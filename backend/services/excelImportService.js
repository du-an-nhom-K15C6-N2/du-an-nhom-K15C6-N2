/**
 * Service xử lý nhập người dùng hàng loạt từ tệp Excel (DNKN-16/17)
 * Chức năng: Tạo file mẫu, đọc dữ liệu, validate từng dòng, thực hiện import
 */

const XLSX = require('xlsx');
const crypto = require('crypto');
const { hashPassword } = require('../security/password');
const { sendActivationEmail } = require('./accountActivationMailer');
const config = require('../config/app.config');
const {
  ROLE_CATALOG,
  isValidRoleAssignment
} = require('../config/rolePermissions');

const ALLOWED_ROLES = new Set(Object.keys(ROLE_CATALOG));
const ROLE_LABELS = Object.fromEntries(
  Object.entries(ROLE_CATALOG).map(([role, def]) => [role, def.label])
);

// ============================================================
// CỘT TRONG FILE EXCEL MẪU
// ============================================================
const TEMPLATE_COLUMNS = [
  { header: 'Họ và Tên (*)', key: 'name', width: 28 },
  { header: 'Email (*)', key: 'email', width: 30 },
  { header: 'Số điện thoại', key: 'phone', width: 18 },
  {
    header: `Vai trò (*) [${Object.keys(ROLE_CATALOG).join(' / ')}]`,
    key: 'role',
    width: 40
  }
];

const COLUMN_KEYS = TEMPLATE_COLUMNS.map(c => c.key);

// ============================================================
// TẠO FILE EXCEL MẪU
// ============================================================
function generateTemplateBuffer() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Dữ liệu mẫu
  const headerRow = TEMPLATE_COLUMNS.map(c => c.header);
  const exampleRows = [
    ['Nguyễn Văn An', 'an.nguyen@edu.vn', '0901234567', 'student'],
    ['Trần Thị Mai', 'mai.tran@edu.vn', '0912345678', 'teacher'],
    ['Lê Quốc Hùng', 'hung.le@edu.vn', '', 'assistant']
  ];

  const wsData = [headerRow, ...exampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Đặt độ rộng cột
  ws['!cols'] = TEMPLATE_COLUMNS.map(c => ({ wch: c.width }));

  // Làm nổi bật dòng tiêu đề
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellAddr]) continue;
    ws[cellAddr].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '2563EB' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
    };
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Danh sách người dùng');

  // Sheet 2: Hướng dẫn
  const guideData = [
    ['HƯỚNG DẪN NHẬP LIỆU'],
    [],
    ['Cột', 'Bắt buộc', 'Mô tả'],
    ['Họ và Tên', 'Có', 'Tên đầy đủ, tối đa 120 ký tự'],
    ['Email', 'Có', 'Địa chỉ email hợp lệ, không trùng trong hệ thống'],
    ['Số điện thoại', 'Không', 'Số điện thoại, tối đa 32 ký tự'],
    [
      'Vai trò',
      'Có',
      `Một trong các giá trị: ${Object.entries(ROLE_CATALOG)
        .map(([k, v]) => `${k} (${v.label})`)
        .join(', ')}`
    ],
    [],
    ['Lưu ý:'],
    ['- Dòng đầu tiên là tiêu đề cột, KHÔNG xóa hoặc sửa dòng này.'],
    ['- Mỗi email chỉ được nhập một lần trong file.'],
    ['- Học sinh (student) và Giáo viên (teacher) không thể kết hợp với vai trò khác.'],
    ['- Sau khi import, hệ thống sẽ gửi email kích hoạt đến từng người dùng.']
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guideData);
  wsGuide['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Hướng dẫn');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ============================================================
// ĐỌC VÀ PARSE FILE EXCEL
// ============================================================
function parseExcelBuffer(buffer) {
  let wb;
  try {
    wb = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    throw new Error('Không thể đọc tệp Excel. Vui lòng kiểm tra định dạng tệp.');
  }

  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new Error('Tệp Excel không có sheet dữ liệu.');
  }

  const ws = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (rawRows.length < 2) {
    throw new Error('Tệp Excel không có dữ liệu (chỉ có dòng tiêu đề hoặc rỗng).');
  }

  // Bỏ qua dòng tiêu đề (dòng 0)
  const dataRows = rawRows.slice(1);

  return dataRows.map((row, idx) => ({
    rowIndex: idx + 2, // dòng thực tế trong Excel (1-indexed + header)
    name: String(row[0] ?? '').trim(),
    email: String(row[1] ?? '').trim().toLowerCase(),
    phone: String(row[2] ?? '').trim(),
    role: String(row[3] ?? '').trim().toLowerCase()
  }));
}

// ============================================================
// VALIDATE TỪNG DÒNG
// ============================================================
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRow(row, existingEmails, seenEmailsInFile) {
  const errors = [];

  // Kiểm tra dòng rỗng hoàn toàn
  if (!row.name && !row.email && !row.phone && !row.role) {
    return { valid: false, skipped: true, errors: ['Dòng rỗng, bỏ qua.'] };
  }

  // Họ tên
  if (!row.name) {
    errors.push('Họ và tên không được để trống.');
  } else if (row.name.length > 120) {
    errors.push('Họ và tên không được vượt quá 120 ký tự.');
  }

  // Email
  if (!row.email) {
    errors.push('Email không được để trống.');
  } else if (row.email.length > 254 || !EMAIL_REGEX.test(row.email)) {
    errors.push('Định dạng email không hợp lệ.');
  } else if (existingEmails.has(row.email)) {
    errors.push(`Email '${row.email}' đã tồn tại trong hệ thống.`);
  } else if (seenEmailsInFile.has(row.email)) {
    errors.push(`Email '${row.email}' bị trùng lặp trong tệp Excel (đã xuất hiện ở dòng trước).`);
  }

  // Số điện thoại (không bắt buộc)
  if (row.phone && row.phone.length > 32) {
    errors.push('Số điện thoại không được vượt quá 32 ký tự.');
  }

  // Vai trò
  if (!row.role) {
    errors.push('Vai trò không được để trống.');
  } else if (!ALLOWED_ROLES.has(row.role)) {
    errors.push(
      `Vai trò '${row.role}' không hợp lệ. Các giá trị hợp lệ: ${[...ALLOWED_ROLES].join(', ')}.`
    );
  } else if (!isValidRoleAssignment([row.role])) {
    errors.push(`Không thể gán vai trò '${row.role}' theo quy tắc phân quyền.`);
  }

  if (errors.length === 0) {
    // Đánh dấu email đã thấy trong file để phát hiện trùng lặp nội bộ
    if (row.email) seenEmailsInFile.add(row.email);
  }

  return {
    valid: errors.length === 0,
    skipped: false,
    errors
  };
}

// ============================================================
// KIỂM TRA TRƯỚC (PREVIEW)
// ============================================================
function previewRows(rows, existingEmails) {
  const seenEmailsInFile = new Set();
  const validRows = [];
  const invalidRows = [];
  const skippedRows = [];

  for (const row of rows) {
    const result = validateRow(row, existingEmails, seenEmailsInFile);

    const entry = {
      rowIndex: row.rowIndex,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      roleLabel: ROLE_LABELS[row.role] || row.role,
      errors: result.errors
    };

    if (result.skipped) {
      skippedRows.push(entry);
    } else if (result.valid) {
      validRows.push(entry);
    } else {
      invalidRows.push(entry);
    }
  }

  return { validRows, invalidRows, skippedRows };
}

// ============================================================
// THỰC HIỆN IMPORT
// ============================================================
async function importRows(validRows, UserModel, baseUrl) {
  const ACTIVATION_TTL_MS = 24 * 60 * 60 * 1000;
  const results = [];

  for (const row of validRows) {
    try {
      // Kiểm tra lần cuối trước khi insert (phòng race condition)
      if (UserModel.findByEmail(row.email)) {
        results.push({
          rowIndex: row.rowIndex,
          name: row.name,
          email: row.email,
          success: false,
          error: `Email '${row.email}' đã tồn tại trong hệ thống (phát hiện ở bước import).`
        });
        continue;
      }

      const temporaryPassword = `${crypto.randomBytes(24).toString('base64url')}Aa1!`;
      const activationToken = crypto.randomBytes(32).toString('hex');

      const newUser = UserModel.create({
        name: row.name,
        email: row.email,
        phone: row.phone || '',
        role: row.role,
        roles: [row.role],
        passwordHash: await hashPassword(temporaryPassword),
        activationTokenHash: crypto.createHash('sha256').update(activationToken).digest('hex'),
        activationExpiresAt: Date.now() + ACTIVATION_TTL_MS
      });

      const activationUrl = `${baseUrl}/activate-account.html?token=${activationToken}`;
      const emailSent = await sendActivationEmail({
        name: newUser.name,
        email: newUser.email,
        activationUrl,
        temporaryPassword
      });

      if (!emailSent) {
        console.info(
          `[Import hàng loạt] Email kích hoạt cho ${newUser.email}: ${activationUrl} | Mật khẩu tạm: ${temporaryPassword}`
        );
      }

      results.push({
        rowIndex: row.rowIndex,
        name: row.name,
        email: row.email,
        success: true,
        userId: newUser.id,
        emailSent
      });
    } catch (err) {
      results.push({
        rowIndex: row.rowIndex,
        name: row.name,
        email: row.email,
        success: false,
        error: err.message || 'Lỗi không xác định khi tạo tài khoản.'
      });
    }
  }

  return results;
}

module.exports = {
  generateTemplateBuffer,
  parseExcelBuffer,
  previewRows,
  importRows,
  TEMPLATE_COLUMNS
};

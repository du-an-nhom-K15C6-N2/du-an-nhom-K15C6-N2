/**
 * Controller xử lý các API nhập người dùng hàng loạt từ Excel (DNKN-16/17)
 *
 * API endpoints:
 *   GET  /api/users/import/template  - Tải tệp Excel mẫu
 *   POST /api/users/import/preview   - Đọc và xem trước dữ liệu từ tệp Excel
 *   POST /api/users/import/confirm   - Thực hiện import các dòng hợp lệ
 */

const multer = require('multer');
const UserModel = require('../models/userModel');
const config = require('../config/app.config');
const {
  generateTemplateBuffer,
  parseExcelBuffer,
  previewRows,
  importRows
} = require('../services/excelImportService');

// Cấu hình multer: lưu vào bộ nhớ, chỉ chấp nhận .xlsx / .xls
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // Tối đa 5 MB
  fileFilter(req, file, cb) {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    const extOk = /\.(xlsx|xls)$/i.test(file.originalname);
    if (allowed.includes(file.mimetype) || extOk) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận tệp Excel (.xlsx hoặc .xls).'));
    }
  }
});

// ============================================================
// HELPER: Lấy base URL của hệ thống
// ============================================================
function getBaseUrl(req) {
  return (
    process.env.RESET_PASSWORD_URL
    || config.RESET_PASSWORD_URL
    || `${req.protocol}://${req.get('host')}`
  ).replace(/\/+$/, '');
}

// ============================================================
// HELPER: Lấy tập email đã tồn tại trong hệ thống
// ============================================================
function getExistingEmailSet() {
  return new Set(
    UserModel.getAllRaw().map(u => u.email.toLowerCase())
  );
}

class ImportUserController {
  /**
   * GET /api/users/import/template
   * Trả về tệp Excel mẫu để quản trị viên điền danh sách người dùng
   */
  static async downloadTemplate(req, res, next) {
    try {
      const buffer = generateTemplateBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="mau-nhap-nguoi-dung.xlsx"');
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/users/import/preview
   * Nhận tệp Excel, đọc dữ liệu và trả về kết quả xem trước kèm báo lỗi từng dòng
   */
  static uploadMiddleware() {
    return upload.single('file');
  }

  static async previewImport(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng tải lên tệp Excel (.xlsx hoặc .xls).'
        });
      }

      let rows;
      try {
        rows = parseExcelBuffer(req.file.buffer);
      } catch (parseErr) {
        return res.status(422).json({
          success: false,
          message: parseErr.message
        });
      }

      if (rows.length === 0) {
        return res.status(422).json({
          success: false,
          message: 'Tệp Excel không có dữ liệu để nhập.'
        });
      }

      const existingEmails = getExistingEmailSet();
      const { validRows, invalidRows, skippedRows } = previewRows(rows, existingEmails);

      return res.status(200).json({
        success: true,
        data: {
          totalRows: rows.length - skippedRows.length,
          validCount: validRows.length,
          invalidCount: invalidRows.length,
          skippedCount: skippedRows.length,
          validRows,
          invalidRows,
          skippedRows
        },
        message: `Xem trước hoàn tất: ${validRows.length} dòng hợp lệ, ${invalidRows.length} dòng lỗi.`
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/users/import/confirm
   * Thực hiện import các dòng hợp lệ, bỏ qua dòng lỗi
   * Body: { rows: [ { rowIndex, name, email, phone, role } ] }
   */
  static async confirmImport(req, res, next) {
    try {
      const { rows } = req.body || {};

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Không có dữ liệu hợp lệ để nhập. Vui lòng tải lên tệp và xem trước trước khi xác nhận.'
        });
      }

      // Giới hạn số dòng mỗi lần import
      if (rows.length > 500) {
        return res.status(400).json({
          success: false,
          message: 'Không được nhập quá 500 dòng trong một lần. Vui lòng chia nhỏ tệp Excel.'
        });
      }

      // Validate lại toàn bộ dòng trước khi import (double-check)
      const existingEmails = getExistingEmailSet();
      const seenEmailsInFile = new Set();
      const toImport = [];
      const preRejected = [];

      for (const row of rows) {
        const name = String(row.name || '').trim();
        const email = String(row.email || '').trim().toLowerCase();
        const phone = String(row.phone || '').trim();
        const role = String(row.role || '').trim().toLowerCase();
        const rowIndex = Number(row.rowIndex) || 0;

        const errors = [];

        if (!name || name.length > 120) errors.push('Họ và tên không hợp lệ.');
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
          errors.push('Email không hợp lệ.');
        } else if (existingEmails.has(email)) {
          errors.push(`Email '${email}' đã tồn tại trong hệ thống.`);
        } else if (seenEmailsInFile.has(email)) {
          errors.push(`Email '${email}' bị trùng lặp trong danh sách nhập.`);
        }

        const { isValidRoleAssignment, ROLE_CATALOG } = require('../config/rolePermissions');
        const ALLOWED = new Set(Object.keys(ROLE_CATALOG));
        if (!role || !ALLOWED.has(role) || !isValidRoleAssignment([role])) {
          errors.push(`Vai trò '${role}' không hợp lệ.`);
        }

        if (errors.length > 0) {
          preRejected.push({ rowIndex, name, email, errors });
        } else {
          seenEmailsInFile.add(email);
          toImport.push({ rowIndex, name, email, phone, role });
        }
      }

      if (toImport.length === 0) {
        return res.status(422).json({
          success: false,
          message: 'Không có dòng nào hợp lệ để nhập sau khi kiểm tra lại.',
          data: { successCount: 0, failedCount: preRejected.length, results: preRejected }
        });
      }

      const baseUrl = getBaseUrl(req);
      const importResults = await importRows(toImport, UserModel, baseUrl);

      const successResults = importResults.filter(r => r.success);
      const failedResults = [
        ...preRejected.map(r => ({ ...r, success: false, error: r.errors.join(' ') })),
        ...importResults.filter(r => !r.success)
      ];

      return res.status(200).json({
        success: true,
        data: {
          totalSubmitted: rows.length,
          successCount: successResults.length,
          failedCount: failedResults.length,
          successResults,
          failedResults
        },
        message: `Import hoàn tất: ${successResults.length} tài khoản đã được tạo, ${failedResults.length} dòng bị bỏ qua.`
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ImportUserController;

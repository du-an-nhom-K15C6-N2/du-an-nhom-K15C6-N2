/**
 * tests/importUsers.test.js
 * QA: Kiểm thử toàn bộ luồng nhập người dùng hàng loạt từ Excel (DNKN-16/17)
 *
 * Chạy: node --test tests/importUsers.test.js
 * Yêu cầu: Node.js >= 18 (built-in test runner)
 */

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const XLSX = require('xlsx');

// ============================================================
// IMPORT SERVICE DƯỚI TEST
// ============================================================
const {
  generateTemplateBuffer,
  parseExcelBuffer,
  previewRows,
  importRows
} = require('../backend/services/excelImportService');

// ============================================================
// HELPERS
// ============================================================
function makeExcelBuffer(rows, includeHeader = true) {
  const header = ['Họ và Tên (*)', 'Email (*)', 'Số điện thoại', `Vai trò (*) [admin / teacher / assistant / student / manager / accountant / department_head / training_staff]`];
  const data = includeHeader ? [header, ...rows] : rows;
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ============================================================
// MOCK UserModel
// ============================================================
function makeMockUserModel(existingEmails = []) {
  const existingSet = new Set(existingEmails.map(e => e.toLowerCase()));
  const created = [];

  return {
    getAllRaw: () => [...existingEmails].map(email => ({ email })),
    findByEmail: (email) => existingSet.has(email.toLowerCase()) ? { email } : null,
    create: (data) => {
      if (existingSet.has(data.email)) throw new Error(`Email '${data.email}' đã tồn tại.`);
      existingSet.add(data.email);
      const user = { id: `usr_test_${Date.now()}_${Math.random()}`, ...data };
      created.push(user);
      return user;
    },
    _created: created
  };
}

// ============================================================
// TESTS
// ============================================================

describe('[QA] DNKN-16/17 – Nhập người dùng hàng loạt từ Excel', () => {

  // -----------------------------------------------------------
  // 1. TẠO FILE MẪU
  // -----------------------------------------------------------
  describe('1. Tải tệp Excel mẫu', () => {
    test('generateTemplateBuffer trả về buffer hợp lệ', () => {
      const buf = generateTemplateBuffer();
      assert.ok(Buffer.isBuffer(buf), 'Kết quả phải là Buffer');
      assert.ok(buf.length > 0, 'Buffer không được rỗng');
    });

    test('Buffer có thể đọc lại bằng xlsx', () => {
      const buf = generateTemplateBuffer();
      const wb = XLSX.read(buf, { type: 'buffer' });
      assert.ok(wb.SheetNames.length >= 1, 'Phải có ít nhất 1 sheet');
      assert.equal(wb.SheetNames[0], 'Danh sách người dùng');
    });

    test('Sheet mẫu có dòng tiêu đề và dữ liệu ví dụ', () => {
      const buf = generateTemplateBuffer();
      const wb = XLSX.read(buf, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      assert.ok(rows.length >= 2, 'Phải có ít nhất 1 dòng dữ liệu ví dụ ngoài tiêu đề');
      const header = rows[0];
      assert.ok(header.some(h => String(h).includes('Họ và Tên')), 'Cột Họ và Tên phải có trong tiêu đề');
      assert.ok(header.some(h => String(h).includes('Email')), 'Cột Email phải có trong tiêu đề');
      assert.ok(header.some(h => String(h).includes('Vai trò')), 'Cột Vai trò phải có trong tiêu đề');
    });
  });

  // -----------------------------------------------------------
  // 2. ĐỌC DỮ LIỆU TỪ FILE EXCEL
  // -----------------------------------------------------------
  describe('2. Đọc dữ liệu từ tệp Excel', () => {
    test('parseExcelBuffer đọc đúng các dòng dữ liệu', () => {
      const buf = makeExcelBuffer([
        ['Nguyễn Văn An', 'an@edu.vn', '0901234567', 'student'],
        ['Trần Thị Mai', 'mai@edu.vn', '0912345678', 'teacher']
      ]);
      const rows = parseExcelBuffer(buf);
      assert.equal(rows.length, 2);
      assert.equal(rows[0].name, 'Nguyễn Văn An');
      assert.equal(rows[0].email, 'an@edu.vn');
      assert.equal(rows[0].phone, '0901234567');
      assert.equal(rows[0].role, 'student');
      assert.equal(rows[1].email, 'mai@edu.vn');
    });

    test('parseExcelBuffer chuyển email thành chữ thường', () => {
      const buf = makeExcelBuffer([['Test User', 'TEST@EDU.VN', '', 'student']]);
      const rows = parseExcelBuffer(buf);
      assert.equal(rows[0].email, 'test@edu.vn');
    });

    test('parseExcelBuffer gán đúng rowIndex bắt đầu từ 2', () => {
      const buf = makeExcelBuffer([['Name A', 'a@edu.vn', '', 'student']]);
      const rows = parseExcelBuffer(buf);
      assert.equal(rows[0].rowIndex, 2);
    });

    test('parseExcelBuffer ném lỗi nếu buffer không hợp lệ (không có dữ liệu)', () => {
      // xlsx có thể parse được buffer random nhưng sheet sẽ rỗng
      // → sẽ ném lỗi "không có dữ liệu" hoặc "không thể đọc"
      assert.throws(
        () => parseExcelBuffer(Buffer.from('not an excel file')),
        (err) => {
          const msg = err.message || '';
          return /không có dữ liệu|không thể đọc|không có sheet/i.test(msg);
        },
        'Phải ném lỗi khi buffer không phải Excel hợp lệ'
      );
    });

    test('parseExcelBuffer ném lỗi nếu file chỉ có header', () => {
      const buf = makeExcelBuffer([]);
      assert.throws(
        () => parseExcelBuffer(buf),
        /không có dữ liệu/i
      );
    });
  });

  // -----------------------------------------------------------
  // 3. VALIDATE TỪNG DÒNG
  // -----------------------------------------------------------
  describe('3. Kiểm tra hợp lệ từng dòng', () => {
    test('Dòng hợp lệ được đưa vào validRows', () => {
      const rows = [
        { rowIndex: 2, name: 'Nguyễn Văn An', email: 'an@edu.vn', phone: '0901234567', role: 'student' }
      ];
      const existingEmails = new Set();
      const { validRows, invalidRows } = previewRows(rows, existingEmails);
      assert.equal(validRows.length, 1);
      assert.equal(invalidRows.length, 0);
    });

    test('Thiếu tên bị báo lỗi', () => {
      const rows = [{ rowIndex: 2, name: '', email: 'a@edu.vn', phone: '', role: 'student' }];
      const { invalidRows } = previewRows(rows, new Set());
      assert.equal(invalidRows.length, 1);
      assert.ok(invalidRows[0].errors.some(e => /Họ và tên/.test(e)));
    });

    test('Email sai định dạng bị báo lỗi', () => {
      const rows = [{ rowIndex: 2, name: 'Test', email: 'not-an-email', phone: '', role: 'student' }];
      const { invalidRows } = previewRows(rows, new Set());
      assert.equal(invalidRows.length, 1);
      assert.ok(invalidRows[0].errors.some(e => /email/i.test(e)));
    });

    test('Email trùng với hệ thống bị báo lỗi', () => {
      const rows = [{ rowIndex: 2, name: 'Test', email: 'existing@edu.vn', phone: '', role: 'student' }];
      const existingEmails = new Set(['existing@edu.vn']);
      const { invalidRows } = previewRows(rows, existingEmails);
      assert.equal(invalidRows.length, 1);
      assert.ok(invalidRows[0].errors.some(e => /đã tồn tại/i.test(e)));
    });

    test('Email trùng lặp trong file bị báo lỗi ở dòng thứ hai', () => {
      const rows = [
        { rowIndex: 2, name: 'User A', email: 'dup@edu.vn', phone: '', role: 'student' },
        { rowIndex: 3, name: 'User B', email: 'dup@edu.vn', phone: '', role: 'teacher' }
      ];
      const { validRows, invalidRows } = previewRows(rows, new Set());
      assert.equal(validRows.length, 1);
      assert.equal(invalidRows.length, 1);
      assert.equal(invalidRows[0].rowIndex, 3);
      assert.ok(invalidRows[0].errors.some(e => /trùng lặp/i.test(e)));
    });

    test('Vai trò không hợp lệ bị báo lỗi', () => {
      const rows = [{ rowIndex: 2, name: 'Test', email: 'test@edu.vn', phone: '', role: 'unknown_role' }];
      const { invalidRows } = previewRows(rows, new Set());
      assert.equal(invalidRows.length, 1);
      assert.ok(invalidRows[0].errors.some(e => /vai trò/i.test(e)));
    });

    test('Dòng rỗng hoàn toàn được bỏ qua', () => {
      const rows = [
        { rowIndex: 2, name: '', email: '', phone: '', role: '' },
        { rowIndex: 3, name: 'Valid User', email: 'valid@edu.vn', phone: '', role: 'student' }
      ];
      const { validRows, skippedRows } = previewRows(rows, new Set());
      assert.equal(skippedRows.length, 1);
      assert.equal(validRows.length, 1);
    });

    test('Nhiều lỗi cùng một dòng được báo đủ', () => {
      const rows = [{ rowIndex: 2, name: '', email: 'bad-email', phone: '', role: 'bad_role' }];
      const { invalidRows } = previewRows(rows, new Set());
      assert.ok(invalidRows[0].errors.length >= 2, 'Phải có ít nhất 2 lỗi');
    });

    test('Số điện thoại quá dài bị báo lỗi', () => {
      const rows = [{ rowIndex: 2, name: 'Test', email: 'test@edu.vn', phone: 'x'.repeat(33), role: 'student' }];
      const { invalidRows } = previewRows(rows, new Set());
      assert.ok(invalidRows.some(r => r.errors.some(e => /điện thoại/i.test(e))));
    });
  });

  // -----------------------------------------------------------
  // 4. XEM TRƯỚC
  // -----------------------------------------------------------
  describe('4. Xem trước (preview)', () => {
    test('previewRows phân loại đúng valid/invalid/skipped', () => {
      const rows = [
        { rowIndex: 2, name: 'Valid User', email: 'valid@edu.vn', phone: '', role: 'student' },
        { rowIndex: 3, name: '', email: '', phone: '', role: '' },            // skipped
        { rowIndex: 4, name: '', email: 'bad', phone: '', role: 'none' }     // invalid
      ];
      const result = previewRows(rows, new Set());
      assert.equal(result.validRows.length, 1);
      assert.equal(result.skippedRows.length, 1);
      assert.equal(result.invalidRows.length, 1);
    });
  });

  // -----------------------------------------------------------
  // 5. IMPORT THỰC TẾ (bỏ qua dòng lỗi)
  // -----------------------------------------------------------
  describe('5. Thực hiện import (bỏ qua dòng lỗi)', () => {
    test('Dòng hợp lệ được tạo thành công', async () => {
      const UserModel = makeMockUserModel([]);
      const toImport = [
        { rowIndex: 2, name: 'Import User 1', email: 'import1@edu.vn', phone: '0901234567', role: 'student' }
      ];
      const results = await importRows(toImport, UserModel, 'http://localhost:3000');
      assert.equal(results.length, 1);
      assert.equal(results[0].success, true);
      assert.equal(results[0].email, 'import1@edu.vn');
    });

    test('Dòng có email đã tồn tại trong DB được ghi nhận thất bại, không gây crash', async () => {
      const UserModel = makeMockUserModel(['existing@edu.vn']);
      const toImport = [
        { rowIndex: 2, name: 'Existing User', email: 'existing@edu.vn', phone: '', role: 'student' },
        { rowIndex: 3, name: 'New User', email: 'new@edu.vn', phone: '', role: 'student' }
      ];
      const results = await importRows(toImport, UserModel, 'http://localhost:3000');
      const failed = results.filter(r => !r.success);
      const success = results.filter(r => r.success);
      assert.equal(failed.length, 1, 'Phải có 1 dòng thất bại');
      assert.equal(success.length, 1, 'Phải có 1 dòng thành công');
      assert.ok(failed[0].error, 'Dòng thất bại phải có thông báo lỗi');
    });

    test('Import nhiều dòng hợp lệ không xung đột', async () => {
      const UserModel = makeMockUserModel([]);
      const toImport = Array.from({ length: 5 }, (_, i) => ({
        rowIndex: i + 2,
        name: `User ${i + 1}`,
        email: `user${i + 1}@edu.vn`,
        phone: '',
        role: 'student'
      }));
      const results = await importRows(toImport, UserModel, 'http://localhost:3000');
      assert.equal(results.filter(r => r.success).length, 5);
    });

    test('Import dòng không hợp lệ (model throw) được ghi nhận, không crash toàn bộ', async () => {
      const UserModel = makeMockUserModel([]);
      UserModel.create = () => { throw new Error('DB error'); };
      const toImport = [{ rowIndex: 2, name: 'Test', email: 'test@edu.vn', phone: '', role: 'student' }];
      const results = await importRows(toImport, UserModel, 'http://localhost:3000');
      assert.equal(results[0].success, false);
      assert.ok(results[0].error);
    });
  });

  // -----------------------------------------------------------
  // 6. BÁO CÁO TỔNG KẾT (logic)
  // -----------------------------------------------------------
  describe('6. Báo cáo tổng kết', () => {
    test('Kết quả import phân biệt đúng success vs failed', async () => {
      const UserModel = makeMockUserModel(['exist@edu.vn']);
      const toImport = [
        { rowIndex: 2, name: 'OK User', email: 'ok@edu.vn', phone: '', role: 'student' },
        { rowIndex: 3, name: 'Dup User', email: 'exist@edu.vn', phone: '', role: 'student' }
      ];
      const results = await importRows(toImport, UserModel, 'http://localhost:3000');
      const successCount = results.filter(r => r.success).length;
      const failedCount  = results.filter(r => !r.success).length;
      assert.equal(successCount, 1);
      assert.equal(failedCount, 1);
    });
  });

  // -----------------------------------------------------------
  // 7. LUỒNG TÍCH HỢP ĐẦU ĐẦU
  // -----------------------------------------------------------
  describe('7. Luồng tích hợp end-to-end (unit)', () => {
    test('Tạo Excel → Parse → Preview → Import dữ liệu hỗn hợp', async () => {
      // Tạo buffer với 4 dòng: 1 hợp lệ, 1 email trùng hệ thống, 1 role sai, 1 email trùng file
      const buf = makeExcelBuffer([
        ['User OK',     'ok@edu.vn',          '0901234567', 'student'],    // hợp lệ
        ['User Exist',  'existing@edu.vn',     '0912345678', 'teacher'],   // email đã tồn tại
        ['User Bad',    'bad@edu.vn',          '',           'invalid_r'],  // role sai
        ['User DupOK',  'ok@edu.vn',           '',           'student']    // email trùng file
      ]);

      const rows = parseExcelBuffer(buf);
      assert.equal(rows.length, 4);

      const existingEmails = new Set(['existing@edu.vn']);
      const { validRows, invalidRows } = previewRows(rows, existingEmails);

      assert.equal(validRows.length, 1, '1 dòng hợp lệ');
      assert.equal(invalidRows.length, 3, '3 dòng lỗi');

      // Import chỉ dòng hợp lệ
      const UserModel = makeMockUserModel(['existing@edu.vn']);
      const importResults = await importRows(validRows, UserModel, 'http://localhost:3000');
      assert.equal(importResults.filter(r => r.success).length, 1);
      assert.equal(importResults.filter(r => !r.success).length, 0);
    });

    test('Import 0 dòng hợp lệ trả về mảng rỗng', async () => {
      const UserModel = makeMockUserModel([]);
      const results = await importRows([], UserModel, 'http://localhost:3000');
      assert.deepEqual(results, []);
    });
  });
});

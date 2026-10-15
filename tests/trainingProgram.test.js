const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Setup isolated test file
const testDataDir = path.resolve(__dirname, '../scratch/test-data');
if (!fs.existsSync(testDataDir)) fs.mkdirSync(testDataDir, { recursive: true });

const testProgramsFile = path.join(testDataDir, 'test-training-programs.json');
const testClassesFile = path.join(testDataDir, 'test-classes.json');
const testUsersFile = path.join(testDataDir, 'test-users.json');

process.env.TRAINING_PROGRAMS_DATA_FILE = testProgramsFile;
process.env.CLASS_DATA_FILE = testClassesFile;
process.env.DATA_FILE = testUsersFile;

const { app } = require('../backend/server');
const { createToken } = require('../backend/security/token');
const UserModel = require('../backend/models/userModel');

let server;
let baseUrl;
let managerToken;
let adminToken;
let studentToken;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('Training Programs Management - Unit & Integration Tests', () => {
  before(async () => {
    // 1. Setup seed users: Manager, Admin, Student
    const testUsers = [
      { id: 'usr_mgr_test', name: 'Quản lý đào tạo', email: 'manager.test@edu.vn', role: 'manager', roles: ['manager'], status: 'active' },
      { id: 'usr_adm_test', name: 'Quản trị viên', email: 'admin.test@edu.vn', role: 'admin', roles: ['admin'], status: 'active' },
      { id: 'usr_std_test', name: 'Học sinh', email: 'student.test@edu.vn', role: 'student', roles: ['student'], status: 'active' }
    ];
    fs.writeFileSync(testUsersFile, JSON.stringify(testUsers, null, 2), 'utf8');

    // 2. Setup seed classes: One linked to tp_linked, one unlinked
    const testClasses = [
      { id: 'cls_001', code: 'L01', name: 'Lớp Lập trình Web', trainingProgramId: 'tp_linked', status: 'active' },
      { id: 'cls_002', code: 'L02', name: 'Lớp Lập trình Di động', trainingProgramId: 'tp_linked', status: 'active' }
    ];
    fs.writeFileSync(testClassesFile, JSON.stringify(testClasses, null, 2), 'utf8');

    // 3. Setup seed training programs
    const testPrograms = [
      {
        id: 'tp_linked',
        code: 'PROG-LINKED',
        name: 'Chương trình đã có lớp',
        description: 'Chương trình này đang liên kết 2 lớp học',
        duration: 90,
        standard_tuition: 12000000,
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'tp_unlinked',
        code: 'PROG-FREE',
        name: 'Chương trình độc lập',
        description: 'Chương trình chưa có lớp học nào',
        duration: 40,
        standard_tuition: 5000000,
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'tp_inactive',
        code: 'PROG-INACTIVE',
        name: 'Chương trình tạm dừng',
        description: 'Đã ngừng áp dụng',
        duration: 60,
        standard_tuition: 7000000,
        status: 'INACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    fs.writeFileSync(testProgramsFile, JSON.stringify(testPrograms, null, 2), 'utf8');

    // Generate tokens
    managerToken = createToken({ id: 'usr_mgr_test', role: 'manager', roles: ['manager'] });
    adminToken = createToken({ id: 'usr_adm_test', role: 'admin', roles: ['admin'] });
    studentToken = createToken({ id: 'usr_std_test', role: 'student', roles: ['student'] });

    // Start ephemeral test server
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    // Clean up test files
    try {
      if (fs.existsSync(testProgramsFile)) fs.unlinkSync(testProgramsFile);
      if (fs.existsSync(testClassesFile)) fs.unlinkSync(testClassesFile);
      if (fs.existsSync(testUsersFile)) fs.unlinkSync(testUsersFile);
    } catch {}
  });

  // --- TEST CASE 1: Lấy danh sách (GET /api/v1/training-programs) ---
  test('1. [GET /api/v1/training-programs] Lấy danh sách chương trình có phân trang và thông tin lớp liên kết', async () => {
    const res = await request('GET', '/api/v1/training-programs', null, managerToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(res.body.data.length, 3);
    assert.ok(res.body.pagination);

    const linkedProg = res.body.data.find(p => p.id === 'tp_linked');
    assert.ok(linkedProg);
    assert.equal(linkedProg.hasClassLinked, true);
    assert.equal(linkedProg.linkedClassesCount, 2);

    const unlinkedProg = res.body.data.find(p => p.id === 'tp_unlinked');
    assert.ok(unlinkedProg);
    assert.equal(unlinkedProg.hasClassLinked, false);
    assert.equal(unlinkedProg.linkedClassesCount, 0);
  });

  test('2. [GET /api/v1/training-programs?status=ACTIVE] Lọc theo trạng thái hoạt động', async () => {
    const res = await request('GET', '/api/v1/training-programs?status=ACTIVE', null, managerToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 2);
    assert.ok(res.body.data.every(p => p.status === 'ACTIVE'));
  });

  test('3. [GET /api/v1/training-programs?search=FREE] Tìm kiếm theo mã chương trình', async () => {
    const res = await request('GET', '/api/v1/training-programs?search=FREE', null, managerToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].code, 'PROG-FREE');
  });

  // --- TEST CASE 2: Chi tiết 1 chương trình (GET /api/v1/training-programs/:id) ---
  test('4. [GET /api/v1/training-programs/:id] Lấy chi tiết kèm danh sách lớp liên kết', async () => {
    const res = await request('GET', '/api/v1/training-programs/tp_linked', null, managerToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.id, 'tp_linked');
    assert.equal(res.body.data.hasClassLinked, true);
    assert.equal(res.body.data.linkedClasses.length, 2);
  });

  test('5. [GET /api/v1/training-programs/:id] Trả về 404 khi ID không tồn tại', async () => {
    const res = await request('GET', '/api/v1/training-programs/tp_non_existent', null, managerToken);
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });

  // --- TEST CASE 3: Tạo mới (POST /api/v1/training-programs) ---
  test('6. [POST /api/v1/training-programs] Tạo mới thành công với thông tin hợp lệ', async () => {
    const newProg = {
      code: 'PROG-AI-2026',
      name: 'Trí tuệ nhân tạo chuyên sâu',
      description: 'Khóa học AI thực chiến',
      duration: 100,
      standard_tuition: 20000000,
      status: 'ACTIVE'
    };

    const res = await request('POST', '/api/v1/training-programs', newProg, managerToken);
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.code, 'PROG-AI-2026');
    assert.ok(res.body.data.id);
    assert.ok(res.body.data.created_at);
  });

  test('7. [POST /api/v1/training-programs] Từ chối khi trùng mã chương trình (Quy tắc 1)', async () => {
    const duplicateProg = {
      code: 'PROG-LINKED', // Đã tồn tại
      name: 'Trùng mã chương trình',
      duration: 50,
      standard_tuition: 10000000
    };

    const res = await request('POST', '/api/v1/training-programs', duplicateProg, managerToken);
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /đã tồn tại/i);
  });

  test('8. [POST /api/v1/training-programs] Validation dữ liệu: thời lượng <= 0 hoặc học phí < 0', async () => {
    const invalidDuration = { code: 'PROG-BAD-1', name: 'Test', duration: 0, standard_tuition: 1000 };
    const resDuration = await request('POST', '/api/v1/training-programs', invalidDuration, managerToken);
    assert.equal(resDuration.status, 400);
    assert.match(resDuration.body.message, /lớn hơn 0/i);

    const invalidTuition = { code: 'PROG-BAD-2', name: 'Test', duration: 10, standard_tuition: -500 };
    const resTuition = await request('POST', '/api/v1/training-programs', invalidTuition, managerToken);
    assert.equal(resTuition.status, 400);
    assert.match(resTuition.body.message, /lớn hơn hoặc bằng 0/i);
  });

  // --- TEST CASE 4: Cập nhật (PUT /api/v1/training-programs/:id) ---
  test('9. [PUT /api/v1/training-programs/:id] Cập nhật thông tin thành công', async () => {
    const updateData = {
      name: 'Chương trình độc lập - Đã đổi tên',
      duration: 50,
      standard_tuition: 6000000
    };

    const res = await request('PUT', '/api/v1/training-programs/tp_unlinked', updateData, managerToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.name, 'Chương trình độc lập - Đã đổi tên');
    assert.equal(res.body.data.duration, 50);
  });

  test('10. [PUT /api/v1/training-programs/:id] Chặn không cho sửa mã chương trình sau khi tạo (Quy tắc Ràng buộc)', async () => {
    const changeCodeData = {
      code: 'PROG-NEW-CODE-HACKED',
      name: 'Cố tình sửa mã'
    };

    const res = await request('PUT', '/api/v1/training-programs/tp_unlinked', changeCodeData, managerToken);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /không được phép thay đổi/i);
  });

  // --- TEST CASE 5: Đổi trạng thái (PATCH /api/v1/training-programs/:id/status) ---
  test('11. [PATCH /api/v1/training-programs/:id/status] Đổi trạng thái sang INACTIVE và ngược lại', async () => {
    const res1 = await request('PATCH', '/api/v1/training-programs/tp_unlinked/status', { status: 'INACTIVE' }, managerToken);
    assert.equal(res1.status, 200);
    assert.equal(res1.body.data.status, 'INACTIVE');

    // Toggle ngược lại
    const res2 = await request('PATCH', '/api/v1/training-programs/tp_unlinked/status', {}, managerToken);
    assert.equal(res2.status, 200);
    assert.equal(res2.body.data.status, 'ACTIVE');
  });

  // --- TEST CASE 6: Xóa chương trình & Quy tắc nghiệp vụ lớp học (DELETE /api/v1/training-programs/:id) ---
  test('12. [DELETE /api/v1/training-programs/:id] Chặn xóa khi ĐÃ CÓ LỚP HỌC (Quy tắc 2 - Trả lỗi 400 chuẩn thông điệp)', async () => {
    const res = await request('DELETE', '/api/v1/training-programs/tp_linked', null, managerToken);
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'HAS_LINKED_CLASSES');
    assert.equal(
      res.body.message,
      'Chương trình đang có lớp học, không được phép xóa. Hãy chuyển sang trạng thái Ngừng áp dụng.'
    );
  });

  test('13. [DELETE /api/v1/training-programs/:id] Cho phép XÓA CỨNG khi CHƯA có lớp học nào liên kết', async () => {
    const res = await request('DELETE', '/api/v1/training-programs/tp_unlinked', null, managerToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.match(res.body.message, /thành công/i);

    // Kiểm tra đã xóa hoàn toàn khỏi DB
    const checkRes = await request('GET', '/api/v1/training-programs/tp_unlinked', null, managerToken);
    assert.equal(checkRes.status, 404);
  });

  // --- TEST CASE 7: Phục vụ mở lớp học mới (GET /api/v1/training-programs/active-options) ---
  test('14. [GET /api/v1/training-programs/active-options] Chỉ trả về các chương trình ACTIVE (Quy tắc 3)', async () => {
    const res = await request('GET', '/api/v1/training-programs/active-options', null, managerToken);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 1);
    assert.ok(!res.body.data.some(p => p.id === 'tp_inactive'));
  });

  // --- TEST CASE 8: Phân quyền RBAC ---
  test('15. [RBAC] Học sinh/sinh viên bị từ chối quyền thêm/sửa/xóa (403 Forbidden)', async () => {
    const resCreate = await request('POST', '/api/v1/training-programs', { code: 'HACK', name: 'Hack' }, studentToken);
    assert.equal(resCreate.status, 403);

    const resDelete = await request('DELETE', '/api/v1/training-programs/tp_linked', null, studentToken);
    assert.equal(resDelete.status, 403);
  });
});

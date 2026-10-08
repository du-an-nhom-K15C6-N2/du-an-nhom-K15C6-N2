/**
 * [QA] Kiểm thử xem và cập nhật hồ sơ cá nhân (Story DNKN-86 / Task QA DNKN-110)
 * Bộ kiểm thử toàn diện cho các yêu cầu:
 * - Xem thông tin hồ sơ cá nhân (đầy đủ các trường)
 * - Cập nhật thông tin hồ sơ hợp lệ (họ tên, sđt, ngày sinh, địa chỉ)
 * - Chặn sửa email và vai trò (từ chối 400 kèm thông báo rõ ràng)
 * - Kiểm tra định dạng số điện thoại Việt Nam (từ chối số sai định dạng)
 * - Chuẩn hóa số điện thoại Việt Nam khi lưu (+84, dấu phân cách -> định dạng chuẩn 10 chữ số)
 * - Xác thực quyền truy cập (yêu cầu đăng nhập, áp dụng cho mọi vai trò học sinh/giảng viên/admin)
 */

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const { hashPassword } = require('../backend/security/password');

let baseUrl;
let server;
let tempDir;
let dataFile;
let sessionStoreFile;
let loginAttemptStoreFile;
let attendanceDataFile;

let studentToken;
let teacherToken;
let adminToken;

async function api(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  let data;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }
  return { response, data };
}

function jsonRequest(body, token, method = 'POST') {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  };
}

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ttcs-profile-test-'));
  dataFile = path.join(tempDir, 'users.json');
  sessionStoreFile = path.join(tempDir, 'revoked-sessions.json');
  loginAttemptStoreFile = path.join(tempDir, 'login-attempts.json');
  attendanceDataFile = path.join(tempDir, 'attendance.json');

  process.env.DATA_FILE = dataFile;
  process.env.SESSION_STORE_FILE = sessionStoreFile;
  process.env.LOGIN_ATTEMPT_STORE_FILE = loginAttemptStoreFile;
  process.env.ATTENDANCE_DATA_FILE = attendanceDataFile;
  process.env.AUTH_TOKEN_SECRET = 'test-secret-profile-testing';

  const defaultHash = await hashPassword('Password@123');

  await fs.writeFile(dataFile, JSON.stringify([
    {
      id: 'usr_student_01',
      name: 'Nguyễn Văn An',
      fullName: 'Nguyễn Văn An',
      email: 'student@edu.vn',
      phone: '0901234567',
      role: 'student',
      roleLabel: 'Học sinh',
      status: 'active',
      statusLabel: 'Đang hoạt động',
      dob: '2004-03-12',
      address: 'Số 234 Hoàng Quốc Việt, Cầu Giấy, Hà Nội',
      passwordHash: defaultHash
    },
    {
      id: 'usr_teacher_01',
      name: 'ThS. Trần Thị Mai',
      fullName: 'ThS. Trần Thị Mai',
      email: 'teacher@edu.vn',
      phone: '0912345678',
      role: 'teacher',
      roleLabel: 'Giảng viên',
      status: 'active',
      statusLabel: 'Đang hoạt động',
      dob: '1988-10-20',
      address: 'Số 144 Xuân Thủy, Cầu Giấy, Hà Nội',
      passwordHash: defaultHash
    },
    {
      id: 'usr_admin_01',
      name: 'Giáp Văn Hiếu',
      fullName: 'Giáp Văn Hiếu',
      email: 'admin@edu.vn',
      phone: '0981234567',
      role: 'admin',
      roleLabel: 'Quản trị viên',
      status: 'active',
      statusLabel: 'Đang hoạt động',
      dob: '1995-05-15',
      address: 'Hà Nội, Việt Nam',
      passwordHash: defaultHash
    }
  ], null, 2));

  const { app } = require('../backend/server');
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  // Đăng nhập lấy token cho 3 vai trò
  const studentLogin = await api('/api/auth/login', jsonRequest({
    email: 'student@edu.vn',
    password: 'Password@123'
  }));
  studentToken = studentLogin.data.token;

  const teacherLogin = await api('/api/auth/login', jsonRequest({
    email: 'teacher@edu.vn',
    password: 'Password@123'
  }));
  teacherToken = teacherLogin.data.token;

  const adminLogin = await api('/api/auth/login', jsonRequest({
    email: 'admin@edu.vn',
    password: 'Password@123'
  }));
  adminToken = adminLogin.data.token;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

// ====================================================================
// NHÓM 1: KIỂM THỬ XEM HỒ SƠ CÁ NHÂN (GET /api/profile)
// ====================================================================

test('[BE/QA] GET /api/profile yêu cầu xác thực - từ chối khi không có token', async () => {
  const result = await api('/api/profile');
  assert.equal(result.response.status, 401);
  assert.equal(result.data.success, false);
});

test('[BE/QA] GET /api/profile trả về đầy đủ các trường thông tin hồ sơ của người dùng', async () => {
  const result = await api('/api/profile', {
    headers: { Authorization: `Bearer ${studentToken}` }
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.data.success, true);
  const profile = result.data.data;

  // Kiểm tra đầy đủ thông tin: họ tên, email, vai trò, số điện thoại, ngày sinh và địa chỉ
  assert.equal(profile.id, 'usr_student_01');
  assert.equal(profile.name, 'Nguyễn Văn An');
  assert.equal(profile.fullName, 'Nguyễn Văn An');
  assert.equal(profile.email, 'student@edu.vn');
  assert.equal(profile.role, 'student');
  assert.equal(profile.roleLabel, 'Học sinh');
  assert.equal(profile.phone, '0901234567');
  assert.equal(profile.dob, '2004-03-12');
  assert.equal(profile.address, 'Số 234 Hoàng Quốc Việt, Cầu Giấy, Hà Nội');
  assert.equal(profile.status, 'active');
  // Tuyệt đối không để lộ mật khẩu hoặc hash mật khẩu
  assert.equal(profile.passwordHash, undefined);
  assert.equal(profile.password, undefined);
});

// ====================================================================
// NHÓM 2: KIỂM THỬ CẬP NHẬT HỒ SƠ HỢP LỆ (PUT /api/profile)
// ====================================================================

test('[BE/QA] PUT /api/profile cập nhật thành công họ tên, số điện thoại, ngày sinh, địa chỉ', async () => {
  const updatePayload = {
    name: 'Nguyễn Văn An Cập Nhật',
    phone: '0988776655',
    dob: '2004-03-15',
    address: 'Số 99 Cầu Giấy, Hà Nội'
  };

  const result = await api('/api/profile', jsonRequest(updatePayload, studentToken, 'PUT'));

  assert.equal(result.response.status, 200);
  assert.equal(result.data.success, true);
  assert.match(result.data.message, /thành công/i);

  const updated = result.data.data;
  assert.equal(updated.name, 'Nguyễn Văn An Cập Nhật');
  assert.equal(updated.fullName, 'Nguyễn Văn An Cập Nhật');
  assert.equal(updated.phone, '0988776655');
  assert.equal(updated.dob, '2004-03-15');
  assert.equal(updated.address, 'Số 99 Cầu Giấy, Hà Nội');

  // Xác minh dữ liệu đọc lại từ GET /api/profile đã được cập nhật chính xác
  const getRefreshed = await api('/api/profile', {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert.equal(getRefreshed.data.data.name, 'Nguyễn Văn An Cập Nhật');
  assert.equal(getRefreshed.data.data.phone, '0988776655');
  assert.equal(getRefreshed.data.data.dob, '2004-03-15');
  assert.equal(getRefreshed.data.data.address, 'Số 99 Cầu Giấy, Hà Nội');
});

// ====================================================================
// NHÓM 3: CHẶN TỰ ĐỔI EMAIL VÀ VAI TRÒ (IMMUTABLE FIELDS)
// ====================================================================

test('[BE/QA] PUT /api/profile từ chối mọi yêu cầu thay đổi email với mã 400', async () => {
  const maliciousPayload = {
    name: 'Nguyễn Văn An',
    email: 'hacker@edu.vn', // Cố tình đổi email
    phone: '0988776655'
  };

  const result = await api('/api/profile', jsonRequest(maliciousPayload, studentToken, 'PUT'));

  assert.equal(result.response.status, 400);
  assert.equal(result.data.success, false);
  assert.equal(result.data.code, 'EMAIL_IMMUTABLE');
  assert.match(result.data.message, /không được phép thay đổi địa chỉ email/i);

  // Đảm bảo email trong DB không bị thay đổi
  const verify = await api('/api/profile', {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert.equal(verify.data.data.email, 'student@edu.vn');
});

test('[BE/QA] PUT /api/profile cho phép gửi email trùng với email hiện tại (idempotent)', async () => {
  const payload = {
    name: 'Nguyễn Văn An',
    email: 'student@edu.vn', // Giữ nguyên email hiện tại
    phone: '0988776655'
  };

  const result = await api('/api/profile', jsonRequest(payload, studentToken, 'PUT'));
  assert.equal(result.response.status, 200);
  assert.equal(result.data.success, true);
});

test('[BE/QA] PUT /api/profile từ chối mọi yêu cầu thay đổi vai trò (role) với mã 400', async () => {
  const escalatePayload = {
    name: 'Nguyễn Văn An',
    role: 'admin', // Học sinh cố leo quyền thành Admin
    phone: '0988776655'
  };

  const result = await api('/api/profile', jsonRequest(escalatePayload, studentToken, 'PUT'));

  assert.equal(result.response.status, 400);
  assert.equal(result.data.success, false);
  assert.equal(result.data.code, 'ROLE_IMMUTABLE');
  assert.match(result.data.message, /không được phép tự thay đổi vai trò/i);

  // Đảm bảo vai trò trong DB vẫn là student
  const verify = await api('/api/profile', {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert.equal(verify.data.data.role, 'student');
});

// ====================================================================
// NHÓM 4: KIỂM TRA ĐỊNH DẠNG VÀ CHUẨN HÓA SỐ ĐIỆN THOẠI VIỆT NAM
// ====================================================================

test('[BE/QA] PUT /api/profile từ chối số điện thoại sai định dạng (ít số, thừa số, đầu số không hợp lệ)', async () => {
  const invalidPhones = [
    '098123',            // Quá ngắn (6 số)
    '098123456789',       // Quá dài (12 số)
    '0123456789',         // Đầu số 01 (không thuộc dải di động Việt Nam hiện hành)
    '0243123456',         // Số cố định Hà Nội (không phải di động)
    '098123456A',         // Chứa chữ cái
    'abcdefghij',         // Chuỗi chữ cái
    '0481234567'          // Đầu số 04 không tồn tại
  ];

  for (const phone of invalidPhones) {
    const result = await api('/api/profile', jsonRequest({
      name: 'Nguyễn Văn An',
      phone: phone
    }, studentToken, 'PUT'));

    assert.equal(
      result.response.status,
      400,
      `Số điện thoại '${phone}' không hợp lệ nhưng không bị từ chối!`
    );
    assert.equal(result.data.success, false);
    assert.equal(result.data.code, 'INVALID_PHONE_FORMAT');
    assert.match(result.data.message, /định dạng Việt Nam/i);
  }
});

test('[BE/QA] PUT /api/profile chuẩn hóa số điện thoại quốc tế (+84 / 84) và có dấu phân cách về định dạng 10 chữ số chuẩn', async () => {
  const validFormats = [
    { input: '+84981234567', expected: '0981234567' },
    { input: '+84 981 234 567', expected: '0981234567' },
    { input: '84981234567', expected: '0981234567' },
    { input: '098-123-4567', expected: '0981234567' },
    { input: '098.123.4567', expected: '0981234567' },
    { input: '(098) 123 4567', expected: '0981234567' },
    { input: '0381234567', expected: '0381234567' },   // Viettel
    { input: '0701234567', expected: '0701234567' },   // Mobifone
    { input: '0831234567', expected: '0831234567' },   // Vinaphone
    { input: '0561234567', expected: '0561234567' }    // Vietnamobile
  ];

  for (const item of validFormats) {
    const result = await api('/api/profile', jsonRequest({
      name: 'Nguyễn Văn An',
      phone: item.input
    }, studentToken, 'PUT'));

    assert.equal(
      result.response.status,
      200,
      `Số điện thoại hợp lệ '${item.input}' bị từ chối!`
    );
    assert.equal(result.data.success, true);
    assert.equal(
      result.data.data.phone,
      item.expected,
      `Số '${item.input}' không được chuẩn hóa thành '${item.expected}'!`
    );
  }
});

// ====================================================================
// NHÓM 5: RÀNG BUỘC TÊN, NGÀY SINH VÀ PHÂN QUYỀN
// ====================================================================

test('[BE/QA] PUT /api/profile từ chối khi họ và tên rỗng', async () => {
  const result = await api('/api/profile', jsonRequest({
    name: '   ',
    phone: '0981234567'
  }, studentToken, 'PUT'));

  assert.equal(result.response.status, 400);
  assert.equal(result.data.success, false);
  assert.equal(result.data.code, 'INVALID_NAME');
});

test('[BE/QA] PUT /api/profile từ chối ngày sinh trong tương lai', async () => {
  const futureDate = new Date(Date.now() + 86400000 * 365).toISOString().split('T')[0];
  const result = await api('/api/profile', jsonRequest({
    name: 'Nguyễn Văn An',
    phone: '0981234567',
    dob: futureDate
  }, studentToken, 'PUT'));

  assert.equal(result.response.status, 400);
  assert.equal(result.data.success, false);
  assert.equal(result.data.code, 'FUTURE_DOB');
});

test('[BE/QA] Mọi vai trò (Giảng viên, Admin, Học sinh) đều cập nhật được hồ sơ cá nhân của mình', async () => {
  // 1. Giảng viên cập nhật
  const teacherResult = await api('/api/profile', jsonRequest({
    name: 'ThS. Trần Thị Mai (Đã sửa)',
    phone: '0919999888',
    address: 'Đại học Quốc gia Hà Nội'
  }, teacherToken, 'PUT'));

  assert.equal(teacherResult.response.status, 200);
  assert.equal(teacherResult.data.data.name, 'ThS. Trần Thị Mai (Đã sửa)');
  assert.equal(teacherResult.data.data.role, 'teacher');
  assert.equal(teacherResult.data.data.phone, '0919999888');

  // 2. Admin cập nhật
  const adminResult = await api('/api/profile', jsonRequest({
    name: 'Giáp Văn Hiếu (Admin)',
    phone: '0988887777',
    address: 'Trung tâm Quản trị Đào tạo'
  }, adminToken, 'PUT'));

  assert.equal(adminResult.response.status, 200);
  assert.equal(adminResult.data.data.name, 'Giáp Văn Hiếu (Admin)');
  assert.equal(adminResult.data.data.role, 'admin');
  assert.equal(adminResult.data.data.phone, '0988887777');
});

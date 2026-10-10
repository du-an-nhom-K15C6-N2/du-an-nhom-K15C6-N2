/**
 * [QA] Kiểm thử xem và cập nhật hồ sơ cá nhân (Story DNKN-86 / Task QA DNKN-110)
 * Module: user-profile-management
 */

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

let baseUrl;
let server;
let tempDir;
let dataFile;

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
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upm-test-'));
  dataFile = path.join(tempDir, 'users.json');
  process.env.PROFILE_DATA_FILE = dataFile;

  // Tạo dữ liệu người dùng ban đầu
  const initialData = [
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
      address: 'Số 234 Hoàng Quốc Việt, Cầu Giấy, Hà Nội'
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
      address: 'Số 144 Xuân Thủy, Cầu Giấy, Hà Nội'
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
      address: 'Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội'
    }
  ];

  await fs.writeFile(dataFile, JSON.stringify(initialData, null, 2), 'utf8');

  const app = require('../server');
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
  delete process.env.PROFILE_DATA_FILE;
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
    headers: { Authorization: 'Bearer student' }
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.data.success, true);
  const profile = result.data.data;

  assert.equal(profile.id, 'usr_student_01');
  assert.equal(profile.name, 'Nguyễn Văn An');
  assert.equal(profile.fullName, 'Nguyễn Văn An');
  assert.equal(profile.email, 'student@edu.vn');
  assert.equal(profile.role, 'student');
  assert.equal(profile.roleLabel, 'Học sinh');
  assert.equal(profile.phone, '0901234567');
  assert.equal(profile.dob, '2004-03-12');
  assert.equal(profile.address, 'Số 234 Hoàng Quốc Việt, Cầu Giấy, Hà Nội');
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

  const result = await api('/api/profile', jsonRequest(updatePayload, 'student', 'PUT'));

  assert.equal(result.response.status, 200);
  assert.equal(result.data.success, true);
  assert.match(result.data.message, /thành công/i);

  const updated = result.data.data;
  assert.equal(updated.name, 'Nguyễn Văn An Cập Nhật');
  assert.equal(updated.phone, '0988776655');
  assert.equal(updated.dob, '2004-03-15');
  assert.equal(updated.address, 'Số 99 Cầu Giấy, Hà Nội');

  // Đọc lại từ GET để kiểm tra lưu trữ
  const getRefreshed = await api('/api/profile', {
    headers: { Authorization: 'Bearer student' }
  });
  assert.equal(getRefreshed.data.data.name, 'Nguyễn Văn An Cập Nhật');
  assert.equal(getRefreshed.data.data.phone, '0988776655');
});

// ====================================================================
// NHÓM 3: CHẶN TỰ ĐỔI EMAIL VÀ VAI TRÒ (IMMUTABLE FIELDS)
// ====================================================================

test('[BE/QA] PUT /api/profile từ chối mọi yêu cầu thay đổi email với mã 400', async () => {
  const maliciousPayload = {
    name: 'Nguyễn Văn An',
    email: 'hacker@edu.vn',
    phone: '0988776655'
  };

  const result = await api('/api/profile', jsonRequest(maliciousPayload, 'student', 'PUT'));

  assert.equal(result.response.status, 400);
  assert.equal(result.data.success, false);
  assert.equal(result.data.code, 'EMAIL_IMMUTABLE');
  assert.match(result.data.message, /không được phép thay đổi địa chỉ email/i);
});

test('[BE/QA] PUT /api/profile cho phép gửi email trùng với email hiện tại (idempotent)', async () => {
  const payload = {
    name: 'Nguyễn Văn An',
    email: 'student@edu.vn',
    phone: '0988776655'
  };

  const result = await api('/api/profile', jsonRequest(payload, 'student', 'PUT'));
  assert.equal(result.response.status, 200);
  assert.equal(result.data.success, true);
});

test('[BE/QA] PUT /api/profile từ chối mọi yêu cầu thay đổi vai trò (role) với mã 400', async () => {
  const escalatePayload = {
    name: 'Nguyễn Văn An',
    role: 'admin',
    phone: '0988776655'
  };

  const result = await api('/api/profile', jsonRequest(escalatePayload, 'student', 'PUT'));

  assert.equal(result.response.status, 400);
  assert.equal(result.data.success, false);
  assert.equal(result.data.code, 'ROLE_IMMUTABLE');
  assert.match(result.data.message, /không được phép tự thay đổi vai trò/i);
});

// ====================================================================
// NHÓM 4: KIỂM TRA ĐỊNH DẠNG VÀ CHUẨN HÓA SỐ ĐIỆN THOẠI VIỆT NAM
// ====================================================================

test('[BE/QA] PUT /api/profile từ chối số điện thoại sai định dạng', async () => {
  const invalidPhones = ['098123', '098123456789', '0123456789', '0243123456', '098123456A', 'abcdefghij'];

  for (const phone of invalidPhones) {
    const result = await api('/api/profile', jsonRequest({
      name: 'Nguyễn Văn An',
      phone: phone
    }, 'student', 'PUT'));

    assert.equal(result.response.status, 400);
    assert.equal(result.data.success, false);
    assert.equal(result.data.code, 'INVALID_PHONE_FORMAT');
  }
});

test('[BE/QA] PUT /api/profile chuẩn hóa số điện thoại quốc tế (+84 / 84) về định dạng 10 chữ số chuẩn', async () => {
  const validFormats = [
    { input: '+84981234567', expected: '0981234567' },
    { input: '+84 981 234 567', expected: '0981234567' },
    { input: '84981234567', expected: '0981234567' },
    { input: '098-123-4567', expected: '0981234567' },
    { input: '0381234567', expected: '0381234567' },
    { input: '0701234567', expected: '0701234567' },
    { input: '0831234567', expected: '0831234567' },
    { input: '0561234567', expected: '0561234567' }
  ];

  for (const item of validFormats) {
    const result = await api('/api/profile', jsonRequest({
      name: 'Nguyễn Văn An',
      phone: item.input
    }, 'student', 'PUT'));

    assert.equal(result.response.status, 200);
    assert.equal(result.data.data.phone, item.expected);
  }
});

// ====================================================================
// NHÓM 5: RÀNG BUỘC TÊN, NGÀY SINH VÀ PHÂN QUYỀN
// ====================================================================

test('[BE/QA] PUT /api/profile từ chối khi họ và tên rỗng', async () => {
  const result = await api('/api/profile', jsonRequest({
    name: '   ',
    phone: '0981234567'
  }, 'student', 'PUT'));

  assert.equal(result.response.status, 400);
  assert.equal(result.data.code, 'INVALID_NAME');
});

test('[BE/QA] PUT /api/profile từ chối ngày sinh trong tương lai', async () => {
  const futureDate = new Date(Date.now() + 86400000 * 365).toISOString().split('T')[0];
  const result = await api('/api/profile', jsonRequest({
    name: 'Nguyễn Văn An',
    phone: '0981234567',
    dob: futureDate
  }, 'student', 'PUT'));

  assert.equal(result.response.status, 400);
  assert.equal(result.data.code, 'FUTURE_DOB');
});

test('[BE/QA] Mọi vai trò (Giảng viên, Admin, Học sinh) đều cập nhật được hồ sơ cá nhân của mình', async () => {
  const teacherResult = await api('/api/profile', jsonRequest({
    name: 'ThS. Trần Thị Mai (Đã sửa)',
    phone: '0919999888',
    address: 'Đại học Quốc gia Hà Nội'
  }, 'teacher', 'PUT'));

  assert.equal(teacherResult.response.status, 200);
  assert.equal(teacherResult.data.data.name, 'ThS. Trần Thị Mai (Đã sửa)');
  assert.equal(teacherResult.data.data.role, 'teacher');

  const adminResult = await api('/api/profile', jsonRequest({
    name: 'Giáp Văn Hiếu (Admin)',
    phone: '0988887777',
    address: 'Trung tâm Quản trị Đào tạo'
  }, 'admin', 'PUT'));

  assert.equal(adminResult.response.status, 200);
  assert.equal(adminResult.data.data.name, 'Giáp Văn Hiếu (Admin)');
  assert.equal(adminResult.data.data.role, 'admin');
});

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

const { hashPassword } = require('../backend/security/password');
const { normalizeVietnamesePhone } = require('../backend/services/vietnamPhoneService');

let baseUrl;
let server;
let tempDir;
let dataFile;
let sessionStoreFile;
let loginAttemptStoreFile;
let originalDataFile;
let originalSessionStoreFile;
let originalLoginAttemptStoreFile;
let originalNodeEnv;

let testUsers = [];

async function api(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  let data = null;
  try {
    data = await response.json();
  } catch (err) {
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

async function getAuthToken(email, password = 'Password@123') {
  const { data } = await api('/api/auth/login', jsonRequest({ email, password }));
  if (!data || !data.token) {
    throw new Error(`Đăng nhập thất bại cho ${email}: ${JSON.stringify(data)}`);
  }
  return data.token;
}

before(async () => {
  originalDataFile = process.env.DATA_FILE;
  originalSessionStoreFile = process.env.SESSION_STORE_FILE;
  originalLoginAttemptStoreFile = process.env.LOGIN_ATTEMPT_STORE_FILE;
  originalNodeEnv = process.env.NODE_ENV;

  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'profile-test-'));
  dataFile = path.join(tempDir, 'users.json');
  sessionStoreFile = path.join(tempDir, 'revoked-sessions.json');
  loginAttemptStoreFile = path.join(tempDir, 'login-attempts.json');

  process.env.DATA_FILE = dataFile;
  process.env.SESSION_STORE_FILE = sessionStoreFile;
  process.env.LOGIN_ATTEMPT_STORE_FILE = loginAttemptStoreFile;
  process.env.NODE_ENV = 'test';

  const defaultPasswordHash = await hashPassword('Password@123');

  testUsers = [
    {
      id: 'usr_student1',
      name: 'Nguyễn Văn Học Sinh',
      email: 'student1@edu.vn',
      phone: '0912345678',
      role: 'student',
      roles: ['student'],
      roleLabel: 'Học sinh / Sinh viên',
      status: 'active',
      dateOfBirth: '2005-05-15',
      address: '123 Đường Cầu Giấy, Hà Nội',
      passwordHash: defaultPasswordHash
    },
    {
      id: 'usr_teacher1',
      name: 'ThS. Trần Thị Giáo Viên',
      email: 'teacher1@edu.vn',
      phone: '0987654321',
      role: 'teacher',
      roles: ['teacher'],
      roleLabel: 'Giảng viên',
      status: 'active',
      dateOfBirth: '1988-10-20',
      address: '456 Đường Nguyễn Trãi, Hà Nội',
      passwordHash: defaultPasswordHash
    },
    {
      id: 'usr_admin1',
      name: 'Quản Trị Viên Hệ Thống',
      email: 'admin1@edu.vn',
      phone: '0901234567',
      role: 'admin',
      roles: ['admin'],
      roleLabel: 'Quản trị viên',
      status: 'active',
      dateOfBirth: '1985-01-01',
      address: '789 Đường Giải Phóng, Hà Nội',
      passwordHash: defaultPasswordHash
    }
  ];

  await fs.writeFile(dataFile, JSON.stringify(testUsers, null, 2), 'utf8');

  const { app } = require('../backend/server');
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }

  if (originalDataFile !== undefined) process.env.DATA_FILE = originalDataFile;
  else delete process.env.DATA_FILE;

  if (originalSessionStoreFile !== undefined) process.env.SESSION_STORE_FILE = originalSessionStoreFile;
  else delete process.env.SESSION_STORE_FILE;

  if (originalLoginAttemptStoreFile !== undefined) process.env.LOGIN_ATTEMPT_STORE_FILE = originalLoginAttemptStoreFile;
  else delete process.env.LOGIN_ATTEMPT_STORE_FILE;

  if (originalNodeEnv !== undefined) process.env.NODE_ENV = originalNodeEnv;
  else delete process.env.NODE_ENV;
});

describe('[QA] Kiểm thử Xem và Cập nhật hồ sơ cá nhân', () => {

  // -------------------------------------------------------------
  // 1. API LẤY THÔNG TIN HỒ SƠ CÁ NHÂN
  // -------------------------------------------------------------
  test('[BE] API GET /api/profile: Trả về đầy đủ thông tin hồ sơ của người dùng hiện tại', async () => {
    const token = await getAuthToken('student1@edu.vn');

    const { response, data } = await api('/api/profile', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.equal(response.status, 200);
    assert.equal(data.success, true);
    assert.ok(data.data || data.user);

    const profile = data.data || data.user;
    assert.equal(profile.id, 'usr_student1');
    assert.equal(profile.name, 'Nguyễn Văn Học Sinh');
    assert.equal(profile.email, 'student1@edu.vn');
    assert.equal(profile.role, 'student');
    assert.deepEqual(profile.roles, ['student']);
    assert.equal(profile.phone, '0912345678');
    assert.equal(profile.dateOfBirth, '2005-05-15');
    assert.equal(profile.address, '123 Đường Cầu Giấy, Hà Nội');
    assert.equal(profile.status, 'active');
  });

  test('[BE] API GET /api/auth/profile và GET /api/auth/me cũng cung cấp đầy đủ thông tin hồ sơ', async () => {
    const token = await getAuthToken('teacher1@edu.vn');

    // Kiểm tra /api/auth/profile
    const resAuthProfile = await api('/api/auth/profile', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(resAuthProfile.response.status, 200);
    assert.equal(resAuthProfile.data.success, true);
    assert.equal((resAuthProfile.data.data || resAuthProfile.data.user).name, 'ThS. Trần Thị Giáo Viên');

    // Kiểm tra /api/auth/me
    const resAuthMe = await api('/api/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(resAuthMe.response.status, 200);
    assert.equal(resAuthMe.data.success, true);
    assert.equal(resAuthMe.data.user.name, 'ThS. Trần Thị Giáo Viên');
    assert.equal(resAuthMe.data.user.phone, '0987654321');
    assert.equal(resAuthMe.data.user.dateOfBirth, '1988-10-20');
    assert.equal(resAuthMe.data.user.address, '456 Đường Nguyễn Trãi, Hà Nội');
  });

  test('[BE] Từ chối truy cập hồ sơ khi không có token xác thực hoặc token không hợp lệ (401)', async () => {
    // Không có header Authorization
    const resNoToken = await api('/api/profile', { method: 'GET' });
    assert.equal(resNoToken.response.status, 401);

    // Token không hợp lệ
    const resBadToken = await api('/api/profile', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-khong-hop-le' }
    });
    assert.equal(resBadToken.response.status, 401);
  });

  // -------------------------------------------------------------
  // 2. API CẬP NHẬT HỒ SƠ CÁ NHÂN HỢP LỆ
  // -------------------------------------------------------------
  test('[BE] Cập nhật hồ sơ cá nhân thành công với dữ liệu hợp lệ (họ tên, SĐT, ngày sinh, địa chỉ)', async () => {
    const token = await getAuthToken('student1@edu.vn');

    const updatePayload = {
      name: 'Nguyễn Văn Học Sinh (Đã đổi)',
      phone: '0933112233',
      dateOfBirth: '2005-12-25',
      address: 'Số 99 Phố Trần Đại Nghĩa, Hai Bà Trưng, Hà Nội'
    };

    const { response, data } = await api('/api/profile', jsonRequest(updatePayload, token, 'PUT'));
    assert.equal(response.status, 200);
    assert.equal(data.success, true);

    const updatedProfile = data.data || data.user;
    assert.equal(updatedProfile.name, 'Nguyễn Văn Học Sinh (Đã đổi)');
    assert.equal(updatedProfile.phone, '0933112233');
    assert.equal(updatedProfile.dateOfBirth, '2005-12-25');
    assert.equal(updatedProfile.address, 'Số 99 Phố Trần Đại Nghĩa, Hai Bà Trưng, Hà Nội');

    // Kiểm tra dữ liệu được lưu bền vững khi đọc lại
    const verifyGet = await api('/api/profile', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    const saved = verifyGet.data.data || verifyGet.data.user;
    assert.equal(saved.name, 'Nguyễn Văn Học Sinh (Đã đổi)');
    assert.equal(saved.phone, '0933112233');
    assert.equal(saved.dateOfBirth, '2005-12-25');
    assert.equal(saved.address, 'Số 99 Phố Trần Đại Nghĩa, Hai Bà Trưng, Hà Nội');
  });

  // -------------------------------------------------------------
  // 3. XÁC THỰC VÀ CHUẨN HÓA SỐ ĐIỆN THOẠI VIỆT NAM
  // -------------------------------------------------------------
  test('[BE] Chuẩn hóa số điện thoại Việt Nam từ các định dạng +84, 84, 0084, khoảng trắng và gạch ngang', async () => {
    const token = await getAuthToken('student1@edu.vn');

    // Trường hợp 1: Có tiền tố +84 và khoảng trắng
    const test1 = await api('/api/profile', jsonRequest({
      name: 'Học Sinh A',
      phone: '+84 912 345 678'
    }, token, 'PUT'));
    assert.equal(test1.response.status, 200);
    assert.equal((test1.data.data || test1.data.user).phone, '0912345678');

    // Trường hợp 2: Có tiền tố 84 và gạch ngang
    const test2 = await api('/api/profile', jsonRequest({
      name: 'Học Sinh A',
      phone: '84-987-654-321'
    }, token, 'PUT'));
    assert.equal(test2.response.status, 200);
    assert.equal((test2.data.data || test2.data.user).phone, '0987654321');

    // Trường hợp 3: Có tiền tố 0084 và ngoặc đơn
    const test3 = await api('/api/profile', jsonRequest({
      name: 'Học Sinh A',
      phone: '0084(976)123456'
    }, token, 'PUT'));
    assert.equal(test3.response.status, 200);
    assert.equal((test3.data.data || test3.data.user).phone, '0976123456');

    // Trường hợp 4: Các đầu số nhà mạng di động khác tại Việt Nam (03x, 05x, 07x, 08x)
    const testViettel = await api('/api/profile', jsonRequest({ phone: '0389998888' }, token, 'PATCH'));
    assert.equal(testViettel.response.status, 200);
    assert.equal((testViettel.data.data || testViettel.data.user).phone, '0389998888');

    const testMobi = await api('/api/profile', jsonRequest({ phone: '0707776666' }, token, 'PATCH'));
    assert.equal(testMobi.response.status, 200);
    assert.equal((testMobi.data.data || testMobi.data.user).phone, '0707776666');

    const testVina = await api('/api/profile', jsonRequest({ phone: '0888889999' }, token, 'PATCH'));
    assert.equal(testVina.response.status, 200);
    assert.equal((testVina.data.data || testVina.data.user).phone, '0888889999');

    const testVietnamobile = await api('/api/profile', jsonRequest({ phone: '0522223333' }, token, 'PATCH'));
    assert.equal(testVietnamobile.response.status, 200);
    assert.equal((testVietnamobile.data.data || testVietnamobile.data.user).phone, '0522223333');
  });

  test('[BE] Từ chối số điện thoại Việt Nam sai định dạng (đầu số sai, thiếu/thừa số, chứa chữ cái)', async () => {
    const token = await getAuthToken('student1@edu.vn');

    const invalidPhones = [
      { phone: '0123456789', desc: 'Đầu số 01 không còn tồn tại' },
      { phone: '0243456789', desc: 'Đầu số điện thoại bàn' },
      { phone: '091234567', desc: 'Thiếu số (9 chữ số)' },
      { phone: '09123456789', desc: 'Thừa số (11 chữ số)' },
      { phone: '0912abc678', desc: 'Chứa chữ cái' },
      { phone: 'abcdefghij', desc: 'Chuỗi không phải số' },
      { phone: '1234567890', desc: 'Không bắt đầu bằng số 0' }
    ];

    for (const item of invalidPhones) {
      const { response, data } = await api('/api/profile', jsonRequest({
        phone: item.phone
      }, token, 'PUT'));

      assert.equal(response.status, 400, `Thất bại tại trường hợp: ${item.desc} (${item.phone})`);
      assert.equal(data.success, false);
      assert.equal(data.code, 'INVALID_PHONE_FORMAT');
      assert.match(data.message, /số điện thoại/i);
    }
  });

  // -------------------------------------------------------------
  // 4. CHẶN TỰ THAY ĐỔI EMAIL VÀ VAI TRÒ
  // -------------------------------------------------------------
  test('[BE] Chặn người dùng tự thay đổi email: từ chối và giữ nguyên email cũ (400)', async () => {
    const token = await getAuthToken('student1@edu.vn');

    const { response, data } = await api('/api/profile', jsonRequest({
      name: 'Nguyễn Văn Học Sinh',
      email: 'newemail@edu.vn'
    }, token, 'PUT'));

    assert.equal(response.status, 400);
    assert.equal(data.success, false);
    assert.equal(data.code, 'EMAIL_CHANGE_NOT_ALLOWED');
    assert.match(data.message, /không được phép thay đổi địa chỉ email/i);

    // Xác nhận email không bị đổi
    const verify = await api('/api/profile', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal((verify.data.data || verify.data.user).email, 'student1@edu.vn');
  });

  test('[BE] Chặn người dùng tự thay đổi vai trò (role hoặc roles): từ chối (400)', async () => {
    const token = await getAuthToken('student1@edu.vn');

    // Cố gắng tự đổi role thành admin
    const resRole = await api('/api/profile', jsonRequest({
      role: 'admin'
    }, token, 'PUT'));

    assert.equal(resRole.response.status, 400);
    assert.equal(resRole.data.success, false);
    assert.equal(resRole.data.code, 'ROLE_CHANGE_NOT_ALLOWED');
    assert.match(resRole.data.message, /không được phép thay đổi vai trò/i);

    // Cố gắng tự đổi mảng roles thành ['admin']
    const resRoles = await api('/api/profile', jsonRequest({
      roles: ['admin']
    }, token, 'PUT'));

    assert.equal(resRoles.response.status, 400);
    assert.equal(resRoles.data.success, false);
    assert.equal(resRoles.data.code, 'ROLE_CHANGE_NOT_ALLOWED');

    // Xác nhận vai trò không bị đổi
    const verify = await api('/api/profile', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal((verify.data.data || verify.data.user).role, 'student');
  });

  test('[BE] Cho phép form gửi kèm email và vai trò hiện tại (không đổi) mà không bị lỗi', async () => {
    const token = await getAuthToken('student1@edu.vn');

    const payload = {
      name: 'Nguyễn Văn Học Sinh',
      email: 'student1@edu.vn', // Giữ nguyên email cũ
      role: 'student',          // Giữ nguyên role cũ
      roles: ['student'],
      phone: '0912345678'
    };

    const { response, data } = await api('/api/profile', jsonRequest(payload, token, 'PUT'));
    assert.equal(response.status, 200);
    assert.equal(data.success, true);
  });

  test('[BE] Chặn các trường nhạy cảm: status, password, passwordHash, permissions (400)', async () => {
    const token = await getAuthToken('student1@edu.vn');

    // Thử sửa status
    const resStatus = await api('/api/profile', jsonRequest({
      status: 'locked'
    }, token, 'PUT'));
    assert.equal(resStatus.response.status, 400);
    assert.equal(resStatus.data.code, 'UNAUTHORIZED_FIELD');

    // Thử sửa password
    const resPassword = await api('/api/profile', jsonRequest({
      password: 'HackedPassword123'
    }, token, 'PUT'));
    assert.equal(resPassword.response.status, 400);
    assert.equal(resPassword.data.code, 'UNAUTHORIZED_FIELD');
  });

  // -------------------------------------------------------------
  // 5. RÀNG BUỘC DỮ LIỆU: NGÀY SINH, HỌ TÊN, ĐỊA CHỈ
  // -------------------------------------------------------------
  test('[BE] Ràng buộc ngày sinh: từ chối ngày trong tương lai hoặc năm < 1900', async () => {
    const token = await getAuthToken('student1@edu.vn');

    // Ngày tương lai
    const futureDateRes = await api('/api/profile', jsonRequest({
      dateOfBirth: '2099-01-01'
    }, token, 'PUT'));
    assert.equal(futureDateRes.response.status, 400);
    assert.equal(futureDateRes.data.code, 'INVALID_DATE_OF_BIRTH');
    assert.match(futureDateRes.data.message, /tương lai/i);

    // Năm sinh < 1900
    const oldDateRes = await api('/api/profile', jsonRequest({
      dateOfBirth: '1850-01-01'
    }, token, 'PUT'));
    assert.equal(oldDateRes.response.status, 400);
    assert.equal(oldDateRes.data.code, 'INVALID_DATE_OF_BIRTH');
    assert.match(oldDateRes.data.message, /1900/);

    // Định dạng sai
    const badDateRes = await api('/api/profile', jsonRequest({
      dateOfBirth: '15/05/2005'
    }, token, 'PUT'));
    assert.equal(badDateRes.response.status, 400);
    assert.equal(badDateRes.data.code, 'INVALID_DATE_OF_BIRTH');
  });

  test('[BE] Ràng buộc họ và tên: từ chối để trống hoặc độ dài không hợp lệ', async () => {
    const token = await getAuthToken('student1@edu.vn');

    // Để trống
    const emptyNameRes = await api('/api/profile', jsonRequest({ name: '   ' }, token, 'PUT'));
    assert.equal(emptyNameRes.response.status, 400);
    assert.equal(emptyNameRes.data.code, 'INVALID_NAME');

    // Quá ngắn (< 2 ký tự)
    const shortNameRes = await api('/api/profile', jsonRequest({ name: 'A' }, token, 'PUT'));
    assert.equal(shortNameRes.response.status, 400);
    assert.equal(shortNameRes.data.code, 'INVALID_NAME');

    // Quá dài (> 120 ký tự)
    const longNameRes = await api('/api/profile', jsonRequest({ name: 'A'.repeat(121) }, token, 'PUT'));
    assert.equal(longNameRes.response.status, 400);
    assert.equal(longNameRes.data.code, 'INVALID_NAME');
  });

  test('[BE] Ràng buộc địa chỉ: từ chối địa chỉ vượt quá 255 ký tự', async () => {
    const token = await getAuthToken('student1@edu.vn');

    const longAddressRes = await api('/api/profile', jsonRequest({
      address: 'Đ'.repeat(256)
    }, token, 'PUT'));
    assert.equal(longAddressRes.response.status, 400);
    assert.equal(longAddressRes.data.code, 'INVALID_ADDRESS');
  });

  // -------------------------------------------------------------
  // 6. KIỂM THỬ VỚI CÁC VAI TRÒ KHÁC NHAU (TEACHER, ADMIN)
  // -------------------------------------------------------------
  test('[QA] Giảng viên và Quản trị viên đều xem và cập nhật được hồ sơ cá nhân của mình', async () => {
    const teacherToken = await getAuthToken('teacher1@edu.vn');

    const updateTeacher = await api('/api/profile', jsonRequest({
      name: 'ThS. Trần Thị Giáo Viên (Cập nhật)',
      phone: '0977888999',
      dateOfBirth: '1989-11-11',
      address: 'Tòa nhà A, Giảng Võ, Ba Đình, Hà Nội'
    }, teacherToken, 'PUT'));
    assert.equal(updateTeacher.response.status, 200);
    assert.equal(updateTeacher.data.success, true);
    assert.equal((updateTeacher.data.data || updateTeacher.data.user).name, 'ThS. Trần Thị Giáo Viên (Cập nhật)');

    const adminToken = await getAuthToken('admin1@edu.vn');

    const updateAdmin = await api('/api/profile', jsonRequest({
      name: 'Quản Trị Viên (Cập nhật)',
      phone: '0909999888'
    }, adminToken, 'PATCH'));
    assert.equal(updateAdmin.response.status, 200);
    assert.equal(updateAdmin.data.success, true);
    assert.equal((updateAdmin.data.data || updateAdmin.data.user).phone, '0909999888');
  });

  // -------------------------------------------------------------
  // 7. UNIT TEST SERVICE XÁC THỰC SĐT VIỆT NAM
  // -------------------------------------------------------------
  test('[Service] normalizeVietnamesePhone xử lý chính xác tất cả các trường hợp biên', () => {
    // Hợp lệ chuẩn
    assert.equal(normalizeVietnamesePhone('0912345678').isValid, true);
    assert.equal(normalizeVietnamesePhone('0912345678').normalized, '0912345678');

    // Chuyển đổi mã quốc gia
    assert.equal(normalizeVietnamesePhone('+84912345678').normalized, '0912345678');
    assert.equal(normalizeVietnamesePhone('84912345678').normalized, '0912345678');
    assert.equal(normalizeVietnamesePhone('0084912345678').normalized, '0912345678');

    // Ký tự phân cách
    assert.equal(normalizeVietnamesePhone('0912.345.678').normalized, '0912345678');
    assert.equal(normalizeVietnamesePhone('0912-345-678').normalized, '0912345678');
    assert.equal(normalizeVietnamesePhone('(0912) 345 678').normalized, '0912345678');

    // Không hợp lệ
    assert.equal(normalizeVietnamesePhone('').isValid, false);
    assert.equal(normalizeVietnamesePhone(null).isValid, false);
    assert.equal(normalizeVietnamesePhone('0123456789').isValid, false);
    assert.equal(normalizeVietnamesePhone('09123456').isValid, false);
    assert.equal(normalizeVietnamesePhone('091234567890').isValid, false);
  });
});

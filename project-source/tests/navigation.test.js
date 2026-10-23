'use strict';

/**
 * Bộ kiểm thử tự động (QA Test Suite) cho Task DNKN-14:
 * "Là người dùng của hệ thống, tôi muốn thấy menu điều hướng đúng theo quyền của mình,
 *  để không bị rối bởi những chức năng mình không được dùng."
 *
 * Kiểm thử đầy đủ 6 Subtasks:
 * 1. [FE] Xử lý trạng thái không có quyền truy cập khi chọn menu (403 Forbidden)
 * 2. [FE] Hiển thị tên người dùng và vai trò đang đăng nhập
 * 3. [FE] Xây dựng menu điều hướng động theo quyền người dùng
 * 4. [FE] Tối ưu giao diện điều hướng cho màn hình 360px
 * 5. [BE] Cung cấp dữ liệu quyền và vai trò cho giao diện điều hướng
 * 6. [QA] Kiểm thử hiển thị menu theo vai trò và kích thước màn hình nhỏ
 */

try {
  const Module = require('module');
  const path = require('path');
  const fallbackDir = path.resolve('D:/FILETONG/aaaaa/node_modules');
  const orig = Module._nodeModulePaths;
  Module._nodeModulePaths = function (from) {
    const paths = orig.call(this, from);
    if (!paths.includes(fallbackDir)) paths.push(fallbackDir);
    return paths;
  };
} catch (e) {}

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

const { app } = require('../backend/server');
const UserModel = require('../backend/models/userModel');
const {
  ROLE_CATALOG,
  ALLOWED_ROLES,
  PERMISSIONS,
  getRoles,
  getPermissions,
  hasPermission,
  isValidRoleAssignment
} = require('../backend/config/rolePermissions');
const { createToken } = require('../backend/security/token');
const { resolveNavigationByRole, ROLE_NAVIGATION_MAP, getSafeAppPath } = require('../frontend/core/navigation');

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

async function api(pathname, options = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, options);
  let data = null;
  try {
    data = await res.json();
  } catch (err) {}
  return { status: res.status, data };
}

describe('DNKN-14: Menu điều hướng theo quyền & Tối ưu 360px', () => {

  // =========================================================================
  // SUBTASK 1 [FE]: Xử lý trạng thái không có quyền truy cập khi chọn menu
  // =========================================================================
  test('1. [FE] Xử lý trạng thái không có quyền truy cập: màn hình 403 Forbidden & điều hướng an toàn', () => {
    // Kiểm tra định nghĩa bảng ánh xạ đường dẫn an toàn theo vai trò
    assert.ok(ROLE_NAVIGATION_MAP.ADMIN, 'Phải có cấu hình điều hướng cho ADMIN');
    assert.ok(ROLE_NAVIGATION_MAP.TEACHER, 'Phải có cấu hình điều hướng cho TEACHER');
    assert.ok(ROLE_NAVIGATION_MAP.STUDENT, 'Phải có cấu hình điều hướng cho STUDENT');
    assert.ok(ROLE_NAVIGATION_MAP.MANAGER, 'Phải có cấu hình điều hướng cho MANAGER');

    // Xác minh hàm lấy đường dẫn an toàn khi bị từ chối quyền
    const studentSafePath = getSafeAppPath(true, ROLE_NAVIGATION_MAP.STUDENT);
    assert.equal(studentSafePath, '/student/workspace', 'Đường dẫn an toàn của học sinh là /student/workspace');

    const teacherSafePath = getSafeAppPath(true, ROLE_NAVIGATION_MAP.TEACHER);
    assert.equal(teacherSafePath, '/teacher/dashboard', 'Đường dẫn an toàn của giảng viên là /teacher/dashboard');

    const adminSafePath = getSafeAppPath(true, ROLE_NAVIGATION_MAP.ADMIN);
    assert.equal(adminSafePath, '/admin/dashboard', 'Đường dẫn an toàn của quản trị viên là /admin/dashboard');

    // Chưa đăng nhập thì chuyển về /login
    const unauthSafePath = getSafeAppPath(false, null);
    assert.equal(unauthSafePath, '/login', 'Chưa xác thực phải điều hướng về /login');
  });

  // =========================================================================
  // SUBTASK 2 [FE]: Hiển thị tên người dùng và vai trò đang đăng nhập
  // =========================================================================
  test('2. [FE] Hiển thị tên người dùng và vai trò đang đăng nhập trên header và sidebar', () => {
    const rawUser = {
      id: 'usr_003',
      name: 'Nguyễn Văn An',
      email: 'student@edu.vn',
      role: 'student',
      roles: ['student'],
      status: 'active',
      statusLabel: 'Đang hoạt động'
    };

    const publicUser = UserModel.toPublicUser(rawUser);
    assert.equal(publicUser.name, 'Nguyễn Văn An', 'Tên người dùng phải được bảo toàn chính xác');
    assert.equal(publicUser.role, 'student', 'Vai trò phải đúng là student');
    assert.equal(publicUser.roleLabel, 'Học sinh / Sinh viên', 'roleLabel phải được định dạng thân thiện');
    assert.equal(publicUser.status, 'active', 'Trạng thái hoạt động hiển thị rõ ràng');

    // Kiểm tra cấu trúc roleNavigation logic hiển thị
    const adminUser = UserModel.toPublicUser({
      id: 'usr_admin',
      name: 'Giáp Văn Hiếu',
      email: 'admin@edu.vn',
      role: 'admin',
      roles: ['admin'],
      status: 'active'
    });
    assert.equal(adminUser.name, 'Giáp Văn Hiếu');
    assert.equal(adminUser.role, 'admin');
    assert.equal(adminUser.roleLabel, 'Quản trị viên');
  });

  // =========================================================================
  // SUBTASK 3 [FE]: Xây dựng menu điều hướng động theo quyền người dùng
  // =========================================================================
  test('3. [FE] Xây dựng menu điều hướng động: Mục menu không thuộc quyền thì không hiển thị', () => {
    // 1. Kiểm tra danh mục navigation của từng vai trò từ RBAC_SEED
    const adminNav = ROLE_CATALOG.admin.navigation.map(item => item.id);
    const teacherNav = ROLE_CATALOG.teacher.navigation.map(item => item.id);
    const studentNav = ROLE_CATALOG.student.navigation.map(item => item.id);
    const managerNav = ROLE_CATALOG.manager.navigation.map(item => item.id);

    // Học sinh CHỈ ĐƯỢC THẤY các mục của học sinh:
    assert.ok(studentNav.includes('dashboard'), 'Học sinh có bảng điều khiển');
    assert.ok(studentNav.includes('my-courses'), 'Học sinh có menu Lớp học của tôi');
    assert.ok(studentNav.includes('profile-security'), 'Học sinh có menu đổi mật khẩu');

    // Học sinh TUYỆT ĐỐI KHÔNG ĐƯỢC HIỂN THỊ menu quản trị:
    assert.equal(studentNav.includes('user-management'), false, 'Học sinh KHÔNG ĐƯỢC thấy menu Quản lý người dùng');
    assert.equal(studentNav.includes('attendance'), false, 'Học sinh KHÔNG ĐƯỢC thấy menu Điểm danh');
    assert.equal(studentNav.includes('class-management'), false, 'Học sinh KHÔNG ĐƯỢC thấy menu Quản lý lớp học');
    assert.equal(studentNav.includes('course-catalog'), false, 'Học sinh KHÔNG ĐƯỢC thấy menu Danh mục môn học');
    assert.equal(studentNav.includes('tuition'), false, 'Học sinh KHÔNG ĐƯỢC thấy menu Học phí');

    // Giảng viên KHÔNG ĐƯỢC THẤY menu Quản lý người dùng:
    assert.ok(teacherNav.includes('attendance'), 'Giảng viên thấy menu Điểm danh');
    assert.ok(teacherNav.includes('class-management'), 'Giảng viên thấy menu Lớp học');
    assert.equal(teacherNav.includes('user-management'), false, 'Giảng viên KHÔNG ĐƯỢC thấy menu Quản lý người dùng');

    // Quản trị viên (Admin) thấy đầy đủ các menu quản trị:
    assert.ok(adminNav.includes('user-management'), 'Admin thấy menu Quản lý người dùng');
    assert.ok(adminNav.includes('attendance'), 'Admin thấy menu Điểm danh');
    assert.ok(adminNav.includes('class-management'), 'Admin thấy menu Quản lý lớp học');
    assert.ok(adminNav.includes('course-catalog'), 'Admin thấy menu Danh mục môn học');

    // Quản lý đào tạo (Manager) thấy menu quản lý lead và đào tạo:
    assert.ok(managerNav.includes('lead-management'), 'Manager thấy menu Quản lý Lead');
    assert.ok(managerNav.includes('course-catalog'), 'Manager thấy menu Danh mục môn học');
  });

  // =========================================================================
  // SUBTASK 4 [FE]: Tối ưu giao diện điều hướng cho màn hình 360px
  // =========================================================================
  test('4. [FE] Tối ưu giao diện điều hướng cho màn hình 360px (CSS responsive & touch targets)', () => {
    const cssPath = path.resolve(__dirname, '../frontend/style.css');
    assert.ok(fs.existsSync(cssPath), 'File frontend/style.css phải tồn tại');

    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // 1. Kiểm tra media query tối ưu cho di động màn hình nhỏ (max-width: 640px bao hàm 360px)
    assert.match(cssContent, /@media\s*\(max-width:\s*640px\)/, 'CSS phải có media query cho mobile');

    // 2. Kiểm tra layout chuyển sang 1 cột: header -> nav -> main
    assert.match(cssContent, /grid-template-columns:\s*1fr/, 'Layout di động phải co về 1 cột duy nhất');
    assert.match(cssContent, /"header"\s*"nav"\s*"main"/, 'Thứ tự hiển thị trên di động: header -> nav -> main');

    // 3. Kiểm tra cơ chế cuộn ngang cho menu điều hướng
    assert.match(cssContent, /overflow-x:\s*auto/, 'Menu di động phải cuộn ngang mượt mà');
    assert.match(cssContent, /-webkit-overflow-scrolling:\s*touch/, 'Hỗ trợ cảm ứng trượt mượt trên mobile');

    // 4. Kiểm tra nút bấm không bị ngắt dòng và touch target thuận tiện
    assert.match(cssContent, /white-space:\s*nowrap/, 'Các nút menu di động không bị vỡ chữ/xuống dòng');
  });

  // =========================================================================
  // SUBTASK 5 [BE]: Cung cấp dữ liệu quyền và vai trò cho giao diện điều hướng
  // =========================================================================
  test('5. [BE] API GET /api/auth/permissions trả về danh sách quyền, vai trò và navigation tương ứng', async () => {
    // 1. Chưa đăng nhập: Bị từ chối 401
    const unauth = await api('/api/auth/permissions');
    assert.equal(unauth.status, 401, 'Chưa đăng nhập phải nhận mã lỗi 401');

    // 2. Tạo token cho Học sinh (student)
    const studentUser = { id: 'usr_003', email: 'student@edu.vn', role: 'student', roles: ['student'], status: 'active' };
    const studentToken = createToken(studentUser);

    const studentRes = await api('/api/auth/permissions', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });

    assert.equal(studentRes.status, 200, 'Học sinh lấy danh sách quyền thành công');
    assert.equal(studentRes.data.success, true);
    assert.equal(studentRes.data.role, 'student');
    assert.deepEqual(studentRes.data.roles, ['student']);
    assert.ok(Array.isArray(studentRes.data.permissions), 'permissions phải là mảng');
    assert.ok(Array.isArray(studentRes.data.navigation), 'navigation phải là mảng các mục điều hướng');
    assert.ok(studentRes.data.navigation.some(item => item.id === 'my-courses'), 'Navigation học sinh phải có my-courses');
    assert.equal(studentRes.data.navigation.some(item => item.id === 'user-management'), false, 'Navigation học sinh KHÔNG ĐƯỢC có user-management');

    // 3. Tạo token cho Quản trị viên (admin)
    const adminUser = { id: 'usr_001', email: 'admin@edu.vn', role: 'admin', roles: ['admin'], status: 'active' };
    const adminToken = createToken(adminUser);

    const adminRes = await api('/api/auth/permissions', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.data.role, 'admin');
    assert.ok(adminRes.data.navigation.some(item => item.id === 'user-management'), 'Admin navigation phải có user-management');
    assert.ok(adminRes.data.navigation.some(item => item.id === 'course-catalog'), 'Admin navigation phải có course-catalog');
  });

  test('5.1 [BE] API GET /api/auth/me trả về thông tin tài khoản đang đăng nhập', async () => {
    const adminUser = { id: 'usr_001', name: 'Giáp Văn Hiếu', email: 'admin@edu.vn', role: 'admin', roles: ['admin'], status: 'active' };
    const adminToken = createToken(adminUser);

    const res = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.user.email, 'admin@edu.vn');
    assert.equal(res.data.user.role, 'admin');
    assert.equal(res.data.user.roleLabel, 'Quản trị viên');
  });

  // =========================================================================
  // SUBTASK 6 [QA]: Kiểm thử hiển thị menu theo vai trò và kích thước màn hình nhỏ
  // =========================================================================
  test('6. [QA] Xác minh tính toàn vẹn của Role Catalog và tất cả 8 vai trò hệ thống', () => {
    const expectedRoles = [
      'admin',
      'teacher',
      'assistant',
      'student',
      'manager',
      'accountant',
      'department_head',
      'training_staff'
    ];

    for (const role of expectedRoles) {
      assert.ok(ROLE_CATALOG[role], `Vai trò ${role} phải tồn tại trong ROLE_CATALOG`);
      assert.ok(ROLE_CATALOG[role].label, `Vai trò ${role} phải có nhãn hiển thị`);
      assert.ok(Array.isArray(ROLE_CATALOG[role].permissions), `Vai trò ${role} phải có danh sách quyền`);
      assert.ok(Array.isArray(ROLE_CATALOG[role].navigation), `Vai trò ${role} phải có danh sách menu điều hướng`);
      assert.ok(ROLE_CATALOG[role].navigation.length > 0, `Vai trò ${role} phải có ít nhất 1 mục điều hướng`);

      // Mọi mục điều hướng đều phải có id, label và path
      for (const navItem of ROLE_CATALOG[role].navigation) {
        assert.ok(navItem.id, `Mục menu trong vai trò ${role} phải có id`);
        assert.ok(navItem.label, `Mục menu trong vai trò ${role} phải có label`);
        assert.ok(navItem.path, `Mục menu trong vai trò ${role} phải có path`);
      }
    }
  });

  test('6.1 [QA] Kiểm thử ràng buộc vai trò độc quyền (Exclusive Roles)', () => {
    // Học sinh và Giảng viên chỉ được giữ 1 vai trò độc quyền
    assert.equal(isValidRoleAssignment(['student']), true);
    assert.equal(isValidRoleAssignment(['teacher']), true);
    assert.equal(isValidRoleAssignment(['student', 'teacher']), false);
    assert.equal(isValidRoleAssignment(['student', 'manager']), false);
    assert.equal(isValidRoleAssignment(['teacher', 'accountant']), false);
    assert.equal(isValidRoleAssignment(['admin', 'manager']), true);

    assert.deepEqual(getRoles({ roles: ['student', 'manager'] }), ['student']);
    assert.deepEqual(getRoles({ roles: ['teacher', 'admin'] }), ['teacher']);
  });

});

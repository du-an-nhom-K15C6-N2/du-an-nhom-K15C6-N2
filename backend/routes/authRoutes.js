const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

// Đăng nhập
router.post('/login', AuthController.login);

// Thông tin tài khoản hiện tại
router.get('/me', requireAuth, AuthController.getMe);

// Đổi mật khẩu bằng cách xác minh mật khẩu hiện tại
router.patch('/change-password', requireAuth, AuthController.changePassword);

// Gia hạn phiên đang hoạt động
router.post('/refresh', requireAuth, AuthController.refresh);

// Đăng xuất
router.post('/logout', requireAuth, AuthController.logout);

// Quên mật khẩu
router.post('/forgot-password', AuthController.forgotPassword);

module.exports = router;
// DNKN-42: API cung cấp danh sách quyền, vai trò và các mục điều hướng
router.get('/permissions', (req, res) => {
  // Lấy role từ query hoặc header (mặc định lấy vai trò được truyền lên hoặc USER)
  const role = (req.query.role || req.headers['x-user-role'] || 'USER').toUpperCase();

  const roleNavigationMap = {
    ADMIN: [
      { id: 'dashboard', label: 'Bảng điều khiển', path: '/admin/dashboard' },
      { id: 'attendance', label: 'Điểm danh lớp học', path: '/admin/attendance' },
      { id: 'class-management', label: 'Quản lý lớp học', path: '/admin/classes' },
      { id: 'user-management', label: 'Quản lý người dùng', path: '/admin/users' },
      { id: 'system-logs', label: 'Nhật ký hệ thống', path: '/admin/logs' },
      { id: 'approval', label: 'Phê duyệt yêu cầu', path: '/admin/approvals' },
      { id: 'profile-security', label: 'Đổi mật khẩu & Bảo mật', path: '/profile/security' }
    ],
    TEACHER: [
      { id: 'dashboard', label: 'Bảng điều khiển', path: '/teacher/dashboard' },
      { id: 'attendance', label: 'Điểm danh lớp học', path: '/teacher/attendance' },
      { id: 'class-management', label: 'Quản lý lớp học', path: '/teacher/classes' },
      { id: 'profile-security', label: 'Đổi mật khẩu & Bảo mật', path: '/profile/security' }
    ],
    ASSISTANT: [
      { id: 'dashboard', label: 'Bảng điều khiển', path: '/assistant/dashboard' },
      { id: 'attendance', label: 'Điểm danh lớp học', path: '/assistant/attendance' },
      { id: 'profile-security', label: 'Đổi mật khẩu & Bảo mật', path: '/profile/security' }
    ],
    STUDENT: [
      { id: 'dashboard', label: 'Bảng điều khiển', path: '/student/dashboard' },
      { id: 'my-courses', label: 'Lớp học của tôi', path: '/student/courses' },
      { id: 'my-tasks', label: 'Nhiệm vụ được giao', path: '/student/tasks' },
      { id: 'profile-security', label: 'Đổi mật khẩu & Bảo mật', path: '/profile/security' }
    ],
    USER: [
      { id: 'dashboard', label: 'Bảng điều khiển', path: '/user/dashboard' },
      { id: 'profile-security', label: 'Đổi mật khẩu & Bảo mật', path: '/profile/security' }
    ]
  };

  const navItems = roleNavigationMap[role] || roleNavigationMap['USER'];

  return res.json({
    success: true,
    role: role,
    navigation: navItems
  });
});

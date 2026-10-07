const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const UserModel = require('../models/userModel');
const { ROLE_CATALOG, getPermissions } = require('../config/rolePermissions');

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
router.post('/reset-password', AuthController.resetPassword);

// DNKN-42: API cung cấp danh sách quyền, vai trò và các mục điều hướng
router.get('/permissions', requireAuth, (req, res) => {
  const roles = UserModel.getRoles(req.user);
  const role = roles.includes(req.user.role) ? req.user.role : roles[0];
  const roleDefinition = ROLE_CATALOG[role];
  return res.json({
    success: true,
    role,
    roles,
    permissions: getPermissions(req.user),
    navigation: roleDefinition?.navigation || []
  });
});

module.exports = router;

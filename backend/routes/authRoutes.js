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

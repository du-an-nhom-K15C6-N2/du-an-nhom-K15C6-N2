const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const emailService = require('../services/emailService');

// Đăng ký tài khoản mới kèm email kích hoạt [DNKN-59]
router.post('/register', AuthController.register);

// Kích hoạt tài khoản bằng token [DNKN-59]
router.get('/activate', AuthController.activateAccount);
router.post('/activate', AuthController.activateAccount);

// Đăng nhập (EP-01 AC 1-2-3)
router.post('/login', AuthController.login);

// Thông tin tài khoản hiện tại
router.get('/me', AuthController.getMe);

// Đăng xuất
router.post('/logout', AuthController.logout);

// Quên mật khẩu
router.post('/forgot-password', AuthController.forgotPassword);

// Xem danh sách email đã gửi gần đây (Phục vụ QA / Kiểm thử đồ án)
router.get('/recent-emails', (req, res) => {
  res.status(200).json({
    success: true,
    total: emailService.getRecentEmails().length,
    data: emailService.getRecentEmails()
  });
});

module.exports = router;

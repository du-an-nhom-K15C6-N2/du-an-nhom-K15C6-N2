const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');

// Đăng nhập
router.post('/login', AuthController.login);

// Thông tin tài khoản hiện tại
router.get('/me', AuthController.getMe);

// Đăng xuất
router.post('/logout', AuthController.logout);

// Quên mật khẩu
router.post('/forgot-password', AuthController.forgotPassword);

module.exports = router;

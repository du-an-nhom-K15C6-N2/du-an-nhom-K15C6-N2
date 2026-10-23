const express = require('express');
const router = express.Router();
const SessionController = require('../controllers/sessionController');
const { requireSession } = require('../services/sessionService');

// Đăng nhập tạo phiên
router.post('/login', SessionController.login);

// Lấy thông tin phiên
router.get('/', requireSession, SessionController.getSession);

// Gia hạn phiên
router.post('/renew', requireSession, SessionController.renew);

// Đăng xuất thu hồi phiên
router.post('/logout', requireSession, SessionController.logout);

module.exports = router;

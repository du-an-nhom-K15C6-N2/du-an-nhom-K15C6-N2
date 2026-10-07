/**
 * Profile Routes
 * Định tuyến các API liên quan đến hồ sơ cá nhân
 */

const express = require('express');
const router = express.Router();
const ProfileController = require('../controllers/profileController');
const { requireAuth } = require('../middleware/authMiddleware');

// Tất cả các route hồ sơ đều yêu cầu xác thực người dùng đã đăng nhập
router.use(requireAuth);

// [BE] API lấy thông tin hồ sơ cá nhân
router.get('/', ProfileController.getProfile);

// [BE] API cập nhật hồ sơ cá nhân với kiểm soát trường được phép sửa
router.put('/', ProfileController.updateProfile);
router.patch('/', ProfileController.updateProfile);

module.exports = router;

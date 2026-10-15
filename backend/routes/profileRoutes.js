const express = require('express');
const router = express.Router();
const ProfileController = require('../controllers/profileController');
const { requireAuth } = require('../middleware/authMiddleware');

router.use(requireAuth);

// [BE] API lấy thông tin hồ sơ cá nhân
router.get('/', ProfileController.getProfile);

// [BE] API cập nhật thông tin hồ sơ cá nhân
router.put('/', ProfileController.updateProfile);
router.patch('/', ProfileController.updateProfile);

module.exports = router;

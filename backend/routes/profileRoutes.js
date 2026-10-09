/**
 * Profile Routes
 * Định tuyến các API liên quan đến hồ sơ cá nhân
 */

const express = require('express');
const router = express.Router();
// DNKN-113: Nhận file ảnh đại diện
const multer = require('multer');

const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024
    },
    fileFilter: (req, file, callback) => {
        const allowedTypes = ['image/jpeg', 'image/png'];

        if (!allowedTypes.includes(file.mimetype)) {
            return callback(new Error('Chỉ chấp nhận ảnh JPG hoặc PNG.'));
        }

        callback(null, true);
    }
});
const ProfileController = require('../controllers/profileController');
const { requireAuth } = require('../middleware/authMiddleware');

// Tất cả các route hồ sơ đều yêu cầu xác thực người dùng đã đăng nhập
router.use(requireAuth);

// [BE] API lấy thông tin hồ sơ cá nhân
router.get('/', ProfileController.getProfile);

// [BE] API cập nhật hồ sơ cá nhân với kiểm soát trường được phép sửa
router.put('/', ProfileController.updateProfile);
router.patch('/', ProfileController.updateProfile);

// DNKN-113: API tải ảnh đại diện
router.post(
    '/avatar',
    avatarUpload.single('avatar'),
    ProfileController.uploadAvatar
);
module.exports = router;

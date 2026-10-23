const express = require('express');
const router = express.Router();
const ProfileController = require('../controllers/profileController');
const { requireAuth } = require('../middleware/authMiddleware');

const multer = require('multer');

// DNKN87: Cau hinh nhan anh dai dien
const avatarUpload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 2 * 1024 * 1024
    },

    fileFilter: (req, file, callback) => {
        const allowedTypes = ['image/jpeg', 'image/png'];

        if (!allowedTypes.includes(file.mimetype)) {
            return callback(new Error('Chi chap nhan anh JPG hoac PNG'));
        }

        callback(null, true);
    }
});

router.use(requireAuth);

// [BE] API lấy thông tin hồ sơ cá nhân
router.get('/', ProfileController.getProfile);

// [BE] API cập nhật thông tin hồ sơ cá nhân
router.put('/', ProfileController.updateProfile);
router.patch('/', ProfileController.updateProfile);

// DNKN87: API doi anh dai dien
router.post(
    '/avatar',
    avatarUpload.single('avatar'),
    ProfileController.uploadAvatar
);

module.exports = router;

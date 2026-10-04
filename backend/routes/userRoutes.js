const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

router.use(requireAuth, requireAdmin);

// Lấy danh sách phân trang (20 dòng/trang), tìm kiếm, lọc
router.get('/', UserController.getUsers);

// Lấy toàn bộ danh sách
router.get('/all', UserController.getAllList);

// Reset danh sách về 28 tài khoản mặc định
router.post('/reset', UserController.resetData);

// Lấy chi tiết 1 người dùng theo ID
router.get('/:id', UserController.getUserById);

// Tạo mới người dùng
router.post('/', UserController.createUser);

// Cập nhật người dùng
router.put('/:id', UserController.updateUser);

// Khóa / Mở khóa người dùng
router.patch('/:id/toggle-lock', UserController.toggleLock);
router.patch('/:id/password', UserController.setPassword);

// Xóa người dùng
router.delete('/:id', UserController.deleteUser);

module.exports = router;

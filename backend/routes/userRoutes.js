const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// Kích hoạt tài khoản được xác thực bằng token dùng một lần trong email.
router.post('/activate', UserController.activateAccount);

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

// Gán và thu hồi vai trò có hiệu lực ngay theo dữ liệu hiện tại trong user store.
router.post('/:id/roles', UserController.assignRole);
router.delete('/:id/roles/:role', UserController.revokeRole);

// Cập nhật người dùng
router.put('/:id', UserController.updateUser);

// Khóa / Mở khóa người dùng
router.patch('/:id/toggle-lock', UserController.toggleLock);
router.patch('/:id/password', UserController.setPassword);

// Xóa người dùng
router.delete('/:id', UserController.deleteUser);

module.exports = router;

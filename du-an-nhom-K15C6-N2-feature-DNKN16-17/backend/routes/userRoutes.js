const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { requireAuth, requirePermission } = require('../middleware/authMiddleware');
const { ROLE_CATALOG } = require('../config/rolePermissions');

// Kích hoạt tài khoản được xác thực bằng token dùng một lần trong email.
router.post('/activate', UserController.activateAccount);

router.use(requireAuth);

// Lấy danh sách phân trang (20 dòng/trang), tìm kiếm, lọc
router.get('/', requirePermission('users.read', { featureName: 'quản lý người dùng' }), UserController.getUsers);

// Lấy toàn bộ danh sách
router.get('/all', requirePermission('users.read', { featureName: 'quản lý người dùng' }), UserController.getAllList);

router.get('/role-permissions', requirePermission('roles.manage', { featureName: 'cấu hình vai trò và quyền' }), (req, res) => {
  const roles = Object.entries(ROLE_CATALOG).map(([role, definition]) => ({
    role,
    label: definition.label,
    permissions: [...definition.permissions]
  }));
  return res.status(200).json({ success: true, data: roles });
});

// Reset dữ liệu khởi tạo
router.post('/reset', requirePermission('system.configure', { featureName: 'khôi phục dữ liệu hệ thống' }), UserController.resetData);

// Lấy chi tiết 1 người dùng theo ID
router.get('/:id', requirePermission('users.read', { featureName: 'quản lý người dùng' }), UserController.getUserById);

// Tạo mới người dùng
router.post(
  '/',
  requirePermission('users.create', {
    featureName: 'tạo tài khoản người dùng',
    fieldPermissions: { role: 'roles.manage', roles: 'roles.manage' }
  }),
  UserController.createUser
);

router.post(
  '/:id/resend-activation',
  requirePermission('users.manage', { featureName: 'gửi lại email kích hoạt tài khoản' }),
  UserController.resendActivation
);
router.patch(
  '/:id/activate',
  requirePermission('users.manage', { featureName: 'kích hoạt tài khoản' }),
  UserController.activatePendingAccount
);

// Gán và thu hồi vai trò có hiệu lực ngay theo dữ liệu hiện tại trong user store.
router.post('/:id/roles', requirePermission('roles.manage', { featureName: 'gán vai trò' }), UserController.assignRole);
router.delete('/:id/roles/:role', requirePermission('roles.manage', { featureName: 'thu hồi vai trò' }), UserController.revokeRole);

// Cập nhật người dùng
router.put(
  '/:id',
  requirePermission('users.update', {
    featureName: 'cập nhật thông tin người dùng',
    fieldPermissions: { role: 'roles.manage', roles: 'roles.manage' }
  }),
  UserController.updateUser
);

// Khóa / Mở khóa người dùng
router.patch('/:id/lock', requirePermission('users.manage', { featureName: 'khóa tài khoản' }), UserController.lock);
router.patch('/:id/unlock', requirePermission('users.manage', { featureName: 'mở khóa tài khoản' }), UserController.unlock);
router.patch('/:id/toggle-lock', requirePermission('users.manage', { featureName: 'thay đổi trạng thái tài khoản' }), UserController.toggleLock);
router.patch('/:id/password', requirePermission('users.manage', { featureName: 'cấp lại mật khẩu' }), UserController.setPassword);

// Xóa người dùng
router.delete('/:id', requirePermission('users.delete', { featureName: 'xóa tài khoản người dùng' }), UserController.deleteUser);

module.exports = router;

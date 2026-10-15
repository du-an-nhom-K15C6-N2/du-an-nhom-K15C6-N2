/**
 * Training Program Routes
 * Định nghĩa endpoints RESTful theo chuẩn yêu cầu
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/trainingProgramController');
let requireAuth = (req, res, next) => next();
let requireRoles = () => (req, res, next) => next();
try {
  const auth = require('../middleware/authMiddleware');
  if (auth.requireAuth) requireAuth = auth.requireAuth;
  if (auth.requireRoles) requireRoles = auth.requireRoles;
} catch (e) {}

// Middleware phân quyền: Quản lý đào tạo (manager) và Quản trị viên (admin)
const requireManagerOrAdmin = requireRoles(['admin', 'manager'], {
  featureName: 'Quản lý danh mục chương trình đào tạo'
});

// 1. GET /api/v1/training-programs/active-options - Lấy danh sách ACTIVE cho chức năng mở lớp mới
router.get('/active-options', requireAuth, controller.getActiveOptions);

// 2. GET /api/v1/training-programs - Lấy danh sách (phân trang, tìm kiếm, lọc theo status)
router.get('/', requireAuth, controller.getAll);

// 3. GET /api/v1/training-programs/:id - Lấy thông tin chi tiết 1 chương trình
router.get('/:id', requireAuth, controller.getById);

// 4. POST /api/v1/training-programs - Tạo mới chương trình đào tạo (validate mã duy nhất)
router.post('/', requireAuth, requireManagerOrAdmin, controller.create);

// 5. PUT /api/v1/training-programs/:id - Cập nhật thông tin chương trình đào tạo
router.put('/:id', requireAuth, requireManagerOrAdmin, controller.update);

// 6. PATCH /api/v1/training-programs/:id/status - Đổi trạng thái (ACTIVE <-> INACTIVE)
router.patch('/:id/status', requireAuth, requireManagerOrAdmin, controller.updateStatus);

// 7. DELETE /api/v1/training-programs/:id - Xóa chương trình (kiểm tra ràng buộc lớp học)
router.delete('/:id', requireAuth, requireManagerOrAdmin, controller.delete);

module.exports = router;

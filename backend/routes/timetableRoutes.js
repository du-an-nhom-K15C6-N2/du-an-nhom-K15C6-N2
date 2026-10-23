const express = require('express');
const router = express.Router();
const TimetableController = require('../controllers/timetableController');
const { requireAuth, requirePermission, requireRoles } = require('../middleware/authMiddleware');

// Áp dụng xác thực cho tất cả endpoint thời khóa biểu
router.use(requireAuth);

// Lấy dữ liệu thời khóa biểu phục vụ chế độ tuần và tháng kèm bộ lọc
router.get(
  '/',
  requirePermission('classes.read', { featureName: 'xem thời khoá biểu' }),
  TimetableController.getTimetable
);

// Chi tiết buổi học khi bấm vào một ô lịch
router.get(
  '/sessions/:id',
  requirePermission('classes.read', { featureName: 'chi tiết buổi học' }),
  TimetableController.getSessionDetail
);

// Xếp lịch / Thêm buổi học mới (Dành cho Quản lý đào tạo và Admin)
router.post(
  '/sessions',
  requireRoles(['admin', 'manager', 'training_staff'], { featureName: 'xếp lịch thời khoá biểu' }),
  TimetableController.createSession
);

module.exports = router;

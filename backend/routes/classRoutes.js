const express = require('express');
const router = express.Router();
const ClassController = require('../controllers/classController');
const { requireAuth, requirePermission } = require('../middleware/authMiddleware');

router.use(requireAuth);

router.get(
  '/',
  requirePermission('classes.read', { featureName: 'danh sách lớp học' }),
  ClassController.list
);
router.get(
  '/room-alerts',
  requirePermission('classes.read', { featureName: 'cảnh báo phòng học' }),
  ClassController.roomAlerts
);
router.patch(
  '/:id/room',
  requirePermission('classrooms.manage', { featureName: 'phân công phòng cho lớp' }),
  ClassController.assignRoom
);
router.get(
  '/handover-alerts',
  requirePermission('classes.handover', { featureName: 'cảnh báo bàn giao lớp học' }),
  ClassController.handoverAlerts
);
router.patch(
  '/:id/handover',
  requirePermission('classes.handover', { featureName: 'thao tác bàn giao lớp học' }),
  ClassController.handover
);

module.exports = router;

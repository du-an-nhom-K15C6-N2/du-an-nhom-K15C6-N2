const express = require('express');
const GradeController = require('../controllers/gradeController');
const { requireAuth, requirePermission } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.get(
  '/',
  requirePermission('grades.read', { featureName: 'bảng điểm' }),
  GradeController.list
);
router.put(
  '/',
  requirePermission('grades.write', { featureName: 'cập nhật điểm' }),
  GradeController.upsert
);

module.exports = router;

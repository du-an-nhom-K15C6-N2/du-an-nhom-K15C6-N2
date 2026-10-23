const express = require('express');
const TuitionController = require('../controllers/tuitionController');
const { requireAuth, requirePermission } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.get(
  '/',
  requirePermission('tuition.read', { featureName: 'thông tin học phí' }),
  TuitionController.list
);
router.put(
  '/',
  requirePermission('tuition.write', { featureName: 'cập nhật học phí' }),
  TuitionController.upsert
);

module.exports = router;

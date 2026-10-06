const express = require('express');
const router = express.Router();
const ClassController = require('../controllers/classController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

router.use(requireAuth, requireAdmin);

router.get('/', ClassController.list);
router.get('/handover-alerts', ClassController.handoverAlerts);
router.patch('/:id/handover', ClassController.handover);

module.exports = router;

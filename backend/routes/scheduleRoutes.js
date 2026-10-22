const express = require('express');
const {
  checkConflictHandler,
  listSchedulesHandler,
  getScheduleByIdHandler,
  createScheduleHandler,
  updateScheduleHandler,
  cancelScheduleHandler,
  getMasterDataHandler,
  getAuditLogsHandler
} = require('../controllers/scheduleController');
const { extractUserMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(extractUserMiddleware);

// DNKN-253 & DNKN-254: API kiểm tra xung đột
router.post('/check-conflict', checkConflictHandler);

// Master data & Audit logs
router.get('/master-data', getMasterDataHandler);
router.get('/audit-logs', getAuditLogsHandler);

// CRUD lịch học (DNKN-257)
router.get('/', listSchedulesHandler);
router.get('/:id', getScheduleByIdHandler);
router.post('/', createScheduleHandler);
router.put('/:id', updateScheduleHandler);
router.patch('/:id/cancel', cancelScheduleHandler);

module.exports = router;

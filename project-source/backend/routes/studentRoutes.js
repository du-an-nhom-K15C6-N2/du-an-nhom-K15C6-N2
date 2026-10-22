const express = require('express');
const { requireAuth, requirePermission } = require('../middleware/authMiddleware');
const { StudentModel, StudentError } = require('../models/studentModel');

const asyncRoute = handler => (req, res, next) => {
  Promise.resolve().then(() => handler(req, res, next)).catch(next);
};

function createStudentRouter({ authenticate = requireAuth } = {}) {
  const router = express.Router();
  router.use(authenticate);

  router.get('/', requirePermission('students.manage', { featureName: 'quản lý hồ sơ học viên' }), asyncRoute((req, res) => {
    res.status(200).json(StudentModel.list(req.query));
  }));

  router.post('/convert-from-lead', requirePermission('leads.update', { featureName: 'chuyển đổi Lead thành học viên' }), asyncRoute(async (req, res) => {
    const actor = req.user?.fullName || req.user?.name || req.user?.email || 'Tư vấn viên';
    const { leadId, ...overrides } = req.body || {};
    const result = await StudentModel.convertFromLead(leadId, overrides, actor);
    res.status(201).json({
      success: true,
      message: 'Chuyển đổi lead thành hồ sơ học viên thành công.',
      data: result
    });
  }));

  router.get('/:id', requirePermission('students.manage', { featureName: 'xem chi tiết học viên' }), asyncRoute((req, res) => {
    const student = StudentModel.findById(req.params.id) || StudentModel.findByCode(req.params.id);
    if (!student) {
      throw new StudentError(404, 'STUDENT_NOT_FOUND', 'Không tìm thấy hồ sơ học viên.');
    }
    res.status(200).json({ success: true, data: student });
  }));

  router.use((error, req, res, next) => {
    if (!(error instanceof StudentError)) return next(error);
    return res.status(error.status).json({
      success: false,
      code: error.code,
      message: error.message,
      ...(error.details ? { existing: error.details } : {})
    });
  });

  return router;
}

module.exports = { createStudentRouter };

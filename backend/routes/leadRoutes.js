const express = require('express');
const { requireAuth, requirePermission } = require('../middleware/authMiddleware');
const { LeadError, LeadModel, normalizePhoneNumber } = require('../models/leadModel');
const { StudentModel, StudentError } = require('../models/studentModel');

const asyncRoute = handler => (req, res, next) => {
  Promise.resolve().then(() => handler(req, res, next)).catch(next);
};

function createLeadRouter({ authenticate = requireAuth } = {}) {
  const leadRouter = express.Router();

  leadRouter.use(authenticate);

  leadRouter.get('/', requirePermission('leads.read', { featureName: 'quản lý Lead' }), asyncRoute((req, res) => {
    res.status(200).json(LeadModel.list(req.query));
  }));

  leadRouter.get('/board', requirePermission('leads.read', { featureName: 'xem bảng phễu Lead' }), asyncRoute((req, res) => {
    res.status(200).json(LeadModel.getPipelineBoard());
  }));

  leadRouter.get('/pipeline', requirePermission('leads.read', { featureName: 'xem bảng phễu Lead' }), asyncRoute((req, res) => {
    res.status(200).json(LeadModel.getPipelineBoard());
  }));

  leadRouter.get('/:id/history', requirePermission('leads.read', { featureName: 'xem lịch sử trạng thái Lead' }), asyncRoute((req, res) => {
    res.status(200).json(LeadModel.getLeadHistory(req.params.id));
  }));

  leadRouter.patch('/:id/status', requirePermission('leads.update', { featureName: 'cập nhật trạng thái Lead' }), asyncRoute((req, res) => {
    const actor = req.user?.fullName || req.user?.name || req.user?.email || 'Tư vấn viên';
    res.status(200).json(LeadModel.updateStatus(req.params.id, req.body, actor));
  }));

  leadRouter.get('/:id', requirePermission('leads.read', { featureName: 'xem Lead' }), asyncRoute((req, res) => {
    res.status(200).json({ data: LeadModel.findById(req.params.id) });
  }));

  leadRouter.post('/phone-check', requirePermission('leads.read', { featureName: 'kiểm tra số điện thoại Lead' }), asyncRoute((req, res) => {
    const body = req.body || {};
    if (body.phone !== undefined && body.phoneNumber !== undefined) {
      if (normalizePhoneNumber(body.phone) !== normalizePhoneNumber(body.phoneNumber)) {
        throw new LeadError(400, 'INVALID_INPUT', 'Các trường phone và phoneNumber phải giống nhau.');
      }
    }
    const phone = body.phoneNumber ?? body.phone;
    if (typeof phone !== 'string') {
      throw new LeadError(400, 'INVALID_PHONE', 'Vui lòng nhập số điện thoại hợp lệ.');
    }
    res.status(200).json(LeadModel.checkPhone(phone, body.excludingLeadId));
  }));

  leadRouter.post('/', requirePermission('leads.create', { featureName: 'tạo Lead' }), asyncRoute((req, res) => {
    res.status(201).json({ data: LeadModel.create(req.body) });
  }));

  leadRouter.patch('/:id', requirePermission('leads.update', { featureName: 'cập nhật Lead' }), asyncRoute((req, res) => {
    res.status(200).json({ data: LeadModel.update(req.params.id, req.body) });
  }));

  leadRouter.put('/:id', requirePermission('leads.update', { featureName: 'cập nhật Lead' }), asyncRoute((req, res) => {
    res.status(200).json({ data: LeadModel.update(req.params.id, req.body) });
  }));

  leadRouter.post('/:id/care-logs', requirePermission('leads.update', { featureName: 'ghi nhật ký chăm sóc Lead' }), asyncRoute((req, res) => {
    res.status(201).json({ data: LeadModel.addCareLog(req.params.id, req.body) });
  }));

  leadRouter.get('/:id/care-logs', requirePermission('leads.read', { featureName: 'xem lịch sử chăm sóc Lead' }), asyncRoute((req, res) => {
    res.status(200).json({ data: LeadModel.listCareLogs(req.params.id) });
  }));

  leadRouter.put('/:id/reminder', requirePermission('leads.update', { featureName: 'đặt lịch nhắc gọi lại Lead' }), asyncRoute((req, res) => {
    res.status(200).json({ data: LeadModel.setReminder(req.params.id, req.body) });
  }));

  leadRouter.post('/:id/reminder', requirePermission('leads.update', { featureName: 'đặt lịch nhắc gọi lại Lead' }), asyncRoute((req, res) => {
    res.status(200).json({ data: LeadModel.setReminder(req.params.id, req.body) });
  }));

  leadRouter.patch('/:id/reminder/complete', requirePermission('leads.update', { featureName: 'hoàn thành lịch nhắc gọi lại Lead' }), asyncRoute((req, res) => {
    res.status(200).json({ data: LeadModel.completeReminder(req.params.id) });
  }));

  leadRouter.delete('/:id/reminder', requirePermission('leads.update', { featureName: 'xóa lịch nhắc gọi lại Lead' }), asyncRoute((req, res) => {
    res.status(200).json({ data: LeadModel.removeReminder(req.params.id) });
  }));

  leadRouter.delete('/:id', requirePermission('leads.delete', { featureName: 'xóa Lead' }), asyncRoute((req, res) => {
    if (!LeadModel.delete(req.params.id)) {
      throw new LeadError(404, 'LEAD_NOT_FOUND', 'Không tìm thấy Lead.');
    }
    res.status(204).end();
  }));

  // Chuyển đổi Lead đã chốt thành hồ sơ học viên
  leadRouter.post('/:id/convert-to-student', requirePermission('leads.update', { featureName: 'chuyển đổi Lead thành học viên' }), asyncRoute(async (req, res) => {
    const actor = req.user?.fullName || req.user?.name || req.user?.email || 'Tư vấn viên';
    const result = await StudentModel.convertFromLead(req.params.id, req.body, actor);
    res.status(201).json({
      success: true,
      message: 'Chuyển đổi lead thành hồ sơ học viên thành công.',
      data: result
    });
  }));

  leadRouter.post('/:id/convert', requirePermission('leads.update', { featureName: 'chuyển đổi Lead thành học viên' }), asyncRoute(async (req, res) => {
    const actor = req.user?.fullName || req.user?.name || req.user?.email || 'Tư vấn viên';
    const result = await StudentModel.convertFromLead(req.params.id, req.body, actor);
    res.status(201).json({
      success: true,
      message: 'Chuyển đổi lead thành hồ sơ học viên thành công.',
      data: result
    });
  }));

  leadRouter.get('/:id/student', requirePermission('leads.read', { featureName: 'xem hồ sơ học viên của Lead' }), asyncRoute((req, res) => {
    const student = StudentModel.findByLeadId(req.params.id);
    if (!student) {
      throw new LeadError(404, 'STUDENT_NOT_FOUND', 'Lead này chưa có hồ sơ học viên.');
    }
    res.status(200).json({ success: true, data: student });
  }));

  leadRouter.use((error, req, res, next) => {
    if (error instanceof LeadError || error instanceof StudentError) {
      return res.status(error.status).json({
        success: false,
        code: error.code,
        message: error.message,
        ...(error.details ? { existing: error.details } : {})
      });
    }
    return next(error);
  });

  return leadRouter;
}

module.exports = { createLeadRouter };

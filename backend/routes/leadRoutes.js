const express = require('express');
const { requireAuth, requirePermission, requireRoles } = require('../middleware/authMiddleware');
const { LeadError, LeadModel, normalizePhoneNumber } = require('../models/leadModel');
const UserModel = require('../models/userModel');

const asyncRoute = handler => (req, res, next) => {
  Promise.resolve().then(() => handler(req, res, next)).catch(next);
};

function createLeadRouter({ authenticate = requireAuth } = {}) {
  const leadRouter = express.Router();

  leadRouter.use(authenticate);

  const requireAssignmentManager = requireRoles(['admin', 'manager'], {
    featureName: 'phân công Lead'
  });

  function requireLeadScope(req, id) {
    const roles = UserModel.getRoles(req.user);
    if (roles.some(role => role === 'admin' || role === 'manager')) return;
    const lead = LeadModel.findById(id);
    if (roles.includes('training_staff') && String(lead.assignedTo || '') === String(req.user.id)) return;
    throw new LeadError(403, 'LEAD_ACCESS_FORBIDDEN', 'Bạn chỉ được truy cập Lead đang được phân công cho mình.');
  }

  leadRouter.post('/assign-bulk', requireAssignmentManager, asyncRoute((req, res) => {
    const input = req.body || {};
    res.status(200).json({
      data: LeadModel.reassignMany(
        input.leadIds,
        input.consultantId ?? input.assignedTo,
        req.user,
        input.note
      )
    });
  }));

  const reassignSingle = asyncRoute((req, res) => {
    const input = req.body || {};
    res.status(200).json({
      data: LeadModel.reassign(
        req.params.id,
        input.assignedTo ?? input.consultantId,
        req.user,
        input.note
      )
    });
  });
  leadRouter.put('/:id/reassign', requireAssignmentManager, reassignSingle);
  leadRouter.patch('/:id/reassign', requireAssignmentManager, reassignSingle);

  leadRouter.get('/:id/transfer-history', requirePermission('leads.read', { featureName: 'xem lịch sử phân công Lead' }), asyncRoute((req, res) => {
    requireLeadScope(req, req.params.id);
    res.status(200).json({ items: LeadModel.getAssignmentHistory(req.params.id) });
  }));

  leadRouter.get('/', requirePermission('leads.read', { featureName: 'quản lý Lead' }), asyncRoute((req, res) => {
    res.status(200).json(LeadModel.list(req.query, req.user));
  }));

  leadRouter.get('/board', requirePermission('leads.read', { featureName: 'xem bảng phễu Lead' }), asyncRoute((req, res) => {
    res.status(200).json(LeadModel.getPipelineBoard(req.user));
  }));

  leadRouter.get('/pipeline', requirePermission('leads.read', { featureName: 'xem bảng phễu Lead' }), asyncRoute((req, res) => {
    res.status(200).json(LeadModel.getPipelineBoard(req.user));
  }));

  leadRouter.get('/:id/history', requirePermission('leads.read', { featureName: 'xem lịch sử trạng thái Lead' }), asyncRoute((req, res) => {
    requireLeadScope(req, req.params.id);
    res.status(200).json(LeadModel.getLeadHistory(req.params.id));
  }));

  leadRouter.patch('/:id/status', requirePermission('leads.update', { featureName: 'cập nhật trạng thái Lead' }), asyncRoute((req, res) => {
    requireLeadScope(req, req.params.id);
    const actor = req.user?.fullName || req.user?.name || req.user?.email || 'Tư vấn viên';
    res.status(200).json(LeadModel.updateStatus(req.params.id, req.body, actor, req.user));
  }));

  leadRouter.get('/:id', requirePermission('leads.read', { featureName: 'xem Lead' }), asyncRoute((req, res) => {
    requireLeadScope(req, req.params.id);
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
    res.status(200).json(LeadModel.checkPhone(phone, body.excludingLeadId, req.user));
  }));

  leadRouter.post('/', requirePermission('leads.create', { featureName: 'tạo Lead' }), asyncRoute((req, res) => {
    res.status(201).json({ data: LeadModel.create(req.body, req.user) });
  }));

  leadRouter.patch('/:id', requirePermission('leads.update', { featureName: 'cập nhật Lead' }), asyncRoute((req, res) => {
    requireLeadScope(req, req.params.id);
    res.status(200).json({ data: LeadModel.update(req.params.id, req.body) });
  }));

  leadRouter.put('/:id', requirePermission('leads.update', { featureName: 'cập nhật Lead' }), asyncRoute((req, res) => {
    requireLeadScope(req, req.params.id);
    res.status(200).json({ data: LeadModel.update(req.params.id, req.body) });
  }));

  leadRouter.post('/:id/care-logs', requirePermission('leads.update', { featureName: 'ghi nhật ký chăm sóc Lead' }), asyncRoute((req, res) => {
    requireLeadScope(req, req.params.id);
    res.status(201).json({ data: LeadModel.addCareLog(req.params.id, req.body) });
  }));

  leadRouter.get('/:id/care-logs', requirePermission('leads.read', { featureName: 'xem lịch sử chăm sóc Lead' }), asyncRoute((req, res) => {
    requireLeadScope(req, req.params.id);
    res.status(200).json({ data: LeadModel.listCareLogs(req.params.id) });
  }));

  leadRouter.put('/:id/reminder', requirePermission('leads.update', { featureName: 'đặt lịch nhắc gọi lại Lead' }), asyncRoute((req, res) => {
    requireLeadScope(req, req.params.id);
    res.status(200).json({ data: LeadModel.setReminder(req.params.id, req.body) });
  }));

  leadRouter.post('/:id/reminder', requirePermission('leads.update', { featureName: 'đặt lịch nhắc gọi lại Lead' }), asyncRoute((req, res) => {
    requireLeadScope(req, req.params.id);
    res.status(200).json({ data: LeadModel.setReminder(req.params.id, req.body) });
  }));

  leadRouter.patch('/:id/reminder/complete', requirePermission('leads.update', { featureName: 'hoàn thành lịch nhắc gọi lại Lead' }), asyncRoute((req, res) => {
    requireLeadScope(req, req.params.id);
    res.status(200).json({ data: LeadModel.completeReminder(req.params.id) });
  }));

  leadRouter.delete('/:id/reminder', requirePermission('leads.update', { featureName: 'xóa lịch nhắc gọi lại Lead' }), asyncRoute((req, res) => {
    requireLeadScope(req, req.params.id);
    res.status(200).json({ data: LeadModel.removeReminder(req.params.id) });
  }));

  leadRouter.delete('/all', requireRoles(['manager'], { featureName: 'xóa toàn bộ Lead' }), asyncRoute((req, res) => {
    const deletedCount = LeadModel.deleteAll();
    res.status(200).json({
      success: true,
      deletedCount,
      message: `Đã xóa ${deletedCount} Lead.`
    });
  }));

  leadRouter.delete('/:id', requireRoles(['manager'], { featureName: 'xóa Lead' }), asyncRoute((req, res) => {
    if (!LeadModel.delete(req.params.id)) {
      throw new LeadError(404, 'LEAD_NOT_FOUND', 'Không tìm thấy Lead.');
    }
    res.status(204).end();
  }));

  leadRouter.use((error, req, res, next) => {
    if (!(error instanceof LeadError)) return next(error);
    return res.status(error.status).json({
      success: false,
      code: error.code,
      message: error.message,
      ...(error.details ? { existing: error.details } : {})
    });
  });

  return leadRouter;
}

module.exports = { createLeadRouter };

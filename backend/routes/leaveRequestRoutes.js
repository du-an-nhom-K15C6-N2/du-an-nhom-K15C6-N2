const express = require('express');
const router = express.Router();
const LeaveRequestController = require('../controllers/leaveRequestController');
const { requireAuth } = require('../middleware/authMiddleware');
const { sessions } = require('../services/sessionService');
const UserModel = require('../models/userModel');

function leaveAuthMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token && sessions.has(token)) {
    const session = sessions.get(token);
    if (session.expiresAt <= Date.now()) {
      sessions.delete(token);
      return res.status(401).json({
        success: false,
        code: 'SESSION_EXPIRED',
        message: 'Phiên đăng nhập đã hết hạn.'
      });
    }
    const user = UserModel.findById(session.user?.id);
    if (!user || user.status !== 'active') {
      sessions.delete(token);
      return res.status(401).json({
        success: false,
        code: 'SESSION_EXPIRED',
        message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'
      });
    }
    req.sessionToken = token;
    req.session = { ...session, user: UserModel.toPublicUser(user) };
    req.user = user;
    return next();
  }

  return requireAuth(req, res, next);
}

function requireReviewer(req, res, next) {
  const roles = UserModel.getRoles(req.user);
  const canReview = roles.some(role =>
    ['admin', 'manager', 'teacher', 'assistant', 'department_head'].includes(role)
  );

  if (!canReview) {
    return res.status(403).json({
      success: false,
      code: 'ACCESS_FORBIDDEN',
      message: 'Bạn không có quyền kiểm tra hoặc phê duyệt đơn xin nghỉ phép.'
    });
  }

  return next();
}

router.use(leaveAuthMiddleware);

// Options lấy danh sách lớp/buổi học
router.get('/options', LeaveRequestController.getOptions);

// Học viên: Xem danh sách đơn của mình
router.get('/my-requests', LeaveRequestController.getMyRequests);

// Học viên: Gửi đơn xin nghỉ phép mới
router.post('/', LeaveRequestController.createRequest);

// Học viên: Huỷ đơn đang chờ duyệt
router.delete('/:id', LeaveRequestController.cancelRequest);
router.post('/:id/cancel', LeaveRequestController.cancelRequest);

// Giảng viên / Quản lý / Admin: Xem danh sách đơn cần duyệt
router.get('/', requireReviewer, LeaveRequestController.listAllRequests);

// Giảng viên / Quản lý / Admin: Duyệt hoặc từ chối đơn
router.patch('/:id/review', requireReviewer, LeaveRequestController.reviewRequest);
router.post('/:id/review', requireReviewer, LeaveRequestController.reviewRequest);

module.exports = router;

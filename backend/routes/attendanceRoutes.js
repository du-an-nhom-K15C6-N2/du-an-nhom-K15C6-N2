const express = require('express');
const router = express.Router();
const AttendanceController = require('../controllers/attendanceController');
const { requireAuth, requireRoles } = require('../middleware/authMiddleware');
const { sessions } = require('../services/sessionService');
const UserModel = require('../models/userModel');

const requireAttendanceAccess = requireRoles(
  ['admin', 'teacher', 'assistant'],
  { featureName: 'quản lý điểm danh' }
);

function attendanceAuthMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // 1. Kiểm tra nếu token là phiên hoạt động của nhánh feature (session store)
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

  // 2. Mặc định sử dụng kiểm tra JWT token của hệ thống
  return requireAuth(req, res, next);
}

router.use(attendanceAuthMiddleware);

router.get('/', requireAttendanceAccess, AttendanceController.list);

router.get('/students', requireAttendanceAccess, AttendanceController.listStudents);

router.post('/', requireAttendanceAccess, AttendanceController.create);

module.exports = router;

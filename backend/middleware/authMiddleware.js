/**
 * Authentication and Role-based Authorization Middleware
 */
const UserModel = require('../models/userModel');
const { verifyToken } = require('../security/token');

const requireAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null;
  const claims = verifyToken(token);
  if (!claims) {
    return res.status(401).json({
      success: false,
      code: 'SESSION_EXPIRED',
      message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'
    });
  }

  const user = UserModel.findById(claims.sub);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Phiên làm việc không hợp lệ hoặc tài khoản không tồn tại.'
    });
  }

  if (user.status !== 'active') {
    return res.status(403).json({
      success: false,
      message: 'Tài khoản hiện không thể truy cập hệ thống.'
    });
  }

  if (claims.role !== user.role) {
    return res.status(401).json({
      success: false,
      code: 'SESSION_EXPIRED',
      message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'
    });
  }

  req.authToken = token;
  req.tokenExpiry = claims.exp;
  req.sessionId = claims.sid;
  req.user = user;
  next();
};

const requireRoles = (roles, { featureName = 'chức năng này', message } = {}) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      code: 'ACCESS_FORBIDDEN',
      errorType: 'forbidden',
      message: message || 'Bạn không có quyền truy cập chức năng này.',
      featureName,
      role: req.user?.role || null
    });
  }
  next();
};

const requireAdmin = requireRoles(['admin'], {
  featureName: 'quản lý người dùng',
  message: 'Bạn không có quyền quản trị viên (Admin) để thực hiện thao tác này.'
});

module.exports = {
  requireAuth,
  requireAdmin,
  requireRoles
};

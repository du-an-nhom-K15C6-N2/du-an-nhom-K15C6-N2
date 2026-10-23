/**
 * Authentication and Role-based Authorization Middleware
 */
const UserModel = require('../models/userModel');
const { verifyToken } = require('../security/token');
const { hasPermission } = require('../config/rolePermissions');

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

  req.authToken = token;
  req.tokenExpiry = claims.exp;
  req.sessionId = claims.sid;
  req.user = user;
  next();
};

function denyAccess(res, featureName, userRoles, message) {
  return res.status(403).json({
    success: false,
    code: 'ACCESS_FORBIDDEN',
    errorType: 'forbidden',
    message: message || `Bạn chưa được cấp quyền truy cập ${featureName}. Vui lòng liên hệ quản trị viên nếu bạn cần quyền này.`,
    featureName,
    role: userRoles[0] || null,
    roles: userRoles
  });
}

const requireRoles = (roles, { featureName = 'chức năng này', message } = {}) => (req, res, next) => {
  const userRoles = UserModel.getRoles(req.user);
  if (!req.user || !roles.some(role => userRoles.includes(role))) {
    return denyAccess(res, featureName, userRoles, message);
  }
  next();
};

const requirePermission = (
  permission,
  { featureName = 'chức năng này', fieldPermissions = {} } = {}
) => (req, res, next) => {
  const userRoles = UserModel.getRoles(req.user);
  if (!req.user || !hasPermission(req.user, permission)) {
    return denyAccess(res, featureName, userRoles);
  }

  const body = req.body || {};
  for (const [field, fieldPermission] of Object.entries(fieldPermissions)) {
    if (Object.prototype.hasOwnProperty.call(body, field) && !hasPermission(req.user, fieldPermission)) {
      return denyAccess(res, featureName, userRoles);
    }
  }

  next();
};

const requireAdmin = requireRoles(['admin'], {
  featureName: 'quản lý người dùng'
});

module.exports = {
  requireAuth,
  requireAdmin,
  requireRoles,
  requirePermission
};

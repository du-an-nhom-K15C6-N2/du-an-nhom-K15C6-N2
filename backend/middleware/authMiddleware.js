/**
 * Authentication and Role-based Authorization Middleware
 */
const UserModel = require('../models/userModel');

const requireAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // Hỗ trợ kiểm tra token hoặc x-user-id header
  const userId = req.headers['x-user-id'] || (authHeader && authHeader.replace('Bearer ', ''));

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Vui lòng đăng nhập để thực hiện thao tác này.'
    });
  }

  const user = UserModel.findById(userId);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Phiên làm việc không hợp lệ hoặc tài khoản không tồn tại.'
    });
  }

  if (user.status === 'locked') {
    return res.status(403).json({
      success: false,
      message: 'Tài khoản của bạn hiện đang bị tạm khóa. Vui lòng liên hệ quản trị viên.'
    });
  }

  req.user = user;
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền quản trị viên (Admin) để thực hiện thao tác này.'
    });
  }
  next();
};

module.exports = {
  requireAuth,
  requireAdmin
};

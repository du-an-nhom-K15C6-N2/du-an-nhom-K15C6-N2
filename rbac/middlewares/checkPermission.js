const rbacPolicy = require('../config/rbacPolicy');

const checkPermission = (resource, action) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user || !user.role) {
      return res.status(403).json({
        code: 'PERMISSION_DENIED',
        message: 'Bạn không có quyền thực hiện chức năng này. Vui lòng liên hệ Quản trị viên nếu cần hỗ trợ.',
        status: 403,
      });
    }

    const userPermissions = rbacPolicy[user.role] ? rbacPolicy[user.role][resource] : null;

    if (userPermissions && userPermissions.includes(action)) {
      return next();
    }

    return res.status(403).json({
      code: 'PERMISSION_DENIED',
      message: 'Bạn không có quyền thực hiện chức năng này. Vui lòng liên hệ Quản trị viên nếu cần hỗ trợ.',
      status: 403,
    });
  };
};

module.exports = checkPermission;

const UserModel = require('../models/userModel');

let verifyTokenFn = null;
try {
  const tokenModule = require('../security/token');
  verifyTokenFn = tokenModule.verifyToken;
} catch (e) {
  // Fallback demo/token decode
  verifyTokenFn = (token) => {
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      }
    } catch {
      return null;
    }
    return null;
  };
}

const requireAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Vui lòng cung cấp token đăng nhập để tiếp tục.'
    });
  }

  const claims = verifyTokenFn(token);
  if (!claims || !claims.sub) {
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

  req.authToken = token;
  req.user = user;
  next();
};

module.exports = {
  requireAuth
};

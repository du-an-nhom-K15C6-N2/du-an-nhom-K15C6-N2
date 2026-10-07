const crypto = require('crypto');
const UserModel = require('../models/userModel');

const SESSION_TTL = 30 * 1000; // 30 giây theo đặc tả của nhánh feature DNKN
const sessions = new Map();

/**
 * Middleware kiểm tra phiên và trạng thái tài khoản hiện hành
 */
function requireSession(req, res, next) {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const session = sessions.get(token);

  if (!session) {
    return res.status(401).json({
      success: false,
      code: 'SESSION_EXPIRED',
      message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'
    });
  }

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
  next();
}
function revokeOtherSessions(userId, currentToken) {
  for (const [token, session] of sessions.entries()) {
    if (
      session.user?.id === userId &&
      token !== currentToken
    ) {
      sessions.delete(token);
    }
  }
}
module.exports = {
  SESSION_TTL,
  sessions,
  requireSession,
  revokeOtherSessions
};

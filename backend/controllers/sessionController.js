const crypto = require('crypto');
const { sessions, SESSION_TTL } = require('../services/sessionService');
const LoginAttemptService = require('../services/loginAttemptService');
const UserModel = require('../models/userModel');
const { verifyPassword } = require('../security/password');

const ALLOWED_ROLES = new Set(['admin', 'teacher', 'assistant', 'student']);

class SessionController {
  /**
   * Đăng nhập phiên bằng email và mật khẩu.
   */
  static async login(req, res, next) {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';

      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu.' });
      }

      if (
        email.length > 254
        || password.length > 1024
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return res.status(400).json({ success: false, message: 'Thông tin đăng nhập không hợp lệ.' });
      }

      if (LoginAttemptService.isLocked(email)) {
        const retryAfterSeconds = Math.ceil(
          LoginAttemptService.getLockoutRemainingMs(email) / 1000
        );
        res.set('Retry-After', String(retryAfterSeconds));
        return res.status(401).json({
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Email hoặc mật khẩu không đúng',
          retryAfterSeconds
        });
      }

      const user = UserModel.findByEmail(email);
      const isPasswordCorrect = await verifyPassword(password, user?.passwordHash);

      if (!user || !isPasswordCorrect) {
        const failedAttemptState = LoginAttemptService.recordFailedAttempt(email);
        if (failedAttemptState.lockedUntil && failedAttemptState.lockedUntil > Date.now()) {
          const retryAfterSeconds = Math.ceil(
            (failedAttemptState.lockedUntil - Date.now()) / 1000
          );
          res.set('Retry-After', String(retryAfterSeconds));
          return res.status(401).json({
            success: false,
            code: 'INVALID_CREDENTIALS',
            message: 'Email hoặc mật khẩu không đúng',
            retryAfterSeconds
          });
        }
        return res.status(401).json({
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Email hoặc mật khẩu không đúng'
        });
      }

      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          code: user.status === 'pending' ? 'ACCOUNT_PENDING' : 'ACCOUNT_DISABLED',
          message: user.status === 'pending'
            ? 'Tài khoản chưa được kích hoạt.'
            : 'Tài khoản hiện không thể đăng nhập.'
        });
      }
      if (!ALLOWED_ROLES.has(user.role)) {
        return res.status(403).json({
          success: false,
          code: 'ROLE_NOT_SUPPORTED',
          message: 'Tài khoản chưa được cấu hình vai trò truy cập hợp lệ.'
        });
      }

      LoginAttemptService.resetAttempts(email);

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = Date.now() + SESSION_TTL;
      sessions.set(token, {
        email: user.email,
        user: UserModel.toPublicUser(user),
        expiresAt
      });

      return res.status(201).json({
        success: true,
        token,
        expiresAt,
        user: UserModel.toPublicUser(user)
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Kiểm tra thông tin phiên hiện tại
   */
  static async getSession(req, res) {
    return res.status(200).json({ success: true, expiresAt: req.session.expiresAt });
  }

  /**
   * Gia hạn phiên đang hoạt động
   */
  static async renew(req, res) {
    const session = sessions.get(req.sessionToken);
    if (!session) {
      return res.status(401).json({
        success: false,
        code: 'SESSION_EXPIRED',
        message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'
      });
    }

    session.expiresAt = Date.now() + SESSION_TTL;
    return res.status(200).json({ success: true, expiresAt: session.expiresAt });
  }

  /**
   * Đăng xuất và thu hồi phiên
   */
  static async logout(req, res) {
    sessions.delete(req.sessionToken);
    return res.status(200).json({ success: true, message: 'Đã đăng xuất.' });
  }
}

module.exports = SessionController;

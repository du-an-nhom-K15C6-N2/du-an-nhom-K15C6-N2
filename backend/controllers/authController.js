const crypto = require('crypto');
const config = require('../config/app.config');
const UserModel = require('../models/userModel');
const LoginAttemptService = require('../services/loginAttemptService');
const { hashPassword, verifyPassword } = require('../security/password');
const {
  createToken,
  revokeToken,
  revokeSession,
  TOKEN_LIFETIME_SECONDS
} = require('../security/token');

const ALLOWED_ROLES = new Set(['admin', 'teacher', 'assistant', 'student']);
const RESET_TOKEN_TTL = 30 * 60 * 1000;
const resetTokens = new Map();

let nodemailerModule = null;
try {
  nodemailerModule = require('nodemailer');
} catch (e) {
  nodemailerModule = null;
}

function getMailTransporter() {
  const user = process.env.SMTP_USER || config.SMTP_USER;
  const pass = process.env.SMTP_PASS || config.SMTP_PASS;
  if (!nodemailerModule || !user || !pass || user === 'email_cua_ban@gmail.com' || pass === 'xxxx xxxx xxxx xxxx') {
    return null;
  }
  return nodemailerModule.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });
}


class AuthController {
  /**
   * Xử lý Đăng Nhập (Tiêu chí EP-01: AC 1-2-3)
   */
  static async login(req, res, next) {
    try {
      const { email, password } = req.body || {};

      if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập đầy đủ email và mật khẩu.'
        });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      if (
        normalizedEmail.length > 254
        || password.length > 1024
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
      ) {
        return res.status(400).json({
          success: false,
          message: 'Thông tin đăng nhập không hợp lệ.'
        });
      }

      if (LoginAttemptService.isLocked(normalizedEmail)) {
        const retryAfterSeconds = Math.ceil(
          LoginAttemptService.getLockoutRemainingMs(normalizedEmail) / 1000
        );
        res.set('Retry-After', String(retryAfterSeconds));
        return res.status(401).json({
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Email hoặc mật khẩu không đúng',
          retryAfterSeconds
        });
      }

      const user = UserModel.findByEmail(normalizedEmail);
      const isPasswordCorrect = await verifyPassword(password, user?.passwordHash);

      if (!user || !isPasswordCorrect) {
        const failedAttemptState = LoginAttemptService.recordFailedAttempt(normalizedEmail);

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

      LoginAttemptService.resetAttempts(normalizedEmail);

      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          fullName: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          roleLabel: user.roleLabel,
          avatar: user.avatar || null
        },
        token: createToken(user),
        message: 'Đăng nhập thành công'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lấy thông tin tài khoản hiện tại
   */
  static async getMe(req, res, next) {
    try {
      return res.status(200).json({ success: true, user: UserModel.toPublicUser(req.user) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Đổi mật khẩu sau khi xác minh mật khẩu hiện tại.
   */
  static async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body || {};
      if (
        typeof currentPassword !== 'string'
        || typeof newPassword !== 'string'
        || !currentPassword
        || !newPassword
      ) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.'
        });
      }

      if (newPassword.length < 8 || newPassword.length > 1024) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu mới phải có từ 8 đến 1024 ký tự.'
        });
      }

      const isCurrentPasswordCorrect = await verifyPassword(currentPassword, req.user.passwordHash);
      if (!isCurrentPasswordCorrect) {
        return res.status(400).json({
          success: false,
          code: 'CURRENT_PASSWORD_INVALID',
          message: 'Mật khẩu hiện tại không đúng.'
        });
      }

      const passwordHash = await hashPassword(newPassword);
      UserModel.setPassword(req.user.id, passwordHash);
      LoginAttemptService.resetAttempts(req.user.email);

      return res.status(200).json({
        success: true,
        message: 'Đổi mật khẩu thành công.'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Gia hạn token hiện tại trong cùng một phiên đăng nhập.
   */
  static async refresh(req, res) {
    return res.status(200).json({
      success: true,
      token: createToken(req.user, req.sessionId),
      expiresIn: TOKEN_LIFETIME_SECONDS
    });
  }

  /**
   * Đăng xuất
   */
  static async logout(req, res) {
    const tokenExpiry = Math.max(
      req.tokenExpiry || 0,
      Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS
    );
    revokeToken(req.authToken, tokenExpiry);
    revokeSession(req.sessionId, tokenExpiry);
    return res.status(200).json({
      success: true,
      message: 'Đăng xuất thành công khỏi hệ thống.'
    });
  }

  /**
   * Yêu cầu khôi phục mật khẩu (Gửi liên kết đặt lại mật khẩu)
   */
  static async forgotPassword(req, res, next) {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập địa chỉ email.' });
      }

      const user = UserModel.findByEmail(email);
      if (user) {
        const now = Date.now();
        for (const [existingToken, request] of resetTokens) {
          if (request.expiresAt <= now) resetTokens.delete(existingToken);
        }

        const token = crypto.randomBytes(32).toString('hex');
        resetTokens.set(token, {
          email: user.email,
          expiresAt: now + RESET_TOKEN_TTL
        });

        const baseUrl = (process.env.RESET_PASSWORD_URL || config.RESET_PASSWORD_URL
          || `http://localhost:${config.PORT || 3000}`).replace(/\/+$/, '');
        const resetLink = `${baseUrl}/reset-password.html?token=${token}`;
        const mailer = getMailTransporter();
        if (mailer) {
          try {
            await mailer.sendMail({
              from: `"Hệ Thống Điểm Danh" <${process.env.SMTP_USER || config.SMTP_USER}>`,
              to: user.email,
              subject: 'Mã và liên kết đặt lại mật khẩu',
              html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                  <h2 style="color: #2563eb; text-align: center; margin-top: 0;">Khôi Phục Mật Khẩu</h2>
                  <p>Bạn đã yêu cầu đặt lại mật khẩu trên hệ thống. Liên kết dưới đây có hiệu lực trong vòng <strong>30 phút</strong> và chỉ sử dụng được một lần:</p>
                  <div style="text-align: center; margin: 25px 0;">
                    <a href="${resetLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Đặt Lại Mật Khẩu Ngay</a>
                  </div>

                  <p style="font-size: 13px; color: #64748b;">Hoặc truy cập trực tiếp liên kết sau:</p>
                  <p style="font-size: 13px; word-break: break-all;"><a href="${resetLink}" style="color: #2563eb;">${resetLink}</a></p>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                  <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">Nếu bạn không yêu cầu hành động này, vui lòng bỏ qua email.</p>
                </div>
              `
            });
          } catch (mailErr) {
            resetTokens.delete(token);
            console.error(`Lỗi khi gửi email đến ${user.email}:`, mailErr.message);
          }
        } else {
          if (process.env.NODE_ENV !== 'production') {
            console.info(`[Chế độ phát triển] Liên kết đặt lại mật khẩu: ${resetLink}`);
          } else {
            console.error('Chưa cấu hình SMTP_USER/SMTP_PASS; không thể gửi email đặt lại mật khẩu.');
          }
        }
      }

      const hasSmtpConfiguration = Boolean(getMailTransporter());
      return res.status(200).json({
        success: true,
        message: hasSmtpConfiguration
          ? 'Yêu cầu đã được tiếp nhận. Nếu địa chỉ email tồn tại trong hệ thống, hướng dẫn sẽ được gửi đến hộp thư.'
          : 'Yêu cầu đã được tiếp nhận. SMTP chưa cấu hình nên ở môi trường local, hãy lấy liên kết đặt lại trong terminal đang chạy backend.'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Đặt lại mật khẩu mới thông qua token
   */
  static async resetPassword(req, res, next) {
    try {
      const { token, password } = req.body || {};
      const resetRequest = typeof token === 'string' ? resetTokens.get(token) : null;

      if (!resetRequest || resetRequest.expiresAt <= Date.now()) {
        if (resetRequest) resetTokens.delete(token);
        return res.status(400).json({
          success: false,
          message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'
        });
      }

      if (typeof password !== 'string' || password.length < 8 || password.length > 1024) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu phải có từ 8 đến 1024 ký tự.'
        });
      }

      const user = UserModel.findByEmail(resetRequest.email);
      if (!user) {
        resetTokens.delete(token);
        return res.status(400).json({
          success: false,
          message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'
        });
      }

      // Xóa trước thao tác bất đồng bộ để chỉ một yêu cầu đồng thời có thể dùng token.
      resetTokens.delete(token);
      const hashed = await hashPassword(password);
      UserModel.setPassword(user.id, hashed);

      return res.status(200).json({
        success: true,
        message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
module.exports.resetTokens = resetTokens;

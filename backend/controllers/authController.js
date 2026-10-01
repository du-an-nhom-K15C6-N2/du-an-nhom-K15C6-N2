/**
 * TTCS Classroom Security Application - Auth Controller
 * Handles authentication, registration, token activation, and authorization
 */

const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');
const userService = require('../services/userService');

class AuthController {
  /**
   * Đăng ký tài khoản người dùng mới (Public Register) [DNKN-59]
   * POST /api/auth/register
   */
  static async register(req, res, next) {
    try {
      const { name, email, phone, role, password } = req.body;

      const result = await userService.createUser({
        name,
        email,
        phone,
        role: role || 'student',
        password,
        status: 'pending' // Chờ kích hoạt qua email
      });

      return res.status(201).json({
        success: true,
        message: `Đăng ký tài khoản thành công! Hệ thống đã gửi email kích hoạt tới ${result.user.email}.`,
        data: result.user,
        activation: result.activation
      });
    } catch (error) {
      const statusCode = error.statusCode || 400;
      return res.status(statusCode).json({
        success: false,
        code: error.code || 'REGISTER_ERROR',
        message: error.message || 'Lỗi khi đăng ký tài khoản.'
      });
    }
  }

  /**
   * Kích hoạt tài khoản qua Token [DNKN-59]
   * GET & POST /api/auth/activate
   */
  static async activateAccount(req, res, next) {
    try {
      const token = req.query.token || (req.body && req.body.token);

      if (!token) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_TOKEN',
          message: 'Vui lòng cung cấp mã token kích hoạt tài khoản.'
        });
      }

      const result = await userService.activateUser(token);

      // Nếu yêu cầu xuất phát từ việc bấm link trực tiếp trên trình duyệt
      if (req.accepts('html') && !req.xhr && req.headers['content-type'] !== 'application/json') {
        return res.status(200).send(`
          <!DOCTYPE html>
          <html lang="vi">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Kích Hoạt Tài Khoản Thành Công - EduClass</title>
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
            <style>
              body { font-family: 'Plus Jakarta Sans', sans-serif; background: #0b0f19; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
              .card { background: #131b2e; border: 1px solid #1e293b; border-radius: 18px; padding: 44px 36px; max-width: 480px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
              .icon { font-size: 56px; margin-bottom: 16px; animation: bounce 1s infinite alternate; }
              @keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-8px); } }
              h1 { font-size: 22px; font-weight: 800; color: #38bdf8; margin: 0 0 12px; }
              p { color: #94a3b8; line-height: 1.6; font-size: 14px; margin-bottom: 24px; }
              .user-box { background: #0a0f1d; border: 1px solid #1e293b; border-radius: 10px; padding: 14px; margin-bottom: 28px; font-size: 13px; color: #cbd5e1; }
              .btn { background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); color: white; text-decoration: none; padding: 12px 32px; border-radius: 9999px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4); }
              .btn:hover { opacity: 0.95; transform: translateY(-1px); }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon">🎉</div>
              <h1>Kích Hoạt Tài Khoản Thành Công!</h1>
              <p>Xin chúc mừng <strong>${result.user.name}</strong> (${result.user.email})! Tài khoản của bạn đã được xác thực an toàn và kích hoạt thành công trên hệ thống EduClass.</p>
              <div class="user-box">
                Vai trò: <strong>${result.user.roleLabel}</strong> • Trạng thái: <span style="color:#10b981;font-weight:700;">Đang hoạt động</span>
              </div>
              <a href="/" class="btn">Đến Màn Hình Đăng Nhập</a>
            </div>
          </body>
          </html>
        `);
      }

      return res.status(200).json(result);
    } catch (error) {
      const statusCode = error.statusCode || 400;

      if (req.accepts('html') && !req.xhr && req.headers['content-type'] !== 'application/json') {
        return res.status(statusCode).send(`
          <!DOCTYPE html>
          <html lang="vi">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Lỗi Kích Hoạt Tài Khoản - EduClass</title>
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
            <style>
              body { font-family: 'Plus Jakarta Sans', sans-serif; background: #0b0f19; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
              .card { background: #131b2e; border: 1px solid #ef4444; border-radius: 18px; padding: 40px 32px; max-width: 480px; text-align: center; }
              .icon { font-size: 56px; margin-bottom: 16px; }
              h1 { font-size: 20px; font-weight: 800; color: #ef4444; margin: 0 0 12px; }
              p { color: #94a3b8; line-height: 1.6; font-size: 14px; margin-bottom: 24px; }
              .btn { background: #1e293b; color: white; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon">⚠️</div>
              <h1>Kích Hoạt Không Thành Công</h1>
              <p>${error.message}</p>
              <a href="/" class="btn">Quay lại Trang Chủ</a>
            </div>
          </body>
          </html>
        `);
      }

      return res.status(statusCode).json({
        success: false,
        code: error.code || 'ACTIVATION_ERROR',
        message: error.message
      });
    }
  }

  /**
   * Xử lý Đăng Nhập (Tiêu chí EP-01: AC 1-2-3)
   * POST /api/auth/login
   */
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Vui lòng nhập đầy đủ email và mật khẩu.'
        });
      }

      const user = userRepository.findByEmail(email);

      // Kiểm tra mật khẩu (Hỗ trợ bcrypt hash và mật khẩu mẫu demo 123456 / Password123!)
      let isPasswordCorrect = false;
      if (user && user.passwordHash) {
        isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
      }
      if (!isPasswordCorrect && (password === '123456' || password === 'Password123!')) {
        isPasswordCorrect = true;
      }

      if (!user || !isPasswordCorrect) {
        // Tiêu chí AC2: Lỗi luôn là 'Email hoặc mật khẩu không đúng' để tránh lộ thông tin người dùng
        return res.status(401).json({
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Email hoặc mật khẩu không đúng'
        });
      }

      // Kiểm tra tài khoản có bị khóa trong hệ thống hay không
      if (user.status === 'locked') {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_LOCKED',
          message: 'Tài khoản của bạn hiện đang bị khóa trong hệ thống. Vui lòng liên hệ quản trị viên.'
        });
      }

      // Kiểm tra tài khoản chưa kích hoạt [DNKN-59]
      if (user.status === 'pending') {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_PENDING_ACTIVATION',
          message: 'Tài khoản của bạn chưa được kích hoạt. Vui lòng kiểm tra email kích hoạt được gửi tới hòm thư của bạn.'
        });
      }

      // Đăng nhập thành công (AC1)
      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          roleLabel: user.roleLabel,
          status: user.status,
          statusLabel: user.statusLabel
        },
        token: `mock_jwt_token_${user.id}`,
        message: 'Đăng nhập thành công'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lấy thông tin tài khoản hiện tại
   * GET /api/auth/me
   */
  static async getMe(req, res, next) {
    try {
      const userId = req.headers['x-user-id'] || req.query.id;
      if (!userId) {
        return res.status(400).json({ success: false, message: 'Thiếu định danh tài khoản.' });
      }

      const user = userRepository.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
      }

      return res.status(200).json({ success: true, user });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Đăng xuất
   * POST /api/auth/logout
   */
  static async logout(req, res) {
    return res.status(200).json({
      success: true,
      message: 'Đăng xuất thành công khỏi hệ thống.'
    });
  }

  /**
   * Yêu cầu khôi phục mật khẩu (Gửi OTP)
   * POST /api/auth/forgot-password
   */
  static async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập địa chỉ email.' });
      }

      const user = userRepository.findByEmail(email);
      return res.status(200).json({
        success: true,
        message: `Mã OTP khôi phục mật khẩu đã được gửi đến email ${email} (nếu email tồn tại trong hệ thống).`
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;

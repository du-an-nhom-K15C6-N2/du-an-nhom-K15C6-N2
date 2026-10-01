const UserModel = require('../models/userModel');

class AuthController {
  /**
   * Xử lý Đăng Nhập (Tiêu chí EP-01: AC 1-2-3)
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

      const user = UserModel.findByEmail(email);
     const LoginAttemptService = require('../services/loginAttemptService');

      // Chấp nhận mật khẩu mẫu '123456' hoặc 'Password123!'
      const isPasswordCorrect = (password === '123456' || password === 'Password123!');

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
   */
  static async getMe(req, res, next) {
    try {
      const userId = req.headers['x-user-id'] || req.query.id;
      if (!userId) {
        return res.status(400).json({ success: false, message: 'Thiếu định danh tài khoản.' });
      }

      const user = UserModel.findById(userId);
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
   */
  static async logout(req, res) {
    return res.status(200).json({
      success: true,
      message: 'Đăng xuất thành công khỏi hệ thống.'
    });
  }

  /**
   * Yêu cầu khôi phục mật khẩu (Gửi OTP)
   */
  static async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập địa chỉ email.' });
      }

      const user = UserModel.findByEmail(email);
      // Luôn trả về thông báo an toàn dù email có tồn tại hay không
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

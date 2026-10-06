const UserModel = require('../models/userModel');
const { hashPassword } = require('../security/password');
const LoginAttemptService = require('../services/loginAttemptService');

class UserController {
  /**
   * Lấy danh sách người dùng có Tìm kiếm, Lọc, Phân trang 20 dòng/trang (AC3 & AC4)
   * GET /api/users
   */
  static async getUsers(req, res, next) {
    try {
      const { page = 1, pageSize = 20, search = '', role = 'all', status = 'all' } = req.query;

      const result = UserModel.findAll({
        page: parseInt(page, 10) || 1,
        pageSize: parseInt(pageSize, 10) || 20,
        search,
        role,
        status
      });

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lấy toàn bộ danh sách (dùng cho debug/presets)
   * GET /api/users/all
   */
  static async getAllList(req, res, next) {
    try {
      const users = UserModel.getAllRaw();
      return res.status(200).json({
        success: true,
        data: users
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lấy chi tiết một người dùng
   * GET /api/users/:id
   */
  static async getUserById(req, res, next) {
    try {
      const { id } = req.params;
      const user = UserModel.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          code: 'RESOURCE_NOT_FOUND',
          errorType: 'not-found',
          resource: 'user',
          message: 'Không tìm thấy tài khoản người dùng.'
        });
      }

      return res.status(200).json({
        success: true,
        data: UserModel.toPublicUser(user)
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Tạo tài khoản người dùng mới (AC1 & AC2)
   * POST /api/users
   */
  static async createUser(req, res, next) {
    try {
      const { name, email, phone, role, status, password } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Họ và tên không được để trống.' });
      }
      if (!email || !email.trim()) {
        return res.status(400).json({ success: false, message: 'Địa chỉ email không được để trống.' });
      }
      if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 8 ký tự.' });
      }

      // Kiểm tra định dạng email cơ bản
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ success: false, message: 'Định dạng email không hợp lệ.' });
      }

      const passwordHash = await hashPassword(password);
      const newUser = UserModel.create({
        name,
        email,
        phone: phone || '',
        role: role || 'student',
        status: status || 'active',
        passwordHash
      });

      return res.status(201).json({
        success: true,
        data: UserModel.toPublicUser(newUser),
        message: 'Tạo tài khoản thành công.'
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Lỗi khi tạo người dùng.'
      });
    }
  }

  /**
   * Cập nhật thông tin tài khoản
   * PUT /api/users/:id
   */
  static async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const { name, email, phone, role, status } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Họ và tên không được để trống.' });
      }
      if (!email || !email.trim()) {
        return res.status(400).json({ success: false, message: 'Email không được để trống.' });
      }

      const updatedUser = UserModel.update(id, {
        name,
        email,
        phone,
        role,
        status
      });

      return res.status(200).json({
        success: true,
        data: UserModel.toPublicUser(updatedUser),
        message: 'Cập nhật thông tin tài khoản thành công!'
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Lỗi khi cập nhật tài khoản.'
      });
    }
  }

  /**
   * Khóa / Mở khóa tài khoản
   * PATCH /api/users/:id/toggle-lock
   */
  static async toggleLock(req, res, next) {
    try {
      const { id } = req.params;
      const updated = UserModel.toggleLock(id);

      const message = updated.status === 'locked'
        ? `Đã tạm khóa tài khoản ${updated.name}.`
        : `Đã mở khóa tài khoản ${updated.name}.`;

      return res.status(200).json({
        success: true,
        data: UserModel.toPublicUser(updated),
        message
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Lỗi khi thay đổi trạng thái khóa.'
      });
    }
  }

  static async setPassword(req, res, next) {
    try {
      const { password } = req.body || {};
      if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu phải có ít nhất 8 ký tự.'
        });
      }

      const passwordHash = await hashPassword(password);
      const updatedUser = UserModel.setPassword(req.params.id, passwordHash);
      LoginAttemptService.resetAttempts(updatedUser.email);
      return res.status(200).json({
        success: true,
        data: UserModel.toPublicUser(updatedUser),
        message: 'Đã cập nhật mật khẩu người dùng.'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Xóa tài khoản người dùng
   * DELETE /api/users/:id
   */
  static async deleteUser(req, res, next) {
    try {
      const { id } = req.params;
      UserModel.delete(id);

      return res.status(200).json({
        success: true,
        message: 'Đã xóa tài khoản khỏi hệ thống thành công.'
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Lỗi khi xóa người dùng.'
      });
    }
  }

  /**
   * Reset dữ liệu người dùng về 28 tài khoản mặc định
   * POST /api/users/reset
   */
  static async resetData(req, res, next) {
    try {
      const users = UserModel.reset();
      return res.status(200).json({
        success: true,
        data: users.map(UserModel.toPublicUser),
        message: 'Đã reset cơ sở dữ liệu về 28 tài khoản ban đầu thành công.'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UserController;

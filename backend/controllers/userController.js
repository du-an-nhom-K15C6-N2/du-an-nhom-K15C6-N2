/**
 * TTCS Classroom Security Application - User Controller
 * Handles user management HTTP requests and responses
 */

const userService = require('../services/userService');

class UserController {
  /**
   * Lấy danh sách người dùng có Tìm kiếm, Lọc, Phân trang 20 dòng/trang (AC3 & AC4)
   * GET /api/users
   */
  static async getUsers(req, res, next) {
    try {
      const { page = 1, pageSize = 20, search = '', role = 'all', status = 'all' } = req.query;

      const result = userService.getUsers({
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
      const users = userService.getUsers({ pageSize: 1000 });
      return res.status(200).json({
        success: true,
        data: users.data
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
      const user = userService.getUserById(id);

      return res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      const statusCode = error.statusCode || 400;
      return res.status(statusCode).json({
        success: false,
        code: error.code || 'USER_ERROR',
        message: error.message
      });
    }
  }

  /**
   * Tạo tài khoản người dùng mới kèm gửi email kích hoạt [DNKN-59]
   * POST /api/users
   */
  static async createUser(req, res, next) {
    try {
      const { name, email, phone, role, password, status } = req.body;

      const result = await userService.createUser({
        name,
        email,
        phone,
        role,
        password,
        status
      });

      return res.status(201).json({
        success: true,
        data: result.user,
        activation: result.activation,
        message: `Tạo tài khoản thành công! Hệ thống đã gửi email kích hoạt tới địa chỉ ${result.user.email}.`
      });
    } catch (error) {
      const statusCode = error.statusCode || 400;
      return res.status(statusCode).json({
        success: false,
        code: error.code || 'CREATE_USER_ERROR',
        message: error.message || 'Lỗi khi tạo tài khoản người dùng.'
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

      const updatedUser = userService.updateUser(id, {
        name,
        email,
        phone,
        role,
        status
      });

      return res.status(200).json({
        success: true,
        data: updatedUser,
        message: 'Cập nhật thông tin tài khoản thành công!'
      });
    } catch (error) {
      const statusCode = error.statusCode || 400;
      return res.status(statusCode).json({
        success: false,
        code: error.code || 'UPDATE_USER_ERROR',
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
      const updated = userService.toggleLock(id);

      const message = updated.status === 'locked'
        ? `Đã tạm khóa tài khoản ${updated.name}.`
        : `Đã mở khóa tài khoản ${updated.name}.`;

      return res.status(200).json({
        success: true,
        data: updated,
        message
      });
    } catch (error) {
      const statusCode = error.statusCode || 400;
      return res.status(statusCode).json({
        success: false,
        code: error.code || 'TOGGLE_LOCK_ERROR',
        message: error.message || 'Lỗi khi thay đổi trạng thái khóa.'
      });
    }
  }

  /**
   * Xóa tài khoản người dùng
   * DELETE /api/users/:id
   */
  static async deleteUser(req, res, next) {
    try {
      const { id } = req.params;
      userService.deleteUser(id);

      return res.status(200).json({
        success: true,
        message: 'Đã xóa tài khoản khỏi hệ thống thành công.'
      });
    } catch (error) {
      const statusCode = error.statusCode || 400;
      return res.status(statusCode).json({
        success: false,
        code: error.code || 'DELETE_USER_ERROR',
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
      const users = userService.resetData();
      return res.status(200).json({
        success: true,
        data: users,
        message: 'Đã reset cơ sở dữ liệu về 28 tài khoản ban đầu thành công.'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UserController;

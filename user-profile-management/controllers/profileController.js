/**
 * Profile Controller - Module user-profile-management (DNKN-86)
 * Xử lý API Xem và Cập nhật hồ sơ cá nhân của người dùng
 */

const UserModel = require('../models/userModel');
const { isValidVietnamPhone, normalizeVietnamPhone } = require('../utils/phoneValidator');

class ProfileController {
  /**
   * [BE] API Lấy thông tin hồ sơ cá nhân của người dùng hiện tại
   * GET /api/profile
   */
  static async getProfile(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Vui lòng đăng nhập để xem thông tin hồ sơ.'
        });
      }

      // Đọc thông tin mới nhất từ cơ sở dữ liệu
      const latestUser = UserModel.findById(req.user.id) || req.user;
      const publicProfile = UserModel.toPublicUser(latestUser);

      return res.status(200).json({
        success: true,
        data: publicProfile
      });
    } catch (error) {
      if (typeof next === 'function') next(error);
      else res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * [BE] API Cập nhật hồ sơ cá nhân với kiểm soát trường được phép sửa
   * PUT /api/profile
   * PATCH /api/profile
   */
  static async updateProfile(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Vui lòng đăng nhập để cập nhật thông tin hồ sơ.'
        });
      }

      const body = req.body || {};

      // 1. KIỂM SOÁT CÁC TRƯỜNG BỊ CẤM SỬA (Email và Vai trò)
      // Chặn đổi email nếu khác với email hiện tại của tài khoản
      if (body.email !== undefined && body.email !== null) {
        const normalizedInputEmail = String(body.email).trim().toLowerCase();
        const currentEmail = String(req.user.email).trim().toLowerCase();
        if (normalizedInputEmail !== currentEmail) {
          return res.status(400).json({
            success: false,
            code: 'EMAIL_IMMUTABLE',
            field: 'email',
            message: 'Không được phép thay đổi địa chỉ email.'
          });
        }
      }

      // Chặn đổi vai trò (role) nếu khác với vai trò hiện tại
      if (body.role !== undefined && body.role !== null) {
        const inputRole = String(body.role).trim().toLowerCase();
        const currentRole = String(req.user.role).trim().toLowerCase();
        if (inputRole !== currentRole) {
          return res.status(400).json({
            success: false,
            code: 'ROLE_IMMUTABLE',
            field: 'role',
            message: 'Không được phép tự thay đổi vai trò người dùng.'
          });
        }
      }

      // Chặn đổi ID và trạng thái tài khoản
      if (body.id !== undefined && body.id !== null && body.id !== req.user.id) {
        return res.status(400).json({
          success: false,
          code: 'ID_IMMUTABLE',
          field: 'id',
          message: 'Không được phép thay đổi mã định danh tài khoản.'
        });
      }

      if (body.status !== undefined && body.status !== null && body.status !== req.user.status) {
        return res.status(400).json({
          success: false,
          code: 'STATUS_IMMUTABLE',
          field: 'status',
          message: 'Không được phép tự thay đổi trạng thái tài khoản.'
        });
      }

      // 2. KIỂM TRA HỌ VÀ TÊN (Bắt buộc, không được để trống)
      const inputName = body.name !== undefined ? body.name : body.fullName;
      if (inputName !== undefined) {
        if (typeof inputName !== 'string' || !inputName.trim()) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_NAME',
            field: 'name',
            message: 'Họ và tên không được để trống.'
          });
        }
      }

      // 3. XÁC THỰC VÀ CHUẨN HÓA SỐ ĐIỆN THOẠI VIỆT NAM Phía Máy Chủ
      let normalizedPhone = undefined;
      if (body.phone !== undefined) {
        if (typeof body.phone !== 'string' || !body.phone.trim()) {
          return res.status(400).json({
            success: false,
            code: 'MISSING_PHONE',
            field: 'phone',
            message: 'Số điện thoại không được để trống.'
          });
        }

        if (!isValidVietnamPhone(body.phone)) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_PHONE_FORMAT',
            field: 'phone',
            message: 'Số điện thoại không đúng định dạng Việt Nam (10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09).'
          });
        }

        // Chuẩn hóa định dạng chuẩn (10 chữ số bắt đầu bằng 0) trước khi lưu
        normalizedPhone = normalizeVietnamPhone(body.phone);
      }

      // 4. KIỂM TRA NGÀY SINH (Nếu có nhập)
      const inputDob = body.dob !== undefined ? body.dob : (body.birthDate !== undefined ? body.birthDate : body.dateOfBirth);
      if (inputDob !== undefined && inputDob !== null && String(inputDob).trim() !== '') {
        const dobStr = String(inputDob).trim();
        const dobDate = new Date(dobStr);
        if (isNaN(dobDate.getTime())) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_DOB',
            field: 'dob',
            message: 'Ngày sinh không hợp lệ.'
          });
        }

        const now = new Date();
        if (dobDate > now) {
          return res.status(400).json({
            success: false,
            code: 'FUTURE_DOB',
            field: 'dob',
            message: 'Ngày sinh không thể là ngày trong tương lai.'
          });
        }
      }

      // 5. CẬP NHẬT DỮ LIỆU VÀO CƠ SỞ DỮ LIỆU
      const updateData = {};
      if (inputName !== undefined) updateData.name = inputName.trim();
      if (normalizedPhone !== undefined) updateData.phone = normalizedPhone;
      if (inputDob !== undefined) updateData.dob = String(inputDob).trim();
      if (body.address !== undefined) updateData.address = String(body.address).trim();

      const updatedUser = UserModel.updateProfile(req.user.id, updateData);

      // Cập nhật lại đối tượng req.user trong phiên hiện tại
      req.user = updatedUser;

      return res.status(200).json({
        success: true,
        message: 'Cập nhật hồ sơ cá nhân thành công.',
        data: UserModel.toPublicUser(updatedUser)
      });
    } catch (error) {
      if (typeof next === 'function') next(error);
      else res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = ProfileController;

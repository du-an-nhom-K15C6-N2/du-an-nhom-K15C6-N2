/**
 * Controller xử lý Xem và Cập nhật hồ sơ cá nhân
 * Hỗ trợ các trường: họ tên, số điện thoại, ngày sinh, địa chỉ
 * Chặn tự thay đổi email và vai trò
 * Xác thực và chuẩn hóa số điện thoại Việt Nam ở phía máy chủ
 */

const UserModel = require('../models/userModel');
const { normalizeVietnamesePhone } = require('../services/vietnamPhoneService');

// DNKN87: Xu ly va luu anh dai dien
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

class ProfileController {
  /**
   * [BE] Lấy thông tin hồ sơ cá nhân của người dùng hiện tại
   * GET /api/profile
   * GET /api/auth/profile
   */
  static async getProfile(req, res, next) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Vui lòng đăng nhập để xem thông tin hồ sơ.'
        });
      }

      const user = UserModel.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'Không tìm thấy thông tin tài khoản người dùng.'
        });
      }

      const publicUser = UserModel.toPublicUser(user);

      return res.status(200).json({
        success: true,
        data: publicUser,
        user: publicUser
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * [BE] Cập nhật thông tin hồ sơ cá nhân
   * PUT /api/profile
   * PATCH /api/profile
   * PUT /api/auth/profile
   * PATCH /api/auth/profile
   * 
   * Cho phép sửa: họ tên, số điện thoại, ngày sinh, địa chỉ
   * Chặn sửa: email, vai trò (role, roles)
   * Kiểm tra và chuẩn hóa số điện thoại Việt Nam
   */
  static async updateProfile(req, res, next) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Vui lòng đăng nhập để thực hiện cập nhật hồ sơ.'
        });
      }

      const currentUser = UserModel.findById(req.user.id);
      if (!currentUser) {
        return res.status(404).json({
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'Không tìm thấy tài khoản người dùng cần cập nhật.'
        });
      }

      const body = req.body || {};

      // 1. Kiểm tra trường cấm thay đổi: EMAIL
      if (body.email !== undefined) {
        const requestedEmail = String(body.email).trim().toLowerCase();
        const currentEmail = String(currentUser.email).trim().toLowerCase();
        if (requestedEmail && requestedEmail !== currentEmail) {
          return res.status(400).json({
            success: false,
            code: 'EMAIL_CHANGE_NOT_ALLOWED',
            message: 'Không được phép thay đổi địa chỉ email. Email được quản lý bởi quản trị viên.'
          });
        }
      }

      // 2. Kiểm tra trường cấm thay đổi: VAI TRÒ (role, roles)
      if (body.role !== undefined) {
        const requestedRole = String(body.role).trim();
        const currentRole = String(currentUser.role).trim();
        if (requestedRole && requestedRole !== currentRole) {
          return res.status(400).json({
            success: false,
            code: 'ROLE_CHANGE_NOT_ALLOWED',
            message: 'Không được phép thay đổi vai trò tài khoản. Vai trò do ban quản trị phân quyền.'
          });
        }
      }

      if (body.roles !== undefined) {
        const requestedRoles = Array.isArray(body.roles) ? body.roles : [body.roles];
        const currentRoles = UserModel.getRoles(currentUser);
        const isRolesEqual = requestedRoles.length === currentRoles.length
          && requestedRoles.every(r => currentRoles.includes(r));
        if (!isRolesEqual) {
          return res.status(400).json({
            success: false,
            code: 'ROLE_CHANGE_NOT_ALLOWED',
            message: 'Không được phép thay đổi danh sách vai trò tài khoản.'
          });
        }
      }

      // 3. Kiểm tra các trường nhạy cảm không được phép sửa qua API hồ sơ
      const securityFields = ['status', 'password', 'passwordHash', 'permissions', 'activationTokenHash', 'activationExpiresAt', 'lockReason'];
      for (const field of securityFields) {
        if (body[field] !== undefined) {
          return res.status(400).json({
            success: false,
            code: 'UNAUTHORIZED_FIELD',
            message: `Không được phép chỉnh sửa trường bảo mật '${field}'.`
          });
        }
      }

      // 4. Kiểm tra và chuẩn hóa Họ và Tên (name hoặc fullName)
      const rawName = body.name !== undefined ? body.name : body.fullName;
      if (rawName !== undefined) {
        if (typeof rawName !== 'string' || !rawName.trim()) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_NAME',
            message: 'Họ và tên không được để trống.'
          });
        }
        if (rawName.trim().length < 2 || rawName.trim().length > 120) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_NAME',
            message: 'Họ và tên phải có độ dài từ 2 đến 120 ký tự.'
          });
        }
      }

      // 5. Kiểm tra và chuẩn hóa Số điện thoại Việt Nam (phone hoặc phoneNumber)
      const rawPhone = body.phone !== undefined ? body.phone : body.phoneNumber;
      let normalizedPhone = currentUser.phone || '';

      if (rawPhone !== undefined) {
        if (typeof rawPhone !== 'string' || !rawPhone.trim()) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_PHONE_FORMAT',
            message: 'Vui lòng nhập số điện thoại liên lạc.'
          });
        }

        const phoneResult = normalizeVietnamesePhone(rawPhone);
        if (!phoneResult.isValid) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_PHONE_FORMAT',
            message: phoneResult.error
          });
        }
        normalizedPhone = phoneResult.normalized;
      }

      // 6. Kiểm tra Ngày sinh (dateOfBirth hoặc dob hoặc birthDate)
      const rawDob = body.dateOfBirth !== undefined
        ? body.dateOfBirth
        : (body.dob !== undefined ? body.dob : body.birthDate);
      let normalizedDob = currentUser.dateOfBirth || currentUser.dob || '';

      if (rawDob !== undefined && rawDob !== null && String(rawDob).trim() !== '') {
        const dobStr = String(rawDob).trim();
        // Kiểm tra định dạng ngày YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dobStr)) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_DATE_OF_BIRTH',
            message: 'Ngày sinh không đúng định dạng hợp lệ (YYYY-MM-DD).'
          });
        }

        const dobDate = new Date(dobStr);
        if (Number.isNaN(dobDate.getTime())) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_DATE_OF_BIRTH',
            message: 'Ngày sinh không hợp lệ.'
          });
        }

        const now = new Date();
        // So sánh ngày sinh với thời điểm hiện tại (không được trong tương lai)
        if (dobDate > now) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_DATE_OF_BIRTH',
            message: 'Ngày sinh không thể là ngày trong tương lai.'
          });
        }

        const year = dobDate.getFullYear();
        if (year < 1900) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_DATE_OF_BIRTH',
            message: 'Năm sinh không hợp lệ (phải từ năm 1900 trở lại đây).'
          });
        }

        normalizedDob = dobStr;
      }

      // 7. Kiểm tra Địa chỉ (address hoặc diaChi)
      const rawAddress = body.address !== undefined ? body.address : body.diaChi;
      let normalizedAddress = currentUser.address || '';

      if (rawAddress !== undefined && rawAddress !== null) {
        if (typeof rawAddress !== 'string') {
          return res.status(400).json({
            success: false,
            code: 'INVALID_ADDRESS',
            message: 'Địa chỉ phải là chuỗi văn bản hợp lệ.'
          });
        }
        if (rawAddress.trim().length > 255) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_ADDRESS',
            message: 'Địa chỉ không được vượt quá 255 ký tự.'
          });
        }
        normalizedAddress = rawAddress.trim();
      }

      // 8. Thực hiện cập nhật vào cơ sở dữ liệu
      const updatedUser = UserModel.updateProfile(currentUser.id, {
        name: rawName !== undefined ? rawName.trim() : currentUser.name,
        phone: normalizedPhone,
        dateOfBirth: normalizedDob,
        dob: normalizedDob,
        address: normalizedAddress
      });

      const publicUser = UserModel.toPublicUser(updatedUser);

      return res.status(200).json({
        success: true,
        message: 'Cập nhật hồ sơ cá nhân thành công.',
        data: publicUser,
        user: publicUser
      });
    } catch (error) {
      next(error);
    }
  }
  // DNKN87: Xu ly upload anh dai dien
  static async uploadAvatar(req, res, next) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Vui lòng đăng nhập.'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng chọn ảnh đại diện.'
        });
      }

      if (req.file.size > 2 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: 'Ảnh không được vượt quá 2 MB.'
        });
      }

      const image = sharp(req.file.buffer);
      const metadata = await image.metadata();

      if (!['jpeg', 'png'].includes(metadata.format)) {
        return res.status(400).json({
          success: false,
          message: 'Chỉ chấp nhận ảnh JPG hoặc PNG.'
        });
      }

      const filename = `${crypto.randomUUID()}.png`;
      const uploadDir = path.join(__dirname, '..', 'uploads', 'avatars');

      await fs.mkdir(uploadDir, { recursive: true });

      const avatarBuffer = await image
        .rotate()
        .resize(300, 300, { fit: 'cover' })
        .png()
        .toBuffer();

      await fs.writeFile(path.join(uploadDir, filename), avatarBuffer);

      const avatarUrl = `/uploads/avatars/${filename}`;

      const updatedUser = await UserModel.updateProfile(req.user.id, {
        avatar: avatarUrl
      });

      return res.status(200).json({
        success: true,
        message: 'Cập nhật ảnh đại diện thành công.',
        data: {
          avatar: avatarUrl,
          user: UserModel.toPublicUser(updatedUser)
        }
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = ProfileController;

/**
 * TTCS Classroom Security Application - User Service
 * Business Logic Layer (Ticket DNKN-59)
 * 
 * Chức năng:
 * - Validate dữ liệu đầu vào (email, họ tên, số điện thoại, mật khẩu)
 * - Kiểm tra trùng lặp email (AC2 / 409 Conflict)
 * - Mã hóa mật khẩu với bcryptjs
 * - Sinh mã token kích hoạt an toàn (Crypto CSPRNG) kèm thời hạn 24 giờ
 * - Gửi email kích hoạt tài khoản chạy nền (Async Background Worker)
 * - Xử lý kích hoạt tài khoản qua Token
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');
const emailService = require('./emailService');
const config = require('../config/app.config');

const VALID_ROLES = ['admin', 'teacher', 'student', 'assistant'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+() -]{8,15}$/;

class UserService {
  /**
   * Validate dữ liệu đầu vào khi tạo/đăng ký tài khoản
   */
  validateUserData({ name, email, phone, role, password }) {
    // 1. Kiểm tra Họ và tên
    if (!name || typeof name !== 'string' || !name.trim()) {
      const error = new Error('Họ và tên không được để trống.');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    if (name.trim().length < 2) {
      const error = new Error('Họ và tên phải có độ dài tối thiểu từ 2 ký tự.');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    // 2. Kiểm tra Email
    if (!email || typeof email !== 'string' || !email.trim()) {
      const error = new Error('Địa chỉ email không được để trống.');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      const error = new Error('Định dạng email không hợp lệ (ví dụ hợp lệ: name@school.edu.vn).');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    // 3. Kiểm tra Số điện thoại (nếu có)
    if (phone && phone.trim() && !PHONE_REGEX.test(phone.trim())) {
      const error = new Error('Số điện thoại không đúng định dạng (từ 8-15 ký số).');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    // 4. Kiểm tra Vai trò
    if (role && !VALID_ROLES.includes(role)) {
      const error = new Error(`Vai trò không hợp lệ. Các vai trò được chấp nhận: ${VALID_ROLES.join(', ')}.`);
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    // 5. Kiểm tra Mật khẩu (nếu được truyền vào thủ công)
    if (password !== undefined && password !== null && password !== '') {
      if (typeof password !== 'string' || password.length < 6) {
        const error = new Error('Mật khẩu phải có độ dài tối thiểu từ 6 ký tự trở lên.');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
    }
  }

  /**
   * Tạo tài khoản người dùng mới kèm token và email kích hoạt [DNKN-59]
   */
  async createUser(userData) {
    const { name, email, phone, role, password, status } = userData;

    // 1. Validation dữ liệu đầu vào
    this.validateUserData({ name, email, phone, role, password });

    const cleanEmail = email.trim().toLowerCase();

    // 2. Kiểm tra trùng lặp email (AC2: Tránh trùng lặp tài khoản)
    const existingUser = userRepository.findByEmail(cleanEmail);
    if (existingUser) {
      const error = new Error(`Địa chỉ email '${cleanEmail}' đã tồn tại trong hệ thống. Vui lòng sử dụng email khác.`);
      error.statusCode = 409;
      error.code = 'EMAIL_ALREADY_EXISTS';
      throw error;
    }

    // 3. Xử lý mật khẩu (Nếu không cung cấp, hệ thống tự phát sinh mật khẩu tạm thời an toàn)
    let rawPassword = password;
    let isTemporaryPassword = false;
    if (!rawPassword || !rawPassword.trim()) {
      rawPassword = 'Edu@' + crypto.randomBytes(4).toString('hex');
      isTemporaryPassword = true;
    }

    // 4. Mã hóa mật khẩu an toàn với bcrypt (Salt rounds = 10)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(rawPassword, saltRounds);

    // 5. Sinh Token kích hoạt an toàn bằng CSPRNG (Thời hạn 24 giờ)
    const activationToken = crypto.randomBytes(32).toString('hex');
    const activationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // 6. Trạng thái mặc định là 'pending' (Chờ kích hoạt)
    const initialStatus = status || 'pending';

    // 7. Lưu vào Repository (Database Layer)
    let newUser;
    try {
      newUser = userRepository.create({
        name: name.trim(),
        email: cleanEmail,
        phone: phone ? phone.trim() : '',
        role: role || 'student',
        status: initialStatus,
        passwordHash,
        activationToken,
        activationExpires
      });
    } catch (dbError) {
      const error = new Error('Lỗi lưu trữ cơ sở dữ liệu: ' + dbError.message);
      error.statusCode = 500;
      error.code = 'DATABASE_ERROR';
      throw error;
    }

    // 8. Tích hợp gửi email kích hoạt (Async non-blocking background worker)
    try {
      await emailService.sendActivationEmail({
        user: newUser,
        activationToken,
        temporaryPassword: isTemporaryPassword ? rawPassword : null
      });
    } catch (mailErr) {
      // Ghi log lỗi gửi mail nhưng không làm rollback tạo tài khoản để người dùng không bị mất dữ liệu
      console.error('⚠️ [EMAIL SEND ERROR]:', mailErr.message);
    }

    // 9. Chuẩn bị dữ liệu phản hồi (Không trả về passwordHash để bảo mật)
    const port = config.PORT || 3000;
    const activationUrl = `http://localhost:${port}/api/auth/activate?token=${activationToken}`;

    return {
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        roleLabel: newUser.roleLabel,
        status: newUser.status,
        statusLabel: newUser.statusLabel,
        createdAt: newUser.createdAt
      },
      activation: {
        token: activationToken,
        expiresAt: activationExpires,
        activationUrl: activationUrl,
        temporaryPassword: isTemporaryPassword ? rawPassword : null
      }
    };
  }

  /**
   * Kích hoạt tài khoản qua Token kích hoạt [DNKN-59]
   */
  async activateUser(token) {
    if (!token || typeof token !== 'string' || !token.trim()) {
      const error = new Error('Mã token kích hoạt không được để trống.');
      error.statusCode = 400;
      error.code = 'INVALID_TOKEN';
      throw error;
    }

    const cleanToken = token.trim();
    const user = userRepository.findByActivationToken(cleanToken);

    if (!user) {
      const error = new Error('Mã token kích hoạt không hợp lệ hoặc đã được sử dụng.');
      error.statusCode = 400;
      error.code = 'TOKEN_NOT_FOUND';
      throw error;
    }

    // Kiểm tra thời hạn token (24 giờ)
    if (user.activationExpires) {
      const expiryDate = new Date(user.activationExpires);
      if (expiryDate < new Date()) {
        const error = new Error('Mã token kích hoạt đã hết hạn (quá 24 giờ). Vui lòng yêu cầu cấp lại liên kết kích hoạt.');
        error.statusCode = 400;
        error.code = 'TOKEN_EXPIRED';
        throw error;
      }
    }

    // Cập nhật trạng thái người dùng thành 'active'
    const activatedUser = userRepository.activate(user.id);

    return {
      success: true,
      message: 'Kích hoạt tài khoản thành công! Bạn có thể đăng nhập vào hệ thống ngay bây giờ.',
      user: {
        id: activatedUser.id,
        name: activatedUser.name,
        email: activatedUser.email,
        role: activatedUser.role,
        roleLabel: activatedUser.roleLabel,
        status: activatedUser.status,
        statusLabel: activatedUser.statusLabel,
        activatedAt: activatedUser.activatedAt
      }
    };
  }

  /**
   * Lấy danh sách người dùng phân trang & tìm kiếm
   */
  getUsers(filters) {
    return userRepository.findAll(filters);
  }

  /**
   * Lấy chi tiết người dùng
   */
  getUserById(id) {
    const user = userRepository.findById(id);
    if (!user) {
      const error = new Error('Không tìm thấy tài khoản người dùng.');
      error.statusCode = 404;
      error.code = 'USER_NOT_FOUND';
      throw error;
    }
    return user;
  }

  /**
   * Cập nhật thông tin người dùng
   */
  updateUser(id, updateData) {
    // Validate cơ bản nếu có cập nhật email
    if (updateData.email) {
      const cleanEmail = updateData.email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(cleanEmail)) {
        const error = new Error('Định dạng email không hợp lệ.');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      const existing = userRepository.findByEmail(cleanEmail);
      if (existing && existing.id !== id) {
        const error = new Error(`Email '${cleanEmail}' đã được sử dụng bởi tài khoản khác.`);
        error.statusCode = 409;
        error.code = 'EMAIL_ALREADY_EXISTS';
        throw error;
      }
    }

    return userRepository.update(id, updateData);
  }

  /**
   * Khóa / Mở khóa tài khoản
   */
  toggleLock(id) {
    return userRepository.toggleLock(id);
  }

  /**
   * Xóa người dùng
   */
  deleteUser(id) {
    return userRepository.delete(id);
  }

  /**
   * Reset dữ liệu
   */
  resetData() {
    return userRepository.reset();
  }
}

module.exports = new UserService();

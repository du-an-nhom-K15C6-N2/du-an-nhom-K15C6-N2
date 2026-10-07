const UserModel = require('../models/userModel');
const { hashPassword } = require('../security/password');
const LoginAttemptService = require('../services/loginAttemptService');
const { sendActivationEmail } = require('../services/accountActivationMailer');
const crypto = require('crypto');
const config = require('../config/app.config');
const sessionStore = require('../security/sessionStore');
const {
  ROLE_CATALOG,
  isValidRoleAssignment,
  getRoleAssignmentError
} = require('../config/rolePermissions');

const ALLOWED_ROLES = new Set(Object.keys(ROLE_CATALOG));
const ROLE_LABELS = Object.fromEntries(
  Object.entries(ROLE_CATALOG).map(([role, definition]) => [role, definition.label])
);
const ALLOWED_STATUSES = new Set(['active', 'locked', 'pending']);
const ACTIVATION_TTL_MS = 24 * 60 * 60 * 1000;

function createTemporaryPassword() {
  return `${crypto.randomBytes(24).toString('base64url')}Aa1!`;
}

function isValidEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

class UserController {
  /**
   * Lấy danh sách người dùng có Tìm kiếm, Lọc, Phân trang 20 dòng/trang (AC3 & AC4)
   * GET /api/users
   */
  static async getUsers(req, res, next) {
    try {
      const { page = 1, pageSize = 20, search = '', role = 'all', status = 'all' } = req.query;
      const pageNumber = Number(page);
      const pageSizeNumber = Number(pageSize);
      if (
        !Number.isInteger(pageNumber)
        || pageNumber < 1
        || !Number.isInteger(pageSizeNumber)
        || pageSizeNumber < 1
        || pageSizeNumber > 100
        || typeof search !== 'string'
        || search.length > 200
        || (role !== 'all' && !ALLOWED_ROLES.has(role))
        || (status !== 'all' && !ALLOWED_STATUSES.has(status))
      ) {
        return res.status(400).json({
          success: false,
          message: 'Tham số tìm kiếm, lọc hoặc phân trang không hợp lệ.'
        });
      }

      const result = UserModel.findAll({
        page: pageNumber,
        pageSize: pageSizeNumber,
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
    let createdUser = null;
    try {
      const { name, email, phone = '', role = 'student', roles, password } = req.body || {};
      const assignedRoles = roles === undefined ? [role] : roles;

      if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
        return res.status(400).json({ success: false, message: 'Họ và tên không được để trống.' });
      }
      if (typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ success: false, message: 'Địa chỉ email không được để trống.' });
      }
      const cleanEmail = email.trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) {
        return res.status(400).json({ success: false, message: 'Định dạng email không hợp lệ.' });
      }
      if (typeof phone !== 'string' || phone.length > 32) {
        return res.status(400).json({ success: false, message: 'Số điện thoại không hợp lệ.' });
      }
      if (
        !Array.isArray(assignedRoles)
        || !isValidRoleAssignment(assignedRoles)
      ) {
        return res.status(400).json({
          success: false,
          message: getRoleAssignmentError(assignedRoles)
        });
      }
      if (typeof password !== 'undefined' && (typeof password !== 'string' || password.length < 8)) {
        return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 8 ký tự.' });
      }
      if (UserModel.findByEmail(cleanEmail)) {
        return res.status(409).json({
          success: false,
          code: 'EMAIL_ALREADY_EXISTS',
          message: `Email '${cleanEmail}' đã tồn tại trong hệ thống. Vui lòng sử dụng email khác.`
        });
      }
      if (process.env.NODE_ENV === 'production' && !sendActivationEmailTransportAvailable()) {
        return res.status(503).json({
          success: false,
          code: 'EMAIL_SERVICE_UNAVAILABLE',
          message: 'Chưa cấu hình dịch vụ gửi email. Tài khoản chưa được tạo; vui lòng liên hệ quản trị hệ thống.'
        });
      }

      const temporaryPassword = createTemporaryPassword();
      const finalPassword = typeof password === 'string' && password.length >= 8 ? password : temporaryPassword;
      const activationToken = crypto.randomBytes(32).toString('hex');
      createdUser = UserModel.create({
        name: name.trim(),
        email: cleanEmail,
        phone,
        role: assignedRoles[0],
        roles: [...new Set(assignedRoles)],
        passwordHash: await hashPassword(finalPassword),
        activationTokenHash: crypto.createHash('sha256').update(activationToken).digest('hex'),
        activationExpiresAt: Date.now() + ACTIVATION_TTL_MS
      });
      const baseUrl = (process.env.RESET_PASSWORD_URL || config.RESET_PASSWORD_URL
        || `http://localhost:${config.PORT || 3000}`).replace(/\/+$/, '');
      const activationUrl = `${baseUrl}/activate-account.html?token=${activationToken}`;
      const emailSent = await sendActivationEmail({
        name: createdUser.name,
        email: createdUser.email,
        activationUrl,
        temporaryPassword
      });
      if (!emailSent) {
        console.info(
          `[Chế độ phát triển] Email kích hoạt cho ${createdUser.email}: ${activationUrl} | Mật khẩu tạm: ${temporaryPassword}`
        );
      }

      return res.status(201).json({
        success: true,
        data: UserModel.toPublicUser(createdUser),
        message: emailSent
          ? 'Tạo tài khoản thành công. Email kích hoạt và mật khẩu tạm đã được gửi.'
          : 'Tạo tài khoản chờ kích hoạt thành công. SMTP chưa cấu hình; thông tin kích hoạt chỉ được ghi trong terminal backend ở môi trường phát triển.'
      });
    } catch (error) {
      if (createdUser) UserModel.delete(createdUser.id);
      if (error.message && /đã tồn tại trong hệ thống/.test(error.message)) {
        return res.status(409).json({
          success: false,
          code: 'EMAIL_ALREADY_EXISTS',
          message: error.message
        });
      }
      next(error);
    }
  }

  static async activateAccount(req, res, next) {
    try {
      const { token } = req.body || {};
      if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_ACTIVATION_TOKEN',
          message: 'Liên kết kích hoạt không hợp lệ hoặc đã hết hạn.'
        });
      }

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const user = UserModel.activateByToken(tokenHash);
      if (!user) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_ACTIVATION_TOKEN',
          message: 'Liên kết kích hoạt không hợp lệ, đã được sử dụng hoặc đã hết hạn.'
        });
      }
      return res.status(200).json({
        success: true,
        message: 'Kích hoạt tài khoản thành công. Bạn có thể đăng nhập bằng mật khẩu tạm trong email.'
      });
    } catch (error) {
      next(error);
    }
  }

  static async resendActivation(req, res, next) {
    try {
      const user = UserModel.findById(req.params.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          code: 'RESOURCE_NOT_FOUND',
          message: 'Không tìm thấy tài khoản người dùng.'
        });
      }
      if (user.status !== 'pending') {
        return res.status(409).json({
          success: false,
          code: 'ACCOUNT_NOT_PENDING',
          message: 'Chỉ có thể gửi lại email cho tài khoản đang chờ kích hoạt.'
        });
      }
      if (process.env.NODE_ENV === 'production' && !sendActivationEmailTransportAvailable()) {
        return res.status(503).json({
          success: false,
          code: 'EMAIL_SERVICE_UNAVAILABLE',
          message: 'Chưa cấu hình dịch vụ gửi email. Không thể gửi lại email kích hoạt.'
        });
      }

      const temporaryPassword = createTemporaryPassword();
      const activationToken = crypto.randomBytes(32).toString('hex');
      const updatedUser = UserModel.renewActivation(req.params.id, {
        passwordHash: await hashPassword(temporaryPassword),
        activationTokenHash: crypto.createHash('sha256').update(activationToken).digest('hex'),
        activationExpiresAt: Date.now() + ACTIVATION_TTL_MS
      });
      const baseUrl = (process.env.RESET_PASSWORD_URL || config.RESET_PASSWORD_URL
        || `http://localhost:${config.PORT || 3000}`).replace(/\/+$/, '');
      const activationUrl = `${baseUrl}/activate-account.html?token=${activationToken}`;
      const emailSent = await sendActivationEmail({
        name: updatedUser.name,
        email: updatedUser.email,
        activationUrl,
        temporaryPassword
      });

      if (!emailSent) {
        console.info(
          `[Chế độ phát triển] Email kích hoạt cho ${updatedUser.email}: ${activationUrl} | Mật khẩu tạm: ${temporaryPassword}`
        );
      }

      return res.status(200).json({
        success: true,
        message: emailSent
          ? 'Đã gửi lại email kích hoạt và mật khẩu tạm. Liên kết kích hoạt cũ không còn hiệu lực.'
          : 'SMTP chưa cấu hình; liên kết kích hoạt và mật khẩu mới chỉ được ghi trong terminal backend ở môi trường phát triển.'
      });
    } catch (error) {
      next(error);
    }
  }

  static async activatePendingAccount(req, res, next) {
    try {
      const user = UserModel.findById(req.params.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          code: 'RESOURCE_NOT_FOUND',
          message: 'Không tìm thấy tài khoản người dùng.'
        });
      }
      if (user.status !== 'pending') {
        return res.status(409).json({
          success: false,
          code: 'ACCOUNT_NOT_PENDING',
          message: 'Chỉ có thể kích hoạt tài khoản đang chờ kích hoạt.'
        });
      }

      const activatedUser = UserModel.activatePendingAccount(req.params.id);
      if (!activatedUser) {
        return res.status(409).json({
          success: false,
          code: 'ACCOUNT_NOT_PENDING',
          message: 'Tài khoản không còn ở trạng thái chờ kích hoạt.'
        });
      }

      return res.status(200).json({
        success: true,
        data: UserModel.toPublicUser(activatedUser),
        message: 'Admin đã kích hoạt tài khoản. Người dùng có thể đăng nhập bằng mật khẩu tạm đã nhận.'
      });
    } catch (error) {
      next(error);
    }
  }

  static async assignRole(req, res) {
    try {
      const { role } = req.body || {};
      if (typeof role !== 'string' || !ALLOWED_ROLES.has(role)) {
        return res.status(400).json({
          success: false,
          message: 'Vai trò cần gán không hợp lệ.'
        });
      }
      const updatedUser = UserModel.assignRole(req.params.id, role);
      return res.status(200).json({
        success: true,
        data: UserModel.toPublicUser(updatedUser),
        message: `Đã gán vai trò ${ROLE_LABELS[role]} cho tài khoản. Quyền mới có hiệu lực ngay.`
      });
    } catch (error) {
      return UserController.handleRoleError(res, error);
    }
  }

  static async revokeRole(req, res) {
    try {
      const role = req.params.role;
      if (!ALLOWED_ROLES.has(role)) {
        return res.status(400).json({ success: false, message: 'Vai trò cần thu hồi không hợp lệ.' });
      }
      if (req.params.id === req.user.id && role === 'admin') {
        return res.status(403).json({
          success: false,
          code: 'CANNOT_REVOKE_OWN_ADMIN_ROLE',
          message: 'Bạn không thể tự thu hồi vai trò quản trị viên của chính mình.'
        });
      }
      const updatedUser = UserModel.revokeRole(req.params.id, role);
      return res.status(200).json({
        success: true,
        data: UserModel.toPublicUser(updatedUser),
        message: `Đã thu hồi vai trò ${ROLE_LABELS[role]}. Thay đổi quyền có hiệu lực ngay.`
      });
    } catch (error) {
      return UserController.handleRoleError(res, error);
    }
  }

  static handleRoleError(res, error) {
    if (error.message === 'Không tìm thấy tài khoản người dùng cần cập nhật.') {
      return res.status(404).json({
        success: false,
        code: 'RESOURCE_NOT_FOUND',
        errorType: 'not-found',
        resource: 'user',
        message: error.message
      });
    }
    return res.status(400).json({ success: false, message: error.message || 'Không thể cập nhật vai trò.' });
  }

  /**
   * Cập nhật thông tin tài khoản
   * PUT /api/users/:id
   */
  static async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const { name, email, phone, role, roles, status, password } = req.body || {};

      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Họ và tên không được để trống.' });
      }
      if (typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ success: false, message: 'Email không được để trống.' });
      }
      const cleanEmail = email.trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) {
        return res.status(400).json({ success: false, message: 'Định dạng email không hợp lệ.' });
      }
      if (typeof role !== 'undefined' && !ALLOWED_ROLES.has(role)) {
        return res.status(400).json({ success: false, message: 'Vai trò tài khoản không hợp lệ.' });
      }
      if (
        typeof roles !== 'undefined'
        && !isValidRoleAssignment(roles)
      ) {
        return res.status(400).json({
          success: false,
          message: getRoleAssignmentError(roles)
        });
      }
      if (typeof status !== 'undefined' && !ALLOWED_STATUSES.has(status)) {
        return res.status(400).json({ success: false, message: 'Trạng thái tài khoản không hợp lệ.' });
      }
      if (typeof name !== 'string' || name.trim().length > 120) {
        return res.status(400).json({ success: false, message: 'Họ và tên không hợp lệ.' });
      }
      if (typeof phone !== 'undefined' && (typeof phone !== 'string' || phone.length > 32)) {
        return res.status(400).json({ success: false, message: 'Số điện thoại không hợp lệ.' });
      }
      if (typeof password !== 'undefined' && (typeof password !== 'string' || password.length < 8)) {
        return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 8 ký tự.' });
      }
      const existingUser = UserModel.findById(id);
      if (existingUser && typeof status !== 'undefined' && status !== existingUser.status) {
        return res.status(400).json({
          success: false,
          code: 'STATUS_CHANGE_REQUIRES_LOCK_API',
          message: 'Trạng thái tài khoản phải được thay đổi bằng API khóa/mở khóa hoặc kích hoạt tài khoản.'
        });
      }

      const updatedRoles = roles || (role ? [role] : UserModel.getRoles(existingUser));
      if (
        existingUser
        && req.user.id === id
        && UserModel.getRoles(existingUser).includes('admin')
        && !updatedRoles.includes('admin')
      ) {
        return res.status(403).json({
          success: false,
          code: 'CANNOT_REVOKE_OWN_ADMIN_ROLE',
          message: 'Bạn không thể tự thu hồi vai trò quản trị viên của chính mình.'
        });
      }

      const updatedUser = UserModel.update(id, {
        name: name.trim(),
        email: cleanEmail,
        phone,
        role,
        roles,
        status
      });

      if (typeof password === 'string' && password.length >= 8) {
        const passwordHash = await hashPassword(password);
        UserModel.setPassword(id, passwordHash);
      }

      return res.status(200).json({
        success: true,
        data: UserModel.toPublicUser(updatedUser),
        message: roles
          ? 'Cập nhật thông tin và vai trò tài khoản thành công. Quyền mới có hiệu lực ngay.'
          : 'Cập nhật thông tin tài khoản thành công!'
      });
    } catch (error) {
      if (error.message === 'Không tìm thấy tài khoản người dùng cần sửa.') {
        return res.status(404).json({
          success: false,
          code: 'RESOURCE_NOT_FOUND',
          errorType: 'not-found',
          resource: 'user',
          message: error.message
        });
      }
      if (error.message && /đã được sử dụng/.test(error.message)) {
        return res.status(409).json({
          success: false,
          code: 'EMAIL_ALREADY_EXISTS',
          message: error.message
        });
      }
      return res.status(400).json({ success: false, message: error.message || 'Lỗi khi cập nhật tài khoản.' });
    }
  }

  /**
   * Khóa tài khoản và thu hồi toàn bộ phiên đăng nhập.
   * PATCH /api/users/:id/lock
   */
  static async lock(req, res) {
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

      if (req.user?.id === id) {
        return res.status(400).json({
          success: false,
          code: 'CANNOT_LOCK_SELF',
          message: 'Không thể tự khóa tài khoản quản trị viên đang đăng nhập.'
        });
      }

      const { reason } = req.body || {};
      if (typeof reason !== 'string' || !reason.trim()) {
        return res.status(400).json({
          success: false,
          code: 'LOCK_REASON_REQUIRED',
          message: 'Vui lòng nhập lý do khóa tài khoản.'
        });
      }

      if (reason.trim().length > 500) {
        return res.status(400).json({
          success: false,
          code: 'LOCK_REASON_TOO_LONG',
          message: 'Lý do khóa tài khoản không được vượt quá 500 ký tự.'
        });
      }

      const updated = UserModel.lock(id, reason.trim());
      const revokedSessions = sessionStore.revokeAllSessions(id);

      return res.status(200).json({
        success: true,
        data: UserModel.toPublicUser(updated),
        revokedSessions,
        message: `Đã khóa tài khoản ${updated.name} và thu hồi ${revokedSessions} phiên đăng nhập.`
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Lỗi khi khóa tài khoản.'
      });
    }
  }

  /**
   * Mở khóa tài khoản.
   * PATCH /api/users/:id/unlock
   */
  static async unlock(req, res) {
    try {
      const { id } = req.params;
      const updated = UserModel.unlock(id);

      return res.status(200).json({
        success: true,
        data: UserModel.toPublicUser(updated),
        message: `Đã mở khóa tài khoản ${updated.name}.`
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Lỗi khi mở khóa tài khoản.'
      });
    }
  }

  /**
   * Tương thích ngược: tự chọn khóa hoặc mở khóa theo trạng thái hiện tại.
   * PATCH /api/users/:id/toggle-lock
   */
  static async toggleLock(req, res) {
    try {
      const user = UserModel.findById(req.params.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          code: 'RESOURCE_NOT_FOUND',
          errorType: 'not-found',
          resource: 'user',
          message: 'Không tìm thấy tài khoản người dùng.'
        });
      }

      if (user.status === 'locked') {
        return UserController.unlock(req, res);
      }
      return UserController.lock(req, res);
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
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        code: 'PRODUCTION_OPERATION_DISABLED',
        message: 'Không thể khôi phục dữ liệu mẫu trong môi trường production.'
      });
    }

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

function sendActivationEmailTransportAvailable() {
  const user = process.env.SMTP_USER || config.SMTP_USER;
  const pass = process.env.SMTP_PASS || config.SMTP_PASS;
  return Boolean(
    user
    && pass
    && user !== 'your-gmail@gmail.com'
    && pass !== 'your-16-character-google-app-password'
  );
}

module.exports = UserController;

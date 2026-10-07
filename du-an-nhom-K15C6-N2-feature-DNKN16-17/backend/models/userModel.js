const db = require('../config/db.config');
const config = require('../config/app.config');
const { hashPasswordSync } = require('../security/password');
const crypto = require('crypto');
const {
  ALLOWED_ROLES,
  ROLE_CATALOG,
  getRoles: getEffectiveRoles,
  isValidRoleAssignment,
  getRoleAssignmentError
} = require('../config/rolePermissions');

const ROLE_MAP = Object.fromEntries(
  Object.entries(ROLE_CATALOG).map(([role, definition]) => [role, definition.label])
);

const STATUS_MAP = {
  active: 'Đang hoạt động',
  locked: 'Đang bị khóa',
  pending: 'Chờ kích hoạt'
};

class UserModel {
  static getRoles(user) {
    return getEffectiveRoles(user);
  }

  static getRoleLabels(roles) {
    return roles.map(role => ROLE_MAP[role]);
  }

  /**
   * Lấy danh sách người dùng có hỗ trợ tìm kiếm, lọc vai trò, trạng thái và phân trang (AC3 & AC4)
   */
  static findAll({ page = 1, pageSize = config.DEFAULT_PAGE_SIZE, search = '', role = 'all', status = 'all' }) {
    let users = db.readUsers();

    // 1. Tìm kiếm theo Tên, Email, SĐT (AC3)
    if (search && search.trim()) {
      const query = search.trim().toLowerCase();
      users = users.filter(u =>
        (u.name && u.name.toLowerCase().includes(query)) ||
        (u.email && u.email.toLowerCase().includes(query)) ||
        (u.phone && u.phone.includes(query))
      );
    }

    // 2. Lọc theo vai trò (AC3)
    if (role && role !== 'all') {
      users = users.filter(u => UserModel.getRoles(u).includes(role));
    }

    // 3. Lọc theo trạng thái (AC3)
    if (status && status !== 'all') {
      users = users.filter(u => u.status === status);
    }

    const total = users.length;
    const pageNum = parseInt(page, 10) || 1;
    const sizeNum = parseInt(pageSize, 10) || config.DEFAULT_PAGE_SIZE;
    const totalPages = Math.ceil(total / sizeNum) || 1;
    const validPage = Math.min(Math.max(1, pageNum), totalPages);

    // 4. Phân trang 20 dòng/trang (AC4)
    const startIndex = (validPage - 1) * sizeNum;
    const paginatedData = users.slice(startIndex, startIndex + sizeNum);

    return {
      data: paginatedData.map(UserModel.toPublicUser),
      pagination: {
        currentPage: validPage,
        pageSize: sizeNum,
        totalRecords: total,
        totalPages: totalPages,
        startIndex: total === 0 ? 0 : startIndex + 1,
        endIndex: Math.min(startIndex + sizeNum, total)
      }
    };
  }

  /**
   * Lấy toàn bộ người dùng (dùng cho presets test hoặc export)
   */
  static getAllRaw() {
    return db.readUsers().map(UserModel.toPublicUser);
  }

  static toPublicUser(user) {
    if (!user) return null;
    const {
      passwordHash,
      password,
      activationTokenHash,
      activationExpiresAt,
      ...publicUser
    } = user;
    const roles = UserModel.getRoles(user);
    return {
      ...publicUser,
      roles,
      roleLabels: UserModel.getRoleLabels(roles),
      roleLabel: UserModel.getRoleLabels(roles).join(', ')
    };
  }

  /**
   * Tìm người dùng theo ID
   */
  static findById(id) {
    const users = db.readUsers();
    return users.find(u => u.id === id) || null;
  }

  /**
   * Tìm người dùng theo email
   */
  static findByEmail(email) {
    if (!email) return null;
    const users = db.readUsers();
    return users.find(u => u.email.toLowerCase() === email.trim().toLowerCase()) || null;
  }

  static findActiveStudents() {
    return db.readUsers()
      .filter(user => UserModel.getRoles(user).includes('student') && user.status === 'active')
      .map(({ id, name, email }) => ({ id, name, email }));
  }

  /**
   * Tạo tài khoản người dùng mới (AC1 & AC2)
   */
  static create(userData) {
    const users = db.readUsers();
    const cleanEmail = userData.email.trim().toLowerCase();

    // AC2: Kiểm tra email trùng lặp
    const emailExists = users.some(u => u.email.toLowerCase() === cleanEmail);
    if (emailExists) {
      throw new Error(`Email '${userData.email}' đã tồn tại trong hệ thống. Vui lòng sử dụng email khác.`);
    }

    const roles = userData.roles || [userData.role || 'student'];
    if (!isValidRoleAssignment(roles)) {
      throw new Error(getRoleAssignmentError(roles));
    }
    const role = roles[0];
    const status = 'pending';

    const newUser = {
      id: `usr_${crypto.randomBytes(8).toString('hex')}`,
      name: userData.name.trim(),
      email: cleanEmail,
      phone: (userData.phone || '').trim(),
      role: role,
      roles,
      roleLabel: UserModel.getRoleLabels(roles).join(', '),
      status: status,
      statusLabel: STATUS_MAP[status] || status,
      passwordHash: userData.passwordHash,
      activationTokenHash: userData.activationTokenHash,
      activationExpiresAt: userData.activationExpiresAt
    };

    // Thêm lên đầu danh sách
    users.unshift(newUser);
    db.writeUsers(users);

    return newUser;
  }

  static activateByToken(tokenHash) {
    const users = db.readUsers();
    const user = users.find(candidate =>
      candidate.activationTokenHash === tokenHash
      && candidate.status === 'pending'
      && candidate.activationExpiresAt > Date.now()
    );
    if (!user) return null;

    user.status = 'active';
    user.statusLabel = STATUS_MAP.active;
    delete user.activationTokenHash;
    delete user.activationExpiresAt;
    db.writeUsers(users);
    return user;
  }

  static activatePendingAccount(id) {
    const users = db.readUsers();
    const user = users.find(candidate => candidate.id === id);
    if (!user || user.status !== 'pending') return null;

    user.status = 'active';
    user.statusLabel = STATUS_MAP.active;
    delete user.activationTokenHash;
    delete user.activationExpiresAt;
    db.writeUsers(users);
    return user;
  }

  static renewActivation(id, { passwordHash, activationTokenHash, activationExpiresAt }) {
    const users = db.readUsers();
    const user = users.find(candidate => candidate.id === id);
    if (!user) throw new Error('Không tìm thấy tài khoản người dùng.');
    if (user.status !== 'pending') {
      throw new Error('Chỉ có thể gửi lại email cho tài khoản đang chờ kích hoạt.');
    }

    user.passwordHash = passwordHash;
    user.activationTokenHash = activationTokenHash;
    user.activationExpiresAt = activationExpiresAt;
    db.writeUsers(users);
    return user;
  }

  static setRoles(id, roles) {
    const users = db.readUsers();
    const user = users.find(candidate => candidate.id === id);
    if (!user) throw new Error('Không tìm thấy tài khoản người dùng cần cập nhật.');
    const uniqueRoles = [...new Set(roles)];
    if (!isValidRoleAssignment(uniqueRoles)) {
      throw new Error(getRoleAssignmentError(uniqueRoles));
    }
    user.roles = uniqueRoles;
    user.role = uniqueRoles.includes(user.role) ? user.role : uniqueRoles[0];
    user.roleLabel = UserModel.getRoleLabels(uniqueRoles).join(', ');
    db.writeUsers(users);
    return user;
  }

  static assignRole(id, role) {
    const user = this.findById(id);
    if (!user) throw new Error('Không tìm thấy tài khoản người dùng cần cập nhật.');
    const roles = this.getRoles(user);
    if (!roles.includes(role)) roles.push(role);
    return this.setRoles(id, roles);
  }

  static revokeRole(id, role) {
    const user = this.findById(id);
    if (!user) throw new Error('Không tìm thấy tài khoản người dùng cần cập nhật.');
    const roles = this.getRoles(user).filter(existingRole => existingRole !== role);
    if (!roles.length) throw new Error('Không thể thu hồi vai trò cuối cùng của tài khoản.');
    return this.setRoles(id, roles);
  }

  /**
   * Cập nhật thông tin tài khoản
   */
  static update(id, userData) {
    const users = db.readUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) {
      throw new Error('Không tìm thấy tài khoản người dùng cần sửa.');
    }

    const cleanEmail = userData.email.trim().toLowerCase();
    // Kiểm tra trùng email với tài khoản khác
    const emailDuplicate = users.some(u => u.id !== id && u.email.toLowerCase() === cleanEmail);
    if (emailDuplicate) {
      throw new Error(`Email '${userData.email}' đã được sử dụng bởi một tài khoản khác.`);
    }

    const roles = userData.roles
      ? [...new Set(userData.roles)]
      : userData.role
        ? [userData.role]
        : UserModel.getRoles(users[index]);
    if (!isValidRoleAssignment(roles)) {
      throw new Error(getRoleAssignmentError(roles));
    }
    const role = roles.includes(users[index].role) ? users[index].role : roles[0];
    const status = userData.status || users[index].status;
    if (status !== users[index].status) {
      throw new Error('Trạng thái tài khoản phải được thay đổi bằng thao tác khóa/mở khóa hoặc kích hoạt tài khoản.');
    }

    users[index] = {
      ...users[index],
      name: userData.name.trim(),
      email: cleanEmail,
      phone: (userData.phone || '').trim(),
      role: role,
      roles,
      roleLabel: UserModel.getRoleLabels(roles).join(', '),
      status: status,
      statusLabel: STATUS_MAP[status] || status
    };
    if (status === 'active') {
      delete users[index].activationTokenHash;
      delete users[index].activationExpiresAt;
    }

    db.writeUsers(users);
    return users[index];
  }

  static setPassword(id, passwordHash) {
    const users = db.readUsers();
    const user = users.find(candidate => candidate.id === id);
    if (!user) {
      throw new Error('Không tìm thấy tài khoản người dùng cần cập nhật.');
    }
    user.passwordHash = passwordHash;
    db.writeUsers(users);
    return user;
  }

  /**
   * Đổi trạng thái khóa / mở khóa tài khoản
   */
  static toggleLock(id, reason = null) {
    const users = db.readUsers();
    const user = users.find(u => u.id === id);
    if (!user) {
      throw new Error('Tài khoản không tồn tại.');
    }

    if (user.status === 'locked') {
      user.status = 'active';
      user.statusLabel = STATUS_MAP.active;
      user.lockReason = null;
    } else if (user.status === 'active') {
      const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
      if (!normalizedReason) {
        throw new Error('Vui lòng nhập lý do khóa tài khoản.');
      }
      if (normalizedReason.length > 500) {
        throw new Error('Lý do khóa tài khoản không được vượt quá 500 ký tự.');
      }
      user.status = 'locked';
      user.statusLabel = STATUS_MAP.locked;
      user.lockReason = normalizedReason;
    } else {
      throw new Error('Chỉ tài khoản đang hoạt động hoặc đang bị khóa mới có thể khóa/mở khóa.');
    }

    db.writeUsers(users);
    return user;
  }

  static lock(id, reason) {
    const user = this.findById(id);
    if (!user) throw new Error('Tài khoản không tồn tại.');
    if (user.status !== 'active') {
      throw new Error(user.status === 'locked'
        ? 'Tài khoản đã bị khóa.'
        : 'Chỉ tài khoản đang hoạt động mới có thể khóa.');
    }
    return this.toggleLock(id, reason);
  }

  static unlock(id) {
    const user = this.findById(id);
    if (!user) throw new Error('Tài khoản không tồn tại.');
    if (user.status !== 'locked') {
      throw new Error('Tài khoản hiện không ở trạng thái bị khóa.');
    }
    return this.toggleLock(id);
  }

  /**
   * Xóa tài khoản người dùng
   */
  static delete(id) {
    let users = db.readUsers();
    const initialLen = users.length;
    users = users.filter(u => u.id !== id);

    if (users.length === initialLen) {
      throw new Error('Không tìm thấy tài khoản để xóa.');
    }

    db.writeUsers(users);
    return true;
  }

  /**
   * Reset lại dữ liệu 28 user ban đầu
   */
  static reset() {
    return db.reset();
  }

  static hasActiveAdminCredentials() {
    return db.readUsers().some(user =>
      user.status === 'active'
      && typeof user.passwordHash === 'string'
      && /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/i.test(user.passwordHash)
      && UserModel.getRoles(user).includes('admin')
    );
  }

  static bootstrapAdminCredentials(email, password) {
    if (typeof email !== 'string' || !email.trim()) {
      throw new Error('Cần cấu hình email quản trị viên ban đầu hợp lệ.');
    }
    if (typeof password !== 'string' || password.length < 12) {
      throw new Error('Mật khẩu quản trị viên ban đầu phải có ít nhất 12 ký tự.');
    }

    const users = db.readUsers();
    const admin = users.find(user => user.email.toLowerCase() === email.trim().toLowerCase());
    if (admin && !this.getRoles(admin).includes('admin')) {
      throw new Error('Email bootstrap đã thuộc về tài khoản không phải quản trị viên.');
    }

    if (admin) {
      if (!admin.passwordHash) {
        admin.passwordHash = hashPasswordSync(password);
        db.writeUsers(users);
      }
      return;
    }

    if (process.env.NODE_ENV !== 'production' || users.length > 0) {
      throw new Error('Không tìm thấy tài khoản quản trị viên ban đầu trong dữ liệu hiện có.');
    }

    const newAdmin = {
      id: `usr_${crypto.randomBytes(8).toString('hex')}`,
      name: 'Quản trị viên hệ thống',
      email: email.trim().toLowerCase(),
      phone: '',
      role: 'admin',
      roles: ['admin'],
      roleLabel: ROLE_MAP.admin,
      status: 'active',
      statusLabel: STATUS_MAP.active,
      passwordHash: hashPasswordSync(password)
    };
    db.writeUsers([newAdmin]);
  }
}

module.exports = UserModel;

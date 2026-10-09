const db = require('../config/db.config');
const config = require('../config/app.config');
const { hashPasswordSync } = require('../security/password');

const ROLE_MAP = {
  admin: 'Quản trị viên',
  teacher: 'Giảng viên',
  student: 'Học sinh',
  assistant: 'Trợ giảng'
};

const STATUS_MAP = {
  active: 'Đang hoạt động',
  locked: 'Đang bị khóa',
  pending: 'Chờ kích hoạt'
};

class UserModel {
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
      users = users.filter(u => u.role === role);
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
    const { passwordHash, password, ...publicUser } = user;
    return {
      ...publicUser,
      fullName: publicUser.fullName || publicUser.name || '',
      name: publicUser.name || publicUser.fullName || '',
      phone: publicUser.phone || '',
      dob: publicUser.dob || '',
      address: publicUser.address || ''
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
      .filter(user => user.role === 'student' && user.status === 'active')
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

    const role = userData.role || 'student';
    const status = userData.status || 'active';
    const name = userData.name.trim();

    const newUser = {
      id: 'usr_' + Date.now().toString(36),
      name: name,
      fullName: name,
      email: cleanEmail,
      phone: (userData.phone || '').trim(),
      dob: (userData.dob || '').trim(),
      address: (userData.address || '').trim(),
      role: role,
      roleLabel: ROLE_MAP[role] || role,
      status: status,
      statusLabel: STATUS_MAP[status] || status,
      passwordHash: userData.passwordHash
    };

    // Thêm lên đầu danh sách
    users.unshift(newUser);
    db.writeUsers(users);

    return newUser;
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

    const role = userData.role || users[index].role;
    const status = userData.status || users[index].status;
    const name = userData.name.trim();

    users[index] = {
      ...users[index],
      name: name,
      fullName: name,
      email: cleanEmail,
      phone: (userData.phone || '').trim(),
      dob: userData.dob !== undefined ? userData.dob.trim() : (users[index].dob || ''),
      address: userData.address !== undefined ? userData.address.trim() : (users[index].address || ''),
      role: role,
      roleLabel: ROLE_MAP[role] || role,
      status: status,
      statusLabel: STATUS_MAP[status] || status
    };

    db.writeUsers(users);
    return users[index];
  }

  /**
   * Cập nhật thông tin hồ sơ cá nhân (chỉ các trường cho phép sửa: name, phone, dob, address)
   */
  static updateProfile(id, profileData) {
    const users = db.readUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) {
      throw new Error('Không tìm thấy tài khoản người dùng cần cập nhật hồ sơ.');
    }

    const current = users[index];
    const updatedName = profileData.name !== undefined ? profileData.name.trim() : current.name;

    users[index] = {
      ...current,
      name: updatedName,
      fullName: updatedName,
      phone: profileData.phone !== undefined ? profileData.phone.trim() : (current.phone || ''),
      dob: profileData.dob !== undefined ? profileData.dob.trim() : (current.dob || ''),
      address: profileData.address !== undefined ? profileData.address.trim() : (current.address || '')
    };

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
  static toggleLock(id) {
    const users = db.readUsers();
    const user = users.find(u => u.id === id);
    if (!user) {
      throw new Error('Tài khoản không tồn tại.');
    }

    if (user.status === 'locked') {
      user.status = 'active';
      user.statusLabel = STATUS_MAP.active;
    } else {
      user.status = 'locked';
      user.statusLabel = STATUS_MAP.locked;
    }

    db.writeUsers(users);
    return user;
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

  static bootstrapAdminCredentials(email, password) {
    if (typeof password !== 'string' || password.length < 8) {
      throw new Error('Mật khẩu quản trị viên ban đầu phải có ít nhất 8 ký tự.');
    }
    const admin = this.findByEmail(email);
    if (!admin || admin.role !== 'admin') {
      throw new Error('Không tìm thấy tài khoản quản trị viên để cấp mật khẩu ban đầu.');
    }
    if (!admin.passwordHash) {
      const users = db.readUsers();
      const adminIndex = users.findIndex(user => user.id === admin.id);
      users[adminIndex].passwordHash = hashPasswordSync(password);
      db.writeUsers(users);
    }
  }
  // DNKN-113: Lưu ảnh đại diện vào tài khoản
  static updateAvatar(id, avatarUrl, thumbnailUrl) {
    const users = db.readUsers();

    const index = users.findIndex(
      user => String(user.id) === String(id)
    );

    if (index === -1) {
      throw new Error('Không tìm thấy tài khoản người dùng.');
    }

    users[index] = {
      ...users[index],
      avatar: avatarUrl,
      avatarThumbnail: thumbnailUrl
    };

    db.writeUsers(users);

    return users[index];
  }
}

module.exports = UserModel;

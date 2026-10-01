/**
 * TTCS Classroom Security Application - User Repository
 * Data Access Layer (Repository Pattern)
 */

const db = require('../config/db.config');
const config = require('../config/app.config');

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

class UserRepository {
  /**
   * Lấy danh sách người dùng có hỗ trợ tìm kiếm, lọc vai trò, trạng thái và phân trang (AC3 & AC4)
   */
  findAll({ page = 1, pageSize = config.DEFAULT_PAGE_SIZE, search = '', role = 'all', status = 'all' } = {}) {
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
      data: paginatedData,
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
   * Lấy toàn bộ người dùng dạng raw
   */
  getAllRaw() {
    return db.readUsers();
  }

  /**
   * Tìm người dùng theo ID
   */
  findById(id) {
    if (!id) return null;
    const users = db.readUsers();
    return users.find(u => u.id === id) || null;
  }

  /**
   * Tìm người dùng theo email (case-insensitive)
   */
  findByEmail(email) {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    const users = db.readUsers();
    return users.find(u => u.email && u.email.toLowerCase() === cleanEmail) || null;
  }

  /**
   * Tìm người dùng theo token kích hoạt
   */
  findByActivationToken(token) {
    if (!token) return null;
    const users = db.readUsers();
    return users.find(u => u.activationToken === token) || null;
  }

  /**
   * Thêm người dùng mới vào hệ thống
   */
  create(userData) {
    const users = db.readUsers();
    const role = userData.role || 'student';
    const status = userData.status || 'pending';

    const newUser = {
      id: userData.id || 'usr_' + Date.now().toString(36),
      name: userData.name.trim(),
      email: userData.email.trim().toLowerCase(),
      phone: (userData.phone || '').trim(),
      role: role,
      roleLabel: ROLE_MAP[role] || role,
      status: status,
      statusLabel: STATUS_MAP[status] || status,
      passwordHash: userData.passwordHash || null,
      activationToken: userData.activationToken || null,
      activationExpires: userData.activationExpires || null,
      createdAt: userData.createdAt || new Date().toISOString(),
      activatedAt: userData.activatedAt || null
    };

    // Thêm lên đầu danh sách
    users.unshift(newUser);
    const writeOk = db.writeUsers(users);
    if (!writeOk) {
      throw new Error('Lỗi cơ sở dữ liệu: Không thể lưu thông tin người dùng.');
    }

    return newUser;
  }

  /**
   * Cập nhật thông tin người dùng
   */
  update(id, updateData) {
    const users = db.readUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) {
      throw new Error('Không tìm thấy tài khoản người dùng cần cập nhật.');
    }

    const current = users[index];
    const role = updateData.role || current.role;
    const status = updateData.status || current.status;

    const updatedUser = {
      ...current,
      ...updateData,
      name: updateData.name !== undefined ? updateData.name.trim() : current.name,
      email: updateData.email !== undefined ? updateData.email.trim().toLowerCase() : current.email,
      phone: updateData.phone !== undefined ? updateData.phone.trim() : current.phone,
      role: role,
      roleLabel: ROLE_MAP[role] || role,
      status: status,
      statusLabel: STATUS_MAP[status] || status,
      updatedAt: new Date().toISOString()
    };

    users[index] = updatedUser;
    const writeOk = db.writeUsers(users);
    if (!writeOk) {
      throw new Error('Lỗi cơ sở dữ liệu: Không thể cập nhật thông tin người dùng.');
    }

    return updatedUser;
  }

  /**
   * Kích hoạt tài khoản
   */
  activate(id) {
    return this.update(id, {
      status: 'active',
      statusLabel: STATUS_MAP.active,
      activationToken: null,
      activationExpires: null,
      activatedAt: new Date().toISOString()
    });
  }

  /**
   * Đổi trạng thái khóa / mở khóa tài khoản
   */
  toggleLock(id) {
    const user = this.findById(id);
    if (!user) {
      throw new Error('Tài khoản không tồn tại.');
    }

    const nextStatus = user.status === 'locked' ? 'active' : 'locked';
    return this.update(id, {
      status: nextStatus,
      statusLabel: STATUS_MAP[nextStatus]
    });
  }

  /**
   * Xóa người dùng theo ID
   */
  delete(id) {
    let users = db.readUsers();
    const initialLen = users.length;
    users = users.filter(u => u.id !== id);

    if (users.length === initialLen) {
      throw new Error('Không tìm thấy tài khoản để xóa.');
    }

    const writeOk = db.writeUsers(users);
    if (!writeOk) {
      throw new Error('Lỗi cơ sở dữ liệu: Không thể xóa tài khoản người dùng.');
    }

    return true;
  }

  /**
   * Reset dữ liệu về 28 tài khoản ban đầu
   */
  reset() {
    return db.reset();
  }
}

module.exports = new UserRepository();

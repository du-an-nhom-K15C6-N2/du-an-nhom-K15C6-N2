const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/users.json');

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
  static getDataFilePath() {
    return process.env.PROFILE_DATA_FILE || DATA_FILE;
  }

  static readUsers() {
    try {
      const file = this.getDataFilePath();
      if (!fs.existsSync(file)) return [];
      const content = fs.readFileSync(file, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      console.error('Lỗi đọc database users:', e);
      return [];
    }
  }

  static writeUsers(users) {
    try {
      const file = this.getDataFilePath();
      fs.writeFileSync(file, JSON.stringify(users, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('Lỗi ghi database users:', e);
      return false;
    }
  }

  static findById(id) {
    const users = this.readUsers();
    return users.find(u => u.id === id) || null;
  }

  static findByEmail(email) {
    const users = this.readUsers();
    const query = String(email).trim().toLowerCase();
    return users.find(u => u.email && u.email.toLowerCase() === query) || null;
  }

  static toPublicUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      name: user.name || user.fullName || '',
      fullName: user.fullName || user.name || '',
      email: user.email,
      role: user.role,
      roleLabel: user.roleLabel || ROLE_MAP[user.role] || user.role,
      status: user.status || 'active',
      statusLabel: user.statusLabel || STATUS_MAP[user.status] || user.status,
      phone: user.phone || '',
      dob: user.dob || null,
      address: user.address || ''
    };
  }

  static updateProfile(userId, data) {
    const users = this.readUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) {
      throw new Error('USER_NOT_FOUND');
    }

    const allowedFields = ['name', 'phone', 'dob', 'address'];
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        users[index][field] = data[field];
        if (field === 'name') {
          users[index].fullName = data[field];
        }
      }
    });

    users[index].updatedAt = new Date().toISOString();
    this.writeUsers(users);
    return users[index];
  }
}

module.exports = UserModel;

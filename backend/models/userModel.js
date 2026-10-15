const fs = require('fs');
const path = require('path');

const DEFAULT_DATA_FILE = path.resolve(__dirname, '../../data/users.json');

function getDataFilePath() {
  return process.env.DATA_FILE || DEFAULT_DATA_FILE;
}

function readUsers() {
  const filePath = getDataFilePath();
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error('Lỗi đọc tệp dữ liệu người dùng:', err);
    return [];
  }
}

function writeUsers(users) {
  const filePath = getDataFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf8');
}

const ROLE_LABELS = {
  admin: 'Quản trị viên',
  teacher: 'Giảng viên',
  assistant: 'Trợ giảng',
  student: 'Học sinh / Sinh viên',
  manager: 'Quản lý đào tạo',
  accountant: 'Kế toán',
  department_head: 'Trưởng bộ môn',
  training_staff: 'Nhân viên đào tạo'
};

class UserModel {
  static getRoles(user) {
    if (Array.isArray(user?.roles) && user.roles.length > 0) return user.roles;
    if (user?.role) return [user.role];
    return ['student'];
  }

  static getRoleLabels(roles) {
    return roles.map(r => ROLE_LABELS[r] || r);
  }

  static findById(id) {
    const users = readUsers();
    return users.find(u => String(u.id) === String(id)) || null;
  }

  static findByEmail(email) {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    const users = readUsers();
    return users.find(u => String(u.email).toLowerCase() === cleanEmail) || null;
  }

  static toPublicUser(user) {
    if (!user) return null;
    const { passwordHash, password, activationTokenHash, activationExpiresAt, ...publicUser } = user;
    const roles = UserModel.getRoles(user);
    const dobValue = user.dateOfBirth || user.dob || '';
    return {
      ...publicUser,
      roles,
      roleLabels: UserModel.getRoleLabels(roles),
      roleLabel: UserModel.getRoleLabels(roles).join(', '),
      phone: user.phone || '',
      dateOfBirth: dobValue,
      dob: dobValue,
      address: user.address || ''
    };
  }

  /**
   * Cập nhật thông tin hồ sơ cá nhân
   */
  static updateProfile(id, profileData = {}) {
    const users = readUsers();
    const index = users.findIndex(u => String(u.id) === String(id));
    if (index === -1) {
      throw new Error('Không tìm thấy tài khoản người dùng.');
    }

    const user = users[index];

    if (typeof profileData.name === 'string' && profileData.name.trim()) {
      user.name = profileData.name.trim();
    }
    if (typeof profileData.phone === 'string') {
      user.phone = profileData.phone.trim();
    }
    const newDob = profileData.dateOfBirth !== undefined ? profileData.dateOfBirth : profileData.dob;
    if (typeof newDob === 'string') {
      user.dateOfBirth = newDob.trim();
      user.dob = newDob.trim();
    }
    if (typeof profileData.address === 'string') {
      user.address = profileData.address.trim();
    }

    writeUsers(users);
    return users[index];
  }
}

module.exports = UserModel;

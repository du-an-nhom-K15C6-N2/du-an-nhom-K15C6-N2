/**
 * Student Account Service
 * Đáp ứng subtask: [BE] Tạo tài khoản đăng nhập cho học viên sau khi chuyển đổi lead
 * Nhiệm vụ:
 * - Tạo tài khoản người dùng với vai trò học sinh (role: 'student')
 * - Gán trạng thái hoạt động (status: 'active')
 * - Cấp mật khẩu đăng nhập ban đầu
 */

const fs = require('fs');
const path = require('path');

class AccountService {
  static getUsersFilePath() {
    return process.env.USERS_DATA_FILE || path.join(__dirname, '../data/users.json');
  }

  static readUsers() {
    try {
      const file = this.getUsersFilePath();
      if (!fs.existsSync(file)) return [];
      const content = fs.readFileSync(file, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      console.error('Lỗi đọc dữ liệu users:', e);
      return [];
    }
  }

  static writeUsers(users) {
    try {
      const file = this.getUsersFilePath();
      fs.writeFileSync(file, JSON.stringify(users, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('Lỗi ghi dữ liệu users:', e);
      return false;
    }
  }

  /**
   * Tạo tài khoản đăng nhập cho học viên từ hồ sơ vừa sinh
   * @param {Object} studentProfile - Thông tin hồ sơ học viên
   * @returns {Object} - Tài khoản vừa tạo kèm mật khẩu ban đầu
   */
  static createStudentAccount(studentProfile) {
    if (!studentProfile || !studentProfile.email) {
      throw new Error('MISSING_STUDENT_EMAIL');
    }

    const users = this.readUsers();
    const normalizedEmail = String(studentProfile.email).trim().toLowerCase();

    // Kiểm tra xem email đã tồn tại trong danh sách tài khoản chưa
    let existingIndex = users.findIndex(u => u.email && u.email.toLowerCase() === normalizedEmail);

    const initialPassword = studentProfile.temporaryPassword || `Edu@${new Date().getFullYear()}`;

    const newAccount = {
      id: `usr_stu_${studentProfile.studentCode}`,
      studentCode: studentProfile.studentCode,
      name: studentProfile.fullName,
      fullName: studentProfile.fullName,
      email: normalizedEmail,
      phone: studentProfile.phone || '',
      role: 'student',
      roleLabel: 'Học sinh',
      status: 'active',
      statusLabel: 'Đang hoạt động',
      initialPassword: initialPassword,
      passwordHash: `hash_mock_${studentProfile.studentCode}`,
      createdAt: new Date().toISOString()
    };

    if (existingIndex !== -1) {
      // Cập nhật vai trò học sinh cho tài khoản có sẵn
      users[existingIndex].studentCode = studentProfile.studentCode;
      users[existingIndex].role = 'student';
      users[existingIndex].roleLabel = 'Học sinh';
      users[existingIndex].status = 'active';
      users[existingIndex].updatedAt = new Date().toISOString();
      this.writeUsers(users);
      return {
        account: users[existingIndex],
        temporaryPassword: initialPassword,
        isExisting: true
      };
    }

    users.push(newAccount);
    this.writeUsers(users);

    return {
      account: newAccount,
      temporaryPassword: initialPassword,
      isExisting: false
    };
  }
}

module.exports = AccountService;

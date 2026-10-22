const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config/app.config');
const db = require('../config/db.config');
const UserModel = require('./userModel');
const { LeadModel, LeadError, normalizePhoneNumber } = require('./leadModel');
const { hashPassword } = require('../security/password');
const { sendStudentWelcomeEmail } = require('../services/accountActivationMailer');

function getStudentsFile() {
  return process.env.STUDENTS_DATA_FILE || config.STUDENTS_DATA_FILE;
}

function readStudents() {
  const filePath = getStudentsFile();
  if (!fs.existsSync(filePath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    throw new Error(`Không thể đọc dữ liệu học viên: ${error.message}`);
  }
}

function writeStudents(students) {
  const filePath = getStudentsFile();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryFile = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryFile, JSON.stringify(students, null, 2), { mode: 0o600 });
    fs.renameSync(temporaryFile, filePath);
  } finally {
    if (fs.existsSync(temporaryFile)) {
      try { fs.unlinkSync(temporaryFile); } catch (_) {}
    }
  }
}

class StudentError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'StudentError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class StudentModel {
  /**
   * Sinh mã học viên tự động định dạng HVYYYYXXXX (ví dụ: HV20260001)
   * Đảm bảo tính duy nhất, tuần tự, không trùng lặp
   */
  static generateStudentCode() {
    const year = new Date().getFullYear();
    const prefix = `HV${year}`;
    const students = readStudents();
    const users = db.readUsers();

    let maxSeq = 0;
    const regex = new RegExp(`^HV${year}(\\d+)$`, 'i');

    const checkCode = (code) => {
      if (typeof code === 'string') {
        const match = code.trim().match(regex);
        if (match) {
          const seq = parseInt(match[1], 10);
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
    };

    students.forEach(s => checkCode(s.studentCode));
    users.forEach(u => checkCode(u.studentCode));

    const existingCodes = new Set([
      ...students.map(s => String(s.studentCode || '').toUpperCase()),
      ...users.map(u => String(u.studentCode || '').toUpperCase())
    ]);

    let nextSeq = maxSeq + 1;
    let code = `${prefix}${String(nextSeq).padStart(4, '0')}`;
    while (existingCodes.has(code.toUpperCase())) {
      nextSeq++;
      code = `${prefix}${String(nextSeq).padStart(4, '0')}`;
    }

    return code;
  }

  /**
   * Lấy danh sách hồ sơ học viên có tìm kiếm, phân trang
   */
  static list({ page = 1, pageSize = 20, search = '' } = {}) {
    const students = readStudents();
    let filtered = students;
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(s =>
        (s.studentCode && s.studentCode.toLowerCase().includes(q)) ||
        (s.fullName && s.fullName.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.course && s.course.toLowerCase().includes(q))
      );
    }

    const total = filtered.length;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const sizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
    const totalPages = Math.ceil(total / sizeNum) || 1;
    const pagedItems = filtered.slice((pageNum - 1) * sizeNum, pageNum * sizeNum);

    return {
      items: pagedItems,
      data: pagedItems,
      pagination: {
        total,
        page: pageNum,
        pageSize: sizeNum,
        totalPages
      }
    };
  }

  static findById(id) {
    if (!id) return null;
    return readStudents().find(s => s.id === id) || null;
  }

  static findByCode(studentCode) {
    if (!studentCode) return null;
    return readStudents().find(s => String(s.studentCode).toLowerCase() === String(studentCode).toLowerCase()) || null;
  }

  static findByLeadId(leadId) {
    if (!leadId) return null;
    return readStudents().find(s => String(s.leadId) === String(leadId)) || null;
  }

  static findByEmail(email) {
    if (!email) return null;
    const clean = String(email).trim().toLowerCase();
    return readStudents().find(s => String(s.email).toLowerCase() === clean) || null;
  }

  /**
   * Chuyển lead đã chốt sang hồ sơ học viên
   * 1. Lấy dữ liệu lead (họ tên, sđt, email, khóa học, ghi chú) -> không phải nhập lại
   * 2. Tự động sinh mã học viên duy nhất
   * 3. Tạo tài khoản người dùng đăng nhập cho học viên (vai trò 'student', trạng thái 'pending' hoặc 'active')
   * 4. Gửi email thông báo tài khoản & liên kết kích hoạt
   * 5. Lưu hồ sơ học viên
   * 6. Cập nhật lead sang trạng thái 'Đã nhập học' và khóa chỉnh sửa
   */
  static async convertFromLead(leadId, overrides = {}, actor = 'Tư vấn tuyển sinh') {
    if (!leadId) {
      throw new StudentError(400, 'INVALID_ID', 'Mã Lead không hợp lệ.');
    }

    // 1. Kiểm tra Lead tồn tại
    const lead = LeadModel.findById(leadId);
    if (!lead) {
      throw new StudentError(404, 'LEAD_NOT_FOUND', 'Không tìm thấy Lead để chuyển đổi.');
    }

    // Kiểm tra trạng thái Lead: đã nhập học thì không chuyển đổi lại
    if (lead.status === 'Đã nhập học' || lead.isLocked) {
      throw new StudentError(409, 'LEAD_ALREADY_ENROLLED', `Lead này đã được chuyển thành hồ sơ học viên (Mã HV: ${lead.studentCode || 'Đã có'}) và đã bị khóa.`);
    }

    // Lead phải ở trạng thái "Chốt" (hoặc "Đã chuyển đổi" của dữ liệu cũ)
    if (lead.status !== 'Chốt' && lead.status !== 'Đã chuyển đổi') {
      throw new StudentError(400, 'LEAD_NOT_CLOSED', `Chỉ có thể chuyển đổi Lead có trạng thái 'Chốt' sang hồ sơ học viên. Trạng thái hiện tại: "${lead.status}".`);
    }

    // 2. Kế thừa thông tin từ lead (không phải nhập lại), cho phép overrides nếu có
    const fullName = (overrides.name || overrides.fullName || lead.name || lead.fullName || '').trim();
    if (!fullName || fullName.length < 2) {
      throw new StudentError(400, 'INVALID_INPUT', 'Họ tên học viên phải có ít nhất 2 ký tự.');
    }

    const phone = overrides.phone || overrides.phoneNumber || lead.phone || lead.phoneNumber;
    if (!phone) {
      throw new StudentError(400, 'INVALID_PHONE', 'Số điện thoại học viên là bắt buộc.');
    }
    const normalizedPhone = normalizePhoneNumber(phone);

    const rawEmail = overrides.email !== undefined ? overrides.email : lead.email;
    if (!rawEmail || typeof rawEmail !== 'string' || !rawEmail.trim()) {
      throw new StudentError(400, 'MISSING_EMAIL', 'Email học viên là bắt buộc để tạo tài khoản đăng nhập và gửi thông báo kích hoạt.');
    }
    const cleanEmail = rawEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new StudentError(400, 'INVALID_EMAIL', 'Địa chỉ email học viên không đúng định dạng.');
    }

    const course = (overrides.course || overrides.program || lead.course || lead.program || lead.programOfInterest || 'Chương trình chuẩn').trim();
    const note = (overrides.note !== undefined ? overrides.note : (lead.note || '')).trim();

    // 3. Tự động sinh mã học viên
    const studentCode = StudentModel.generateStudentCode();

    // 4. Tạo tài khoản người dùng đăng nhập cho học viên
    let user = UserModel.findByEmail(cleanEmail);
    let createdUser = null;
    let temporaryPassword = null;
    let activationUrl = null;
    let activationToken = null;

    if (user) {
      const userRoles = UserModel.getRoles(user);
      if (!userRoles.includes('student')) {
        throw new StudentError(409, 'EMAIL_ALREADY_EXISTS', `Email '${cleanEmail}' đã được sử dụng bởi một tài khoản khác (${user.roleLabel || user.role}) trong hệ thống.`);
      }
      // Đã có tài khoản student: cập nhật studentCode nếu chưa có
      if (!user.studentCode) {
        user.studentCode = studentCode;
        const allUsers = db.readUsers();
        const uIdx = allUsers.findIndex(u => u.id === user.id);
        if (uIdx >= 0) {
          allUsers[uIdx].studentCode = studentCode;
          db.writeUsers(allUsers);
        }
      }
    } else {
      // Sinh mật khẩu tạm và token kích hoạt
      temporaryPassword = `${crypto.randomBytes(16).toString('base64url')}Aa1!`;
      activationToken = crypto.randomBytes(32).toString('hex');
      const activationTokenHash = crypto.createHash('sha256').update(activationToken).digest('hex');
      const activationExpiresAt = Date.now() + 24 * 60 * 60 * 1000;
      const passwordHash = await hashPassword(temporaryPassword);

      createdUser = UserModel.create({
        name: fullName,
        email: cleanEmail,
        phone: normalizedPhone,
        role: 'student',
        roles: ['student'],
        studentCode,
        passwordHash,
        activationTokenHash,
        activationExpiresAt
      });
      user = createdUser;

      const baseUrl = (process.env.RESET_PASSWORD_URL || config.RESET_PASSWORD_URL
        || `http://localhost:${config.PORT || 3000}`).replace(/\/+$/, '');
      activationUrl = `${baseUrl}/activate-account.html?token=${activationToken}`;
    }

    // 5. Gửi email thông báo tài khoản học viên & thông tin kích hoạt
    let emailSent = false;
    try {
      if (activationUrl && temporaryPassword) {
        emailSent = await sendStudentWelcomeEmail({
          name: fullName,
          email: cleanEmail,
          studentCode,
          course,
          activationUrl,
          temporaryPassword
        });
        if (!emailSent) {
          console.info(
            `[Chuyển đổi học viên] Email tài khoản gửi cho ${cleanEmail}: Mã HV ${studentCode} | ${activationUrl} | Mật khẩu: ${temporaryPassword}`
          );
        }
      }
    } catch (mailError) {
      console.error('Không thể gửi email thông báo tài khoản học viên:', mailError.message);
    }

    // 6. Lưu hồ sơ học viên
    const timestamp = new Date().toISOString();
    const student = {
      id: `stu_${crypto.randomUUID()}`,
      studentCode,
      leadId: String(lead.id),
      fullName,
      name: fullName,
      phone: normalizedPhone,
      phoneNumber: normalizedPhone,
      email: cleanEmail,
      course,
      program: course,
      userId: user.id,
      status: 'enrolled',
      statusLabel: 'Đang học',
      note,
      createdBy: actor,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const students = readStudents();
    students.unshift(student);
    writeStudents(students);

    // 7. Cập nhật trạng thái lead sang "Đã nhập học" và khóa chỉnh sửa
    try {
      LeadModel.enrollLead(lead.id, {
        studentCode,
        studentId: student.id,
        actor
      });
    } catch (leadError) {
      // Rollback nếu cập nhật lead gặp sự cố
      const rollbackStudents = readStudents().filter(s => s.id !== student.id);
      writeStudents(rollbackStudents);
      if (createdUser) {
        UserModel.delete(createdUser.id);
      }
      throw leadError;
    }

    return {
      student,
      user: UserModel.toPublicUser(user),
      emailSent: Boolean(emailSent),
      temporaryPassword: (process.env.NODE_ENV === 'test' || !emailSent) ? temporaryPassword : undefined,
      activationUrl: (process.env.NODE_ENV === 'test' || !emailSent) ? activationUrl : undefined
    };
  }
}

module.exports = {
  StudentModel,
  StudentError,
  readStudents,
  writeStudents
};

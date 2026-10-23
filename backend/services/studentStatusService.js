const StudentStatusModel = require('../models/studentStatusModel');
const EnrollmentModel = require('../models/enrollmentModel');
const ClassModel = require('../models/classModel');
const UserModel = require('../models/userModel');
const AttendanceModel = require('../models/attendanceModel');
const GradeModel = require('../models/gradeModel');

const DEFAULT_MAX_STUDENTS = 30;

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

class StudentStatusService {
  constructor({
    statusModel = new StudentStatusModel(),
    enrollmentModel = new EnrollmentModel(),
    classModel = ClassModel,
    userModel = UserModel
  } = {}) {
    this.statusModel = statusModel;
    this.enrollmentModel = enrollmentModel;
    this.classModel = classModel;
    this.userModel = userModel;
  }

  validateStudent(studentId) {
    if (!studentId || typeof studentId !== 'string' || !studentId.trim()) {
      const error = new Error('ID học viên không hợp lệ.');
      error.statusCode = 400;
      error.code = 'INVALID_STUDENT_ID';
      throw error;
    }

    const student = this.userModel.findById(studentId.trim());
    if (!student || !this.userModel.getRoles(student).includes('student') || student.status !== 'active') {
      const error = new Error('Không tìm thấy học viên đang hoạt động trong hệ thống.');
      error.statusCode = 404;
      error.code = 'STUDENT_NOT_FOUND';
      throw error;
    }
    return student;
  }

  validateEffectiveDate(effectiveDate) {
    if (!isValidDate(effectiveDate)) {
      const error = new Error('Ngày hiệu lực không hợp lệ. Vui lòng nhập định dạng YYYY-MM-DD.');
      error.statusCode = 400;
      error.code = 'INVALID_EFFECTIVE_DATE';
      throw error;
    }
    return effectiveDate.trim();
  }

  validateReason(reason) {
    if (typeof reason !== 'string' || !reason.trim()) {
      const error = new Error('Vui lòng nhập lý do thực hiện thao tác.');
      error.statusCode = 400;
      error.code = 'MISSING_REASON';
      throw error;
    }
    const trimmed = reason.trim();
    if (trimmed.length > 500) {
      const error = new Error('Lý do thao tác không được vượt quá 500 ký tự.');
      error.statusCode = 400;
      error.code = 'REASON_TOO_LONG';
      throw error;
    }
    return trimmed;
  }

  /**
   * [BE] Xử lý bảo lưu học viên
   */
  async deferStudent(studentId, { effectiveDate, reason, classId }, user) {
    const student = this.validateStudent(studentId);
    const validDate = this.validateEffectiveDate(effectiveDate);
    const validReason = this.validateReason(reason);

    let fromClass = null;
    if (classId) {
      fromClass = this.classModel.list().find(c => String(c.id) === String(classId));
    }
    if (!fromClass) {
      const currentClassId = this.enrollmentModel.findCurrentClassForStudent(student.id);
      if (currentClassId) {
        fromClass = this.classModel.list().find(c => String(c.id) === String(currentClassId));
      }
    }

    const actionResult = this.statusModel.recordAction({
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email,
      actionType: 'defer',
      effectiveDate: validDate,
      reason: validReason,
      fromClassId: fromClass?.id || null,
      fromClassName: fromClass?.name || null,
      fromClassCode: fromClass?.code || null,
      createdBy: user?.id || 'system',
      createdByName: user?.name || user?.email || 'Quản lý đào tạo',
      createdByRole: user?.role || ''
    });

    return {
      success: true,
      message: `Đã xử lý bảo lưu cho học viên ${student.name} có hiệu lực từ ngày ${validDate}.`,
      data: actionResult
    };
  }

  /**
   * [BE] Xử lý thôi học cho học viên
   */
  async dropStudent(studentId, { effectiveDate, reason }, user) {
    const student = this.validateStudent(studentId);
    const validDate = this.validateEffectiveDate(effectiveDate);
    const validReason = this.validateReason(reason);

    const currentClassId = this.enrollmentModel.findCurrentClassForStudent(student.id);
    const currentClass = currentClassId
      ? this.classModel.list().find(c => String(c.id) === String(currentClassId))
      : null;

    const actionResult = this.statusModel.recordAction({
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email,
      actionType: 'drop',
      effectiveDate: validDate,
      reason: validReason,
      fromClassId: currentClass?.id || null,
      fromClassName: currentClass?.name || null,
      fromClassCode: currentClass?.code || null,
      createdBy: user?.id || 'system',
      createdByName: user?.name || user?.email || 'Quản lý đào tạo',
      createdByRole: user?.role || ''
    });

    return {
      success: true,
      message: `Đã xử lý thôi học cho học viên ${student.name} có hiệu lực từ ngày ${validDate}.`,
      data: actionResult
    };
  }

  /**
   * [BE] Xử lý chuyển lớp cho học viên
   * Bảo toàn 100% dữ liệu điểm và điểm danh ở lớp cũ
   */
  async transferStudent(studentId, { fromClassId, toClassId, effectiveDate, reason }, user) {
    const student = this.validateStudent(studentId);
    const validDate = this.validateEffectiveDate(effectiveDate);
    const validReason = this.validateReason(reason);

    if (!toClassId || typeof toClassId !== 'string' || !toClassId.trim()) {
      const error = new Error('Vui lòng chọn lớp học mới cần chuyển đến.');
      error.statusCode = 400;
      error.code = 'MISSING_TO_CLASS';
      throw error;
    }

    const classes = this.classModel.list();
    const toClass = classes.find(c => String(c.id) === String(toClassId.trim()) && c.status === 'active');
    if (!toClass) {
      const error = new Error('Không tìm thấy lớp học mới hoặc lớp học mới không còn hoạt động.');
      error.statusCode = 404;
      error.code = 'TARGET_CLASS_NOT_FOUND';
      throw error;
    }

    // Xác định lớp cũ
    let fromClass = null;
    if (fromClassId && typeof fromClassId === 'string' && fromClassId.trim()) {
      fromClass = classes.find(c => String(c.id) === String(fromClassId.trim()));
    }
    if (!fromClass) {
      const currentClassId = this.enrollmentModel.findCurrentClassForStudent(student.id);
      if (currentClassId) {
        fromClass = classes.find(c => String(c.id) === String(currentClassId));
      }
    }

    if (fromClass && String(fromClass.id) === String(toClass.id)) {
      const error = new Error('Lớp chuyển đến phải khác lớp hiện tại của học viên.');
      error.statusCode = 400;
      error.code = 'SAME_CLASS_TRANSFER';
      throw error;
    }

    // Kiểm tra sĩ số lớp mới
    const maxCapacity = Number.isSafeInteger(toClass.maxStudents) && toClass.maxStudents > 0
      ? toClass.maxStudents
      : DEFAULT_MAX_STUDENTS;
    const currentEnrolled = this.enrollmentModel.countStudentsInClass(toClass.id);
    if (currentEnrolled >= maxCapacity) {
      const error = new Error(`Lớp đích "${toClass.name}" đã đạt sĩ số tối đa (${maxCapacity} học viên).`);
      error.statusCode = 409;
      error.code = 'CLASS_FULL';
      throw error;
    }

    // Thực hiện liên kết sang lớp mới qua EnrollmentModel, lưu giữ thông tin lớp cũ
    this.enrollmentModel.transferEnrollment(
      student.id,
      fromClass ? fromClass.id : null,
      toClass.id,
      {
        enrolledAt: new Date().toISOString(),
        effectiveDate: validDate,
        createdBy: user?.id || 'system',
        reason: validReason
      },
      maxCapacity
    );

    // Ghi nhận lịch sử hồ sơ học viên
    const actionResult = this.statusModel.recordAction({
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email,
      actionType: 'transfer',
      effectiveDate: validDate,
      reason: validReason,
      fromClassId: fromClass ? fromClass.id : null,
      fromClassName: fromClass ? fromClass.name : null,
      fromClassCode: fromClass ? fromClass.code : null,
      toClassId: toClass.id,
      toClassName: toClass.name,
      toClassCode: toClass.code,
      createdBy: user?.id || 'system',
      createdByName: user?.name || user?.email || 'Quản lý đào tạo',
      createdByRole: user?.role || ''
    });

    return {
      success: true,
      message: `Đã chuyển học viên ${student.name} sang lớp "${toClass.name}" thành công với ngày hiệu lực ${validDate}. Lịch sử điểm và điểm danh ở lớp cũ được bảo toàn.`,
      data: actionResult
    };
  }

  /**
   * Lấy danh sách học viên kèm thông tin trạng thái học tập và tác động điểm danh
   */
  listStudentsWithStatus({ date, search, status, classId } = {}) {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const activeStudents = this.userModel.findActiveStudents();
    const classes = this.classModel.list();

    let list = activeStudents.map(student => {
      const effective = this.statusModel.getEffectiveStatus(student.id, targetDate);

      // Nếu chưa có class từ statusModel, tra cứu từ enrollmentModel
      let currentClass = null;
      const classIdentifier = effective.currentClassId || this.enrollmentModel.findCurrentClassForStudent(student.id);
      if (classIdentifier) {
        currentClass = classes.find(c => String(c.id) === String(classIdentifier)) || null;
      }

      // Mô tả tác động tới danh sách điểm danh
      let attendanceImpact = 'Hiển thị bình thường trong danh sách điểm danh';
      if (effective.academicStatus === 'reserved') {
        attendanceImpact = `Bảo lưu: Đã ẩn khỏi danh sách điểm danh từ ${effective.effectiveDate}`;
      } else if (effective.academicStatus === 'dropped') {
        attendanceImpact = `Thôi học: Đã ẩn khỏi danh sách điểm danh từ ${effective.effectiveDate}`;
      } else if (effective.pendingAction) {
        attendanceImpact = `Đang học (Lên lịch ${effective.pendingAction.actionLabel} từ ngày ${effective.pendingAction.effectiveDate})`;
      }

      return {
        id: student.id,
        name: student.name,
        email: student.email,
        academicStatus: effective.academicStatus,
        statusLabel: effective.statusLabel,
        isStudying: effective.isStudying,
        currentClassId: currentClass?.id || null,
        currentClassName: currentClass?.name || null,
        currentClassCode: currentClass?.code || null,
        effectiveDate: effective.effectiveDate,
        reason: effective.reason,
        lastAction: effective.lastAction,
        pendingAction: effective.pendingAction,
        attendanceImpact
      };
    });

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(item =>
        item.name.toLowerCase().includes(q)
        || item.email.toLowerCase().includes(q)
        || (item.currentClassName && item.currentClassName.toLowerCase().includes(q))
      );
    }

    if (status && status !== 'all') {
      list = list.filter(item => item.academicStatus === status);
    }

    if (classId && classId !== 'all') {
      list = list.filter(item => String(item.currentClassId) === String(classId));
    }

    return {
      asOfDate: targetDate,
      total: list.length,
      studyingCount: list.filter(item => item.academicStatus === 'studying').length,
      reservedCount: list.filter(item => item.academicStatus === 'reserved').length,
      droppedCount: list.filter(item => item.academicStatus === 'dropped').length,
      data: list
    };
  }

  /**
   * Lấy tóm tắt hồ sơ đào tạo đầy đủ của học viên
   * Chứng minh việc bảo toàn điểm, điểm danh và lịch sử thao tác
   */
  getStudentSummary(studentId) {
    const student = this.validateStudent(studentId);
    const effectiveStatus = this.statusModel.getEffectiveStatus(student.id);
    const history = this.statusModel.listHistory({ studentId: student.id, limit: 100 });
    const enrollments = this.enrollmentModel.getEnrollmentsByStudent(student.id);

    // Lấy lịch sử điểm danh của học viên
    const allAttendance = AttendanceModel.listForUser({ id: 'system', role: 'admin', roles: ['admin'] })
      .filter(record => String(record.studentId) === String(student.id));

    // Lấy lịch sử điểm của học viên
    const allGrades = GradeModel.listForUser({ id: student.id, role: 'student', roles: ['student'] })
      .filter(record => String(record.studentId) === String(student.id));

    return {
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        phone: student.phone || '',
        avatar: student.avatar || '',
        status: student.status
      },
      currentStatus: effectiveStatus,
      statusHistory: history,
      enrollmentHistory: enrollments,
      attendanceHistory: allAttendance,
      gradeHistory: allGrades
    };
  }
}

module.exports = StudentStatusService;

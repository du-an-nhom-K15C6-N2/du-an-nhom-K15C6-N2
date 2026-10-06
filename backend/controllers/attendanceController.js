const AttendanceModel = require('../models/attendanceModel');
const UserModel = require('../models/userModel');

const ATTENDANCE_STATUSES = new Set(['present', 'late', 'absent', 'excused']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

class AttendanceController {
  static listStudents(req, res, next) {
    try {
      return res.status(200).json({
        success: true,
        data: UserModel.findActiveStudents()
      });
    } catch (error) {
      next(error);
    }
  }

  static list(req, res, next) {
    try {
      return res.status(200).json({
        success: true,
        data: AttendanceModel.listForUser(req.user)
      });
    } catch (error) {
      next(error);
    }
  }

  static create(req, res, next) {
    try {
      const { className, studentId, studentEmail, attendanceDate, status, note = '' } = req.body || {};
      if (typeof className !== 'string' || !className.trim() || className.trim().length > 120) {
        return res.status(400).json({ success: false, message: 'Tên lớp phải có từ 1 đến 120 ký tự.' });
      }
      if (studentId === undefined) {
        if (typeof studentEmail !== 'string' || !EMAIL_PATTERN.test(studentEmail.trim())) {
          return res.status(400).json({ success: false, message: 'Vui lòng chọn học sinh từ danh sách quản lý người dùng.' });
        }
      } else if (typeof studentId !== 'string' || !studentId.trim()) {
        return res.status(400).json({ success: false, message: 'Học sinh được chọn không hợp lệ.' });
      }
      if (!isValidDate(attendanceDate)) {
        return res.status(400).json({ success: false, message: 'Ngày điểm danh không hợp lệ.' });
      }
      if (!ATTENDANCE_STATUSES.has(status)) {
        return res.status(400).json({ success: false, message: 'Trạng thái điểm danh không hợp lệ.' });
      }
      if (typeof note !== 'string' || note.length > 500) {
        return res.status(400).json({ success: false, message: 'Ghi chú không được vượt quá 500 ký tự.' });
      }

      const student = studentId === undefined
        ? UserModel.findByEmail(studentEmail.trim().toLowerCase())
        : UserModel.findById(studentId.trim());
      if (!student || student.role !== 'student' || student.status !== 'active') {
        return res.status(404).json({
          success: false,
          code: 'RESOURCE_NOT_FOUND',
          errorType: 'not-found',
          resource: 'student',
          message: studentId === undefined
            ? 'Không tìm thấy học sinh đang hoạt động với email này.'
            : 'Học sinh đã chọn không còn hoạt động hoặc không tồn tại.'
        });
      }

      const data = AttendanceModel.create({
        className: className.trim(),
        studentId: student.id,
        studentName: student.name,
        studentEmail: student.email,
        attendanceDate,
        status,
        note: note.trim(),
        createdBy: req.user.id,
        createdByName: req.user.name
      });

      return res.status(201).json({ success: true, data, message: 'Đã lưu điểm danh.' });
    } catch (error) {
      if (error.statusCode === 409) {
        return res.status(409).json({ success: false, message: error.message });
      }
      next(error);
    }
  }
}

module.exports = AttendanceController;

const GradeModel = require('../models/gradeModel');
const UserModel = require('../models/userModel');

const MAX_TEXT_LENGTH = 120;

function invalid(res, message) {
  return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message });
}

class GradeController {
  static list(req, res, next) {
    try {
      return res.status(200).json({ success: true, data: GradeModel.listForUser(req.user) });
    } catch (error) {
      next(error);
    }
  }

  static upsert(req, res, next) {
    try {
      const { studentId, className, subject, term, score, maxScore = 10, note = '' } = req.body || {};
      if (
        typeof studentId !== 'string' || !studentId.trim()
        || typeof className !== 'string' || !className.trim() || className.trim().length > MAX_TEXT_LENGTH
        || typeof subject !== 'string' || !subject.trim() || subject.trim().length > MAX_TEXT_LENGTH
        || typeof term !== 'string' || !term.trim() || term.trim().length > MAX_TEXT_LENGTH
      ) {
        return invalid(res, 'Vui lòng nhập đầy đủ mã học viên, lớp, môn học và học kỳ hợp lệ.');
      }
      if (
        typeof score !== 'number' || !Number.isFinite(score) || score < 0
        || typeof maxScore !== 'number' || !Number.isFinite(maxScore) || maxScore <= 0
        || score > maxScore
      ) {
        return invalid(res, 'Điểm phải là số không âm và không vượt quá thang điểm tối đa.');
      }
      if (typeof note !== 'string' || note.length > 500) {
        return invalid(res, 'Ghi chú điểm không được vượt quá 500 ký tự.');
      }

      const student = UserModel.findById(studentId.trim());
      if (!student || !UserModel.getRoles(student).includes('student') || student.status !== 'active') {
        return res.status(404).json({
          success: false,
          code: 'RESOURCE_NOT_FOUND',
          message: 'Không tìm thấy học viên đang hoạt động.'
        });
      }

      const data = GradeModel.upsert({
        studentId: student.id,
        studentName: student.name,
        className: className.trim(),
        subject: subject.trim(),
        term: term.trim(),
        score,
        maxScore,
        note: note.trim(),
        updatedBy: req.user.id,
        updatedByName: req.user.name
      });
      return res.status(200).json({ success: true, data, message: 'Đã lưu điểm học viên.' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = GradeController;

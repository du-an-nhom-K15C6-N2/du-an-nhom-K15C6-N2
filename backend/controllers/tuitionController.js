const TuitionModel = require('../models/tuitionModel');
const UserModel = require('../models/userModel');

const VALID_STATUSES = new Set(['unpaid', 'partial', 'paid', 'waived']);

function invalid(res, message) {
  return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message });
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

class TuitionController {
  static list(req, res, next) {
    try {
      return res.status(200).json({ success: true, data: TuitionModel.listForUser(req.user) });
    } catch (error) {
      next(error);
    }
  }

  static upsert(req, res, next) {
    try {
      const {
        studentId,
        academicYear,
        amount,
        paidAmount = 0,
        dueDate = '',
        status,
        note = ''
      } = req.body || {};
      if (
        typeof studentId !== 'string' || !studentId.trim()
        || typeof academicYear !== 'string'
        || !/^\d{4}-\d{4}$/.test(academicYear)
      ) {
        return invalid(res, 'Vui lòng nhập mã học viên và năm học theo định dạng YYYY-YYYY.');
      }
      if (
        typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0
        || amount > 1_000_000_000_000
        || typeof paidAmount !== 'number' || !Number.isFinite(paidAmount)
        || paidAmount < 0 || paidAmount > amount
      ) {
        return invalid(res, 'Học phí và số tiền đã đóng phải hợp lệ; số đã đóng không được vượt học phí.');
      }
      if (!VALID_STATUSES.has(status)) {
        return invalid(res, 'Trạng thái học phí không hợp lệ.');
      }
      if (
        (status === 'unpaid' && (amount === 0 || paidAmount !== 0))
        || (status === 'partial' && (paidAmount === 0 || paidAmount === amount))
        || (status === 'paid' && (amount === 0 || paidAmount !== amount))
        || (status === 'waived' && paidAmount !== 0)
      ) {
        return invalid(res, 'Trạng thái học phí không khớp với số tiền phải thu và số tiền đã đóng.');
      }
      if (dueDate !== '' && !isValidDate(dueDate)) {
        return invalid(res, 'Ngày đến hạn học phí không hợp lệ.');
      }
      if (typeof note !== 'string' || note.length > 500) {
        return invalid(res, 'Ghi chú học phí không được vượt quá 500 ký tự.');
      }
      const student = UserModel.findById(studentId.trim());
      if (!student || !UserModel.getRoles(student).includes('student') || student.status !== 'active') {
        return res.status(404).json({
          success: false,
          code: 'RESOURCE_NOT_FOUND',
          message: 'Không tìm thấy học viên đang hoạt động.'
        });
      }

      const data = TuitionModel.upsert({
        studentId: student.id,
        studentName: student.name,
        academicYear,
        amount,
        paidAmount,
        dueDate,
        status,
        note: note.trim(),
        updatedBy: req.user.id,
        updatedByName: req.user.name
      });
      return res.status(200).json({ success: true, data, message: 'Đã cập nhật học phí học viên.' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = TuitionController;

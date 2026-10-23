const LeaveRequestModel = require('../models/leaveRequestModel');
const ClassModel = require('../models/classModel');
const LessonModel = require('../models/lessonModel');
const UserModel = require('../models/userModel');

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

class LeaveRequestController {
  /**
   * Học viên lấy danh sách đơn xin nghỉ phép của mình
   */
  static getMyRequests(req, res, next) {
    try {
      const studentId = req.user.id;
      const requests = LeaveRequestModel.listForStudent(studentId);
      return res.status(200).json({
        success: true,
        data: requests
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Học viên gửi đơn xin nghỉ phép mới
   */
  static createRequest(req, res, next) {
    try {
      const {
        classId,
        className,
        lessonId,
        lessonNumber,
        leaveDate,
        reason,
        evidence = ''
      } = req.body || {};

      const resolvedClassName = (className || '').trim();
      if (!resolvedClassName) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_CLASS',
          message: 'Vui lòng chọn lớp học cần xin phép vắng.'
        });
      }

      if (!isValidDate(leaveDate)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_DATE',
          message: 'Ngày xin nghỉ không đúng định dạng YYYY-MM-DD.'
        });
      }

      if (typeof reason !== 'string' || reason.trim().length < 5) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_REASON',
          message: 'Lý do xin nghỉ bắt buộc nhập tối thiểu 5 ký tự.'
        });
      }

      if (reason.trim().length > 1000) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_REASON',
          message: 'Lý do xin nghỉ không được vượt quá 1000 ký tự.'
        });
      }

      const newRequest = LeaveRequestModel.create({
        studentId: req.user.id,
        studentName: req.user.fullName || req.user.name || req.user.email,
        studentEmail: req.user.email,
        classId: classId || null,
        className: resolvedClassName,
        lessonId: lessonId || null,
        lessonNumber: lessonNumber || null,
        leaveDate,
        reason,
        evidence
      });

      return res.status(201).json({
        success: true,
        data: newRequest,
        message: 'Đã gửi đơn xin phép vắng thành công. Đang chờ giảng viên/quản lý phê duyệt.'
      });
    } catch (error) {
      if (error.statusCode === 409) {
        return res.status(409).json({
          success: false,
          code: error.code || 'DUPLICATE_LEAVE_REQUEST',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Học viên huỷ đơn khi còn ở trạng thái chờ duyệt
   */
  static cancelRequest(req, res, next) {
    try {
      const { id } = req.params;
      const cancelled = LeaveRequestModel.cancel(id, req.user.id);
      return res.status(200).json({
        success: true,
        data: cancelled,
        message: 'Đã huỷ đơn xin nghỉ phép thành công.'
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Giảng viên / Quản lý / Admin xem danh sách đơn để duyệt
   */
  static listAllRequests(req, res, next) {
    try {
      const { classId, status, search } = req.query;
      const requests = LeaveRequestModel.listForReviewer({ classId, status, search });
      return res.status(200).json({
        success: true,
        data: requests
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Giảng viên / Quản lý / Admin duyệt hoặc từ chối đơn
   */
  static reviewRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { status, reviewNote = '' } = req.body || {};

      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_STATUS',
          message: 'Trạng thái xử lý không hợp lệ. Chỉ chấp nhận "approved" (Duyệt) hoặc "rejected" (Từ chối).'
        });
      }

      if (status === 'rejected' && (!reviewNote || reviewNote.trim().length < 3)) {
        return res.status(400).json({
          success: false,
          code: 'REQUIRED_REJECT_REASON',
          message: 'Vui lòng nhập lý do từ chối (tối thiểu 3 ký tự) để phản hồi cho học viên.'
        });
      }

      const reviewed = LeaveRequestModel.review(id, {
        status,
        reviewNote,
        reviewerUser: req.user
      });

      const message = status === 'approved'
        ? 'Đã duyệt đơn xin phép vắng thành công. Hệ thống đã tự động ghi nhận điểm danh có phép (excused) cho học viên.'
        : 'Đã từ chối đơn xin phép vắng và gửi thông báo phản hồi cho học viên.';

      return res.status(200).json({
        success: true,
        data: reviewed,
        message
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Danh sách lớp và các buổi học để học viên chọn khi nộp đơn
   */
  static getOptions(req, res, next) {
    try {
      const classes = ClassModel.listActiveClasses ? ClassModel.listActiveClasses() : [];
      let lessons = [];
      try {
        if (req.query.classId) {
          lessons = LessonModel.listByClass(req.query.classId);
        }
      } catch (e) {
        // bỏ qua
      }

      return res.status(200).json({
        success: true,
        data: {
          classes: classes.map(c => ({
            id: c.id,
            code: c.code,
            name: c.name,
            schedule: c.schedule || ''
          })),
          lessons: lessons.map(l => ({
            id: l.id,
            lessonNumber: l.lessonNumber,
            date: l.date,
            startTime: l.startTime,
            endTime: l.endTime,
            status: l.status
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = LeaveRequestController;

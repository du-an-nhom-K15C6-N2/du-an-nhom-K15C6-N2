const ClassModel = require('../models/classModel');

const CLASS_STATUSES = new Set(['active', 'planned', 'paused', 'completed', 'cancelled']);

function getFilterValue(value, name, maxLength = 100) {
  if (value === undefined) return { value: '', error: null };
  if (typeof value !== 'string' || value.length > maxLength) {
    return { value: '', error: `Tham số ${name} không hợp lệ.` };
  }
  return { value: value.trim(), error: null };
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

class ClassController {
  /**
   * Danh sách lớp học kèm trạng thái cảnh báo bàn giao.
   * GET /api/classes
   */
  static async list(req, res) {
    try {
      const filters = {};
      for (const key of ['status', 'programId', 'teacherId', 'startDate', 'endDate']) {
        const parsed = getFilterValue(req.query[key], key, 100);
        if (parsed.error) {
          return res.status(400).json({ success: false, code: 'INVALID_CLASS_FILTER', message: parsed.error });
        }
        if (parsed.value) filters[key] = parsed.value;
      }

      if (filters.status === 'all') delete filters.status;
      if (filters.status && !CLASS_STATUSES.has(filters.status)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_CLASS_FILTER',
          message: 'Trạng thái lớp học không hợp lệ.'
        });
      }
      for (const key of ['startDate', 'endDate']) {
        if (filters[key] && !isValidDate(filters[key])) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_CLASS_FILTER',
            message: `Ngày ${key === 'startDate' ? 'bắt đầu' : 'kết thúc'} phải theo định dạng YYYY-MM-DD.`
          });
        }
      }
      if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_CLASS_FILTER',
          message: 'Ngày bắt đầu không được sau ngày kết thúc.'
        });
      }

      const data = ClassModel.list(filters);
      const roomAlerts = data.filter(item => item.roomWarning);
      return res.status(200).json({
        success: true,
        data,
        filterOptions: ClassModel.getFilterOptions(),
        summary: {
          totalClasses: data.length,
          handoverRequired: data.filter(item => item.needsHandover).length,
          roomAlerts: roomAlerts.length,
          currentStudents: data.reduce((total, item) => total + item.currentStudents, 0),
          maxStudents: data.reduce((total, item) => total + item.maxStudents, 0)
        }
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message || 'Không thể tải danh sách lớp học.' });
    }
  }

  static async roomAlerts(req, res) {
    try {
      const data = ClassModel.listRoomAlerts();
      return res.status(200).json({
        success: true,
        data,
        summary: {
          total: data.length,
          message: data.length
            ? `Có ${data.length} lớp cần kiểm tra phòng học hoặc sức chứa.`
            : 'Không có cảnh báo phòng học.'
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Không thể tải cảnh báo phòng học.'
      });
    }
  }

  static async assignRoom(req, res, next) {
    const roomId = req.body?.roomId;
    if (roomId !== null && (typeof roomId !== 'string' || !roomId.trim())) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_ROOM_ID',
        message: 'roomId phải là mã phòng hợp lệ hoặc null để bỏ phân công.'
      });
    }
    try {
      const data = ClassModel.assignRoom(req.params.id, roomId === null ? null : roomId.trim());
      return res.status(200).json({
        success: true,
        data,
        message: data.roomName
          ? `Đã phân công ${data.roomName} cho lớp ${data.code}.`
          : `Đã bỏ phân công phòng cho lớp ${data.code}.`
      });
    } catch (error) {
      if (!error.code) return next(error);
      const status = error.code === 'CLASS_NOT_FOUND' || error.code === 'ROOM_NOT_FOUND' ? 404
        : error.code === 'ROOM_CAPACITY_EXCEEDED' ? 409
          : 400;
      return res.status(status).json({
        success: false,
        code: error.code || 'ROOM_ASSIGNMENT_FAILED',
        message: error.message || 'Không thể phân công phòng cho lớp.'
      });
    }
  }

  /**
   * Danh sách cảnh báo các lớp do giảng viên bị khóa phụ trách.
   * GET /api/classes/handover-alerts
   */
  static async handoverAlerts(req, res) {
    try {
      const data = ClassModel.listHandoverAlerts();
      return res.status(200).json({
        success: true,
        data,
        availableTeachers: ClassModel.getAvailableTeachers(),
        summary: {
          handoverRequired: data.length,
          message: data.length
            ? `Có ${data.length} lớp học cần bàn giao do giảng viên phụ trách đang bị khóa.`
            : 'Hiện không có lớp học nào cần bàn giao.'
        }
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message || 'Không thể tải cảnh báo bàn giao lớp học.' });
    }
  }

  /**
   * Bàn giao lớp học cho giảng viên hoạt động.
   * PATCH /api/classes/:id/handover
   */
  static async handover(req, res) {
    try {
      const { id } = req.params;
      const { teacherId } = req.body || {};

      if (typeof teacherId !== 'string' || !teacherId.trim()) {
        return res.status(400).json({
          success: false,
          code: 'HANDOVER_TEACHER_REQUIRED',
          message: 'Vui lòng chọn giảng viên nhận bàn giao.'
        });
      }

      const updated = ClassModel.handover(id, teacherId.trim(), req.user);
      return res.status(200).json({
        success: true,
        data: updated,
        message: `Đã bàn giao lớp ${updated.code} - ${updated.name} cho ${updated.teacherName}.`
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Không thể bàn giao lớp học.'
      });
    }
  }
}

module.exports = ClassController;

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
      return res.status(200).json({
        success: true,
        data,
        filterOptions: ClassModel.getFilterOptions(),
        summary: {
          totalClasses: data.length,
          handoverRequired: data.filter(item => item.needsHandover).length,
          currentStudents: data.reduce((total, item) => total + item.currentStudents, 0),
          maxStudents: data.reduce((total, item) => total + item.maxStudents, 0)
        }
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message || 'Không thể tải danh sách lớp học.' });
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

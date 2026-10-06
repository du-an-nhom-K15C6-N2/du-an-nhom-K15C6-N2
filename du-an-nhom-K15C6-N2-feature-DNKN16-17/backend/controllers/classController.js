const ClassModel = require('../models/classModel');

class ClassController {
  /**
   * Danh sách lớp học kèm trạng thái cảnh báo bàn giao.
   * GET /api/classes
   */
  static async list(req, res) {
    try {
      const data = ClassModel.list();
      return res.status(200).json({
        success: true,
        data,
        summary: {
          totalClasses: data.length,
          handoverRequired: data.filter(item => item.needsHandover).length
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

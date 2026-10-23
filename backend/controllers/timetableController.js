const TimetableModel = require('../models/timetableModel');

class TimetableController {
  /**
   * Lấy dữ liệu thời khóa biểu theo chế độ tuần/tháng và các bộ lọc
   */
  static getTimetable(req, res) {
    try {
      const { view, date, classId, teacherId, room } = req.query;

      const result = TimetableModel.getSchedule({
        view: view || 'week',
        date: date || undefined,
        classId: classId || undefined,
        teacherId: teacherId || undefined,
        room: room || undefined
      });

      return res.status(200).json({
        success: true,
        message: 'Lấy dữ liệu thời khóa biểu thành công.',
        data: result
      });
    } catch (error) {
      console.error('Lỗi khi lấy dữ liệu thời khóa biểu:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Lỗi xử lý yêu cầu thời khóa biểu.'
      });
    }
  }

  /**
   * Lấy chi tiết buổi học khi bấm vào ô lịch
   */
  static getSessionDetail(req, res) {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp mã buổi học (id).'
        });
      }

      const session = TimetableModel.findById(id);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thông tin buổi học.'
        });
      }

      return res.status(200).json({
        success: true,
        data: session
      });
    } catch (error) {
      console.error('Lỗi khi lấy chi tiết buổi học:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ khi lấy chi tiết buổi học.'
      });
    }
  }

  /**
   * Thêm buổi học mới vào thời khóa biểu
   */
  static createSession(req, res) {
    try {
      const {
        classId,
        className,
        classCode,
        courseName,
        teacherId,
        teacherName,
        room,
        date,
        startTime,
        endTime,
        shift,
        note
      } = req.body;

      if (!classId || !date || !startTime || !endTime || !room) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng điền đầy đủ các thông tin: Lớp học, Ngày học, Giờ bắt đầu, Giờ kết thúc và Phòng học.'
        });
      }

      const created = TimetableModel.create({
        classId,
        className: className || classId,
        classCode: classCode || classId,
        courseName: courseName || '',
        teacherId: teacherId || '',
        teacherName: teacherName || 'Chưa phân công',
        room,
        date,
        startTime,
        endTime,
        shift: shift || 'Ca học',
        note: note || ''
      });

      return res.status(201).json({
        success: true,
        message: 'Thêm buổi học vào thời khóa biểu thành công.',
        data: created
      });
    } catch (error) {
      console.error('Lỗi khi thêm buổi học:', error);
      return res.status(500).json({
        success: false,
        message: 'Không thể thêm buổi học.'
      });
    }
  }
}

module.exports = TimetableController;

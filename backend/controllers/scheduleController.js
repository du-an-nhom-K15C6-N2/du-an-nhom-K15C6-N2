/**
 * Controller cho API Quản lý Lịch học (DNKN-240)
 * Tích hợp DNKN-253, DNKN-254, DNKN-257
 */

const { scheduleService, ConflictError, ForbiddenError, ValidationError } = require('../services/scheduleService');

/**
 * DNKN-253 & DNKN-254: API kiểm tra xung đột lịch học
 * Endpoint: POST /api/schedules/check-conflict
 */
async function checkConflictHandler(req, res) {
  try {
    const conflictResult = await scheduleService.checkConflict(req.body || {});
    return res.status(200).json({
      success: true,
      data: conflictResult
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'Lỗi khi kiểm tra xung đột lịch học.'
    });
  }
}

/**
 * Lấy danh sách lịch học
 * Endpoint: GET /api/schedules
 */
async function listSchedulesHandler(req, res) {
  try {
    const schedules = await scheduleService.listSchedules(req.query);
    return res.status(200).json({
      success: true,
      count: schedules.length,
      data: schedules
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Không thể tải danh sách lịch học.'
    });
  }
}

/**
 * Lấy chi tiết lịch học theo ID
 * Endpoint: GET /api/schedules/:id
 */
async function getScheduleByIdHandler(req, res) {
  try {
    const schedule = await scheduleService.getScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy lịch học với mã ${req.params.id}.`
      });
    }
    return res.status(200).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thông tin lịch học.'
    });
  }
}

/**
 * DNKN-257: Tạo mới lịch học
 * Endpoint: POST /api/schedules
 */
async function createScheduleHandler(req, res) {
  try {
    const result = await scheduleService.createSchedule(req.body, req.user);
    return res.status(201).json({
      success: true,
      message: result.overridden ? 'Đã lưu lịch học (đã xác nhận ghi đè).' : 'Tạo lịch học thành công.',
      data: result.schedule,
      overridden: result.overridden,
      audit: result.audit || null
    });
  } catch (error) {
    if (error instanceof ConflictError) {
      return res.status(409).json({
        success: false,
        code: error.code,
        message: error.message,
        conflictDetails: error.conflictDetails
      });
    }

    if (error instanceof ForbiddenError) {
      return res.status(403).json({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    return res.status(error.status || 500).json({
      success: false,
      code: error.code || 'SERVER_ERROR',
      message: error.message || 'Lỗi hệ thống khi tạo lịch học.'
    });
  }
}

/**
 * DNKN-257: Cập nhật lịch học
 * Endpoint: PUT /api/schedules/:id
 */
async function updateScheduleHandler(req, res) {
  try {
    const result = await scheduleService.updateSchedule(req.params.id, req.body, req.user);
    return res.status(200).json({
      success: true,
      message: result.overridden ? 'Đã cập nhật lịch học (đã xác nhận ghi đè).' : 'Cập nhật lịch học thành công.',
      data: result.schedule,
      overridden: result.overridden,
      audit: result.audit || null
    });
  } catch (error) {
    if (error instanceof ConflictError) {
      return res.status(409).json({
        success: false,
        code: error.code,
        message: error.message,
        conflictDetails: error.conflictDetails
      });
    }

    if (error instanceof ForbiddenError) {
      return res.status(403).json({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        code: error.code,
        message: error.message
      });
    }

    return res.status(error.status || 500).json({
      success: false,
      code: error.code || 'SERVER_ERROR',
      message: error.message || 'Lỗi hệ thống khi cập nhật lịch học.'
    });
  }
}

/**
 * Hủy lịch học
 * Endpoint: PATCH /api/schedules/:id/cancel
 */
async function cancelScheduleHandler(req, res) {
  try {
    const cancelled = await scheduleService.cancelSchedule(req.params.id);
    if (!cancelled) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy lịch học với mã ${req.params.id}.`
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Đã hủy lịch học thành công.',
      data: cancelled
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi hủy lịch học.'
    });
  }
}

/**
 * Lấy danh mục master data (lớp, môn, giảng viên, phòng, ca)
 * Endpoint: GET /api/schedules/master-data
 */
function getMasterDataHandler(req, res) {
  const data = scheduleService.getMasterData();
  return res.status(200).json({
    success: true,
    data
  });
}

/**
 * Lấy danh sách audit log ghi đè lịch
 * Endpoint: GET /api/schedules/audit-logs
 */
async function getAuditLogsHandler(req, res) {
  try {
    const logs = await scheduleService.getAuditLogs(req.query);
    return res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Không thể tải danh sách audit logs.'
    });
  }
}

module.exports = {
  checkConflictHandler,
  listSchedulesHandler,
  getScheduleByIdHandler,
  createScheduleHandler,
  updateScheduleHandler,
  cancelScheduleHandler,
  getMasterDataHandler,
  getAuditLogsHandler
};

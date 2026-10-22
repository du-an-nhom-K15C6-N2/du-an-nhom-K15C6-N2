/**
 * DNKN-240: Service nghiệp vụ Quản lý Lịch học
 * Tích hợp DNKN-254 (Kiểm tra trùng), DNKN-253 (Chi tiết xung đột), DNKN-257 (Chặn lưu & Ghi đè)
 */

const { checkScheduleConflict, resolveTimes, normalizeDate } = require('./scheduleConflictService');
const { scheduleRepository, MASTER_CLASSES, MASTER_SUBJECTS, MASTER_LECTURERS, MASTER_ROOMS } = require('../models/scheduleModel');
const { scheduleAuditRepository } = require('../models/scheduleAuditModel');
const { isTrainingManager } = require('../middleware/auth');

class ConflictError extends Error {
  constructor(message, conflictDetails) {
    super(message);
    this.name = 'ConflictError';
    this.status = 409;
    this.code = 'SCHEDULE_CONFLICT';
    this.conflictDetails = conflictDetails;
  }
}

class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ForbiddenError';
    this.status = 403;
    this.code = 'FORBIDDEN_OVERRIDE';
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.code = 'VALIDATION_ERROR';
  }
}

function validateScheduleInput(data) {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Dữ liệu lịch học không hợp lệ.');
  }

  if (!data.classId || String(data.classId).trim() === '') {
    throw new ValidationError('Lớp học không được để trống.');
  }

  if (!data.subjectId || String(data.subjectId).trim() === '') {
    throw new ValidationError('Môn học không được để trống.');
  }

  if (!data.lecturerId || String(data.lecturerId).trim() === '') {
    throw new ValidationError('Giảng viên không được để trống.');
  }

  if (!data.roomId || String(data.roomId).trim() === '') {
    throw new ValidationError('Phòng học không được để trống.');
  }

  if (!data.date || String(data.date).trim() === '') {
    throw new ValidationError('Ngày học không được để trống.');
  }

  const normalizedDate = normalizeDate(data.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    throw new ValidationError('Định dạng ngày học phải là YYYY-MM-DD.');
  }

  const { startTime, endTime } = resolveTimes(data);
  if (!startTime || !endTime) {
    throw new ValidationError('Cần chỉ định ca học hoặc khoảng thời gian bắt đầu - kết thúc.');
  }

  if (startTime >= endTime) {
    throw new ValidationError('Thời gian kết thúc phải sau thời gian bắt đầu.');
  }

  return {
    ...data,
    date: normalizedDate,
    startTime,
    endTime
  };
}

class ScheduleService {
  constructor(repo = scheduleRepository, auditRepo = scheduleAuditRepository) {
    this.repo = repo;
    this.auditRepo = auditRepo;
  }

  /**
   * DNKN-254 & DNKN-253: Kiểm tra xung đột cho một lịch học
   * @param {Object} scheduleData - Dữ liệu lịch cần kiểm tra
   * @returns {Promise<Object>} Chi tiết xung đột
   */
  async checkConflict(scheduleData) {
    const existing = await this.repo.getAll();
    return checkScheduleConflict(scheduleData, existing, {
      excludeId: scheduleData.id || null
    });
  }

  /**
   * Lấy danh sách lịch học kèm lọc
   */
  async listSchedules(filter = {}) {
    return this.repo.getAll(filter);
  }

  /**
   * Lấy chi tiết lịch học theo ID
   */
  async getScheduleById(id) {
    return this.repo.getById(id);
  }

  /**
   * DNKN-257: Tạo mới lịch học
   * - Mặc định chặn lưu nếu có xung đột (409 Conflict)
   * - Chỉ Quản lý đào tạo được xác nhận ghi đè (403 Forbidden nếu không đủ quyền)
   * - Đảm bảo tính nhất quán: ghi audit và lưu lịch cùng thành công
   */
  async createSchedule(data, actor = {}) {
    const validated = validateScheduleInput(data);
    const conflictResult = await this.checkConflict(validated);

    if (conflictResult.hasConflict) {
      // 1. Chặn lưu mặc định
      if (!data.confirmOverride) {
        throw new ConflictError(
          'Phát hiện xung đột lịch học. Cần Quản lý đào tạo xác nhận ghi đè để lưu.',
          conflictResult
        );
      }

      // 2. Xác minh quyền Quản lý đào tạo
      if (!isTrainingManager(actor.role)) {
        throw new ForbiddenError(
          'Chỉ người có quyền Quản lý đào tạo mới được xác nhận ghi đè lịch học bị trùng.'
        );
      }

      // 3. Yêu cầu lý do ghi đè
      const overrideReason = (data.overrideReason || '').trim();
      if (!overrideReason) {
        throw new ValidationError('Cần cung cấp lý do xác nhận ghi đè lịch học.');
      }

      // 4. Lưu lịch và ghi audit nhất quán
      let createdSchedule = null;
      let auditRecord = null;

      try {
        createdSchedule = await this.repo.create({
          ...validated,
          isOverridden: true,
          overrideReason,
          overriddenBy: {
            id: actor.id,
            name: actor.name,
            role: actor.role
          },
          overriddenAt: new Date().toISOString()
        });

        auditRecord = await this.auditRepo.createAuditEntry({
          action: 'SCHEDULE_OVERRIDE_CREATE',
          scheduleId: createdSchedule.id,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          overrideReason,
          conflictsOverridden: conflictResult.conflicts,
          scheduleData: createdSchedule
        });

        return {
          schedule: createdSchedule,
          overridden: true,
          audit: auditRecord
        };
      } catch (err) {
        // Rollback nếu có lỗi xảy ra để không có thành công giả
        if (createdSchedule) {
          await this.repo.delete(createdSchedule.id);
        }
        if (auditRecord) {
          await this.auditRepo.remove(auditRecord.id);
        }
        throw err;
      }
    }

    // Không có xung đột: lưu bình thường
    const createdSchedule = await this.repo.create(validated);
    return {
      schedule: createdSchedule,
      overridden: false
    };
  }

  /**
   * DNKN-257: Cập nhật lịch học
   */
  async updateSchedule(id, data, actor = {}) {
    const existing = await this.repo.getById(id);
    if (!existing) {
      const err = new Error(`Không tìm thấy lịch học với mã ${id}.`);
      err.status = 404;
      throw err;
    }

    const merged = { ...existing, ...data, id };
    const validated = validateScheduleInput(merged);
    const conflictResult = await this.checkConflict(validated);

    if (conflictResult.hasConflict) {
      if (!data.confirmOverride) {
        throw new ConflictError(
          'Phát hiện xung đột lịch học khi cập nhật. Cần Quản lý đào tạo xác nhận ghi đè để lưu.',
          conflictResult
        );
      }

      if (!isTrainingManager(actor.role)) {
        throw new ForbiddenError(
          'Chỉ người có quyền Quản lý đào tạo mới được xác nhận ghi đè lịch học bị trùng.'
        );
      }

      const overrideReason = (data.overrideReason || '').trim();
      if (!overrideReason) {
        throw new ValidationError('Cần cung cấp lý do xác nhận ghi đè lịch học.');
      }

      // Sao lưu trạng thái cũ để phục hồi nếu ghi audit thất bại
      const previousState = { ...existing };
      let updatedSchedule = null;
      let auditRecord = null;

      try {
        updatedSchedule = await this.repo.update(id, {
          ...validated,
          isOverridden: true,
          overrideReason,
          overriddenBy: {
            id: actor.id,
            name: actor.name,
            role: actor.role
          },
          overriddenAt: new Date().toISOString()
        });

        auditRecord = await this.auditRepo.createAuditEntry({
          action: 'SCHEDULE_OVERRIDE_UPDATE',
          scheduleId: id,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          overrideReason,
          conflictsOverridden: conflictResult.conflicts,
          scheduleData: updatedSchedule
        });

        return {
          schedule: updatedSchedule,
          overridden: true,
          audit: auditRecord
        };
      } catch (err) {
        // Rollback nếu thất bại
        await this.repo.update(id, previousState);
        if (auditRecord) {
          await this.auditRepo.remove(auditRecord.id);
        }
        throw err;
      }
    }

    const updatedSchedule = await this.repo.update(id, validated);
    return {
      schedule: updatedSchedule,
      overridden: false
    };
  }

  /**
   * Hủy lịch học
   */
  async cancelSchedule(id) {
    return this.repo.cancel(id);
  }

  /**
   * Lấy danh mục master data (lớp, môn, giảng viên, phòng, ca)
   */
  getMasterData() {
    return {
      classes: MASTER_CLASSES,
      subjects: MASTER_SUBJECTS,
      lecturers: MASTER_LECTURERS,
      rooms: MASTER_ROOMS
    };
  }

  /**
   * Lấy lịch sử audit ghi đè
   */
  async getAuditLogs(filter = {}) {
    return this.auditRepo.getAll(filter);
  }
}

const scheduleService = new ScheduleService();

module.exports = {
  ConflictError,
  ForbiddenError,
  ValidationError,
  ScheduleService,
  scheduleService
};

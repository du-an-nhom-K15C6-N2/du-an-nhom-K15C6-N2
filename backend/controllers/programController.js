const ProgramModel = require('../models/programModel');
const config = require('../config/app.config');

class ProgramController {
  static getPrograms(req, res, next) {
    try {
      const page = ProgramController.parsePositiveInteger(req.query.page, 1);
      const pageSize = ProgramController.parsePositiveInteger(
        req.query.pageSize,
        config.DEFAULT_PAGE_SIZE
      );
      if (!page || !pageSize || pageSize > 100) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PAGINATION',
          message: 'Trang phải là số nguyên dương; kích thước trang phải từ 1 đến 100.'
        });
      }

      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
      if (typeof req.query.search !== 'undefined' && typeof req.query.search !== 'string'
        || typeof req.query.code !== 'undefined' && typeof req.query.code !== 'string') {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PROGRAM_FILTER',
          message: 'Từ khóa tìm kiếm và mã chương trình phải là văn bản đơn.'
        });
      }

      return res.status(200).json({
        success: true,
        ...ProgramModel.findAll({ page, pageSize, search, code })
      });
    } catch (error) {
      return next(error);
    }
  }

  static parsePositiveInteger(value, defaultValue) {
    if (typeof value === 'undefined') return defaultValue;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  static validateProgramFields(body, defaults = {}) {
    const { code, name, description = '' } = body || {};
    const totalDuration = body?.totalDuration ?? defaults.totalDuration ?? 0;
    const standardTuition = body?.standardTuition ?? defaults.standardTuition ?? 0;
    const status = body?.status ?? defaults.status ?? 'active';

    if (typeof code !== 'string' || !code.trim()) {
      return { error: { code: 'PROGRAM_CODE_REQUIRED', message: 'Mã chương trình không được để trống.' } };
    }
    if (typeof name !== 'string' || !name.trim()) {
      return { error: { code: 'PROGRAM_NAME_REQUIRED', message: 'Tên chương trình không được để trống.' } };
    }
    if (typeof description !== 'string') {
      return { error: { code: 'PROGRAM_DESCRIPTION_INVALID', message: 'Mô tả chương trình phải là văn bản.' } };
    }
    if (typeof totalDuration !== 'number' || !Number.isFinite(totalDuration) || totalDuration < 0) {
      return { error: { code: 'PROGRAM_DURATION_INVALID', message: 'Tổng thời lượng phải là số không âm.' } };
    }
    if (typeof standardTuition !== 'number' || !Number.isSafeInteger(standardTuition) || standardTuition < 0) {
      return { error: { code: 'PROGRAM_TUITION_INVALID', message: 'Học phí chuẩn phải là số nguyên không âm (VNĐ).' } };
    }
    if (!['active', 'inactive'].includes(status)) {
      return { error: { code: 'PROGRAM_STATUS_INVALID', message: 'Trạng thái chỉ được là đang hoạt động hoặc ngừng hoạt động.' } };
    }

    return {
      value: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim(),
        totalDuration,
        standardTuition,
        status
      }
    };
  }

  static createProgram(req, res, next) {
    const validation = ProgramController.validateProgramFields(req.body);
    if (validation.error) {
      return res.status(400).json({ success: false, ...validation.error });
    }
    const programFields = validation.value;
    if (ProgramModel.hasCode(programFields.code)) {
      return ProgramController.duplicateCodeResponse(res);
    }

    try {
      const program = ProgramModel.create(programFields);
      return res.status(201).json({
        success: true,
        data: program,
        message: 'Tạo chương trình đào tạo thành công.'
      });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return ProgramController.duplicateCodeResponse(res);
      }
      return next(error);
    }
  }

  static updateProgram(req, res, next) {
    const id = ProgramController.parsePositiveInteger(req.params.id, null);
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PROGRAM_ID',
        message: 'Mã định danh chương trình không hợp lệ.'
      });
    }

    try {
      const existingProgram = ProgramModel.findById(id);
      if (!existingProgram) {
        return res.status(404).json({
          success: false,
          code: 'PROGRAM_NOT_FOUND',
          message: 'Không tìm thấy chương trình đào tạo.'
        });
      }

      const validation = ProgramController.validateProgramFields(req.body, existingProgram);
      if (validation.error) {
        return res.status(400).json({ success: false, ...validation.error });
      }
      const programFields = validation.value;
      if (programFields.code !== existingProgram.code && ProgramModel.hasCode(programFields.code)) {
        return ProgramController.duplicateCodeResponse(res);
      }

      const program = ProgramModel.update(id, programFields);
      return res.status(200).json({
        success: true,
        data: program,
        message: 'Cập nhật chương trình đào tạo thành công.'
      });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return ProgramController.duplicateCodeResponse(res);
      }
      return next(error);
    }
  }

  static createRunningClass(req, res, next) {
    const programId = ProgramController.parsePositiveInteger(req.params.id, null);
    if (!programId) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PROGRAM_ID',
        message: 'Mã định danh chương trình không hợp lệ.'
      });
    }

    const { classCode, className } = req.body || {};
    if (typeof classCode !== 'string' || !classCode.trim()
      || typeof className !== 'string' || !className.trim()) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_RUNNING_CLASS',
        message: 'Mã lớp và tên lớp đang chạy không được để trống.'
      });
    }

    try {
      const program = ProgramModel.findById(programId);
      if (!program) {
        return res.status(404).json({
          success: false,
          code: 'PROGRAM_NOT_FOUND',
          message: 'Không tìm thấy chương trình đào tạo.'
        });
      }
      if (program.status !== 'active') {
        return res.status(409).json({
          success: false,
          code: 'PROGRAM_INACTIVE',
          message: 'Không thể gán lớp mới vào chương trình đã ngừng áp dụng.'
        });
      }

      const runningClass = ProgramModel.addRunningClass(programId, {
        classCode: classCode.trim().toUpperCase(),
        className: className.trim()
      });
      if (!runningClass) {
        const latestProgram = ProgramModel.findById(programId);
        return res.status(latestProgram ? 409 : 404).json({
          success: false,
          code: latestProgram ? 'PROGRAM_INACTIVE' : 'PROGRAM_NOT_FOUND',
          message: latestProgram
            ? 'Không thể gán lớp mới vào chương trình đã ngừng áp dụng.'
            : 'Không tìm thấy chương trình đào tạo.'
        });
      }
      return res.status(201).json({
        success: true,
        data: runningClass,
        message: 'Đã liên kết lớp đang chạy với chương trình đào tạo.'
      });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({
          success: false,
          code: 'CLASS_ALREADY_LINKED',
          message: 'Mã lớp này đã được liên kết với một chương trình đào tạo.'
        });
      }
      return next(error);
    }
  }

  static getRunningClasses(req, res, next) {
    const programId = ProgramController.parsePositiveInteger(req.params.id, null);
    if (!programId) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PROGRAM_ID',
        message: 'Mã định danh chương trình không hợp lệ.'
      });
    }
    try {
      if (!ProgramModel.findById(programId)) {
        return res.status(404).json({
          success: false,
          code: 'PROGRAM_NOT_FOUND',
          message: 'Không tìm thấy chương trình đào tạo.'
        });
      }
      return res.status(200).json({
        success: true,
        data: ProgramModel.listRunningClasses(programId)
      });
    } catch (error) {
      return next(error);
    }
  }

  static endRunningClass(req, res, next) {
    const programId = ProgramController.parsePositiveInteger(req.params.id, null);
    const classId = ProgramController.parsePositiveInteger(req.params.classId, null);
    if (!programId || !classId) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_CLASS_ID',
        message: 'Mã chương trình hoặc mã lớp không hợp lệ.'
      });
    }
    try {
      if (!ProgramModel.findById(programId)) {
        return res.status(404).json({
          success: false,
          code: 'PROGRAM_NOT_FOUND',
          message: 'Không tìm thấy chương trình đào tạo.'
        });
      }
      if (!ProgramModel.removeRunningClass(programId, classId)) {
        return res.status(404).json({
          success: false,
          code: 'RUNNING_CLASS_NOT_FOUND',
          message: 'Không tìm thấy liên kết lớp đang chạy với chương trình này.'
        });
      }
      return res.status(200).json({
        success: true,
        message: 'Đã kết thúc liên kết lớp đang chạy với chương trình.'
      });
    } catch (error) {
      return next(error);
    }
  }

  static deleteProgram(req, res, next) {
    const id = ProgramController.parsePositiveInteger(req.params.id, null);
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PROGRAM_ID',
        message: 'Mã định danh chương trình không hợp lệ.'
      });
    }
    try {
      const result = ProgramModel.deleteOrDeactivate(id);
      if (!result) {
        return res.status(404).json({
          success: false,
          code: 'PROGRAM_NOT_FOUND',
          message: 'Không tìm thấy chương trình đào tạo.'
        });
      }
      if (!result.deleted) {
        return res.status(200).json({
          success: true,
          code: 'PROGRAM_DEACTIVATED_IN_USE',
          data: result.program,
          runningClassCount: result.runningClassCount,
          message: `Chương trình đang được ${result.runningClassCount} lớp sử dụng nên không thể xóa. Đã chuyển chương trình sang trạng thái ngừng áp dụng.`
        });
      }
      return res.status(200).json({
        success: true,
        code: 'PROGRAM_DELETED',
        data: { id },
        message: 'Đã xóa chương trình đào tạo.'
      });
    } catch (error) {
      return next(error);
    }
  }

  static duplicateCodeResponse(res) {
    return res.status(409).json({
      success: false,
      code: 'PROGRAM_CODE_ALREADY_EXISTS',
      message: 'Mã chương trình đã tồn tại. Vui lòng nhập mã khác.'
    });
  }
}

module.exports = ProgramController;

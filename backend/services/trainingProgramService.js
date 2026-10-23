/**
 * Training Program Service
 * Xử lý toàn bộ nghiệp vụ, ràng buộc và kiểm tra liên kết lớp học
 */

const crypto = require('crypto');
const repository = require('../repositories/trainingProgramRepository');
const {
  validateCreateTrainingProgram,
  validateUpdateTrainingProgram,
  validateStatusUpdate
} = require('../validation/trainingProgramValidation');

class BusinessError extends Error {
  constructor(message, statusCode = 400, code = 'BUSINESS_ERROR') {
    super(message);
    this.name = 'BusinessError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

class TrainingProgramService {
  /**
   * Lấy danh sách chương trình đào tạo có phân trang, tìm kiếm, lọc
   */
  async getPrograms({ page = 1, pageSize = 20, search = '', status = 'all', activeOnly = false }) {
    let programs = repository.findAll();

    // 1. Lọc theo trạng thái
    if (activeOnly || status === 'ACTIVE') {
      programs = programs.filter(p => p.status === 'ACTIVE');
    } else if (status && status !== 'all') {
      const upperStatus = String(status).toUpperCase();
      programs = programs.filter(p => p.status === upperStatus);
    }

    // 2. Tìm kiếm theo Tên hoặc Mã chương trình
    if (search && search.trim()) {
      const query = search.trim().toLowerCase();
      programs = programs.filter(p =>
        (p.code && p.code.toLowerCase().includes(query)) ||
        (p.name && p.name.toLowerCase().includes(query)) ||
        (p.description && p.description.toLowerCase().includes(query))
      );
    }

    // Bổ sung thông tin lớp học liên kết vào từng chương trình
    const enriched = programs.map(p => {
      const linked = repository.getLinkedClasses(p.id, p.code);
      return {
        ...p,
        hasClassLinked: linked.length > 0,
        linkedClassesCount: linked.length
      };
    });

    // 3. Phân trang
    const totalRecords = enriched.length;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const sizeNum = Math.max(1, parseInt(pageSize, 10) || 20);
    const totalPages = Math.ceil(totalRecords / sizeNum) || 1;
    const validPage = Math.min(pageNum, totalPages);

    const startIndex = (validPage - 1) * sizeNum;
    const paginatedData = enriched.slice(startIndex, startIndex + sizeNum);

    return {
      data: paginatedData,
      pagination: {
        currentPage: validPage,
        pageSize: sizeNum,
        totalRecords,
        totalPages,
        startIndex: totalRecords === 0 ? 0 : startIndex + 1,
        endIndex: Math.min(startIndex + sizeNum, totalRecords)
      }
    };
  }

  /**
   * Lấy chi tiết 1 chương trình đào tạo kèm danh sách lớp liên kết
   */
  async getProgramById(id) {
    const program = repository.findById(id);
    if (!program) {
      throw new BusinessError('Không tìm thấy chương trình đào tạo.', 404, 'NOT_FOUND');
    }

    const linkedClasses = repository.getLinkedClasses(program.id, program.code);
    return {
      ...program,
      hasClassLinked: linkedClasses.length > 0,
      linkedClassesCount: linkedClasses.length,
      linkedClasses: linkedClasses.map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        room: c.room,
        schedule: c.schedule,
        status: c.status
      }))
    };
  }

  /**
   * Tạo mới chương trình đào tạo (Quy tắc 1: Mã chương trình duy nhất)
   */
  async createProgram(dto) {
    const validation = validateCreateTrainingProgram(dto);
    if (!validation.isValid) {
      throw new BusinessError(validation.errors.join(' '), 400, 'VALIDATION_ERROR');
    }

    const { code, name, description, duration, standard_tuition, status } = validation.data;

    // Kiểm tra duy nhất mã chương trình
    const existing = repository.findByCode(code);
    if (existing) {
      throw new BusinessError(`Mã chương trình '${code}' đã tồn tại trong hệ thống. Vui lòng chọn mã khác.`, 400, 'DUPLICATE_CODE');
    }

    const now = new Date().toISOString();
    const newProgram = {
      id: `tp_${crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex')}`,
      code,
      name,
      description: description || '',
      duration,
      standard_tuition,
      status: status || 'ACTIVE',
      created_at: now,
      updated_at: now
    };

    return repository.create(newProgram);
  }

  /**
   * Cập nhật thông tin chương trình đào tạo (Không cho sửa mã)
   */
  async updateProgram(id, dto) {
    const existing = repository.findById(id);
    if (!existing) {
      throw new BusinessError('Không tìm thấy chương trình đào tạo để cập nhật.', 404, 'NOT_FOUND');
    }

    const validation = validateUpdateTrainingProgram(dto, existing);
    if (!validation.isValid) {
      throw new BusinessError(validation.errors.join(' '), 400, 'VALIDATION_ERROR');
    }

    const updated = repository.update(id, validation.data);
    return updated;
  }

  /**
   * Chuyển đổi trạng thái (ACTIVE <-> INACTIVE)
   */
  async updateStatus(id, newStatus = null) {
    const existing = repository.findById(id);
    if (!existing) {
      throw new BusinessError('Không tìm thấy chương trình đào tạo.', 404, 'NOT_FOUND');
    }

    let targetStatus;
    if (newStatus) {
      const validation = validateStatusUpdate(newStatus);
      if (!validation.isValid) {
        throw new BusinessError(validation.error, 400, 'INVALID_STATUS');
      }
      targetStatus = validation.status;
    } else {
      // Toggle
      targetStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    }

    return repository.update(id, { status: targetStatus });
  }

  /**
   * Xóa chương trình đào tạo
   * (Quy tắc 2: Nếu đã có lớp học -> Không cho xóa, bắt buộc chuyển sang INACTIVE.
   *  Nếu chưa có lớp học -> Cho phép xóa cứng)
   */
  async deleteProgram(id) {
    const existing = repository.findById(id);
    if (!existing) {
      throw new BusinessError('Không tìm thấy chương trình đào tạo để xóa.', 404, 'NOT_FOUND');
    }

    const hasLinked = repository.hasClassLinked(existing.id, existing.code);
    if (hasLinked) {
      throw new BusinessError(
        'Chương trình đang có lớp học, không được phép xóa. Hãy chuyển sang trạng thái Ngừng áp dụng.',
        400,
        'HAS_LINKED_CLASSES'
      );
    }

    return repository.delete(id);
  }

  /**
   * Danh sách chương trình chỉ lấy ACTIVE (phục vụ chức năng mở lớp học mới - Quy tắc 3)
   */
  async getActiveProgramsForClassCreation() {
    const programs = repository.findAll();
    return programs
      .filter(p => p.status === 'ACTIVE')
      .map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        duration: p.duration,
        standard_tuition: p.standard_tuition
      }));
  }
}

module.exports = {
  TrainingProgramService: new TrainingProgramService(),
  BusinessError
};

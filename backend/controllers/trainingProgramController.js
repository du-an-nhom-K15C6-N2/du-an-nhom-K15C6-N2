/**
 * Training Program Controller
 * Tiếp nhận request HTTP, điều phối Service và định dạng response
 */

const { TrainingProgramService, BusinessError } = require('../services/trainingProgramService');

class TrainingProgramController {
  /**
   * GET /api/v1/training-programs
   * Lấy danh sách (hỗ trợ phân trang, tìm kiếm theo tên/mã, lọc theo status)
   */
  async getAll(req, res) {
    try {
      const { page, pageSize, limit, search, status, activeOnly } = req.query;
      const result = await TrainingProgramService.getPrograms({
        page: page || 1,
        pageSize: pageSize || limit || 20,
        search: search || '',
        status: status || 'all',
        activeOnly: activeOnly === 'true' || activeOnly === true
      });

      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách chương trình đào tạo thành công.',
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      return handleControllerError(res, error, 'Lỗi khi lấy danh sách chương trình đào tạo.');
    }
  }

  /**
   * GET /api/v1/training-programs/:id
   * Lấy thông tin chi tiết 1 chương trình
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const program = await TrainingProgramService.getProgramById(id);

      return res.status(200).json({
        success: true,
        message: 'Lấy thông tin chi tiết chương trình đào tạo thành công.',
        data: program
      });
    } catch (error) {
      return handleControllerError(res, error, 'Không thể lấy thông tin chương trình đào tạo.');
    }
  }

  /**
   * POST /api/v1/training-programs
   * Tạo mới chương trình đào tạo (validate mã duy nhất)
   */
  async create(req, res) {
    try {
      const created = await TrainingProgramService.createProgram(req.body);

      return res.status(201).json({
        success: true,
        message: 'Tạo mới chương trình đào tạo thành công.',
        data: created
      });
    } catch (error) {
      return handleControllerError(res, error, 'Không thể tạo mới chương trình đào tạo.');
    }
  }

  /**
   * PUT /api/v1/training-programs/:id
   * Cập nhật thông tin chương trình đào tạo (không cho sửa mã)
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const updated = await TrainingProgramService.updateProgram(id, req.body);

      return res.status(200).json({
        success: true,
        message: 'Cập nhật thông tin chương trình đào tạo thành công.',
        data: updated
      });
    } catch (error) {
      return handleControllerError(res, error, 'Không thể cập nhật chương trình đào tạo.');
    }
  }

  /**
   * PATCH /api/v1/training-programs/:id/status
   * Đổi trạng thái (ACTIVE <-> INACTIVE)
   */
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body || {};
      const updated = await TrainingProgramService.updateStatus(id, status);

      return res.status(200).json({
        success: true,
        message: `Đã chuyển trạng thái chương trình sang "${updated.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng áp dụng'}".`,
        data: updated
      });
    } catch (error) {
      return handleControllerError(res, error, 'Không thể cập nhật trạng thái chương trình đào tạo.');
    }
  }

  /**
   * DELETE /api/v1/training-programs/:id
   * Xóa chương trình. Kiểm tra ràng buộc lớp học trước khi xóa.
   * Nếu có lớp -> Trả về lỗi status 400 kèm thông điệp:
   * "Chương trình đang có lớp học, không được phép xóa. Hãy chuyển sang trạng thái Ngừng áp dụng."
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      const deleted = await TrainingProgramService.deleteProgram(id);

      return res.status(200).json({
        success: true,
        message: 'Đã xóa chương trình đào tạo khỏi cơ sở dữ liệu thành công.',
        data: deleted
      });
    } catch (error) {
      return handleControllerError(res, error, 'Không thể xóa chương trình đào tạo.');
    }
  }

  /**
   * GET /api/v1/training-programs/active-options
   * Trả về danh sách chương trình đang ACTIVE phục vụ chọn khi mở lớp mới (Quy tắc 3)
   */
  async getActiveOptions(req, res) {
    try {
      const options = await TrainingProgramService.getActiveProgramsForClassCreation();
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách chương trình đào tạo đang hoạt động thành công.',
        data: options
      });
    } catch (error) {
      return handleControllerError(res, error, 'Không thể lấy danh sách chương trình mở lớp.');
    }
  }
}

function handleControllerError(res, error, defaultMessage) {
  if (error instanceof BusinessError || error.statusCode) {
    return res.status(error.statusCode || 400).json({
      success: false,
      code: error.code || 'BUSINESS_ERROR',
      message: error.message
    });
  }

  console.error('Unhandled error in TrainingProgramController:', error);
  return res.status(500).json({
    success: false,
    code: 'SERVER_ERROR',
    message: defaultMessage || 'Đã xảy ra lỗi máy chủ nội bộ.'
  });
}

module.exports = new TrainingProgramController();

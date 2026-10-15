/**
 * Validation DTOs and Rules for Training Program Management
 */

function validateCreateTrainingProgram(data = {}) {
  const errors = [];
  const sanitized = {};

  // 1. Mã chương trình (code): Bắt buộc, chuỗi không rỗng
  if (!data.code || typeof data.code !== 'string' || !data.code.trim()) {
    errors.push('Mã chương trình đào tạo là bắt buộc và không được để trống.');
  } else {
    sanitized.code = data.code.trim().toUpperCase();
    if (sanitized.code.length > 50) {
      errors.push('Mã chương trình không được vượt quá 50 ký tự.');
    }
  }

  // 2. Tên chương trình (name): Bắt buộc
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    errors.push('Tên chương trình đào tạo là bắt buộc và không được để trống.');
  } else {
    sanitized.name = data.name.trim();
    if (sanitized.name.length > 255) {
      errors.push('Tên chương trình không được vượt quá 255 ký tự.');
    }
  }

  // 3. Mô tả (description): Tùy chọn
  if (data.description !== undefined && data.description !== null) {
    sanitized.description = String(data.description).trim();
  } else {
    sanitized.description = '';
  }

  // 4. Tổng thời lượng (duration): Bắt buộc, > 0
  const durationNum = Number(data.duration);
  if (data.duration === undefined || data.duration === null || data.duration === '' || Number.isNaN(durationNum)) {
    errors.push('Tổng thời lượng là bắt buộc và phải là số hợp lệ.');
  } else if (durationNum <= 0) {
    errors.push('Tổng thời lượng phải lớn hơn 0.');
  } else {
    sanitized.duration = durationNum;
  }

  // 5. Học phí chuẩn (standard_tuition): Bắt buộc, >= 0
  const tuitionNum = Number(data.standard_tuition);
  if (data.standard_tuition === undefined || data.standard_tuition === null || data.standard_tuition === '' || Number.isNaN(tuitionNum)) {
    errors.push('Học phí chuẩn là bắt buộc và phải là số hợp lệ.');
  } else if (tuitionNum < 0) {
    errors.push('Học phí chuẩn phải lớn hơn hoặc bằng 0.');
  } else {
    sanitized.standard_tuition = tuitionNum;
  }

  // 6. Trạng thái (status): ACTIVE hoặc INACTIVE (mặc định ACTIVE)
  const validStatuses = ['ACTIVE', 'INACTIVE'];
  if (data.status) {
    const upperStatus = String(data.status).trim().toUpperCase();
    if (!validStatuses.includes(upperStatus)) {
      errors.push('Trạng thái không hợp lệ. Chỉ chấp nhận ACTIVE hoặc INACTIVE.');
    } else {
      sanitized.status = upperStatus;
    }
  } else {
    sanitized.status = 'ACTIVE';
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: sanitized
  };
}

function validateUpdateTrainingProgram(data = {}, existingProgram = {}) {
  const errors = [];
  const sanitized = {};

  // 1. Ràng buộc: Không cho sửa mã chương trình sau khi tạo
  if (data.code !== undefined && data.code !== null) {
    const normalizedInputCode = String(data.code).trim().toUpperCase();
    const existingCode = String(existingProgram.code || '').trim().toUpperCase();
    if (normalizedInputCode !== existingCode) {
      errors.push('Mã chương trình đào tạo không được phép thay đổi sau khi tạo.');
    }
  }

  // 2. Tên chương trình (nếu gửi lên hoặc giữ nguyên)
  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || !data.name.trim()) {
      errors.push('Tên chương trình đào tạo không được để trống.');
    } else {
      sanitized.name = data.name.trim();
      if (sanitized.name.length > 255) {
        errors.push('Tên chương trình không được vượt quá 255 ký tự.');
      }
    }
  }

  // 3. Mô tả
  if (data.description !== undefined) {
    sanitized.description = data.description ? String(data.description).trim() : '';
  }

  // 4. Thời lượng
  if (data.duration !== undefined) {
    const durationNum = Number(data.duration);
    if (data.duration === '' || Number.isNaN(durationNum)) {
      errors.push('Tổng thời lượng phải là số hợp lệ.');
    } else if (durationNum <= 0) {
      errors.push('Tổng thời lượng phải lớn hơn 0.');
    } else {
      sanitized.duration = durationNum;
    }
  }

  // 5. Học phí chuẩn
  if (data.standard_tuition !== undefined) {
    const tuitionNum = Number(data.standard_tuition);
    if (data.standard_tuition === '' || Number.isNaN(tuitionNum)) {
      errors.push('Học phí chuẩn phải là số hợp lệ.');
    } else if (tuitionNum < 0) {
      errors.push('Học phí chuẩn phải lớn hơn hoặc bằng 0.');
    } else {
      sanitized.standard_tuition = tuitionNum;
    }
  }

  // 6. Trạng thái
  if (data.status !== undefined) {
    const validStatuses = ['ACTIVE', 'INACTIVE'];
    const upperStatus = String(data.status).trim().toUpperCase();
    if (!validStatuses.includes(upperStatus)) {
      errors.push('Trạng thái không hợp lệ. Chỉ chấp nhận ACTIVE hoặc INACTIVE.');
    } else {
      sanitized.status = upperStatus;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: sanitized
  };
}

function validateStatusUpdate(status) {
  const validStatuses = ['ACTIVE', 'INACTIVE'];
  const upperStatus = String(status || '').trim().toUpperCase();
  if (!validStatuses.includes(upperStatus)) {
    return {
      isValid: false,
      error: 'Trạng thái không hợp lệ. Chỉ chấp nhận ACTIVE hoặc INACTIVE.',
      status: null
    };
  }
  return {
    isValid: true,
    error: null,
    status: upperStatus
  };
}

module.exports = {
  validateCreateTrainingProgram,
  validateUpdateTrainingProgram,
  validateStatusUpdate
};

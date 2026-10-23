'use strict';

const UserModel = require('../models/userModel');
const ClassModel = require('../models/classModel');

class AssignmentValidationError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'AssignmentValidationError';
    this.status = statusCode;
    this.statusCode = statusCode;
    this.code = code;
  }
}

class TeachingAssignmentValidationService {
  constructor({
    userModel = UserModel,
    classModel = ClassModel,
    assignmentModel = null
  } = {}) {
    this.userModel = userModel;
    this.classModel = classModel;
    this.assignmentModel = assignmentModel;
  }

  setAssignmentModel(model) {
    this.assignmentModel = model;
  }

  /**
   * Xác thực lớp học
   */
  validateClass(classId) {
    if (!classId || typeof classId !== 'string' || !classId.trim()) {
      throw new AssignmentValidationError(400, 'CLASS_REQUIRED', 'Vui lòng chọn lớp học.');
    }

    const classes = this.classModel.list();
    const targetClass = classes.find(c => String(c.id) === String(classId.trim()));
    if (!targetClass) {
      throw new AssignmentValidationError(404, 'CLASS_NOT_FOUND', 'Lớp học không tồn tại trong hệ thống.');
    }

    if (targetClass.status !== 'active') {
      throw new AssignmentValidationError(400, 'CLASS_INACTIVE', 'Chỉ có thể phân công giảng dạy cho lớp học đang hoạt động.');
    }

    return targetClass;
  }

  /**
   * Xác thực môn học
   */
  validateCourse(courseId, coursesList = null) {
    if (!courseId || typeof courseId !== 'string' || !courseId.trim()) {
      throw new AssignmentValidationError(400, 'COURSE_REQUIRED', 'Vui lòng chọn môn học cần phân công.');
    }

    const courses = coursesList || (this.assignmentModel ? this.assignmentModel.getCoursesCatalog() : []);
    const targetCourse = courses.find(c => String(c.id) === String(courseId.trim()) || String(c.code) === String(courseId.trim()));
    if (!targetCourse) {
      throw new AssignmentValidationError(404, 'COURSE_NOT_FOUND', 'Môn học không tồn tại trong danh mục môn học.');
    }

    return targetCourse;
  }

  /**
   * Xác thực giảng viên chính
   */
  validatePrimaryTeacher(teacherId) {
    if (!teacherId || typeof teacherId !== 'string' || !teacherId.trim()) {
      throw new AssignmentValidationError(400, 'PRIMARY_TEACHER_REQUIRED', 'Mỗi môn học bắt buộc phải có một giảng viên chính chịu trách nhiệm chuyên môn.');
    }

    const teacher = this.userModel.findById(teacherId.trim());
    if (!teacher) {
      throw new AssignmentValidationError(404, 'TEACHER_NOT_FOUND', 'Tài khoản giảng viên không tồn tại trong hệ thống.');
    }

    const roles = this.userModel.getRoles(teacher);
    if (!roles.includes('teacher')) {
      throw new AssignmentValidationError(400, 'INVALID_TEACHER_ROLE', 'Tài khoản được phân công làm giảng viên chính phải có vai trò Giảng viên (teacher).');
    }

    if (teacher.status === 'locked') {
      throw new AssignmentValidationError(400, 'TEACHER_LOCKED', `Giảng viên '${teacher.name}' đang bị khóa tài khoản (${teacher.lockReason || 'tài khoản bị khóa'}). Không thể phân công.`);
    }

    if (teacher.status === 'pending') {
      throw new AssignmentValidationError(400, 'TEACHER_PENDING', `Giảng viên '${teacher.name}' đang ở trạng thái chờ kích hoạt tài khoản.`);
    }

    if (teacher.status !== 'active') {
      throw new AssignmentValidationError(400, 'TEACHER_NOT_ACTIVE', `Chỉ có thể phân công giảng viên đang hoạt động.`);
    }

    return teacher;
  }

  /**
   * Xác thực danh sách trợ giảng và kiểm tra xung đột với giảng viên chính
   */
  validateAssistants(assistantIds, primaryTeacherId) {
    if (!assistantIds) return [];

    let ids = [];
    if (Array.isArray(assistantIds)) {
      ids = assistantIds.filter(id => id && typeof id === 'string' && id.trim()).map(id => id.trim());
    } else if (typeof assistantIds === 'string' && assistantIds.trim()) {
      ids = [assistantIds.trim()];
    }

    // Kiểm tra trùng lặp ID trợ giảng trong mảng
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length !== ids.length) {
      throw new AssignmentValidationError(400, 'DUPLICATE_ASSISTANTS', 'Danh sách trợ giảng không được chứa tài khoản trùng lặp.');
    }

    const validatedAssistants = [];
    for (const assistantId of uniqueIds) {
      // Ràng buộc: Trợ giảng không được trùng với giảng viên chính
      if (primaryTeacherId && String(assistantId) === String(primaryTeacherId).trim()) {
        throw new AssignmentValidationError(
          400,
          'TEACHER_ASSISTANT_CONFLICT',
          'Giảng viên chính không thể đồng thời được phân công làm trợ giảng cho cùng một môn học trong lớp.'
        );
      }

      const assistant = this.userModel.findById(assistantId);
      if (!assistant) {
        throw new AssignmentValidationError(404, 'ASSISTANT_NOT_FOUND', `Tài khoản trợ giảng ID '${assistantId}' không tồn tại.`);
      }

      const roles = this.userModel.getRoles(assistant);
      if (!roles.includes('assistant')) {
        throw new AssignmentValidationError(
          400,
          'INVALID_ASSISTANT_ROLE',
          `Tài khoản '${assistant.name}' không có vai trò Trợ giảng (assistant).`
        );
      }

      if (assistant.status === 'locked') {
        throw new AssignmentValidationError(
          400,
          'ASSISTANT_LOCKED',
          `Trợ giảng '${assistant.name}' đang bị khóa tài khoản. Không thể phân công.`
        );
      }

      if (assistant.status === 'pending') {
        throw new AssignmentValidationError(
          400,
          'ASSISTANT_PENDING',
          `Trợ giảng '${assistant.name}' chưa kích hoạt tài khoản.`
        );
      }

      if (assistant.status !== 'active') {
        throw new AssignmentValidationError(
          400,
          'ASSISTANT_NOT_ACTIVE',
          `Chỉ có thể phân công trợ giảng đang ở trạng thái hoạt động.`
        );
      }

      validatedAssistants.push(assistant);
    }

    return validatedAssistants;
  }

  /**
   * Xác thực toàn diện payload tạo phân công
   */
  validateCreatePayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new AssignmentValidationError(400, 'INVALID_PAYLOAD', 'Dữ liệu phân công không hợp lệ.');
    }

    const cls = this.validateClass(payload.classId);
    const course = this.validateCourse(payload.courseId);
    const teacher = this.validatePrimaryTeacher(payload.primaryTeacherId || payload.teacherId);

    const assistantIds = payload.assistantIds !== undefined
      ? payload.assistantIds
      : (payload.assistantId ? [payload.assistantId] : []);

    const assistants = this.validateAssistants(assistantIds, teacher.id);

    // Kiểm tra trùng phân công trong lớp
    if (this.assignmentModel) {
      const existing = this.assignmentModel.findByClassAndCourse(cls.id, course.id);
      if (existing && existing.status === 'active') {
        throw new AssignmentValidationError(
          409,
          'DUPLICATE_ASSIGNMENT',
          `Môn '${course.name}' đã được phân công cho lớp '${cls.name}' (Giảng viên: ${existing.primaryTeacherName}). Vui lòng cập nhật hoặc bàn giao thay vì tạo mới.`
        );
      }
    }

    return {
      classId: cls.id,
      courseId: course.id,
      primaryTeacherId: teacher.id,
      assistantIds: assistants.map(a => a.id),
      term: typeof payload.term === 'string' && payload.term.trim() ? payload.term.trim() : 'Học kỳ 1 - 2026',
      academicYear: typeof payload.academicYear === 'string' && payload.academicYear.trim() ? payload.academicYear.trim() : '2026-2027',
      status: payload.status || 'active',
      note: typeof payload.note === 'string' ? payload.note.trim() : ''
    };
  }

  /**
   * Xác thực toàn diện payload cập nhật phân công
   */
  validateUpdatePayload(currentAssignment, payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new AssignmentValidationError(400, 'INVALID_PAYLOAD', 'Dữ liệu cập nhật không hợp lệ.');
    }

    const updates = {};

    // Giảng viên chính (nếu cập nhật)
    let newTeacherId = currentAssignment.primaryTeacherId;
    if (payload.primaryTeacherId !== undefined || payload.teacherId !== undefined) {
      const inputTeacher = payload.primaryTeacherId || payload.teacherId;
      const teacher = this.validatePrimaryTeacher(inputTeacher);
      newTeacherId = teacher.id;
      updates.primaryTeacherId = teacher.id;
    }

    // Trợ giảng (nếu cập nhật)
    if (payload.assistantIds !== undefined || payload.assistantId !== undefined) {
      const inputAssistants = payload.assistantIds !== undefined
        ? payload.assistantIds
        : (payload.assistantId ? [payload.assistantId] : []);

      const assistants = this.validateAssistants(inputAssistants, newTeacherId);
      updates.assistantIds = assistants.map(a => a.id);
    } else {
      // Nếu không gửi assistantIds mới, nhưng teacherId thay đổi, phải đảm bảo teacher mới không trùng với assistant hiện tại
      if (currentAssignment.assistantIds && currentAssignment.assistantIds.includes(newTeacherId)) {
        throw new AssignmentValidationError(
          400,
          'TEACHER_ASSISTANT_CONFLICT',
          'Giảng viên chính mới trùng với một trong các trợ giảng hiện tại của môn học.'
        );
      }
    }

    if (payload.term !== undefined) {
      updates.term = typeof payload.term === 'string' ? payload.term.trim() : currentAssignment.term;
    }
    if (payload.academicYear !== undefined) {
      updates.academicYear = typeof payload.academicYear === 'string' ? payload.academicYear.trim() : currentAssignment.academicYear;
    }
    if (payload.status !== undefined) {
      if (!['active', 'completed', 'cancelled'].includes(payload.status)) {
        throw new AssignmentValidationError(400, 'INVALID_STATUS', 'Trạng thái phân công phải là active, completed hoặc cancelled.');
      }
      updates.status = payload.status;
    }
    if (payload.note !== undefined) {
      updates.note = typeof payload.note === 'string' ? payload.note.trim() : '';
    }
    if (payload.reason !== undefined) {
      updates.reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
    }

    return updates;
  }
}

module.exports = {
  TeachingAssignmentValidationService,
  AssignmentValidationError
};

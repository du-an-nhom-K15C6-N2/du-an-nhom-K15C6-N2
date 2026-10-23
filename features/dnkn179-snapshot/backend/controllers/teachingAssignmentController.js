'use strict';

const TeachingAssignmentModel = require('../models/teachingAssignmentModel');
const { TeachingAssignmentValidationService, AssignmentValidationError } = require('../services/teachingAssignmentValidationService');
const UserModel = require('../models/userModel');
const ClassModel = require('../models/classModel');

class TeachingAssignmentController {
  constructor({
    model = new TeachingAssignmentModel(),
    validationService = null
  } = {}) {
    this.model = model;
    this.validationService = validationService || new TeachingAssignmentValidationService({
      userModel: UserModel,
      classModel: ClassModel,
      assignmentModel: this.model
    });
    this.validationService.setAssignmentModel(this.model);

    // Bind methods
    this.getOptions = this.getOptions.bind(this);
    this.list = this.list.bind(this);
    this.getByClass = this.getByClass.bind(this);
    this.getById = this.getById.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.remove = this.remove.bind(this);
    this.getHistory = this.getHistory.bind(this);
  }

  /**
   * Lấy dữ liệu nguồn cho màn hình phân công (Lớp, Môn, Giảng viên, Trợ giảng)
   * GET /api/assignments/options
   */
  async getOptions(req, res, next) {
    try {
      const classes = ClassModel.list()
        .filter(c => c.status === 'active')
        .map(c => ({
          id: c.id,
          code: c.code,
          name: c.name,
          room: c.room,
          schedule: c.schedule,
          status: c.status
        }));

      const courses = this.model.getCoursesCatalog().map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        sessionCount: c.sessionCount,
        weight: c.weight,
        programIds: c.programIds || []
      }));

      const teachers = UserModel.findActiveTeachers();
      const assistants = UserModel.findActiveAssistants();

      return res.status(200).json({
        success: true,
        data: {
          classes,
          courses,
          teachers,
          assistants
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lấy danh sách phân công giảng dạy (có bộ lọc)
   * GET /api/assignments
   */
  async list(req, res, next) {
    try {
      const { classId, courseId, primaryTeacherId, status } = req.query;
      const assignments = this.model.list({
        classId: typeof classId === 'string' && classId.trim() ? classId.trim() : undefined,
        courseId: typeof courseId === 'string' && courseId.trim() ? courseId.trim() : undefined,
        primaryTeacherId: typeof primaryTeacherId === 'string' && primaryTeacherId.trim() ? primaryTeacherId.trim() : undefined,
        status: typeof status === 'string' && status.trim() ? status.trim() : undefined
      });

      return res.status(200).json({
        success: true,
        data: assignments,
        total: assignments.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lấy chi tiết phân công theo lớp học
   * GET /api/assignments/classes/:classId
   */
  async getByClass(req, res, next) {
    try {
      const { classId } = req.params;
      this.validationService.validateClass(classId);

      const assignments = this.model.list({ classId });
      const courses = this.model.getCoursesCatalog();

      // Bảng tổng hợp các môn của lớp: môn nào đã phân công, môn nào chưa
      const matrix = courses.map(course => {
        const assignment = assignments.find(a => String(a.courseId) === String(course.id));
        return {
          courseId: course.id,
          courseCode: course.code,
          courseName: course.name,
          sessionCount: course.sessionCount,
          weight: course.weight,
          assignment: assignment || null,
          isAssigned: Boolean(assignment),
          status: assignment ? (assignment.hasAssistant ? 'FULLY_ASSIGNED' : 'NO_ASSISTANT') : 'UNASSIGNED'
        };
      });

      return res.status(200).json({
        success: true,
        classId,
        data: {
          assignments,
          matrix,
          summary: {
            totalCourses: courses.length,
            assignedCourses: assignments.length,
            unassignedCourses: Math.max(0, courses.length - assignments.length)
          }
        }
      });
    } catch (error) {
      if (error instanceof AssignmentValidationError) {
        return res.status(error.statusCode).json({
          success: false,
          code: error.code,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Lấy chi tiết một bản ghi phân công
   * GET /api/assignments/:id
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const assignment = this.model.findById(id);

      if (!assignment) {
        return res.status(404).json({
          success: false,
          code: 'ASSIGNMENT_NOT_FOUND',
          message: 'Không tìm thấy thông tin phân công.'
        });
      }

      return res.status(200).json({
        success: true,
        data: assignment
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Tạo phân công giảng viên chính và trợ giảng cho môn trong lớp
   * POST /api/assignments
   */
  async create(req, res, next) {
    try {
      const validatedPayload = this.validationService.validateCreatePayload(req.body);
      const actor = req.user;

      const created = this.model.create(validatedPayload, actor);

      return res.status(201).json({
        success: true,
        data: created,
        message: `Phân công giảng dạy môn ${created.courseName} cho ${created.primaryTeacherName} thành công.`
      });
    } catch (error) {
      if (error instanceof AssignmentValidationError) {
        return res.status(error.statusCode).json({
          success: false,
          code: error.code,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Cập nhật / Đổi giảng viên hoặc trợ giảng cho môn học
   * PUT /api/assignments/:id
   */
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const current = this.model.findById(id);
      if (!current) {
        return res.status(404).json({
          success: false,
          code: 'ASSIGNMENT_NOT_FOUND',
          message: 'Không tìm thấy bản ghi phân công cần cập nhật.'
        });
      }

      const validatedUpdates = this.validationService.validateUpdatePayload(current, req.body);
      const actor = req.user;

      const updated = this.model.update(id, validatedUpdates, actor);

      return res.status(200).json({
        success: true,
        data: updated,
        message: `Cập nhật phân công môn ${updated.courseName} thành công.`
      });
    } catch (error) {
      if (error instanceof AssignmentValidationError) {
        return res.status(error.statusCode).json({
          success: false,
          code: error.code,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Hủy phân công môn học trong lớp
   * DELETE /api/assignments/:id
   */
  async remove(req, res, next) {
    try {
      const { id } = req.params;
      const actor = req.user;
      const removed = this.model.remove(id, actor);

      return res.status(200).json({
        success: true,
        data: removed,
        message: `Đã hủy phân công môn ${removed.courseName} của lớp ${removed.className}.`
      });
    } catch (error) {
      if (error.code === 'ASSIGNMENT_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ASSIGNMENT_NOT_FOUND',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Lấy lịch sử phân công và bàn giao
   * GET /api/assignments/history
   */
  async getHistory(req, res, next) {
    try {
      const { classId, courseId, assignmentId, limit } = req.query;
      const history = this.model.listHistory({
        classId: typeof classId === 'string' && classId.trim() ? classId.trim() : undefined,
        courseId: typeof courseId === 'string' && courseId.trim() ? courseId.trim() : undefined,
        assignmentId: typeof assignmentId === 'string' && assignmentId.trim() ? assignmentId.trim() : undefined,
        limit: limit ? Number(limit) : 100
      });

      return res.status(200).json({
        success: true,
        data: history,
        total: history.length
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = TeachingAssignmentController;

const EnrollmentModel = require('../models/enrollmentModel');
const ClassModel = require('../models/classModel');
const UserModel = require('../models/userModel');
const { DEFAULT_CLASS_CAPACITY } = require('../services/enrollmentValidationService');

const STATUS_BY_CODE = {
  INVALID_CLASS_ID: 400,
  CLASS_NOT_FOUND: 404,
  INVALID_STUDENT_ID: 400,
  STUDENT_NOT_FOUND: 404,
  CLASS_FULL: 409,
  ALREADY_ENROLLED: 409
};

function parsePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, message: 'Request body phải là một object JSON.' };
  }

  const hasSingleStudent = Object.prototype.hasOwnProperty.call(body, 'studentId');
  const hasStudentList = Object.prototype.hasOwnProperty.call(body, 'studentIds');
  if (hasSingleStudent === hasStudentList) {
    return { valid: false, message: 'Cung cấp đúng một trường studentId hoặc studentIds.' };
  }

  if (hasSingleStudent) {
    return {
      valid: true,
      classId: body.classId,
      studentIds: [body.studentId]
    };
  }

  if (!Array.isArray(body.studentIds) || body.studentIds.length === 0) {
    return { valid: false, message: 'studentIds phải là danh sách không rỗng.' };
  }

  return { valid: true, classId: body.classId, studentIds: body.studentIds };
}

function toItemResponse(result) {
  if (result.success) {
    return {
      classId: result.classId,
      studentId: result.studentId,
      success: true,
      status: 201,
      code: 'ENROLLED',
      message: 'Ghi danh học viên thành công.'
    };
  }

  return {
    classId: result.classId,
    studentId: result.studentId,
    success: false,
    status: STATUS_BY_CODE[result.code],
    code: result.code,
    message: result.message
  };
}

function createEnrollmentController({
  service,
  repository = new EnrollmentModel(),
  classes = ClassModel,
  users = UserModel
}) {
  return {
    async create(req, res, next) {
      try {
        const createdBy = req.user?.id;
        if (
          (typeof createdBy !== 'string' || !createdBy.trim())
          && (typeof createdBy !== 'number' || !Number.isSafeInteger(createdBy) || createdBy <= 0)
        ) {
          return res.status(401).json({
            success: false,
            code: 'UNAUTHENTICATED',
            message: 'Cần đăng nhập để thực hiện ghi danh.'
          });
        }

        const parsed = parsePayload(req.body);
        if (!parsed.valid) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_REQUEST',
            message: parsed.message
          });
        }

        const serviceResults = parsed.studentIds.length === 1
          ? [await service.enrollStudent(parsed.classId, parsed.studentIds[0], createdBy)]
          : await service.enrollStudents(parsed.classId, parsed.studentIds, createdBy);
        const results = serviceResults.map(toItemResponse);
        const succeeded = results.filter(result => result.success).length;

        return res.status(200).json({
          success: true,
          data: {
            classId: parsed.classId,
            results,
            summary: {
              requested: results.length,
              succeeded,
              failed: results.length - succeeded
            }
          }
        });
      } catch (error) {
        return next(error);
      }
    },

    listOptions(req, res, next) {
      try {
        const classOptions = classes.list()
          .filter(item => item.status === 'active')
          .map(item => ({
            id: item.id,
            code: item.code,
            name: item.name,
            maxStudents: Number.isSafeInteger(item.maxStudents) && item.maxStudents > 0
              ? item.maxStudents
              : DEFAULT_CLASS_CAPACITY,
            enrolledCount: repository.countStudentsInClass(item.id)
          }));

        return res.status(200).json({
          success: true,
          data: {
            classes: classOptions,
            students: users.findActiveStudents()
          }
        });
      } catch (error) {
        return next(error);
      }
    },

    listHistory(req, res, next) {
      try {
        const classId = typeof req.query.classId === 'string' && req.query.classId.trim()
          ? req.query.classId.trim()
          : undefined;
        return res.status(200).json({
          success: true,
          data: repository.listHistory({ classId })
        });
      } catch (error) {
        return next(error);
      }
    }
  };
}

module.exports = { createEnrollmentController, parsePayload, toItemResponse };

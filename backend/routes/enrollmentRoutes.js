const express = require('express');
const EnrollmentModel = require('../models/enrollmentModel');
const ClassModel = require('../models/classModel');
const UserModel = require('../models/userModel');
const { requireAuth, requirePermission } = require('../middleware/authMiddleware');
const { EnrollmentValidationService } = require('../services/enrollmentValidationService');
const { createEnrollmentController } = require('../controllers/enrollmentController');

const router = express.Router();
const repository = new EnrollmentModel();
const service = new EnrollmentValidationService({
  findClassById: classId => ClassModel.list().find(
    item => item.status === 'active' && String(item.id) === String(classId)
  ) || null,
  findStudentById: studentId => {
    const student = UserModel.findById(String(studentId).trim());
    return student
      && student.status === 'active'
      && UserModel.getRoles(student).includes('student')
      ? student
      : null;
  },
  countStudentsInClass: classId => repository.countStudentsInClass(classId),
  isStudentEnrolled: (classId, studentId) => repository.isStudentEnrolled(classId, studentId),
  createEnrollmentWithHistory: (...args) => repository.createEnrollmentWithHistory(...args)
});
const controller = createEnrollmentController({ service, repository });

router.use(requireAuth);
router.use(requirePermission('students.manage', { featureName: 'ghi danh học viên' }));

router.get('/options', controller.listOptions);
router.get('/history', controller.listHistory);
router.post('/', controller.create);
router.post('/bulk', controller.create);

module.exports = router;

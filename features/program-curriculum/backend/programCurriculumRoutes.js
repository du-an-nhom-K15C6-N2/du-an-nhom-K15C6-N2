'use strict';

const express = require('express');
const ProgramCurriculumController = require('./programCurriculumController');
const { requireAuth, requirePermission } = require('../../../backend/middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.get(
  '/:programId/courses',
  requirePermission('curricula.read', { featureName: 'lộ trình chương trình đào tạo' }),
  ProgramCurriculumController.list
);
router.post(
  '/:programId/courses',
  requirePermission('curricula.manage', { featureName: 'gắn môn học vào chương trình' }),
  ProgramCurriculumController.addCourse
);
router.delete(
  '/:programId/courses/:courseId',
  requirePermission('curricula.manage', { featureName: 'gỡ môn học khỏi chương trình' }),
  ProgramCurriculumController.removeCourse
);
router.put(
  '/:programId/courses/order',
  requirePermission('curricula.manage', { featureName: 'sắp xếp môn học trong chương trình' }),
  ProgramCurriculumController.reorder
);
router.put(
  '/:programId/courses/:courseId/prerequisites',
  requirePermission('curricula.manage', { featureName: 'khai báo môn tiên quyết' }),
  ProgramCurriculumController.setPrerequisites
);

module.exports = router;

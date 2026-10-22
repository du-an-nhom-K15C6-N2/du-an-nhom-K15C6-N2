'use strict';

const express = require('express');
const CourseSessionsController = require('./courseSessionsController');
const { requireAuth, requirePermission } = require('../../../backend/middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.get(
  '/:courseId/sessions',
  requirePermission('courses.read', { featureName: 'buổi học của môn' }),
  CourseSessionsController.list
);
router.post(
  '/:courseId/sessions',
  requirePermission('courses.manage', { featureName: 'khai báo buổi học' }),
  CourseSessionsController.create
);
router.put(
  '/:courseId/sessions/:number',
  requirePermission('courses.manage', { featureName: 'cập nhật buổi học' }),
  CourseSessionsController.update
);
router.delete(
  '/:courseId/sessions/:number',
  requirePermission('courses.manage', { featureName: 'xoá buổi học' }),
  CourseSessionsController.remove
);
router.post(
  '/:courseId/sessions/clone',
  requirePermission('courses.manage', { featureName: 'nhân bản danh sách buổi học' }),
  CourseSessionsController.clone
);

module.exports = router;

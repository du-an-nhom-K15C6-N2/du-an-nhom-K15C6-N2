'use strict';

const express = require('express');
const CourseCatalogController = require('./courseCatalogController');
const { requireAuth, requirePermission } = require('../../../backend/middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.get(
  '/',
  requirePermission('courses.read', { featureName: 'danh mục môn học' }),
  CourseCatalogController.list
);
router.post(
  '/',
  requirePermission('courses.manage', { featureName: 'tạo môn học' }),
  CourseCatalogController.create
);
router.put(
  '/:id',
  requirePermission('courses.manage', { featureName: 'cập nhật môn học' }),
  CourseCatalogController.update
);
router.delete(
  '/:id',
  requirePermission('courses.manage', { featureName: 'xoá môn học' }),
  CourseCatalogController.remove
);

module.exports = router;

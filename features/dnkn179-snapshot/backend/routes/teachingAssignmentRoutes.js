'use strict';

const express = require('express');
const TeachingAssignmentController = require('../controllers/teachingAssignmentController');
const { requireAuth, requirePermission } = require('../middleware/authMiddleware');

function createTeachingAssignmentRouter(controller = new TeachingAssignmentController()) {
  const router = express.Router();

  router.use(requireAuth);

  // Dữ liệu tùy chọn cho màn hình phân công (Lớp, Môn, Giảng viên, Trợ giảng)
  router.get(
    '/options',
    requirePermission('classes.read', { featureName: 'dữ liệu màn hình phân công giảng dạy' }),
    controller.getOptions
  );

  // Lịch sử phân công và bàn giao
  router.get(
    '/history',
    requirePermission('classes.read', { featureName: 'lịch sử phân công giảng dạy' }),
    controller.getHistory
  );

  // Bảng phân công theo lớp học
  router.get(
    '/classes/:classId',
    requirePermission('classes.read', { featureName: 'danh sách phân công theo lớp' }),
    controller.getByClass
  );

  // Danh sách toàn bộ phân công
  router.get(
    '/',
    requirePermission('classes.read', { featureName: 'danh sách phân công giảng dạy' }),
    controller.list
  );

  // Chi tiết 1 phân công
  router.get(
    '/:id',
    requirePermission('classes.read', { featureName: 'chi tiết phân công giảng dạy' }),
    controller.getById
  );

  // Tạo phân công mới (Chỉ Quản lý đào tạo & Admin có quyền classes.manage)
  router.post(
    '/',
    requirePermission('classes.manage', { featureName: 'phân công giảng viên và trợ giảng' }),
    controller.create
  );

  // Cập nhật / Đổi phân công
  router.put(
    '/:id',
    requirePermission('classes.manage', { featureName: 'cập nhật phân công giảng dạy' }),
    controller.update
  );

  // Hủy phân công
  router.delete(
    '/:id',
    requirePermission('classes.manage', { featureName: 'hủy phân công giảng dạy' }),
    controller.remove
  );

  return router;
}

module.exports = {
  createTeachingAssignmentRouter
};

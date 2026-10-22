// DNKN-175: API quản lý hồ sơ học viên

const express = require('express');
const path = require('path');

const {
    requireAuth,
    requirePermission
} = require(
    path.resolve(
        __dirname,
        '../../../backend/middleware/authMiddleware'
    )
);

const StudentProfileController =
    require('./studentProfileController');

const router = express.Router();

// Bắt buộc đăng nhập
router.use(requireAuth);

// Bắt buộc có quyền quản lý học viên
router.use(
    requirePermission('students.manage', {
        featureName: 'quản lý hồ sơ học viên'
    })
);

// Danh sách học viên
router.get('/', StudentProfileController.getAllStudents);

// Hồ sơ chi tiết
router.get('/:studentId', StudentProfileController.getStudentProfile);

// DNKN-175: Cập nhật hồ sơ học viên
router.put('/:studentId', StudentProfileController.updateStudentProfile);

// DNKN-175: Cập nhật trình độ và ghi chú
router.put('/:studentId/extra', StudentProfileController.updateStudentExtra);

// Các lớp đang ghi danh
router.get('/:studentId/classes', StudentProfileController.getStudentClasses);

// Lịch sử ghi danh
router.get('/:studentId/history', StudentProfileController.getStudentHistory);

module.exports = router;
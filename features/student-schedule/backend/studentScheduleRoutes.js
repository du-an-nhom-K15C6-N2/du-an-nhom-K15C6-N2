
const express = require('express');
const router = express.Router();

const {
    requireAuth,
    requireRoles
} = require('../../../backend/middleware/authMiddleware');

const {
    getStudentSchedule
} = require('./studentScheduleModel');

// DNKN-274: Chỉ học viên đã đăng nhập được truy cập.
router.use(requireAuth);

router.get(
    '/me',
    requireRoles(['student'], {
        featureName: 'lịch học cá nhân'
    }),
    (req, res) => {
        try {
            // Luôn lấy ID từ phiên đăng nhập, không lấy từ URL.
            const studentId = req.user.id;

            const schedule = getStudentSchedule(studentId);

            return res.status(200).json({
                success: true,
                message: 'Lấy lịch học cá nhân thành công.',
                data: {
                    studentId,
                    nextSession: schedule.nextSession,
                    weeklySessions: schedule.weeklySessions
                }
            });
        } catch (error) {
            console.error('DNKN-243:', error);

            return res.status(500).json({
                success: false,
                code: 'STUDENT_SCHEDULE_ERROR',
                message: 'Không thể tải lịch học. Vui lòng thử lại.'
            });
        }
    }
);

module.exports = router;

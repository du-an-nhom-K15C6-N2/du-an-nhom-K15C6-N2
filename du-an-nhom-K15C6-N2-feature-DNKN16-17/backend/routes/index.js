const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const sessionRoutes = require('./sessionRoutes');
const classRoutes = require('./classRoutes');
const gradeRoutes = require('./gradeRoutes');
const tuitionRoutes = require('./tuitionRoutes');
const AuthController = require('../controllers/authController');

// API Health Check (tương thích cả 2 định dạng)
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'OK',
    message: 'Backend đang chạy bình thường.',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'TTCS Classroom Management API'
  });
});

// Gắn các sub-routers
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/session', sessionRoutes);
router.use('/classes', classRoutes);
router.use('/grades', gradeRoutes);
router.use('/tuition', tuitionRoutes);

// Endpoint đặt lại mật khẩu trực tiếp theo đặc tả nhánh feature
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);

module.exports = router;

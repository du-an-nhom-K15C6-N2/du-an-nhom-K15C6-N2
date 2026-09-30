const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');

// API Health Check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'TTCS Classroom Management API'
  });
});

// Gắn các sub-routers
router.use('/auth', authRoutes);
router.use('/users', userRoutes);

module.exports = router;

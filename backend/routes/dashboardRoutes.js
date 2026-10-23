const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/summary', requireAuth, DashboardController.summary);

module.exports = router;

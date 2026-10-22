const express = require('express');
const { getHealth, getModules } = require('../controllers/moduleController');
const scheduleRoutes = require('./scheduleRoutes');

const router = express.Router();

router.get('/health', getHealth);
router.get('/modules', getModules);
router.use('/schedules', scheduleRoutes);

module.exports = router;

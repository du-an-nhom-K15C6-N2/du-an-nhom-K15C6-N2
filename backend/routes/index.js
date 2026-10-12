
const express = require('express');
const { getHealth, getModules } = require('../controllers/moduleController');

// DNKN-175: Quan ly ho so hoc vien
const studentRoutes = require('./studentRoutes');

const router = express.Router();

// API co san cua nhom
router.get('/health', getHealth);
router.get('/modules', getModules);

// API rieng DNKN-175
router.use('/students', studentRoutes);

module.exports = router;

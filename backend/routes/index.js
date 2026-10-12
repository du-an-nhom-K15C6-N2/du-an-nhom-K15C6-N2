
const express = require('express');
const { getHealth, getModules } = require('../controllers/moduleController');

// DNKN-175: Quan ly ho so hoc vien
const studentRoutes = require('./studentRoutes');

// DNKN-176: Quan ly lop hoc & Kiem tra ma lop duy nhat
const classRoutes = require('./classRoutes');

const router = express.Router();

// API co san cua nhom
router.get('/health', getHealth);
router.get('/modules', getModules);

// API rieng DNKN-175
router.use('/students', studentRoutes);

// API rieng DNKN-176
router.use('/classes', classRoutes);

module.exports = router;

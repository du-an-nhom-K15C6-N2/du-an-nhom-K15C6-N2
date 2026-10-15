const express = require('express');
const { getHealth, getModules } = require('../controllers/moduleController');

const trainingProgramRoutes = require('./trainingProgramRoutes');

const router = express.Router();

router.get('/health', getHealth);
router.get('/modules', getModules);

// Phân hệ Quản lý danh mục chương trình đào tạo (DNKN-88)
router.use('/v1/training-programs', trainingProgramRoutes);
router.use('/training-programs', trainingProgramRoutes);

module.exports = router;

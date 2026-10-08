const express = require('express');
const { getHealth, getModules } = require('../controllers/moduleController');

const router = express.Router();

router.get('/health', getHealth);
router.get('/modules', getModules);

module.exports = router;

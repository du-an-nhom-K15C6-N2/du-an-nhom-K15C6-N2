'use strict';

const express = require('express');
const ConsultationLeadController = require('./consultationLeadController');
const { consultationRateLimiter } = require('./consultationLeadRateLimit');

const router = express.Router();

router.post('/', consultationRateLimiter, ConsultationLeadController.create);

module.exports = router;

const express = require('express');
const router = express.Router();
const ConversionController = require('../controllers/conversionController');

// Lấy danh sách leads
router.get('/', ConversionController.getLeads);

// Chuyển lead đã chốt thành hồ sơ học viên (Endpoint chính)
router.post('/:id/convert', ConversionController.convertLeadToStudent);

// Chi tiết một lead
router.get('/:id', ConversionController.getLeadById);

// Cập nhật lead (có khóa kiểm tra nếu lead đã nhập học)
router.put('/:id', ConversionController.updateLead);

module.exports = router;

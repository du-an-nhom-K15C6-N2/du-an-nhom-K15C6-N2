const express = require('express');
const router = express.Router();
const checkPermission = require('../middlewares/checkPermission');

router.post('/update', checkPermission('tuition', 'WRITE'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Cập nhật học phí thành công.',
  });
});

module.exports = router;

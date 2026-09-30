const express = require('express');
const router = express.Router();
const checkPermission = require('../middlewares/checkPermission');

router.post('/update', checkPermission('grades', 'WRITE'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Cập nhật điểm thành công.',
  });
});

module.exports = router;

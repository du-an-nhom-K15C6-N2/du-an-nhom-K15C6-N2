const express = require('express');
const path = require('node:path');
const apiRoutes = require('./routes');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use('/api', apiRoutes);
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Không tìm thấy tài nguyên.'
  });
});

app.listen(port, () => {
  console.log(`Hệ thống Quản lý Đào tạo đang chạy tại http://localhost:${port}`);
});

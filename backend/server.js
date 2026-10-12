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

function startServer(targetPort) {
  const server = app.listen(targetPort, () => {
    console.log(`Hệ thống Quản lý Đào tạo đang chạy tại http://localhost:${targetPort}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && !process.env.PORT) {
      console.warn(`Cổng ${targetPort} đã bị chiếm dụng, tự động chuyển sang cổng ${targetPort + 1}...`);
      startServer(targetPort + 1);
    } else {
      console.error(`Lỗi khởi động máy chủ: ${err.message}`);
    }
  });
}

if (require.main === module) {
  startServer(port);
}

module.exports = app;

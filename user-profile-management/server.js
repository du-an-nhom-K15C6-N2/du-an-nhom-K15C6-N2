const express = require('express');
const path = require('path');
const cors = require('cors');

const profileRoutes = require('./routes/profileRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// API Routes
app.use('/api/profile', profileRoutes);

// Fallback route cho Single Page (Express 5 tương thích)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'Endpoint không tồn tại' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 [User Profile Management] Server đang chạy tại: http://localhost:${PORT}`);
    console.log(`📄 Mở trình duyệt để xem giao diện quản lý hồ sơ: http://localhost:${PORT}`);
  });
}

module.exports = app;

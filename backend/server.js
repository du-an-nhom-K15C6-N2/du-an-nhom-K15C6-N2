const express = require('express');
const path = require('path');
const cors = require('cors');

const conversionRoutes = require('./routes/conversionRoutes');
const ConversionController = require('./controllers/conversionController');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
const frontendDir = path.join(__dirname, '../frontend');
app.use(express.static(frontendDir));

// API Routes
app.use('/api/leads', conversionRoutes);
app.get('/api/students', ConversionController.getStudents);

// Fallback Route cho SPA / HTML (Express 5 compatible)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'Endpoint không tồn tại' });
  }
  res.sendFile(path.join(frontendDir, 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 [Lead To Student Conversion] Server đang chạy tại: http://localhost:${PORT}`);
    console.log(`📄 Mở trình duyệt xem giao diện chuyển đổi lead: http://localhost:${PORT}`);
  });
}

module.exports = app;

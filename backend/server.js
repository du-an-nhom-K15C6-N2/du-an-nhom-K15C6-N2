/**
 * TTCS Classroom Security Application - Backend Server
 * Architecture: MVC (Model - View - Controller) with Express.js
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config/app.config');
const apiRoutes = require('./routes/index');
const loggerMiddleware = require('./middleware/loggerMiddleware');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

// 1. GLOBAL MIDDLEWARES
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(loggerMiddleware);

// 2. STATIC FILES SERVING (FRONTEND)
app.use(express.static(config.FRONTEND_DIR));

// 3. API ROUTES
app.use('/api', apiRoutes);

// 4. SPA FALLBACK FOR NON-API ROUTES
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.originalUrl.startsWith('/api')) {
    return res.sendFile(path.join(config.FRONTEND_DIR, 'index.html'));
  }
  next();
});

// 5. ERROR HANDLING MIDDLEWARES
app.use(notFoundHandler);
app.use(errorHandler);

// 6. START SERVER
const PORT = config.PORT;
const server = app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Hệ Thống Quản Lý Dữ Liệu Lớp Học An Toàn (TTCS MVC)`);
  console.log(`📡 Backend Server đang hoạt động tại: http://localhost:${PORT}`);
  console.log(`💻 Giao diện Frontend: http://localhost:${PORT}`);
  console.log(`🔌 API Base Endpoint: http://localhost:${PORT}/api`);
  console.log(`======================================================\n`);
});

module.exports = { app, server };

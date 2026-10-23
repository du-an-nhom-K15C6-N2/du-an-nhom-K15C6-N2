/**
 * TTCS Classroom Security Application - Backend Server
 * Architecture: MVC (Model - View - Controller) with Express.js
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config/app.config');
const apiRoutes = require('./routes/index');
const loggerMiddleware = require('./middleware/loggerMiddleware');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');
const UserModel = require('./models/userModel');
const { sessions } = require('./services/sessionService');

const app = express();
const frontendDir = path.resolve(__dirname, '../frontend');
const featuresDir = path.resolve(__dirname, '../features');

// DNKN87: Cho phep trinh duyet xem anh dai dien
const avatarDir = path.join(__dirname, 'uploads', 'avatars');

app.use(
  '/uploads/avatars',
  express.static(avatarDir)
);

function resolveHtmlFile(filename) {
  const inDist = path.join(config.FRONTEND_DIR, filename);
  if (fs.existsSync(inDist)) return inDist;
  const inFrontend = path.join(frontendDir, filename);
  if (fs.existsSync(inFrontend)) return inFrontend;
  return inDist;
}

// 1. GLOBAL MIDDLEWARES
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(loggerMiddleware);

app.get('/', (req, res) => {
  res.sendFile(resolveHtmlFile('index.html'));
});

// 2. STATIC FILES SERVING (FRONTEND)
app.use(express.static(config.FRONTEND_DIR));
app.use(express.static(frontendDir));
app.use(express.static(path.join(config.FRONTEND_DIR, 'css')));
app.use(express.static(path.join(config.FRONTEND_DIR, 'js')));
app.use(express.static(path.join(frontendDir, 'css')));
app.use(express.static(path.join(frontendDir, 'js')));
app.use('/css', express.static(path.join(config.FRONTEND_DIR, 'css')));
app.use('/css', express.static(path.join(frontendDir, 'css')));
app.use('/js', express.static(path.join(config.FRONTEND_DIR, 'js')));
app.use('/js', express.static(path.join(frontendDir, 'js')));
app.use('/features', express.static(featuresDir));
app.get('/lead-management', (req, res, next) => {
  const indexFile = path.join(featuresDir, 'lead-management-ui', 'frontend', 'index.html');
  fs.readFile(indexFile, 'utf8', (error, html) => {
    if (error) return next(error);
    const integrationConfig = '<base href="/features/lead-management-ui/frontend/"><script>window.LEAD_API_ENABLED=true;window.LEAD_USE_APP_AUTH=true;</script>';
    return res.type('html').send(html.replace(/<head([^>]*)>/i, `<head$1>${integrationConfig}`));
  });
});

// 3. API ROUTES
app.use('/api', apiRoutes);
app.get('/courses', (req, res) => {
  res.sendFile(path.join(featuresDir, 'course-catalog', 'frontend', 'courses.html'));
});

// 4. SPA FALLBACK & ROUTING FOR NON-API ROUTES
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.originalUrl.startsWith('/api')) {
    if (req.path === '/login' || req.path === '/login.html') {
      return res.sendFile(resolveHtmlFile('login.html'));
    }
    if (req.path === '/forgot-password' || req.path === '/forgot-password.html') {
      return res.sendFile(resolveHtmlFile('forgot-password.html'));
    }
    if (req.path === '/reset-password' || req.path === '/reset-password.html') {
      return res.sendFile(resolveHtmlFile('reset-password.html'));
    }
    if (req.path === '/activate-account' || req.path === '/activate-account.html') {
      return res.sendFile(resolveHtmlFile('activate-account.html'));
    }
    if (req.path === '/session-demo' || req.path === '/session-demo.html') {
      return res.sendFile(resolveHtmlFile('session-demo.html'));
    }
    if (req.path === '/import-users' || req.path === '/import-users.html') {
      return res.sendFile(resolveHtmlFile('import-users.html'));
    }
    return res.sendFile(resolveHtmlFile('index.html'));
  }
  next();
});

// 5. ERROR HANDLING MIDDLEWARES
app.use(notFoundHandler);
app.use(errorHandler);

function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && !process.env.DATA_FILE) {
    throw new Error('DATA_FILE phải trỏ tới kho dữ liệu riêng, bền vững và không dùng dữ liệu mẫu trong production.');
  }

  if (isProduction && Buffer.byteLength(process.env.AUTH_TOKEN_SECRET || '', 'utf8') < 32) {
    throw new Error('AUTH_TOKEN_SECRET phải có ít nhất 32 byte trong môi trường production.');
  }

  if (Boolean(process.env.BOOTSTRAP_ADMIN_EMAIL) !== Boolean(process.env.BOOTSTRAP_ADMIN_PASSWORD)) {
    throw new Error('Cần cấu hình đồng thời BOOTSTRAP_ADMIN_EMAIL và BOOTSTRAP_ADMIN_PASSWORD.');
  }

  if (process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_PASSWORD) {
    UserModel.bootstrapAdminCredentials(
      process.env.BOOTSTRAP_ADMIN_EMAIL,
      process.env.BOOTSTRAP_ADMIN_PASSWORD
    );
  }

  if (isProduction && !UserModel.hasActiveAdminCredentials()) {
    throw new Error('Chưa có quản trị viên đang hoạt động. Cấu hình BOOTSTRAP_ADMIN_EMAIL và BOOTSTRAP_ADMIN_PASSWORD để khởi tạo lần đầu.');
  }

  const requestedPort = Number(process.env.PORT || config.PORT);
  const basePort = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : Number(config.PORT);

  const logServerStartup = (port) => {
    console.log(`\n======================================================`);
    console.log(`🚀 Hệ Thống Quản Lý Dữ Liệu Lớp Học An Toàn (TTCS MVC)`);
    console.log(`📡 Backend Server đang hoạt động tại: http://localhost:${port}`);
    console.log(`💻 Giao diện Frontend: http://localhost:${port}`);
    console.log(`🔌 API Base Endpoint: http://localhost:${port}/api`);
    console.log(`======================================================\n`);
  };

  const startOnPort = (port) => {
    const server = app.listen(port, () => {
      logServerStartup(port);
    });

    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        const fallbackPort = port + 1;
        console.warn(`⚠️ Cổng ${port} đang bị chiếm dụng. Đang thử cổng ${fallbackPort}...`);
        startOnPort(fallbackPort);
        return;
      }

      console.error(`❌ Lỗi server:`, err);
    });

    return server;
  };

  return startOnPort(basePort);
}

const server = require.main === module ? startServer() : null;
module.exports = { app, server, sessions, startServer };

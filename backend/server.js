try {
  const Module = require('module');
  const path = require('path');
  const fallbackDir = path.resolve('D:/FILETONG/aaaaa/node_modules');
  const orig = Module._nodeModulePaths;
  Module._nodeModulePaths = function (from) {
    const paths = orig.call(this, from);
    if (!paths.includes(fallbackDir)) paths.push(fallbackDir);
    return paths;
  };
} catch (e) {}

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const config = require('./config/app.config');
const authRoutes = require('./routes/authRoutes');
const UserModel = require('./models/userModel');
const { requireAuth } = require('./middleware/authMiddleware');
const { ROLE_CATALOG, getPermissions } = require('./config/rolePermissions');

const app = express();
const frontendDir = path.resolve(__dirname, '../frontend');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(frontendDir));

// Sub-routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    module: 'DNKN-14',
    title: 'Role-based Dynamic Navigation & 360px Responsive Viewport'
  });
});

// Single Page Application Fallback
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.originalUrl.startsWith('/api')) {
    const indexPath = path.join(frontendDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
});

module.exports = { app };

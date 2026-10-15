try {
  const Module = require('module');
  const path = require('path');
  const fallbackDir = path.resolve('D:/aaaaa/aaaaa/node_modules');
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
const UserModel = require('./models/userModel');
const profileRoutes = require('./routes/profileRoutes');
const ProfileController = require('./controllers/profileController');
const { requireAuth } = require('./middleware/authMiddleware');
const { createToken } = require('./security/token');
const { verifyPassword } = require('./security/password');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.resolve(__dirname, '../frontend')));

// API Đăng nhập phục vụ test & preview
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ email và mật khẩu.' });
  }

  const user = UserModel.findByEmail(email);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
  }

  const isMatch = await verifyPassword(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
  }

  const token = createToken(user);
  return res.status(200).json({
    success: true,
    token,
    user: UserModel.toPublicUser(user)
  });
});

// API Thông tin tài khoản hiện tại
app.get('/api/auth/me', requireAuth, (req, res) => {
  return res.status(200).json({
    success: true,
    user: UserModel.toPublicUser(req.user)
  });
});

// API Profile
app.use('/api/profile', profileRoutes);

// Tương thích /api/auth/profile
app.get('/api/auth/profile', requireAuth, ProfileController.getProfile);
app.put('/api/auth/profile', requireAuth, ProfileController.updateProfile);
app.patch('/api/auth/profile', requireAuth, ProfileController.updateProfile);

module.exports = { app };

const path = require('path');
const express = require('express');
const { createDb, seed } = require('./db');
const { createApp } = require('./app');

const db = createDb(path.join(__dirname, 'dnkn.db'));
seed(db);

const app = createApp(db);
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('==========================================');
  console.log('  DNKN - Quản lý nhiều vai trò cho người dùng');
  console.log(`  Đang chạy tại: http://localhost:${PORT}`);
  console.log('  Tài khoản quản trị : admin / admin123');
  console.log('  Giảng viên+QLĐT   : linh  / 123456');
  console.log('==========================================');
});

#!/usr/bin/env node

/**
 * Preview Server cho Task DNKN-14: Menu điều hướng theo quyền & Tối ưu 360px
 * Khởi chạy độc lập trên cổng 3014
 */

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

const { app } = require('./backend/server');

const PORT = parseInt(process.env.PORT, 10) || 3014;

const server = app.listen(PORT, '0.0.0.0', () => {
  const url = `http://localhost:${PORT}`;
  console.log('='.repeat(75));
  console.log('⭐ MÁY CHỦ DEMO & KIỂM THỬ MENU ĐIỀU HƯỚNG ĐỘNG THEO QUYỀN (DNKN-14)');
  console.log('='.repeat(75));
  console.log(`🌐 Xem giao diện thử nghiệm trực tiếp tại: \x1b[36m${url}\x1b[0m`);
  console.log(`📋 Danh sách API Endpoints chính:`);
  console.log(`   - GET  /api/auth/permissions (Dữ liệu quyền, vai trò & mục điều hướng)`);
  console.log(`   - GET  /api/auth/me          (Thông tin tài khoản, vai trò & roleLabel)`);
  console.log(`   - POST /api/auth/login       (Xác thực tài khoản và cấp JWT token)`);
  console.log(`   - POST /api/auth/logout      (Đăng xuất và hủy phiên làm việc)`);
  console.log(`\n👥 Tài khoản chuyển đổi nhanh có sẵn trên giao diện:`);
  console.log(`   1. Quản trị viên (Admin):    admin@edu.vn    | Password@123`);
  console.log(`   2. Giảng viên (Teacher):     teacher@edu.vn  | Password@123`);
  console.log(`   3. Học sinh (Student):       student@edu.vn  | Password@123`);
  console.log(`   4. Trợ giảng (Assistant):    thao.le@edu.vn  | Password@123`);
  console.log(`   5. Quản lý (Manager):        hoang@edu.vn    | Password@123`);
  console.log('\n⏹️ Nhấn Ctrl + C để dừng máy chủ.');
  console.log('='.repeat(75));
});

module.exports = server;

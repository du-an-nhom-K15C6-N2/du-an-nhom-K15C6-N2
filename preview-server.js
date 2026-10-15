#!/usr/bin/env node

/**
 * Preview Server cho Task DNKN-86: Xem & Cập nhật Hồ sơ cá nhân
 * Chạy độc lập trên cổng 3086 mà không cần cài đặt thêm phụ thuộc
 */

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

const { app } = require('./backend/server');


const PORT = parseInt(process.env.PORT, 10) || 3086;

const server = app.listen(PORT, '0.0.0.0', () => {
  const url = `http://localhost:${PORT}`;
  console.log('='.repeat(64));
  console.log('🚀 MÁY CHỦ DEMO & TEST TÍNH NĂNG HỒ SƠ CÁ NHÂN (DNKN-86)');
  console.log('='.repeat(64));
  console.log(`🌐 Xem giao diện thử nghiệm tại: \x1b[36m${url}\x1b[0m`);
  console.log(`📡 API Endpoints đã kích hoạt:`);
  console.log(`   - GET  /api/profile           (Lấy hồ sơ cá nhân hiện tại)`);
  console.log(`   - PUT  /api/profile           (Cập nhật họ tên, SĐT, ngày sinh, địa chỉ)`);
  console.log(`   - POST /api/auth/login        (Đăng nhập cấp token)`);
  console.log(`\n👥 Tài khoản mẫu có sẵn trong hệ thống:`);
  console.log(`   1. Học sinh:   an.nguyen@edu.vn / Password@123`);
  console.log(`   2. Giảng viên: mai.tran@edu.vn  / Password@123`);
  console.log(`   3. Quản trị:   hoang@edu.vn     / Password@123`);
  console.log('\n💡 Nhấn Ctrl + C để dừng máy chủ bất kỳ lúc nào.');
  console.log('='.repeat(64));
});

module.exports = server;

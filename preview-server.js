#!/usr/bin/env node

/**
 * Preview Server cho Task DNKN-174: Chuyển Lead đã chốt thành hồ sơ học viên
 * Chạy độc lập trên cổng 3174
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

const PORT = parseInt(process.env.PORT, 10) || 3174;

const server = app.listen(PORT, '0.0.0.0', () => {
  const url = `http://localhost:${PORT}`;
  console.log('='.repeat(72));
  console.log('🎓 MÁY CHỦ DEMO & KIỂM THỬ CHUYỂN LEAD THÀNH HỒ SƠ HỌC VIÊN (DNKN-174)');
  console.log('='.repeat(72));
  console.log(`🌐 Xem giao diện thử nghiệm trực tiếp tại: \x1b[36m${url}\x1b[0m`);
  console.log(`📡 Danh sách API Endpoints chính:`);
  console.log(`   - POST /api/leads/:id/convert-to-student (Chuyển Lead chốt sang hồ sơ học viên)`);
  console.log(`   - GET  /api/leads/:id/student            (Xem hồ sơ học viên đã chuyển đổi)`);
  console.log(`   - GET  /api/students                     (Danh sách hồ sơ học viên)`);
  console.log(`   - GET  /api/students/:id                 (Chi tiết hồ sơ học viên theo ID/mã HV)`);
  console.log(`   - POST /api/students/convert-from-lead   (Endpoint phụ chuyển đổi từ StudentRouter)`);
  console.log(`\n✨ Các chức năng nổi bật trong giao diện xem thử:`);
  console.log(`   1. Danh sách Lead với trạng thái Chốt, Đã nhập học, Đang tư vấn`);
  console.log(`   2. Nút "Chuyển thành học viên" ở Lead đã chốt`);
  console.log(`   3. Modal xác nhận kế thừa dữ liệu, không phải nhập lại`);
  console.log(`   4. Sinh mã học viên tự động định dạng HVYYYYXXXX`);
  console.log(`   5. Tạo tài khoản người dùng, cấp mật khẩu tạm và gửi email kích hoạt`);
  console.log(`   6. Tự động chuyển Lead sang "Đã nhập học" và khóa chỉnh sửa/xóa 100%`);
  console.log('\n💡 Nhấn Ctrl + C để dừng máy chủ.');
  console.log('='.repeat(72));
});

module.exports = server;

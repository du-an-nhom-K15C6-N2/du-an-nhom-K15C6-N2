const request = require('supertest');
const app = require('./src/app');

describe('Kiểm thử tự động Phân quyền RBAC', () => {
  
  // 1. Kiểm thử vai trò Giảng viên
  describe('Vai trò: Giảng viên (LECTURER)', () => {
    test('ĐƯỢC PHÉP sửa điểm', async () => {
      const res = await request(app)
        .post('/api/v1/grades/update')
        .set('x-user-role', 'LECTURER')
        .send({ studentId: 'SV01', grade: 9.0 });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Cập nhật điểm thành công.');
    });

    test('KHÔNG ĐƯỢC PHÉP sửa học phí (Báo lỗi tiếng Việt)', async () => {
      const res = await request(app)
        .post('/api/v1/tuition/update')
        .set('x-user-role', 'LECTURER')
        .send({ studentId: 'SV01', amount: 5000000 });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Bạn không có quyền thực hiện chức năng này. Vui lòng liên hệ Quản trị viên nếu cần hỗ trợ.');
    });
  });

  // 2. Kiểm thử vai trò Kế toán
  describe('Vai trò: Kế toán (ACCOUNTANT)', () => {
    test('ĐƯỢC PHÉP sửa học phí', async () => {
      const res = await request(app)
        .post('/api/v1/tuition/update')
        .set('x-user-role', 'ACCOUNTANT')
        .send({ studentId: 'SV01', amount: 5000000 });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Cập nhật học phí thành công.');
    });

    test('KHÔNG ĐƯỢC PHÉP sửa điểm (Báo lỗi tiếng Việt)', async () => {
      const res = await request(app)
        .post('/api/v1/grades/update')
        .set('x-user-role', 'ACCOUNTANT')
        .send({ studentId: 'SV01', grade: 9.0 });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Bạn không có quyền thực hiện chức năng này. Vui lòng liên hệ Quản trị viên nếu cần hỗ trợ.');
    });
  });

  // 3. Kiểm thử vai trò Sinh viên
  describe('Vai trò: Sinh viên (STUDENT)', () => {
    test('KHÔNG ĐƯỢC PHÉP sửa điểm', async () => {
      const res = await request(app)
        .post('/api/v1/grades/update')
        .set('x-user-role', 'STUDENT')
        .send({ studentId: 'SV01', grade: 10.0 });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Bạn không có quyền thực hiện chức năng này. Vui lòng liên hệ Quản trị viên nếu cần hỗ trợ.');
    });
  });
});
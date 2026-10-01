const request = require('supertest');
const app = require('./src/app');
const { seedRoles } = require('./src/seed/rbacSeed');

const appForRole = (role) => app.createApp({
  authenticate: (req, res, next) => {
    req.user = { id: 'test-user', role };
    next();
  },
});

describe('Kiểm thử tự động phân quyền RBAC', () => {
  describe('Vai trò: Giảng viên (LECTURER)', () => {
    test('ĐƯỢC PHÉP sửa điểm', async () => {
      const res = await request(appForRole('LECTURER'))
        .post('/api/v1/grades/update')
        .send({ studentId: 'SV01', grade: 9.0 });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Cập nhật điểm thành công.');
    });

    test('KHÔNG ĐƯỢC PHÉP sửa học phí (Báo lỗi tiếng Việt)', async () => {
      const res = await request(appForRole('LECTURER'))
        .post('/api/v1/tuition/update')
        .send({ studentId: 'SV01', amount: 5000000 });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Bạn không có quyền thực hiện chức năng này. Vui lòng liên hệ Quản trị viên nếu cần hỗ trợ.');
    });
  });

  describe('Vai trò: Kế toán (ACCOUNTANT)', () => {
    test('ĐƯỢC PHÉP sửa học phí', async () => {
      const res = await request(appForRole('ACCOUNTANT'))
        .post('/api/v1/tuition/update')
        .send({ studentId: 'SV01', amount: 5000000 });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Cập nhật học phí thành công.');
    });

    test('KHÔNG ĐƯỢC PHÉP sửa điểm (Báo lỗi tiếng Việt)', async () => {
      const res = await request(appForRole('ACCOUNTANT'))
        .post('/api/v1/grades/update')
        .send({ studentId: 'SV01', grade: 9.0 });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Bạn không có quyền thực hiện chức năng này. Vui lòng liên hệ Quản trị viên nếu cần hỗ trợ.');
    });
  });

  describe('Vai trò: Sinh viên (STUDENT)', () => {
    test('KHÔNG ĐƯỢC PHÉP sửa điểm', async () => {
      const res = await request(appForRole('STUDENT'))
        .post('/api/v1/grades/update')
        .send({ studentId: 'SV01', grade: 10.0 });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Bạn không có quyền thực hiện chức năng này. Vui lòng liên hệ Quản trị viên nếu cần hỗ trợ.');
    });
  });

  describe('Từ chối mặc định', () => {
    test('Từ chối khi không có identity, kể cả khi client tự gửi role header', async () => {
      const res = await request(app)
        .post('/api/v1/tuition/update')
        .set('x-user-role', 'ADMIN')
        .send({ studentId: 'SV01', amount: 5000000 });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PERMISSION_DENIED');
      expect(res.body.message).toBe('Bạn không có quyền thực hiện chức năng này. Vui lòng liên hệ Quản trị viên nếu cần hỗ trợ.');
    });

    test('Từ chối role không nằm trong danh sách cấu hình', async () => {
      const res = await request(appForRole('UNKNOWN_ROLE'))
        .post('/api/v1/grades/update');

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PERMISSION_DENIED');
    });
  });

  test('Seed chứa đúng tám vai trò nghiệp vụ', () => {
    expect(seedRoles).toHaveLength(8);
    expect(seedRoles.map(({ role }) => role)).not.toContain('ROLE_LIST');
  });
});
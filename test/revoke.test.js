const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup, login, auth } = require('./helpers');

// DNKN-70: API thu hồi vai trò
test('Admin có thể thu hồi một vai trò khỏi người dùng', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');

  const res = await auth(request.delete('/api/users/4/roles/3'), admin); // thu hồi QUAN_LY_DAO_TAO khỏi linh
  assert.equal(res.status, 200);
  const codes = res.body.roles.map((r) => r.code);
  assert.ok(codes.includes('GIANG_VIEN'));
  assert.ok(!codes.includes('QUAN_LY_DAO_TAO'));
});

// DNKN-69 + DNKN-75: không thể tự thu hồi vai trò quản trị của chính mình
test('Không thể tự thu hồi vai trò ADMIN của chính mình (403)', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');

  const res = await auth(request.delete('/api/users/1/roles/1'), admin); // admin tự thu hồi ADMIN
  assert.equal(res.status, 403);
  assert.match(res.body.error, /chính mình/);
});

test('Vẫn có thể thu hồi vai trò admin của NGƯỜI KHÁC', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');

  // admin gán ADMIN cho giangvien trước
  await auth(request.post('/api/users/2/roles'), admin).send({ role_ids: [1] });

  // admin thu hồi ADMIN của giangvien (người khác) -> được phép
  const res = await auth(request.delete('/api/users/2/roles/1'), admin);
  assert.equal(res.status, 200);
});

test('Thu hồi vai trò người dùng chưa có trả về 404', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');

  const res = await auth(request.delete('/api/users/2/roles/4'), admin); // giangvien không có HOC_VIEN
  assert.equal(res.status, 404);
});

test('Thu hồi vai trò không tồn tại trả về 404', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');

  const res = await auth(request.delete('/api/users/2/roles/999'), admin);
  assert.equal(res.status, 404);
});

test('Người không phải admin không thể thu hồi vai trò (403)', async () => {
  const { request } = setup();
  const token = await login(request, 'giangvien', '123456');

  const res = await auth(request.delete('/api/users/2/roles/2'), token);
  assert.equal(res.status, 403);
});

// DNKN-74: sau khi thu hồi, quyền mất hiệu lực ngay ở request kế tiếp
test('Sau khi thu hồi, vai trò mất hiệu lực ngay mà không cần đăng nhập lại', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');
  const gv = await login(request, 'giangvien', '123456');

  // Gán ADMIN cho giangvien -> có quyền admin
  await auth(request.post('/api/users/2/roles'), admin).send({ role_ids: [1] });
  const hasAccess = await auth(request.get('/api/users'), gv);
  assert.equal(hasAccess.status, 200);

  // Thu hồi ADMIN -> mất quyền ngay với cùng token
  await auth(request.delete('/api/users/2/roles/1'), admin);
  const lostAccess = await auth(request.get('/api/users'), gv);
  assert.equal(lostAccess.status, 403);
});

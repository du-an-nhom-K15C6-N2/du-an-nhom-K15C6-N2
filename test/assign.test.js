const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup, login, auth } = require('./helpers');

// DNKN-71: API gán vai trò cho người dùng
test('Admin có thể gán một vai trò mới cho người dùng', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');

  const res = await auth(request.post('/api/users/2/roles'), admin).send({ role_ids: [3] });
  assert.equal(res.status, 201);
  const codes = res.body.roles.map((r) => r.code);
  assert.ok(codes.includes('GIANG_VIEN'));
  assert.ok(codes.includes('QUAN_LY_DAO_TAO'));
});

test('Có thể gán nhiều vai trò cùng lúc (nhiều - nhiều)', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');

  const res = await auth(request.post('/api/users/2/roles'), admin).send({ role_ids: [1, 4] });
  assert.equal(res.status, 201);
  const codes = res.body.roles.map((r) => r.code);
  assert.ok(codes.includes('ADMIN'));
  assert.ok(codes.includes('HOC_VIEN'));
  assert.ok(codes.includes('GIANG_VIEN'));
});

test('Gán vai trò đã tồn tại trả về 409 (phản hồi rõ ràng)', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');

  const res = await auth(request.post('/api/users/2/roles'), admin).send({ role_ids: [2] }); // GIANG_VIEN đã có sẵn
  assert.equal(res.status, 409);
  assert.match(res.body.error, /đã được gán/);
});

test('Gán vai trò không tồn tại trả về 404', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');

  const res = await auth(request.post('/api/users/2/roles'), admin).send({ role_ids: [999] });
  assert.equal(res.status, 404);
});

test('Gán vai trò cho người dùng không tồn tại trả về 404', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');

  const res = await auth(request.post('/api/users/999/roles'), admin).send({ role_ids: [1] });
  assert.equal(res.status, 404);
});

test('Thiếu role_ids trả về 400', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');

  const res = await auth(request.post('/api/users/2/roles'), admin).send({});
  assert.equal(res.status, 400);
});

test('Người không phải admin không thể gán vai trò (403)', async () => {
  const { request } = setup();
  const token = await login(request, 'giangvien', '123456');

  const res = await auth(request.post('/api/users/3/roles'), token).send({ role_ids: [4] });
  assert.equal(res.status, 403);
});

// DNKN-67 + DNKN-74: thay đổi vai trò có hiệu lực ngay ở request kế tiếp,
// KHÔNG cần đăng nhập lại (cùng một token).
test('Vai trò mới có hiệu lực ngay request kế tiếp mà không cần đăng nhập lại', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');
  const gv = await login(request, 'giangvien', '123456');

  // Trước khi gán: giangvien KHÔNG có quyền admin
  const before = await auth(request.get('/api/users'), gv);
  assert.equal(before.status, 403);

  // Admin gán vai trò ADMIN cho giangvien
  const assign = await auth(request.post('/api/users/2/roles'), admin).send({ role_ids: [1] });
  assert.equal(assign.status, 201);

  // Dùng lại CHÍNH token cũ của giangvien -> giờ đã có quyền admin
  const after = await auth(request.get('/api/users'), gv);
  assert.equal(after.status, 200);
});

// DNKN-68: khóa chính ghép ngăn trùng lặp dữ liệu
test('Ràng buộc unique (user_id, role_id) ngăn dữ liệu trùng lặp', async () => {
  const { db, request } = setup();
  const admin = await login(request, 'admin', 'admin123');
  await auth(request.post('/api/users/2/roles'), admin).send({ role_ids: [3] });

  assert.throws(() => db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?,?)').run(2, 3));
});

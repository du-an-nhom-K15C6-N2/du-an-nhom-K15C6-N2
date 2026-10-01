const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup, login, auth } = require('./helpers');

// ---------- Quản lý người dùng ----------
test('Admin có thể tạo người dùng mới kèm vai trò ban đầu', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');

  const res = await auth(request.post('/api/users'), admin).send({
    username: 'newuser', password: '123456', full_name: 'Người Mới', email: 'new@dnkn.vn', role_ids: [2, 4],
  });
  assert.equal(res.status, 201);

  const users = await auth(request.get('/api/users'), admin);
  const u = users.body.find((x) => x.username === 'newuser');
  assert.ok(u);
  assert.equal(u.roles.length, 2);
});

test('Tạo người dùng trùng tên đăng nhập trả về 409', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');
  const res = await auth(request.post('/api/users'), admin).send({
    username: 'admin', password: 'x', full_name: 'X',
  });
  assert.equal(res.status, 409);
});

test('Admin có thể cập nhật thông tin người dùng', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');
  const res = await auth(request.put('/api/users/2'), admin).send({
    full_name: 'Nguyễn Văn Đổi', email: 'doi@dnkn.vn',
  });
  assert.equal(res.status, 200);

  const me = await auth(request.get('/api/users'), admin);
  const u = me.body.find((x) => x.id === 2);
  assert.equal(u.full_name, 'Nguyễn Văn Đổi');
});

test('Không thể xóa tài khoản của chính mình (403)', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');
  const res = await auth(request.delete('/api/users/1'), admin);
  assert.equal(res.status, 403);
});

// ---------- Quản lý vai trò ----------
test('Admin có thể tạo vai trò mới', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');
  const res = await auth(request.post('/api/roles'), admin).send({
    code: 'THU_KY', name: 'Thư ký', description: 'Hỗ trợ hành chính',
  });
  assert.equal(res.status, 201);

  const roles = await auth(request.get('/api/roles'), admin);
  assert.ok(roles.body.find((r) => r.code === 'THU_KY'));
});

test('Tạo vai trò trùng mã trả về 409', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');
  const res = await auth(request.post('/api/roles'), admin).send({ code: 'ADMIN', name: 'X' });
  assert.equal(res.status, 409);
});

test('Không thể xóa vai trò hệ thống (ADMIN)', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');
  const res = await auth(request.delete('/api/roles/1'), admin);
  assert.equal(res.status, 403);
});

test('Không thể xóa vai trò đang được gán cho người dùng', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');
  // GIANG_VIEN (id 2) đang được gán cho giangvien + linh
  const res = await auth(request.delete('/api/roles/2'), admin);
  assert.equal(res.status, 409);
});

// ---------- Nhật ký thao tác ----------
test('Gán / thu hồi vai trò được ghi vào nhật ký', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');

  await auth(request.post('/api/users/2/roles'), admin).send({ role_ids: [3] });
  await auth(request.delete('/api/users/2/roles/3'), admin);

  const log = await auth(request.get('/api/audit'), admin);
  const actions = log.body.map((x) => x.action);
  assert.ok(actions.includes('assign'));
  assert.ok(actions.includes('revoke'));

  const revoke = log.body.find((x) => x.action === 'revoke');
  assert.equal(revoke.role_code, 'QUAN_LY_DAO_TAO');
  assert.equal(revoke.target_name, 'Nguyễn Giảng Viên');
  assert.equal(revoke.actor_name, 'Trần Quản Trị');
});

// ---------- Thống kê ----------
test('API thống kê trả về đúng số liệu', async () => {
  const { request } = setup();
  const admin = await login(request, 'admin', 'admin123');
  const res = await auth(request.get('/api/stats'), admin);
  assert.equal(res.status, 200);
  assert.equal(res.body.totalUsers, 4);
  assert.equal(res.body.totalRoles, 4);
  assert.equal(res.body.admins, 1);
  assert.ok(Array.isArray(res.body.rolesDistribution));
  assert.ok(Array.isArray(res.body.recent));
});

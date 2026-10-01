const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup, login, auth } = require('./helpers');

test('Đăng nhập đúng trả về token + thông tin người dùng', async () => {
  const { request } = setup();
  const res = await request.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.equal(res.body.user.username, 'admin');
});

test('Đăng nhập sai mật khẩu trả về 401', async () => {
  const { request } = setup();
  const res = await request.post('/api/auth/login').send({ username: 'admin', password: 'sai' });
  assert.equal(res.status, 401);
});

test('Đăng nhập thiếu thông tin trả về 400', async () => {
  const { request } = setup();
  const res = await request.post('/api/auth/login').send({});
  assert.equal(res.status, 400);
});

test('GET /api/auth/me trả về đúng danh sách vai trò hiện tại', async () => {
  const { request } = setup();
  const token = await login(request, 'linh', '123456');
  const res = await auth(request.get('/api/auth/me'), token);
  assert.equal(res.status, 200);
  const codes = res.body.user.roles;
  assert.ok(codes.includes('GIANG_VIEN'));
  assert.ok(codes.includes('QUAN_LY_DAO_TAO'));
});

test('Gọi API khi chưa đăng nhập trả về 401', async () => {
  const { request } = setup();
  const res = await request.get('/api/users');
  assert.equal(res.status, 401);
});

test('Token không hợp lệ trả về 401', async () => {
  const { request } = setup();
  const res = await auth(request.get('/api/users'), 'token-sai');
  assert.equal(res.status, 401);
});

// Tiện ích dùng chung cho kiểm thử
const request = require('supertest');
const { createDb, seed } = require('../db');
const { createApp } = require('../app');

// Tạo ứng dụng với cơ sở dữ liệu trong bộ nhớ (độc lập mỗi lần gọi)
function setup() {
  const db = createDb(':memory:');
  seed(db);
  const app = createApp(db);
  return { db, request: request(app) };
}

// Đăng nhập và trả về token
async function login(req, username, password) {
  const res = await req.post('/api/auth/login').send({ username, password });
  if (res.status !== 200) throw new Error('Đăng nhập thất bại: ' + (res.body.error || res.status));
  return res.body.token;
}

// Gắn header Authorization cho request supertest
function auth(req, token) {
  return req.set('Authorization', 'Bearer ' + token);
}

module.exports = { setup, login, auth };

// Khởi tạo ứng dụng Express (tách khỏi server để dễ kiểm thử bằng supertest)
const express = require('express');
const bcrypt = require('bcryptjs');
const { makeAuth, signToken } = require('./middleware/auth');

function getRoles(db, userId) {
  return db.prepare(`
    SELECT r.id, r.code, r.name
    FROM roles r
    JOIN user_roles ur ON ur.role_id = r.id
    WHERE ur.user_id = ?
    ORDER BY r.id
  `).all(userId);
}

function createApp(db) {
  const app = express();
  app.use(express.json());
  const { authenticate, authorize } = makeAuth(db);

  // ---------- Đăng nhập (không cần token) ----------
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
    }
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username).trim());
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });
    }
    res.json({
      token: signToken(user.id),
      user: { id: user.id, username: user.username, full_name: user.full_name },
    });
  });

  // ---------- Từ đây trở đi yêu cầu đăng nhập (chỉ áp dụng cho các route /api) ----------
  app.use('/api', authenticate);

  // Thông tin người dùng hiện tại + vai trò (đọc mới mỗi lần gọi)
  app.get('/api/auth/me', (req, res) => {
    res.json({ user: { ...req.user, roleDetails: req.roleDetails } });
  });

  // Danh sách tất cả vai trò
  app.get('/api/roles', authorize('ADMIN'), (req, res) => {
    res.json(db.prepare('SELECT id, code, name FROM roles ORDER BY id').all());
  });

  // Danh sách người dùng (kèm vai trò từng người)
  app.get('/api/users', authorize('ADMIN'), (req, res) => {
    const users = db.prepare('SELECT id, username, full_name, email, created_at FROM users ORDER BY id').all();
    const rows = db.prepare(`
      SELECT ur.user_id, r.id AS role_id, r.code, r.name
      FROM user_roles ur JOIN roles r ON r.id = ur.role_id ORDER BY r.id
    `).all();
    const byUser = {};
    rows.forEach((r) => {
      (byUser[r.user_id] = byUser[r.user_id] || []).push({ id: r.role_id, code: r.code, name: r.name });
    });
    res.json(users.map((u) => ({ ...u, roles: byUser[u.id] || [] })));
  });

  // Xem vai trò hiện có của một người dùng
  app.get('/api/users/:id/roles', authorize('ADMIN'), (req, res) => {
    const user = db.prepare('SELECT id, username, full_name, email FROM users WHERE id = ?').get(Number(req.params.id));
    if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    res.json({ user, roles: getRoles(db, user.id) });
  });

  // Gán một hoặc nhiều vai trò (DNKN-71)
  app.post('/api/users/:id/roles', authorize('ADMIN'), (req, res) => {
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
    if (!target) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

    const roleIds = (req.body && req.body.role_ids) || [];
    if (!Array.isArray(roleIds) || roleIds.length === 0) {
      return res.status(400).json({ error: 'Vui lòng chọn ít nhất một vai trò (role_ids)' });
    }

    const uniqueIds = [...new Set(roleIds.map(Number))];
    const placeholders = uniqueIds.map(() => '?').join(',');
    const found = db.prepare(`SELECT id, code, name FROM roles WHERE id IN (${placeholders})`).all(...uniqueIds);
    if (found.length !== uniqueIds.length) {
      return res.status(404).json({ error: 'Có vai trò không tồn tại' });
    }

    // Phản hồi rõ ràng khi vai trò đã được gán (tránh trùng lặp dữ liệu)
    const assigned = db.prepare('SELECT role_id FROM user_roles WHERE user_id = ?').all(target.id).map((r) => r.role_id);
    const duplicated = found.filter((r) => assigned.includes(r.id));
    if (duplicated.length > 0) {
      return res.status(409).json({
        error: 'Vai trò đã được gán cho người dùng này: ' + duplicated.map((r) => r.name).join(', '),
      });
    }

    const insert = db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)');
    found.forEach((r) => insert.run(target.id, r.id));

    res.status(201).json({ message: 'Đã gán vai trò thành công', roles: getRoles(db, target.id) });
  });

  // Thu hồi một vai trò (DNKN-70)
  app.delete('/api/users/:id/roles/:roleId', authorize('ADMIN'), (req, res) => {
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
    if (!target) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

    const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(Number(req.params.roleId));
    if (!role) return res.status(404).json({ error: 'Không tìm thấy vai trò' });

    // Ràng buộc (DNKN-69): không được tự thu hồi vai trò quản trị của chính mình
    if (target.id === req.user.id && role.code === 'ADMIN') {
      return res.status(403).json({ error: 'Bạn không thể tự thu hồi vai trò quản trị của chính mình' });
    }

    const existing = db.prepare('SELECT role_id FROM user_roles WHERE user_id = ? AND role_id = ?').get(target.id, role.id);
    if (!existing) return res.status(404).json({ error: 'Người dùng chưa có vai trò này' });

    db.prepare('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?').run(target.id, role.id);
    res.json({ message: 'Đã thu hồi vai trò', roles: getRoles(db, target.id) });
  });

  return app;
}

module.exports = { createApp };

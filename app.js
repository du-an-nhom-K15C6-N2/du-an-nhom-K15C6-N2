// Khởi tạo ứng dụng Express (tách khỏi server để dễ kiểm thử bằng supertest)
const express = require('express');
const bcrypt = require('bcryptjs');
const { makeAuth, signToken } = require('./middleware/auth');

function getRoles(db, userId) {
  return db.prepare(`
    SELECT r.id, r.code, r.name, r.description, r.is_system
    FROM roles r
    JOIN user_roles ur ON ur.role_id = r.id
    WHERE ur.user_id = ?
    ORDER BY r.id
  `).all(userId);
}

function logAudit(db, actor, target, role, action) {
  db.prepare(
    'INSERT INTO role_audit_log (actor_user_id, actor_name, target_user_id, target_name, role_code, role_name, action) VALUES (?,?,?,?,?,?,?)'
  ).run(actor.id, actor.full_name, target.id, target.full_name, role.code, role.name, action);
}

function countAdmins(db) {
  return db.prepare(
    "SELECT COUNT(*) c FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.code = 'ADMIN'"
  ).get().c;
}

// Người dùng này có phải quản trị viên DUY NHẤT còn lại không?
function isLastAdmin(db, userId) {
  const rows = db.prepare(
    "SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.code = 'ADMIN'"
  ).all();
  return rows.length === 1 && rows[0].user_id === userId;
}

function createApp(db) {
  const app = express();
  app.use(express.json());
  const { authenticate, authorize } = makeAuth(db);
  const adminOnly = authorize('ADMIN');

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

  // ---------- Từ đây trở đi yêu cầu đăng nhập (chỉ áp dụng cho /api) ----------
  app.use('/api', authenticate);

  // Thông tin người dùng hiện tại + vai trò (đọc mới mỗi lần gọi)
  app.get('/api/auth/me', (req, res) => {
    res.json({ user: { ...req.user, roleDetails: req.roleDetails } });
  });

  // ================= VAI TRÒ =================
  // Danh sách vai trò (kèm số người dùng đang có vai trò đó)
  app.get('/api/roles', adminOnly, (req, res) => {
    const roles = db.prepare('SELECT * FROM roles ORDER BY id').all();
    const counts = db.prepare('SELECT role_id, COUNT(*) c FROM user_roles GROUP BY role_id').all();
    const map = {};
    counts.forEach((x) => (map[x.role_id] = x.c));
    res.json(roles.map((r) => ({ ...r, user_count: map[r.id] || 0 })));
  });

  // Tạo vai trò mới
  app.post('/api/roles', adminOnly, (req, res) => {
    const { code, name, description } = req.body || {};
    if (!code || !name) return res.status(400).json({ error: 'Vui lòng nhập mã và tên vai trò' });
    const c = String(code).trim().toUpperCase().replace(/\s+/g, '_');
    if (!/^[A-Z][A-Z0-9_]*$/.test(c)) {
      return res.status(400).json({ error: 'Mã vai trò chỉ gồm chữ in hoa, số và dấu gạch dưới, bắt đầu bằng chữ cái' });
    }
    if (db.prepare('SELECT id FROM roles WHERE code = ?').get(c)) {
      return res.status(409).json({ error: 'Mã vai trò đã tồn tại' });
    }
    const info = db.prepare('INSERT INTO roles (code, name, description, is_system) VALUES (?,?,?,0)')
      .run(c, String(name).trim(), description || '');
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  });

  // Cập nhật vai trò (không cho sửa vai trò hệ thống)
  app.put('/api/roles/:id', adminOnly, (req, res) => {
    const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(Number(req.params.id));
    if (!role) return res.status(404).json({ error: 'Không tìm thấy vai trò' });
    if (role.is_system) return res.status(403).json({ error: 'Không thể chỉnh sửa vai trò hệ thống' });
    const { name, description } = req.body || {};
    db.prepare('UPDATE roles SET name=?, description=? WHERE id=?').run(
      name || role.name,
      description !== undefined ? description : role.description,
      role.id
    );
    res.json({ ok: true });
  });

  // Xóa vai trò (không xóa vai trò hệ thống / vai trò đang được gán)
  app.delete('/api/roles/:id', adminOnly, (req, res) => {
    const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(Number(req.params.id));
    if (!role) return res.status(404).json({ error: 'Không tìm thấy vai trò' });
    if (role.is_system) return res.status(403).json({ error: 'Không thể xóa vai trò hệ thống' });
    const used = db.prepare('SELECT COUNT(*) c FROM user_roles WHERE role_id = ?').get(role.id).c;
    if (used > 0) {
      return res.status(409).json({ error: `Vai trò đang được gán cho ${used} người dùng, hãy thu hồi trước khi xóa` });
    }
    db.prepare('DELETE FROM roles WHERE id = ?').run(role.id);
    res.json({ ok: true });
  });

  // ================= NGƯỜI DÙNG =================
  // Danh sách người dùng (kèm vai trò từng người)
  app.get('/api/users', adminOnly, (req, res) => {
    const users = db.prepare('SELECT id, username, full_name, email, created_at FROM users ORDER BY id').all();
    const rows = db.prepare(`
      SELECT ur.user_id, r.id AS role_id, r.code, r.name, r.description, r.is_system
      FROM user_roles ur JOIN roles r ON r.id = ur.role_id ORDER BY r.id
    `).all();
    const byUser = {};
    rows.forEach((r) => {
      (byUser[r.user_id] = byUser[r.user_id] || []).push({
        id: r.role_id, code: r.code, name: r.name, description: r.description, is_system: r.is_system,
      });
    });
    res.json(users.map((u) => ({ ...u, roles: byUser[u.id] || [] })));
  });

  // Tạo người dùng mới (có thể kèm vai trò ban đầu)
  app.post('/api/users', adminOnly, (req, res) => {
    const { username, password, full_name, email, role_ids } = req.body || {};
    if (!username || !password || !full_name) {
      return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập, mật khẩu và họ tên' });
    }
    const uname = String(username).trim();
    if (db.prepare('SELECT id FROM users WHERE username = ?').get(uname)) {
      return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại' });
    }
    const roleIds = Array.isArray(role_ids) ? [...new Set(role_ids.map(Number))] : [];
    let roleRows = [];
    if (roleIds.length) {
      const ph = roleIds.map(() => '?').join(',');
      roleRows = db.prepare(`SELECT * FROM roles WHERE id IN (${ph})`).all(...roleIds);
      if (roleRows.length !== roleIds.length) return res.status(404).json({ error: 'Có vai trò không tồn tại' });
    }
    const info = db.prepare('INSERT INTO users (username, password, full_name, email) VALUES (?,?,?,?)')
      .run(uname, bcrypt.hashSync(password, 10), String(full_name).trim(), email || '');
    const userId = Number(info.lastInsertRowid);
    const ins = db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?,?)');
    roleRows.forEach((r) => ins.run(userId, r.id));
    res.status(201).json({ id: userId });
  });

  // Cập nhật người dùng (mật khẩu để trống = giữ nguyên)
  app.put('/api/users/:id', adminOnly, (req, res) => {
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
    if (!target) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    const { username, password, full_name, email } = req.body || {};
    const uname = username ? String(username).trim() : target.username;
    if (uname !== target.username && db.prepare('SELECT id FROM users WHERE username = ?').get(uname)) {
      return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại' });
    }
    db.prepare('UPDATE users SET username=?, full_name=?, email=? WHERE id=?').run(
      uname,
      full_name ? String(full_name).trim() : target.full_name,
      email !== undefined ? email : target.email,
      target.id
    );
    if (password) db.prepare('UPDATE users SET password=? WHERE id=?').run(bcrypt.hashSync(password, 10), target.id);
    res.json({ ok: true });
  });

  // Xóa người dùng (không xóa chính mình / quản trị viên cuối cùng)
  app.delete('/api/users/:id', adminOnly, (req, res) => {
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
    if (!target) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    if (target.id === req.user.id) return res.status(403).json({ error: 'Không thể xóa tài khoản của chính mình' });
    if (isLastAdmin(db, target.id)) {
      return res.status(403).json({ error: 'Không thể xóa quản trị viên cuối cùng của hệ thống' });
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(target.id);
    res.json({ ok: true });
  });

  // Xem vai trò hiện có của một người dùng
  app.get('/api/users/:id/roles', adminOnly, (req, res) => {
    const user = db.prepare('SELECT id, username, full_name, email FROM users WHERE id = ?').get(Number(req.params.id));
    if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    res.json({ user, roles: getRoles(db, user.id) });
  });

  // Gán một hoặc nhiều vai trò (DNKN-71)
  app.post('/api/users/:id/roles', adminOnly, (req, res) => {
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
    if (!target) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

    const roleIds = (req.body && req.body.role_ids) || [];
    if (!Array.isArray(roleIds) || roleIds.length === 0) {
      return res.status(400).json({ error: 'Vui lòng chọn ít nhất một vai trò (role_ids)' });
    }

    const uniqueIds = [...new Set(roleIds.map(Number))];
    const placeholders = uniqueIds.map(() => '?').join(',');
    const found = db.prepare(`SELECT * FROM roles WHERE id IN (${placeholders})`).all(...uniqueIds);
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
    found.forEach((r) => {
      insert.run(target.id, r.id);
      logAudit(db, req.user, target, r, 'assign');
    });

    res.status(201).json({ message: 'Đã gán vai trò thành công', roles: getRoles(db, target.id) });
  });

  // Thu hồi một vai trò (DNKN-70)
  app.delete('/api/users/:id/roles/:roleId', adminOnly, (req, res) => {
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
    if (!target) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

    const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(Number(req.params.roleId));
    if (!role) return res.status(404).json({ error: 'Không tìm thấy vai trò' });

    // Ràng buộc (DNKN-69): không được tự thu hồi vai trò quản trị của chính mình
    if (target.id === req.user.id && role.code === 'ADMIN') {
      return res.status(403).json({ error: 'Bạn không thể tự thu hồi vai trò quản trị của chính mình' });
    }
    // Bảo vệ bổ sung: không thể thu hồi vai trò quản trị của quản trị viên cuối cùng
    if (role.code === 'ADMIN' && isLastAdmin(db, target.id)) {
      return res.status(403).json({ error: 'Không thể thu hồi vai trò quản trị của quản trị viên cuối cùng' });
    }

    const existing = db.prepare('SELECT role_id FROM user_roles WHERE user_id = ? AND role_id = ?').get(target.id, role.id);
    if (!existing) return res.status(404).json({ error: 'Người dùng chưa có vai trò này' });

    db.prepare('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?').run(target.id, role.id);
    logAudit(db, req.user, target, role, 'revoke');
    res.json({ message: 'Đã thu hồi vai trò', roles: getRoles(db, target.id) });
  });

  // ================= NHẬT KÝ & THỐNG KÊ =================
  // Lịch sử gán / thu hồi vai trò
  app.get('/api/audit', adminOnly, (req, res) => {
    let sql = 'SELECT * FROM role_audit_log';
    const params = [];
    if (req.query.action === 'assign' || req.query.action === 'revoke') {
      sql += ' WHERE action = ?';
      params.push(req.query.action);
    }
    sql += ' ORDER BY id DESC LIMIT 200';
    res.json(db.prepare(sql).all(...params));
  });

  // Số liệu cho bảng điều khiển
  app.get('/api/stats', adminOnly, (req, res) => {
    const totalUsers = db.prepare('SELECT COUNT(*) c FROM users').get().c;
    const totalRoles = db.prepare('SELECT COUNT(*) c FROM roles').get().c;
    const totalAssignments = db.prepare('SELECT COUNT(*) c FROM user_roles').get().c;
    const admins = countAdmins(db);

    const roles = db.prepare('SELECT * FROM roles ORDER BY id').all();
    const counts = db.prepare('SELECT role_id, COUNT(*) c FROM user_roles GROUP BY role_id').all();
    const map = {};
    counts.forEach((x) => (map[x.role_id] = x.c));
    const rolesDistribution = roles.map((r) => ({ id: r.id, code: r.code, name: r.name, user_count: map[r.id] || 0 }));

    const recent = db.prepare('SELECT * FROM role_audit_log ORDER BY id DESC LIMIT 8').all();

    res.json({ totalUsers, totalRoles, totalAssignments, admins, rolesDistribution, recent });
  });

  return app;
}

module.exports = { createApp };

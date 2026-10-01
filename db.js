// Cơ sở dữ liệu SQLite (better-sqlite3 — chạy được trên Node 18+)
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

// Các vai trò của hệ thống
const ROLES = [
  { code: 'ADMIN', name: 'Quản trị hệ thống', description: 'Toàn quyền quản lý hệ thống và phân quyền người dùng', is_system: 1 },
  { code: 'GIANG_VIEN', name: 'Giảng viên', description: 'Quản lý khóa học, bài giảng và chấm điểm', is_system: 0 },
  { code: 'QUAN_LY_DAO_TAO', name: 'Quản lý đào tạo', description: 'Quản lý chương trình đào tạo và lịch học', is_system: 0 },
  { code: 'HOC_VIEN', name: 'Học viên', description: 'Tham gia khóa học và xem kết quả học tập', is_system: 0 },
];

// Người dùng mẫu (kèm danh sách vai trò) — "linh" vừa là giảng viên vừa là quản lý đào tạo
const USERS = [
  { username: 'admin', password: 'admin123', full_name: 'Trần Quản Trị', email: 'admin@dnkn.vn', roles: ['ADMIN'] },
  { username: 'giangvien', password: '123456', full_name: 'Nguyễn Giảng Viên', email: 'giangvien@dnkn.vn', roles: ['GIANG_VIEN'] },
  { username: 'quanly', password: '123456', full_name: 'Lê Quản Lý', email: 'quanly@dnkn.vn', roles: ['QUAN_LY_DAO_TAO'] },
  { username: 'linh', password: '123456', full_name: 'Phạm Thu Linh', email: 'linh@dnkn.vn', roles: ['GIANG_VIEN', 'QUAN_LY_DAO_TAO'] },
];

// Tạo kết nối + bảng (path = ':memory:' khi chạy kiểm thử)
function createDb(path = ':memory:') {
  const db = new Database(path);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      is_system INTEGER DEFAULT 0
    );

    -- Quan hệ nhiều - nhiều giữa người dùng và vai trò.
    -- Khóa chính ghép (user_id, role_id) đảm bảo KHÔNG trùng lặp dữ liệu (DNKN-68).
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, role_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );

    -- Nhật ký thao tác gán / thu hồi vai trò (lưu tên đầy đủ để giữ lịch sử)
    CREATE TABLE IF NOT EXISTS role_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER NOT NULL,
      actor_name TEXT,
      target_user_id INTEGER NOT NULL,
      target_name TEXT,
      role_code TEXT,
      role_name TEXT,
      action TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);
  return db;
}

// Nạp dữ liệu mẫu (chỉ khi bảng roles còn trống)
function seed(db) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM roles').get().c;
  if (count > 0) return;

  const insRole = db.prepare('INSERT INTO roles (code, name, description, is_system) VALUES (?,?,?,?)');
  ROLES.forEach((r) => insRole.run(r.code, r.name, r.description, r.is_system));

  const roleIdByCode = {};
  db.prepare('SELECT id, code FROM roles').all().forEach((r) => (roleIdByCode[r.code] = r.id));

  const insUser = db.prepare('INSERT INTO users (username, password, full_name, email) VALUES (?,?,?,?)');
  const insUserRole = db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?,?)');
  const userIdByUsername = {};

  USERS.forEach((u) => {
    const info = insUser.run(u.username, bcrypt.hashSync(u.password, 10), u.full_name, u.email);
    const userId = Number(info.lastInsertRowid);
    userIdByUsername[u.username] = userId;
    u.roles.forEach((code) => insUserRole.run(userId, roleIdByCode[code]));
  });

  // Một vài mục nhật ký mẫu để trang lịch sử / dashboard không trống
  const insAudit = db.prepare(
    'INSERT INTO role_audit_log (actor_user_id, actor_name, target_user_id, target_name, role_code, role_name, action) VALUES (?,?,?,?,?,?,?)'
  );
  const admin = userIdByUsername['admin'];
  insAudit.run(admin, 'Trần Quản Trị', userIdByUsername['linh'], 'Phạm Thu Linh', 'GIANG_VIEN', 'Giảng viên', 'assign');
  insAudit.run(admin, 'Trần Quản Trị', userIdByUsername['linh'], 'Phạm Thu Linh', 'QUAN_LY_DAO_TAO', 'Quản lý đào tạo', 'assign');
  insAudit.run(admin, 'Trần Quản Trị', userIdByUsername['quanly'], 'Lê Quản Lý', 'QUAN_LY_DAO_TAO', 'Quản lý đào tạo', 'assign');
}

module.exports = { createDb, seed, ROLES, USERS };

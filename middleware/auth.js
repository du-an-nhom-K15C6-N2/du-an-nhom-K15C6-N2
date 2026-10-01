// Xác thực bằng JWT + phân quyền.
// Điểm mấu chốt (DNKN-67): JWT chỉ chứa userId, KHÔNG nhúng vai trò.
// Vai trò được đọc MỚI từ DB ở mỗi request, nên thay đổi vai trò có hiệu lực
// ngay ở thao tác kế tiếp mà người dùng không cần đăng nhập lại.
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dnkn-jwt-secret-2026';
const JWT_EXPIRES_IN = '8h';

function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function makeAuth(db) {
  // Xác thực: giải mã token -> nạp user -> nạp danh sách vai trò MỚI từ DB
  function authenticate(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
    }

    const user = db.prepare('SELECT id, username, full_name, email FROM users WHERE id = ?').get(Number(payload.sub));
    if (!user) return res.status(401).json({ error: 'Người dùng không tồn tại' });

    const roleRows = db.prepare(`
      SELECT r.id, r.code, r.name
      FROM roles r
      JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = ?
      ORDER BY r.id
    `).all(user.id);

    req.user = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      roles: roleRows.map((r) => r.code), // danh sách mã vai trò (mới nhất)
    };
    req.roleDetails = roleRows; // chi tiết vai trò (id, code, name)
    next();
  }

  // Phân quyền: người dùng cần có ÍT NHẤT một trong các vai trò cho phép
  function authorize(...allowedCodes) {
    return (req, res, next) => {
      if (req.user.roles.some((r) => allowedCodes.includes(r))) return next();
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này' });
    };
  }

  return { authenticate, authorize };
}

module.exports = { makeAuth, signToken, JWT_SECRET };

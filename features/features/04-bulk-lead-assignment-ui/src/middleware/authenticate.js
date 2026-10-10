import jwt from "jsonwebtoken";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createAuthenticate({ secret, pool }) {
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  }

  return async (req, res, next) => {
    const authorization = req.header("authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ message: "Cần đăng nhập để thực hiện thao tác." });
    }

    let payload;
    try {
      payload = jwt.verify(match[1], secret, { algorithms: ["HS256"] });
    } catch {
      return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn." });
    }
    if (typeof payload === "string" || typeof payload.sub !== "string" || !UUID_PATTERN.test(payload.sub)) {
      return res.status(401).json({ message: "Token không hợp lệ." });
    }
    try {
      const result = await pool.query(
        `SELECT id, email, name, role
         FROM users
         WHERE id = $1 AND is_active = TRUE`,
        [payload.sub],
      );
      const user = result.rows[0];
      if (!user) {
        return res.status(401).json({ message: "Tài khoản không tồn tại hoặc đã bị vô hiệu hóa." });
      }
      req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

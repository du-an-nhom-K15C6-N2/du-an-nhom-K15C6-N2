import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export function createAuthRouter({ pool, jwtSecret }) {
  const router = Router();

  router.post("/login", async (req, res, next) => {
    try {
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (!email || !password) {
        return res.status(400).json({ message: "Email và mật khẩu là bắt buộc." });
      }

      const result = await pool.query(
        `SELECT id, email, name, role, password_hash
         FROM users
         WHERE LOWER(email) = $1 AND is_active = TRUE`,
        [email],
      );
      const user = result.rows[0];
      if (!user || !await bcrypt.compare(password, user.password_hash)) {
        return res.status(401).json({ message: "Email hoặc mật khẩu không chính xác." });
      }

      const accessToken = jwt.sign({ sub: user.id }, jwtSecret, {
        algorithm: "HS256",
        expiresIn: process.env.JWT_EXPIRES_IN || "8h",
      });
      return res.json({
        accessToken,
        tokenType: "Bearer",
        expiresIn: process.env.JWT_EXPIRES_IN || "8h",
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

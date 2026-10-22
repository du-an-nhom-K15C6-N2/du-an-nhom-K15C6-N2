import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

try {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "DNKN94 Admin";
  if (!email || !password || password.length < 12) {
    throw new Error("Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD (at least 12 characters).");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, role, name)
     VALUES ($1, $2, 'admin', $3)
     ON CONFLICT DO NOTHING
     RETURNING id, email, role`,
    [email, passwordHash, name],
  );
  if (!result.rows[0]) {
    throw new Error("An account with this email already exists; bootstrap never overwrites existing users.");
  }
  console.log(`Created initial admin ${result.rows[0].email} (${result.rows[0].id}).`);
} catch (error) {
  console.error("Admin bootstrap failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}

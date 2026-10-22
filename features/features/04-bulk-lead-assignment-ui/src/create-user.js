import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

try {
  const email = process.env.NEW_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.NEW_USER_PASSWORD;
  const name = process.env.NEW_USER_NAME?.trim();
  const role = process.env.NEW_USER_ROLE?.trim().toLowerCase();
  if (!email || !password || password.length < 12 || !name) {
    throw new Error("Set NEW_USER_EMAIL, NEW_USER_NAME, and NEW_USER_PASSWORD (at least 12 characters).");
  }
  if (!["consultant", "sales_manager", "training_manager"].includes(role)) {
    throw new Error("NEW_USER_ROLE must be consultant, sales_manager, or training_manager.");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, role, name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING
     RETURNING id, email, role`,
    [email, passwordHash, role, name],
  );
  if (!result.rows[0]) {
    throw new Error("A user with this email already exists; this command never overwrites existing users.");
  }
  console.log(`Created ${result.rows[0].role} ${result.rows[0].email} (${result.rows[0].id}).`);
} catch (error) {
  console.error("User creation failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}

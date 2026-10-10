import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";

const migrationPath = new URL("../migrations/002_create_crm_schema.sql", import.meta.url);

try {
  const migration = await readFile(fileURLToPath(migrationPath), "utf8");
  await pool.query(migration);
  console.log("CRM schema migration applied.");
} catch (error) {
  console.error("CRM schema migration failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}

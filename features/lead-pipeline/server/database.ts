import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Database as DatabaseType } from "better-sqlite3";

const defaultPath = resolve(dirname(fileURLToPath(import.meta.url)), "data", "leads.sqlite");

export function createDatabase(path = process.env.DATABASE_PATH ?? defaultPath): DatabaseType {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      course TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Mới', 'Đã liên hệ', 'Đang tư vấn', 'Hẹn học thử', 'Chốt', 'Từ chối')),
      next_call_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lead_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      from_status TEXT CHECK (from_status IS NULL OR from_status IN ('Mới', 'Đã liên hệ', 'Đang tư vấn', 'Hẹn học thử', 'Chốt', 'Từ chối')),
      to_status TEXT NOT NULL CHECK (to_status IN ('Mới', 'Đã liên hệ', 'Đang tư vấn', 'Hẹn học thử', 'Chốt', 'Từ chối')),
      reason TEXT,
      changed_at TEXT NOT NULL,
      changed_by TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_lead_history_lead_time ON lead_status_history(lead_id, changed_at DESC);
  `);
  seedDatabase(db);
  return db;
}

function seedDatabase(db: DatabaseType): void {
  const count = db.prepare("SELECT COUNT(*) AS count FROM leads").get() as { count: number };
  if (count.count > 0) return;

  const samples = [
    ["Nguyễn Minh Anh", "0901 234 567", "Tiếng Anh giao tiếp", "Facebook", "Mới", 0],
    ["Trần Gia Bảo", "0912 345 678", "IELTS 6.5+", "Website", "Mới", 1],
    ["Lê Khánh Linh", "0987 654 321", "Tiếng Anh thiếu nhi", "Hotline", "Đã liên hệ", 0],
    ["Phạm Đức Huy", "0934 567 890", "IELTS 6.5+", "Facebook", "Đang tư vấn", 0],
    ["Võ Ngọc Hà", "0965 432 109", "Tiếng Anh giao tiếp", "Giới thiệu", "Hẹn học thử", 1],
    ["Đặng Quốc An", "0978 123 456", "Tiếng Anh thiếu nhi", "Website", "Chốt", 0],
    ["Bùi Thảo Vy", "0908 765 432", "IELTS 6.5+", "Facebook", "Từ chối", null],
  ] as const;
  const now = new Date();
  const insert = db.prepare(
    `INSERT INTO leads (name, phone, course, source, status, next_call_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const seed = db.transaction(() => {
    for (const [name, phone, course, source, status, dueOffset] of samples) {
      const due = dueOffset === null ? null : new Date(now.getTime() + dueOffset * 60 * 60 * 1000).toISOString();
      insert.run(name, phone, course, source, status, due, now.toISOString());
    }
  });
  seed();
}

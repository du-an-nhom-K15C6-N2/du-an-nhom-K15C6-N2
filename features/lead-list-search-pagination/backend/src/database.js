const { DatabaseSync } = require('node:sqlite');
const { normalizePhone } = require('./phone-number');

function createDatabase(databasePath) {
  const db = new DatabaseSync(databasePath);

  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY,
      full_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      source TEXT,
      program TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  const columns = new Set(db.prepare('PRAGMA table_info(leads)').all().map((column) => column.name));
  for (const [name, definition] of [
    ['status', "TEXT NOT NULL DEFAULT 'Mới'"],
    ['note', "TEXT NOT NULL DEFAULT ''"],
    ['phone_normalized', 'TEXT'],
    ['updated_at', 'TEXT']
  ]) {
    if (!columns.has(name)) {
      db.exec(`ALTER TABLE leads ADD COLUMN ${name} ${definition}`);
    }
  }

  const updateLead = db.prepare(`
    UPDATE leads
    SET phone_normalized = ?, updated_at = COALESCE(updated_at, created_at)
    WHERE id = ?
  `);
  for (const lead of db.prepare('SELECT id, phone, phone_normalized, updated_at FROM leads').all()) {
    const normalizedPhone = lead.phone ? normalizePhone(lead.phone) : null;
    if (normalizedPhone !== lead.phone_normalized || !lead.updated_at) {
      updateLead.run(normalizedPhone, lead.id);
    }
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_leads_source ON leads (source);
    CREATE INDEX IF NOT EXISTS idx_leads_program ON leads (program);
    CREATE INDEX IF NOT EXISTS idx_leads_phone_normalized ON leads (phone_normalized);
  `);

  return db;
}

module.exports = { createDatabase };

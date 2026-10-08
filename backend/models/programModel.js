const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('../config/app.config');

let database;

function getDatabase() {
  if (!database) {
    const databaseFile = process.env.PROGRAMS_DB_FILE
      || path.resolve(__dirname, '../data/programs.sqlite');
    fs.mkdirSync(path.dirname(databaseFile), { recursive: true });
    database = new Database(databaseFile);
    database.exec(`
      CREATE TABLE IF NOT EXISTS programs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL COLLATE NOCASE UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        total_duration REAL NOT NULL DEFAULT 0,
        standard_tuition REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const columns = new Set(database.pragma('table_info(programs)').map(column => column.name));
    if (!columns.has('total_duration')) {
      database.exec('ALTER TABLE programs ADD COLUMN total_duration REAL NOT NULL DEFAULT 0');
    }
    if (!columns.has('standard_tuition')) {
      database.exec('ALTER TABLE programs ADD COLUMN standard_tuition REAL NOT NULL DEFAULT 0');
    }
    if (!columns.has('status')) {
      database.exec("ALTER TABLE programs ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
    }
    database.pragma('foreign_keys = ON');
    database.exec(`
      CREATE TABLE IF NOT EXISTS running_program_classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
        class_code TEXT NOT NULL COLLATE NOCASE UNIQUE,
        class_name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  return database;
}

class ProgramModel {
  static selectProgramFields() {
    return `id, code, name, description,
      total_duration AS totalDuration,
      standard_tuition AS standardTuition,
      status, created_at AS createdAt,
      (SELECT COUNT(*) FROM running_program_classes rpc WHERE rpc.program_id = programs.id)
        AS runningClassCount`;
  }

  static findAll({ page = 1, pageSize = config.DEFAULT_PAGE_SIZE, search = '', code = '' } = {}) {
    const filters = [];
    const params = [];

    if (search) {
      const escapedSearch = search.replace(/[\\%_]/g, '\\$&');
      filters.push("(code LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')");
      const searchPattern = `%${escapedSearch}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    if (code) {
      filters.push('code = ? COLLATE NOCASE');
      params.push(code);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const database = getDatabase();
    const total = database.prepare(`SELECT COUNT(*) AS total FROM programs ${whereClause}`)
      .get(...params).total;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const offset = (currentPage - 1) * pageSize;
    const data = database.prepare(`
      SELECT ${ProgramModel.selectProgramFields()}
      FROM programs ${whereClause}
      ORDER BY id
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    return {
      data,
      pagination: {
        currentPage,
        pageSize,
        totalRecords: total,
        totalPages,
        startIndex: total === 0 ? 0 : offset + 1,
        endIndex: Math.min(offset + pageSize, total)
      }
    };
  }

  static hasCode(code) {
    return Boolean(getDatabase()
      .prepare('SELECT 1 FROM programs WHERE code = ? COLLATE NOCASE')
      .get(code));
  }

  static findById(id) {
    return getDatabase()
      .prepare(`SELECT ${ProgramModel.selectProgramFields()} FROM programs WHERE id = ?`)
      .get(id) || null;
  }

  static create({
    code,
    name,
    description = '',
    totalDuration = 0,
    standardTuition = 0,
    status = 'active'
  }) {
    const result = getDatabase()
      .prepare(`
        INSERT INTO programs (code, name, description, total_duration, standard_tuition, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(code, name, description, totalDuration, standardTuition, status);
    return getDatabase()
      .prepare(`SELECT ${ProgramModel.selectProgramFields()} FROM programs WHERE id = ?`)
      .get(result.lastInsertRowid);
  }

  static update(id, {
    code,
    name,
    description = '',
    totalDuration = 0,
    standardTuition = 0,
    status = 'active'
  }) {
    const result = getDatabase()
      .prepare(`
        UPDATE programs
        SET code = ?, name = ?, description = ?, total_duration = ?, standard_tuition = ?, status = ?
        WHERE id = ?
      `)
      .run(code, name, description, totalDuration, standardTuition, status, id);
    return result.changes ? ProgramModel.findById(id) : null;
  }

  static addRunningClass(id, { classCode, className }) {
    const result = getDatabase()
      .prepare(`
        INSERT INTO running_program_classes (program_id, class_code, class_name)
        SELECT ?, ?, ? WHERE EXISTS (
          SELECT 1 FROM programs WHERE id = ? AND status = 'active'
        )
      `)
      .run(id, classCode, className, id);
    if (!result.changes) return null;
    return getDatabase()
      .prepare(`
        SELECT id, program_id AS programId, class_code AS classCode, class_name AS className,
          created_at AS createdAt
        FROM running_program_classes WHERE id = ?
      `)
      .get(result.lastInsertRowid);
  }

  static listRunningClasses(programId) {
    return getDatabase()
      .prepare(`
        SELECT id, program_id AS programId, class_code AS classCode, class_name AS className,
          created_at AS createdAt
        FROM running_program_classes WHERE program_id = ? ORDER BY id
      `)
      .all(programId);
  }

  static removeRunningClass(programId, classId) {
    return getDatabase()
      .prepare('DELETE FROM running_program_classes WHERE program_id = ? AND id = ?')
      .run(programId, classId).changes > 0;
  }

  static deleteOrDeactivate(id) {
    const database = getDatabase();
    return database.transaction(() => {
      const program = ProgramModel.findById(id);
      if (!program) return null;

      if (program.runningClassCount > 0) {
        database.prepare("UPDATE programs SET status = 'inactive' WHERE id = ?").run(id);
        return {
          deleted: false,
          runningClassCount: program.runningClassCount,
          program: ProgramModel.findById(id)
        };
      }

      database.prepare('DELETE FROM programs WHERE id = ?').run(id);
      return { deleted: true, runningClassCount: 0, program: null };
    }).immediate();
  }

  static close() {
    if (database) {
      database.close();
      database = undefined;
    }
  }
}

module.exports = ProgramModel;

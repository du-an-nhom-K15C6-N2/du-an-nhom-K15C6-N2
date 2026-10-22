/**
 * DNKN-257: Cấu trúc Audit Log cho ghi đè lịch học
 *
 * Ghi lại:
 * - Người xác nhận (actorId, actorName, actorRole)
 * - Thời điểm (timestamp ISO 8601)
 * - Lịch liên quan (scheduleId, scheduleData)
 * - Quyết định ghi đè (action, overrideReason, conflictsOverridden)
 *
 * Đảm bảo tính nhất quán giữa việc lưu lịch và ghi audit.
 */

const fs = require('node:fs');
const path = require('node:path');
const AUDIT_FILE_PATH = path.resolve(__dirname, '..', '..', 'data', 'schedule-audit.json');

function loadPersistedAuditLogs() {
  try {
    if (fs.existsSync(AUDIT_FILE_PATH)) {
      const raw = fs.readFileSync(AUDIT_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // fallback
  }
  return [];
}

function persistAuditLogs(logs) {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  try {
    fs.mkdirSync(path.dirname(AUDIT_FILE_PATH), { recursive: true });
    fs.writeFileSync(AUDIT_FILE_PATH, JSON.stringify(logs, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

class ScheduleAuditRepository {
  constructor() {
    this.logs = loadPersistedAuditLogs();
  }

  /**
   * Tạo bản ghi audit
   * @param {Object} entry
   * @returns {Object} audit entry đã lưu
   */
  async createAuditEntry(entry) {
    if (!entry || !entry.scheduleId) {
      throw new Error('Dữ liệu audit không hợp lệ: thiếu scheduleId.');
    }

    const auditRecord = {
      id: entry.id || `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      action: entry.action || 'SCHEDULE_OVERRIDE_CONFIRMED',
      scheduleId: String(entry.scheduleId),
      actorId: entry.actorId || 'system',
      actorName: entry.actorName || 'Người dùng hệ thống',
      actorRole: entry.actorRole || 'training_manager',
      timestamp: entry.timestamp || new Date().toISOString(),
      overrideReason: entry.overrideReason || '',
      conflictsOverridden: Array.isArray(entry.conflictsOverridden) ? entry.conflictsOverridden : [],
      scheduleData: entry.scheduleData ? { ...entry.scheduleData } : null
    };

    this.logs.unshift(auditRecord);
    persistAuditLogs(this.logs);
    return auditRecord;
  }

  /**
   * Lấy toàn bộ danh sách audit log
   * @param {Object} filter
   * @returns {Array<Object>}
   */
  async getAll(filter = {}) {
    let result = [...this.logs];
    if (filter.scheduleId) {
      result = result.filter(item => String(item.scheduleId) === String(filter.scheduleId));
    }
    if (filter.actorId) {
      result = result.filter(item => String(item.actorId) === String(filter.actorId));
    }
    return result;
  }

  /**
   * Lấy lịch sử theo scheduleId
   * @param {string} scheduleId
   * @returns {Array<Object>}
   */
  async getByScheduleId(scheduleId) {
    return this.logs.filter(item => String(item.scheduleId) === String(scheduleId));
  }

  /**
   * Xóa một bản ghi audit (dùng khi rollback nếu lưu lịch thất bại)
   * @param {string} auditId
   */
  async remove(auditId) {
    const index = this.logs.findIndex(item => item.id === auditId);
    if (index !== -1) {
      this.logs.splice(index, 1);
      persistAuditLogs(this.logs);
      return true;
    }
    return false;
  }

  /**
   * Dùng cho test isolation
   */
  clear() {
    this.logs = [];
    persistAuditLogs(this.logs);
  }
}

const scheduleAuditRepository = new ScheduleAuditRepository();

module.exports = {
  ScheduleAuditRepository,
  scheduleAuditRepository
};

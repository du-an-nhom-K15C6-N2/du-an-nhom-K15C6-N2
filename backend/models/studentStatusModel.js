const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config/app.config');

const STATUS_LABELS = {
  studying: 'Đang học',
  reserved: 'Bảo lưu',
  transferred: 'Đã chuyển lớp',
  dropped: 'Thôi học'
};

const ACTION_LABELS = {
  reserve: 'Bảo lưu',
  defer: 'Bảo lưu',
  transfer: 'Chuyển lớp',
  drop: 'Thôi học',
  withdraw: 'Thôi học'
};

class StudentStatusModel {
  constructor(dataFile = config.STUDENT_STATUS_DATA_FILE) {
    this.dataFile = dataFile;
  }

  readStore() {
    if (!fs.existsSync(this.dataFile)) {
      return { records: [], history: [] };
    }
    try {
      const store = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
      if (!store || !Array.isArray(store.records) || !Array.isArray(store.history)) {
        return { records: [], history: [] };
      }
      return store;
    } catch {
      return { records: [], history: [] };
    }
  }

  writeStore(store) {
    const directory = path.dirname(this.dataFile);
    fs.mkdirSync(directory, { recursive: true });
    const temporaryFile = `${this.dataFile}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporaryFile, JSON.stringify(store, null, 2), { mode: 0o600 });
      fs.renameSync(temporaryFile, this.dataFile);
    } finally {
      if (fs.existsSync(temporaryFile)) {
        try {
          fs.unlinkSync(temporaryFile);
        } catch {
          // Bỏ qua lỗi xóa file tạm
        }
      }
    }
  }

  /**
   * Tính toán trạng thái học viên theo ngày hiệu lực (asOfDate)
   */
  getEffectiveStatus(studentId, asOfDate = new Date().toISOString().slice(0, 10)) {
    const store = this.readStore();
    const studentHistory = store.history
      .filter(entry => String(entry.studentId) === String(studentId))
      .sort((a, b) => {
        const cmp = a.effectiveDate.localeCompare(b.effectiveDate);
        return cmp !== 0 ? cmp : (a.createdAt || '').localeCompare(b.createdAt || '');
      });

    // 1. Phân loại các thao tác trước/tại ngày hiệu lực và sau ngày hiệu lực
    const applicableHistory = studentHistory.filter(entry => entry.effectiveDate <= asOfDate);
    const pendingHistory = studentHistory.filter(entry => entry.effectiveDate > asOfDate);

    // 2. Mặc định: Đang học
    let academicStatus = 'studying';
    let statusLabel = STATUS_LABELS.studying;
    let isStudying = true;
    let currentClassId = null;
    let currentClassName = null;
    let currentClassCode = null;
    let effectiveDate = asOfDate;
    let reason = 'Đang theo học bình thường';
    let lastAction = null;

    // 3. Duyệt tuần tự các thao tác đã có hiệu lực để xác định trạng thái tại asOfDate
    for (const entry of applicableHistory) {
      lastAction = entry;
      effectiveDate = entry.effectiveDate;
      reason = entry.reason;

      const normalizedAction = (entry.actionType || '').toLowerCase();
      if (normalizedAction === 'reserve' || normalizedAction === 'defer') {
        academicStatus = 'reserved';
        statusLabel = STATUS_LABELS.reserved;
        isStudying = false;
      } else if (normalizedAction === 'drop' || normalizedAction === 'withdraw') {
        academicStatus = 'dropped';
        statusLabel = STATUS_LABELS.dropped;
        isStudying = false;
      } else if (normalizedAction === 'transfer') {
        academicStatus = 'studying';
        statusLabel = STATUS_LABELS.studying;
        isStudying = true;
        currentClassId = entry.toClassId;
        currentClassName = entry.toClassName;
        currentClassCode = entry.toClassCode;
      }
    }

    // 4. Nếu chưa có thao tác chuyển lớp nào trong history, lấy từ record hiện tại nếu có
    if (!currentClassId) {
      const record = store.records.find(r => String(r.studentId) === String(studentId));
      if (record?.currentClassId) {
        currentClassId = record.currentClassId;
        currentClassName = record.currentClassName;
        currentClassCode = record.currentClassCode;
      }
    }

    const nextPending = pendingHistory.length > 0 ? pendingHistory[0] : null;

    return {
      studentId: String(studentId),
      academicStatus,
      statusLabel,
      isStudying,
      currentClassId,
      currentClassName,
      currentClassCode,
      effectiveDate,
      reason,
      lastAction,
      pendingAction: nextPending
        ? {
            id: nextPending.id,
            actionType: nextPending.actionType,
            actionLabel: ACTION_LABELS[nextPending.actionType] || nextPending.actionType,
            effectiveDate: nextPending.effectiveDate,
            reason: nextPending.reason,
            toClassId: nextPending.toClassId,
            toClassName: nextPending.toClassName
          }
        : null
    };
  }

  /**
   * Xác định học viên có thuộc lớp cụ thể vào ngày chỉ định hay không
   * (Xử lý chuyển lớp theo ngày hiệu lực)
   */
  isStudentInClassOnDate(studentId, classIdentifier, targetDate = new Date().toISOString().slice(0, 10)) {
    const status = this.getEffectiveStatus(studentId, targetDate);
    if (!status.isStudying) {
      return false;
    }

    const store = this.readStore();
    const transfers = store.history
      .filter(entry => String(entry.studentId) === String(studentId) && entry.actionType === 'transfer')
      .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

    const idStr = String(classIdentifier).trim().toLowerCase();

    // Duyệt qua các mốc chuyển lớp để xem tại targetDate học viên ở lớp nào
    let assignedClassId = status.currentClassId;
    let assignedClassName = status.currentClassName;

    // Nếu có lịch sử chuyển lớp
    for (const transfer of transfers) {
      if (targetDate < transfer.effectiveDate) {
        // Trước ngày chuyển lớp: thuộc lớp cũ (fromClass)
        assignedClassId = transfer.fromClassId;
        assignedClassName = transfer.fromClassName;
        break;
      } else {
        // Từ ngày chuyển lớp trở đi: thuộc lớp mới (toClass)
        assignedClassId = transfer.toClassId;
        assignedClassName = transfer.toClassName;
      }
    }

    if (!assignedClassId && !assignedClassName) {
      return true; // Nếu chưa phân lớp cụ thể thì dựa vào enrollment chung
    }

    const matchId = assignedClassId && String(assignedClassId).trim().toLowerCase() === idStr;
    const matchName = assignedClassName && String(assignedClassName).trim().toLowerCase().includes(idStr);
    return Boolean(matchId || matchName);
  }

  /**
   * Ghi nhận thao tác vào lịch sử hồ sơ học viên và cập nhật trạng thái
   */
  recordAction(actionData) {
    const store = this.readStore();
    const actionId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const normalizedType = (actionData.actionType || '').toLowerCase();
    const actionLabel = ACTION_LABELS[normalizedType] || actionData.actionType;

    let appliedStatus = 'studying';
    if (normalizedType === 'reserve' || normalizedType === 'defer') {
      appliedStatus = 'reserved';
    } else if (normalizedType === 'drop' || normalizedType === 'withdraw') {
      appliedStatus = 'dropped';
    } else if (normalizedType === 'transfer') {
      appliedStatus = 'transferred';
    }

    const historyEntry = {
      id: actionId,
      studentId: String(actionData.studentId),
      studentName: actionData.studentName || '',
      studentEmail: actionData.studentEmail || '',
      actionType: normalizedType,
      actionLabel,
      appliedStatus,
      appliedStatusLabel: STATUS_LABELS[appliedStatus] || appliedStatus,
      effectiveDate: actionData.effectiveDate,
      reason: actionData.reason.trim(),
      fromClassId: actionData.fromClassId || null,
      fromClassName: actionData.fromClassName || null,
      fromClassCode: actionData.fromClassCode || null,
      toClassId: actionData.toClassId || null,
      toClassName: actionData.toClassName || null,
      toClassCode: actionData.toClassCode || null,
      createdAt: timestamp,
      createdBy: actionData.createdBy || 'system',
      createdByName: actionData.createdByName || 'Hệ thống',
      createdByRole: actionData.createdByRole || ''
    };

    // Cập nhật bảng records (trạng thái lưu trữ hiện tại)
    const existingIndex = store.records.findIndex(
      r => String(r.studentId) === String(actionData.studentId)
    );

    const recordData = {
      studentId: String(actionData.studentId),
      studentName: actionData.studentName || '',
      studentEmail: actionData.studentEmail || '',
      academicStatus: appliedStatus,
      statusLabel: STATUS_LABELS[appliedStatus] || appliedStatus,
      currentClassId: actionData.toClassId || actionData.fromClassId || null,
      currentClassName: actionData.toClassName || actionData.fromClassName || null,
      currentClassCode: actionData.toClassCode || actionData.fromClassCode || null,
      effectiveDate: actionData.effectiveDate,
      reason: actionData.reason.trim(),
      updatedAt: timestamp,
      updatedBy: actionData.createdBy || 'system',
      updatedByName: actionData.createdByName || 'Hệ thống'
    };

    if (existingIndex >= 0) {
      store.records[existingIndex] = {
        ...store.records[existingIndex],
        ...recordData
      };
    } else {
      store.records.push(recordData);
    }

    store.history.unshift(historyEntry);
    this.writeStore(store);

    return historyEntry;
  }

  /**
   * Lấy lịch sử thay đổi hồ sơ học viên
   */
  listHistory({ studentId, actionType, limit = 100 } = {}) {
    let history = this.readStore().history;

    if (studentId) {
      history = history.filter(item => String(item.studentId) === String(studentId));
    }
    if (actionType && actionType !== 'all') {
      const normalized = actionType.toLowerCase();
      history = history.filter(item => item.actionType === normalized);
    }

    return history
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
}

module.exports = StudentStatusModel;

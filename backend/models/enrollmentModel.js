const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config/app.config');

class EnrollmentModel {
  constructor(dataFile = process.env.ENROLLMENT_DATA_FILE || config.ENROLLMENT_DATA_FILE) {
    this.dataFile = dataFile;
  }

  readStore() {
    if (!fs.existsSync(this.dataFile)) {
      return { enrollments: [], history: [] };
    }

    const store = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
    if (
      !store
      || !Array.isArray(store.enrollments)
      || !Array.isArray(store.history)
    ) {
      throw new Error(`Dữ liệu ghi danh không hợp lệ: ${this.dataFile}`);
    }
    return store;
  }

  writeStore(store) {
    const directory = path.dirname(this.dataFile);
    fs.mkdirSync(directory, { recursive: true });
    const temporaryFile = `${this.dataFile}.${process.pid}.${crypto.randomUUID()}.tmp`;

    try {
      fs.writeFileSync(temporaryFile, JSON.stringify(store, null, 2), { mode: 0o600 });
      fs.renameSync(temporaryFile, this.dataFile);
    } finally {
      if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
    }
  }

  countStudentsInClass(classId) {
    return this.readStore().enrollments.filter(
      record => String(record.classId) === String(classId)
    ).length;
  }

  getCountsByClass() {
    return this.readStore().enrollments.reduce((counts, record) => {
      const classId = String(record.classId);
      counts.set(classId, (counts.get(classId) || 0) + 1);
      return counts;
    }, new Map());
  }

  isStudentEnrolled(classId, studentId) {
    return this.readStore().enrollments.some(record =>
      String(record.classId) === String(classId)
      && String(record.studentId) === String(studentId)
    );
  }

  createEnrollmentWithHistory(classId, studentId, history, maxStudents) {
    const store = this.readStore();
    const alreadyEnrolled = store.enrollments.some(record =>
      String(record.classId) === String(classId)
      && String(record.studentId) === String(studentId)
    );
    if (alreadyEnrolled) {
      const error = new Error('Học viên đã được ghi danh vào lớp này.');
      error.code = 'ALREADY_ENROLLED';
      throw error;
    }

    const classEnrollmentCount = store.enrollments.filter(
      record => String(record.classId) === String(classId)
    ).length;
    if (classEnrollmentCount >= maxStudents) {
      const error = new Error(`Lớp đã đạt sĩ số tối đa (${maxStudents} học viên).`);
      error.code = 'CLASS_FULL';
      throw error;
    }

    const enrollment = {
      id: crypto.randomUUID(),
      classId,
      studentId,
      enrolledAt: history.enrolledAt,
      createdBy: history.createdBy
    };
    const historyEntry = {
      ...history,
      classId,
      studentId
    };

    this.writeStore({
      enrollments: [...store.enrollments, enrollment],
      history: [...store.history, historyEntry]
    });
    return enrollment;
  }

  listHistory({ classId, limit = 100 } = {}) {
    let history = this.readStore().history;
    if (classId !== undefined) {
      history = history.filter(record => String(record.classId) === String(classId));
    }
    return history
      .slice()
      .sort((first, second) => second.enrolledAt.localeCompare(first.enrolledAt))
      .slice(0, limit);
  }
}

module.exports = EnrollmentModel;

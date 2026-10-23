const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config/app.config');

class EnrollmentModel {
  constructor(dataFile = config.ENROLLMENT_DATA_FILE) {
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

  getEnrollmentsByStudent(studentId) {
    return this.readStore().enrollments.filter(
      record => String(record.studentId) === String(studentId)
    );
  }

  findCurrentClassForStudent(studentId) {
    const list = this.readStore().enrollments.filter(
      record => String(record.studentId) === String(studentId) && record.status !== 'transferred'
    );
    if (!list.length) return null;
    return list[list.length - 1].classId;
  }

  transferEnrollment(studentId, fromClassId, toClassId, history, maxStudents) {
    const store = this.readStore();
    const alreadyEnrolledInTarget = store.enrollments.some(record =>
      String(record.classId) === String(toClassId)
      && String(record.studentId) === String(studentId)
      && record.status !== 'transferred'
    );
    if (alreadyEnrolledInTarget) {
      const error = new Error('Học viên đã được ghi danh vào lớp đích này.');
      error.code = 'ALREADY_ENROLLED';
      throw error;
    }

    const classEnrollmentCount = store.enrollments.filter(
      record => String(record.classId) === String(toClassId) && record.status !== 'transferred'
    ).length;
    if (classEnrollmentCount >= maxStudents) {
      const error = new Error(`Lớp đích đã đạt sĩ số tối đa (${maxStudents} học viên).`);
      error.code = 'CLASS_FULL';
      throw error;
    }

    const updatedEnrollments = store.enrollments.map(record => {
      if (
        String(record.studentId) === String(studentId)
        && (!fromClassId || String(record.classId) === String(fromClassId))
        && record.status !== 'transferred'
      ) {
        return {
          ...record,
          status: 'transferred',
          transferredAt: history.transferredAt || new Date().toISOString()
        };
      }
      return record;
    });

    const newEnrollment = {
      id: crypto.randomUUID(),
      classId: toClassId,
      studentId,
      enrolledAt: history.enrolledAt || new Date().toISOString(),
      createdBy: history.createdBy,
      status: 'active',
      previousClassId: fromClassId || null
    };

    const historyEntry = {
      ...history,
      action: 'transfer',
      classId: toClassId,
      fromClassId,
      toClassId,
      studentId
    };

    this.writeStore({
      enrollments: [...updatedEnrollments, newEnrollment],
      history: [...store.history, historyEntry]
    });
    return newEnrollment;
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

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config/app.config');
const UserModel = require('./userModel');

function readRecords() {
  if (!fs.existsSync(config.ATTENDANCE_DATA_FILE)) return [];
  const records = JSON.parse(fs.readFileSync(config.ATTENDANCE_DATA_FILE, 'utf8'));
  if (!Array.isArray(records)) {
    throw new Error(`Dữ liệu điểm danh không hợp lệ: ${config.ATTENDANCE_DATA_FILE}`);
  }
  return records;
}

function writeRecords(records) {
  const directory = path.dirname(config.ATTENDANCE_DATA_FILE);
  fs.mkdirSync(directory, { recursive: true });
  const temporaryFile = `${config.ATTENDANCE_DATA_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(records, null, 2), { mode: 0o600 });
  fs.renameSync(temporaryFile, config.ATTENDANCE_DATA_FILE);
}

class AttendanceModel {
  static listForUser(user) {
    const records = readRecords()
      .filter(record => UserModel.getRoles(user).includes('admin') || record.createdBy === user.id)
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
    return records.slice(0, 50);
  }

  static create(record) {
    const records = readRecords();
    const duplicate = records.find(existing =>
      existing.createdBy === record.createdBy
      && existing.className.toLowerCase() === record.className.toLowerCase()
      && existing.studentEmail === record.studentEmail
      && existing.attendanceDate === record.attendanceDate
    );
    if (duplicate) {
      const error = new Error('Học sinh này đã được điểm danh trong lớp vào ngày đã chọn.');
      error.statusCode = 409;
      throw error;
    }

    const created = {
      id: crypto.randomUUID(),
      ...record,
      createdAt: new Date().toISOString()
    };
    records.push(created);
    writeRecords(records);
    return created;
  }
}

module.exports = AttendanceModel;

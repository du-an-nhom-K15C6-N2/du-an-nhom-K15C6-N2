const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config/app.config');
const UserModel = require('./userModel');

function readRecords() {
  if (!fs.existsSync(config.TUITION_DATA_FILE)) return [];
  const records = JSON.parse(fs.readFileSync(config.TUITION_DATA_FILE, 'utf8'));
  if (!Array.isArray(records)) {
    throw new Error(`Dữ liệu học phí không hợp lệ: ${config.TUITION_DATA_FILE}`);
  }
  return records;
}

function writeRecords(records) {
  const directory = path.dirname(config.TUITION_DATA_FILE);
  fs.mkdirSync(directory, { recursive: true });
  const temporaryFile = `${config.TUITION_DATA_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(records, null, 2), { mode: 0o600 });
  fs.renameSync(temporaryFile, config.TUITION_DATA_FILE);
}

class TuitionModel {
  static listForUser(user) {
    const roles = UserModel.getRoles(user);
    const canViewAll = ['admin', 'accountant'].some(role =>
      roles.includes(role)
    );
    return readRecords()
      .filter(record => canViewAll || record.studentId === user.id)
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
  }

  static upsert(record) {
    const records = readRecords();
    const index = records.findIndex(existing =>
      existing.studentId === record.studentId
      && existing.academicYear === record.academicYear
    );
    const timestamp = new Date().toISOString();
    const savedRecord = {
      ...(index >= 0 ? records[index] : {}),
      ...record,
      id: index >= 0 ? records[index].id : crypto.randomUUID(),
      createdAt: index >= 0 ? records[index].createdAt : timestamp,
      updatedAt: timestamp
    };

    if (index >= 0) records[index] = savedRecord;
    else records.push(savedRecord);
    writeRecords(records);
    return savedRecord;
  }
}

module.exports = TuitionModel;

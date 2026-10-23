const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config/app.config');

const DATA_FILE = process.env.CLASSROOM_DATA_FILE
  || config.CLASSROOM_DATA_FILE
  || path.resolve(__dirname, '../data/classrooms.json');

function readRooms() {
  if (!fs.existsSync(DATA_FILE)) return [];
  const rooms = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!Array.isArray(rooms)) {
    throw new Error(`Dữ liệu phòng học không hợp lệ: ${DATA_FILE}`);
  }
  return rooms;
}

function writeRooms(rooms) {
  const directory = path.dirname(DATA_FILE);
  fs.mkdirSync(directory, { recursive: true });
  const temporaryFile = `${DATA_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryFile, JSON.stringify(rooms, null, 2), { mode: 0o600 });
    fs.renameSync(temporaryFile, DATA_FILE);
  } finally {
    if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
  }
}

class ClassroomModel {
  static list() {
    return readRooms().sort((first, second) => first.name.localeCompare(second.name, 'vi'));
  }

  static findById(id) {
    return readRooms().find(room => String(room.id) === String(id)) || null;
  }

  static create(room) {
    const rooms = readRooms();
    if (rooms.some(item => item.name.toLocaleLowerCase('vi') === room.name.toLocaleLowerCase('vi'))) {
      const error = new Error('Tên phòng học đã tồn tại.');
      error.code = 'ROOM_NAME_EXISTS';
      throw error;
    }
    const created = { id: crypto.randomUUID(), ...room, createdAt: new Date().toISOString() };
    writeRooms([...rooms, created]);
    return created;
  }

  static update(id, room) {
    const rooms = readRooms();
    const index = rooms.findIndex(item => String(item.id) === String(id));
    if (index === -1) {
      const error = new Error('Không tìm thấy phòng học.');
      error.code = 'ROOM_NOT_FOUND';
      throw error;
    }
    if (rooms.some(item => String(item.id) !== String(id)
      && item.name.toLocaleLowerCase('vi') === room.name.toLocaleLowerCase('vi'))) {
      const error = new Error('Tên phòng học đã tồn tại.');
      error.code = 'ROOM_NAME_EXISTS';
      throw error;
    }
    const updated = { ...rooms[index], ...room, updatedAt: new Date().toISOString() };
    rooms[index] = updated;
    writeRooms(rooms);
    return updated;
  }
}

module.exports = ClassroomModel;

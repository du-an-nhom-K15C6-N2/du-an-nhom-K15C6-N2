/**
 * DNKN-240: Model & Repository cho Quản lý Lịch học (Class Schedule Management)
 */

const { SHIFT_TIMES } = require('../services/scheduleConflictService');

const MASTER_CLASSES = [
  { id: 'K15C6-N1', name: 'K15 CNTT C6 - Nhóm 1', code: 'K15C6N1' },
  { id: 'K15C6-N2', name: 'K15 CNTT C6 - Nhóm 2', code: 'K15C6N2' },
  { id: 'K15C6-N3', name: 'K15 CNTT C6 - Nhóm 3', code: 'K15C6N3' },
  { id: 'K15KTPM-N1', name: 'K15 Kỹ thuật Phần mềm - N1', code: 'K15PM1' }
];

const MASTER_SUBJECTS = [
  { id: 'INT1340', name: 'Lập trình Web nâng cao', credits: 3 },
  { id: 'INT1330', name: 'Cơ sở dữ liệu nâng cao', credits: 3 },
  { id: 'INT1410', name: 'Kiểm thử phần mềm', credits: 2 },
  { id: 'INT1305', name: 'Cấu trúc dữ liệu và giải thuật', credits: 3 }
];

const MASTER_LECTURERS = [
  { id: 'GV01', name: 'TS. Nguyễn Văn An', email: 'an.nv@edu.vn', department: 'Công nghệ thông tin' },
  { id: 'GV02', name: 'ThS. Trần Thị Bình', email: 'binh.tt@edu.vn', department: 'Công nghệ thông tin' },
  { id: 'GV03', name: 'PGS.TS. Lê Hoàng Cường', email: 'cuong.lh@edu.vn', department: 'Hệ thống thông tin' },
  { id: 'GV04', name: 'ThS. Phạm Thu Dung', email: 'dung.pt@edu.vn', department: 'Kỹ thuật phần mềm' }
];

const MASTER_ROOMS = [
  { id: 'P301', name: 'Phòng 301 - Giảng đường A1', capacity: 60, type: 'Lý thuyết' },
  { id: 'P302', name: 'Phòng 302 - Giảng đường A1', capacity: 60, type: 'Lý thuyết' },
  { id: 'LAB01', name: 'Phòng máy Lab 01 - Nhà B2', capacity: 45, type: 'Thực hành' },
  { id: 'LAB02', name: 'Phòng máy Lab 02 - Nhà B2', capacity: 45, type: 'Thực hành' }
];

// Dữ liệu mẫu ban đầu
function createInitialSchedules() {
  return [
    {
      id: 'SCHED-101',
      classId: 'K15C6-N1',
      className: 'K15 CNTT C6 - Nhóm 1',
      subjectId: 'INT1340',
      subjectName: 'Lập trình Web nâng cao',
      lecturerId: 'GV01',
      lecturerName: 'TS. Nguyễn Văn An',
      roomId: 'P301',
      roomName: 'Phòng 301 - Giảng đường A1',
      date: '2026-10-26',
      shift: 'Ca 1',
      startTime: '07:00',
      endTime: '09:15',
      status: 'scheduled',
      note: 'Buổi 1: Giới thiệu kiến trúc hệ thống',
      createdAt: '2026-10-20T08:00:00.000Z',
      updatedAt: '2026-10-20T08:00:00.000Z'
    },
    {
      id: 'SCHED-102',
      classId: 'K15C6-N2',
      className: 'K15 CNTT C6 - Nhóm 2',
      subjectId: 'INT1330',
      subjectName: 'Cơ sở dữ liệu nâng cao',
      lecturerId: 'GV02',
      lecturerName: 'ThS. Trần Thị Bình',
      roomId: 'LAB01',
      roomName: 'Phòng máy Lab 01 - Nhà B2',
      date: '2026-10-26',
      shift: 'Ca 2',
      startTime: '09:30',
      endTime: '11:45',
      status: 'scheduled',
      note: 'Thực hành thiết kế CSDL',
      createdAt: '2026-10-20T08:30:00.000Z',
      updatedAt: '2026-10-20T08:30:00.000Z'
    },
    {
      id: 'SCHED-103',
      classId: 'K15C6-N3',
      className: 'K15 CNTT C6 - Nhóm 3',
      subjectId: 'INT1410',
      subjectName: 'Kiểm thử phần mềm',
      lecturerId: 'GV03',
      lecturerName: 'PGS.TS. Lê Hoàng Cường',
      roomId: 'P302',
      roomName: 'Phòng 302 - Giảng đường A1',
      date: '2026-10-26',
      shift: 'Ca 1',
      startTime: '07:00',
      endTime: '09:15',
      status: 'cancelled',
      note: 'Buổi học đã hủy do hội nghị khoa học',
      createdAt: '2026-10-20T09:00:00.000Z',
      updatedAt: '2026-10-21T10:00:00.000Z'
    }
  ];
}

const fs = require('node:fs');
const path = require('node:path');
const DATA_FILE_PATH = path.resolve(__dirname, '..', '..', 'data', 'schedules.json');

function loadPersistedSchedules() {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const raw = fs.readFileSync(DATA_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return createInitialSchedules();
}

function persistSchedules(list) {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  try {
    fs.mkdirSync(path.dirname(DATA_FILE_PATH), { recursive: true });
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(list, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

class ScheduleRepository {
  constructor() {
    this.schedules = loadPersistedSchedules();
  }

  async getAll(filter = {}) {
    let list = [...this.schedules];

    if (filter.classId) {
      list = list.filter(s => s.classId === filter.classId);
    }
    if (filter.lecturerId) {
      list = list.filter(s => s.lecturerId === filter.lecturerId);
    }
    if (filter.roomId) {
      list = list.filter(s => s.roomId === filter.roomId);
    }
    if (filter.date) {
      list = list.filter(s => s.date === filter.date);
    }
    if (filter.status) {
      list = list.filter(s => s.status === filter.status);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(s =>
        (s.className && s.className.toLowerCase().includes(q)) ||
        (s.subjectName && s.subjectName.toLowerCase().includes(q)) ||
        (s.lecturerName && s.lecturerName.toLowerCase().includes(q)) ||
        (s.roomName && s.roomName.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => {
      const dComp = (a.date || '').localeCompare(b.date || '');
      if (dComp !== 0) return dComp;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });
  }

  async getById(id) {
    if (!id) return null;
    return this.schedules.find(s => String(s.id) === String(id)) || null;
  }

  async create(data) {
    const id = data.id || `SCHED-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();

    const record = {
      id,
      classId: data.classId,
      className: data.className || data.classId,
      subjectId: data.subjectId,
      subjectName: data.subjectName || data.subjectId,
      lecturerId: data.lecturerId,
      lecturerName: data.lecturerName || data.lecturerId,
      roomId: data.roomId,
      roomName: data.roomName || data.roomId,
      date: data.date,
      shift: data.shift || null,
      startTime: data.startTime || (data.shift && SHIFT_TIMES[data.shift] ? SHIFT_TIMES[data.shift].startTime : ''),
      endTime: data.endTime || (data.shift && SHIFT_TIMES[data.shift] ? SHIFT_TIMES[data.shift].endTime : ''),
      status: data.status || 'scheduled',
      note: data.note || '',
      isOverridden: Boolean(data.isOverridden),
      overrideReason: data.overrideReason || null,
      overriddenBy: data.overriddenBy || null,
      overriddenAt: data.overriddenAt || null,
      createdAt: now,
      updatedAt: now
    };

    this.schedules.push(record);
    persistSchedules(this.schedules);
    return record;
  }

  async update(id, updateData) {
    const index = this.schedules.findIndex(s => String(s.id) === String(id));
    if (index === -1) {
      return null;
    }

    const current = this.schedules[index];
    const shift = updateData.shift !== undefined ? updateData.shift : current.shift;
    let startTime = updateData.startTime !== undefined ? updateData.startTime : current.startTime;
    let endTime = updateData.endTime !== undefined ? updateData.endTime : current.endTime;

    if (shift && SHIFT_TIMES[shift]) {
      if (!updateData.startTime) startTime = SHIFT_TIMES[shift].startTime;
      if (!updateData.endTime) endTime = SHIFT_TIMES[shift].endTime;
    }

    const updated = {
      ...current,
      ...updateData,
      id: current.id,
      shift,
      startTime,
      endTime,
      updatedAt: new Date().toISOString()
    };

    this.schedules[index] = updated;
    persistSchedules(this.schedules);
    return updated;
  }

  async cancel(id) {
    const schedule = await this.getById(id);
    if (!schedule) return null;
    return this.update(id, { status: 'cancelled' });
  }

  async delete(id) {
    const index = this.schedules.findIndex(s => String(s.id) === String(id));
    if (index === -1) return false;
    this.schedules.splice(index, 1);
    persistSchedules(this.schedules);
    return true;
  }

  resetToDefault(customList) {
    if (customList) {
      this.schedules = JSON.parse(JSON.stringify(customList));
    } else if (process.env.NODE_ENV === 'test') {
      this.schedules = createInitialSchedules();
    } else {
      this.schedules = loadPersistedSchedules();
    }
  }
}

const scheduleRepository = new ScheduleRepository();

module.exports = {
  MASTER_CLASSES,
  MASTER_SUBJECTS,
  MASTER_LECTURERS,
  MASTER_ROOMS,
  ScheduleRepository,
  scheduleRepository
};

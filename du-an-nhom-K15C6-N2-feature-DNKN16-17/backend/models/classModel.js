const fs = require('fs');
const path = require('path');
const UserModel = require('./userModel');

const DATA_FILE = path.resolve(__dirname, '../data/classes.json');

const INITIAL_CLASSES = [
  {
    id: 'cls_001',
    code: 'K15-CNTT01',
    name: 'Lập trình Web',
    room: 'A101',
    schedule: 'Thứ 2 • 07:30–09:30',
    teacherId: 'usr_026',
    status: 'active'
  },
  {
    id: 'cls_002',
    code: 'K15-CNTT02',
    name: 'Cơ sở dữ liệu',
    room: 'A203',
    schedule: 'Thứ 3 • 07:30–09:30',
    teacherId: 'usr_002',
    status: 'active'
  },
  {
    id: 'cls_003',
    code: 'K15-CNTT03',
    name: 'Phân tích & Thiết kế hệ thống',
    room: 'B102',
    schedule: 'Thứ 4 • 09:45–11:45',
    teacherId: 'usr_008',
    status: 'active'
  },
  {
    id: 'cls_004',
    code: 'K15-CNTT04',
    name: 'An toàn thông tin',
    room: 'B201',
    schedule: 'Thứ 5 • 07:30–09:30',
    teacherId: 'usr_012',
    status: 'active'
  },
  {
    id: 'cls_005',
    code: 'K15-CNTT05',
    name: 'Kiến trúc phần mềm',
    room: 'C105',
    schedule: 'Thứ 6 • 09:45–11:45',
    teacherId: 'usr_021',
    status: 'active'
  },
  {
    id: 'cls_006',
    code: 'K15-CNTT06',
    name: 'Kiểm thử phần mềm',
    room: 'C202',
    schedule: 'Thứ 7 • 07:30–09:30',
    teacherId: 'usr_027',
    status: 'active'
  },
  {
    id: 'cls_007',
    code: 'K15-CNTT07',
    name: 'Mạng máy tính',
    room: 'D101',
    schedule: 'Thứ 2 • 09:45–11:45',
    teacherId: 'usr_022',
    status: 'active'
  },
  {
    id: 'cls_008',
    code: 'K15-CNTT08',
    name: 'Phát triển ứng dụng',
    room: 'D203',
    schedule: 'Thứ 4 • 13:30–15:30',
    teacherId: 'usr_023',
    status: 'active'
  }
];

function ensureStore() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_CLASSES, null, 2), 'utf8');
  }
}

function readClasses() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (error) {
    console.error('Lỗi đọc dữ liệu lớp học:', error);
    return [...INITIAL_CLASSES];
  }
}

function writeClasses(classes) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(classes, null, 2), 'utf8');
}

function enrichClass(item) {
  const teacher = UserModel.findById(item.teacherId);
  const teacherRoles = UserModel.getRoles(teacher);
  const teacherIsLocked = Boolean(
    teacher
    && teacherRoles.includes('teacher')
    && teacher.status === 'locked'
  );

  return {
    ...item,
    teacherId: teacher?.id || item.teacherId || null,
    teacherName: teacher?.name || 'Chưa phân công',
    teacherEmail: teacher?.email || '',
    teacherStatus: teacher?.status || 'missing',
    teacherStatusLabel: teacher?.statusLabel || 'Không xác định',
    teacherLockReason: teacher?.lockReason || null,
    needsHandover: teacherIsLocked
  };
}

class ClassModel {
  static list() {
    return readClasses().map(enrichClass);
  }

  static listHandoverAlerts() {
    return this.list().filter(item => item.needsHandover);
  }

  static getAvailableTeachers() {
    return UserModel.getAllRaw()
      .filter(user => UserModel.getRoles(user).includes('teacher') && user.status === 'active')
      .map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        roleLabel: user.roleLabel
      }));
  }

  static handover(id, newTeacherId, handoverBy = null) {
    const classes = readClasses();
    const index = classes.findIndex(item => item.id === id);
    if (index === -1) throw new Error('Không tìm thấy lớp học cần bàn giao.');

    const targetTeacher = UserModel.findById(newTeacherId);
    if (!targetTeacher || !UserModel.getRoles(targetTeacher).includes('teacher')) {
      throw new Error('Giảng viên nhận bàn giao không tồn tại hoặc không có vai trò giảng viên.');
    }
    if (targetTeacher.status !== 'active') {
      throw new Error('Chỉ có thể bàn giao cho giảng viên đang hoạt động.');
    }
    if (classes[index].teacherId === newTeacherId) {
      throw new Error('Giảng viên nhận bàn giao phải khác giảng viên hiện tại.');
    }

    const previousTeacherId = classes[index].teacherId || null;
    classes[index] = {
      ...classes[index],
      teacherId: newTeacherId,
      handoverAt: new Date().toISOString(),
      handoverBy: handoverBy?.id || null,
      handoverByName: handoverBy?.name || null,
      previousTeacherId
    };

    writeClasses(classes);
    return enrichClass(classes[index]);
  }
}

ensureStore();
module.exports = ClassModel;

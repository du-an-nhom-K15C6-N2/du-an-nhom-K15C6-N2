const fs = require('fs');
const path = require('path');
const UserModel = require('./userModel');
const EnrollmentModel = require('./enrollmentModel');
const ClassroomModel = require('./classroomModel');
const TrainingProgramRepository = require('../repositories/trainingProgramRepository');
const config = require('../config/app.config');

const DATA_FILE = process.env.CLASS_DATA_FILE || config.CLASS_DATA_FILE || path.resolve(__dirname, '../data/classes.json');
const DEFAULT_CLASS_CAPACITY = 30;
const enrollmentModel = new EnrollmentModel();

const INITIAL_CLASSES = [
  {
    id: 'cls_001',
    code: 'K15-CNTT01',
    name: 'Lập trình Web',
    room: 'A101',
    schedule: 'Thứ 2 • 07:30–09:30',
    teacherId: 'usr_026',
    status: 'active',
    trainingProgramId: 'tp_cntt_01',
    startDate: '2026-09-01',
    endDate: '2026-12-20',
    maxStudents: 30,
    completedLessons: 12,
    totalLessons: 24
  },
  {
    id: 'cls_002',
    code: 'K15-CNTT02',
    name: 'Cơ sở dữ liệu',
    room: 'A203',
    schedule: 'Thứ 3 • 07:30–09:30',
    teacherId: 'usr_002',
    status: 'active',
    trainingProgramId: 'tp_cntt_01',
    startDate: '2026-09-01',
    endDate: '2026-12-20',
    maxStudents: 30,
    completedLessons: 10,
    totalLessons: 24
  },
  {
    id: 'cls_003',
    code: 'K15-CNTT03',
    name: 'Phân tích & Thiết kế hệ thống',
    room: 'B102',
    schedule: 'Thứ 4 • 09:45–11:45',
    teacherId: 'usr_008',
    status: 'active',
    trainingProgramId: 'tp_data_02',
    startDate: '2026-09-08',
    endDate: '2026-12-27',
    maxStudents: 25,
    completedLessons: 8,
    totalLessons: 20
  },
  {
    id: 'cls_004',
    code: 'K15-CNTT04',
    name: 'An toàn thông tin',
    room: 'B201',
    schedule: 'Thứ 5 • 07:30–09:30',
    teacherId: 'usr_012',
    status: 'active',
    trainingProgramId: 'tp_cntt_01',
    startDate: '2026-10-01',
    endDate: '2027-01-20',
    maxStudents: 30,
    completedLessons: 4,
    totalLessons: 24
  },
  {
    id: 'cls_005',
    code: 'K15-CNTT05',
    name: 'Kiến trúc phần mềm',
    room: 'C105',
    schedule: 'Thứ 6 • 09:45–11:45',
    teacherId: 'usr_021',
    status: 'active',
    trainingProgramId: 'tp_cntt_01',
    startDate: '2026-08-20',
    endDate: '2026-11-30',
    maxStudents: 28,
    completedLessons: 14,
    totalLessons: 24
  },
  {
    id: 'cls_006',
    code: 'K15-CNTT06',
    name: 'Kiểm thử phần mềm',
    room: 'C202',
    schedule: 'Thứ 7 • 07:30–09:30',
    teacherId: 'usr_027',
    status: 'active',
    trainingProgramId: 'tp_cntt_01',
    startDate: '2026-10-15',
    endDate: '2027-02-15',
    maxStudents: 30,
    completedLessons: 2,
    totalLessons: 24
  },
  {
    id: 'cls_007',
    code: 'K15-CNTT07',
    name: 'Mạng máy tính',
    room: 'D101',
    schedule: 'Thứ 2 • 09:45–11:45',
    teacherId: 'usr_022',
    status: 'active',
    trainingProgramId: 'tp_cntt_01',
    startDate: '2026-09-15',
    endDate: '2027-01-15',
    maxStudents: 32,
    completedLessons: 6,
    totalLessons: 24
  },
  {
    id: 'cls_008',
    code: 'K15-CNTT08',
    name: 'Phát triển ứng dụng',
    room: 'D203',
    schedule: 'Thứ 4 • 13:30–15:30',
    teacherId: 'usr_023',
    status: 'active',
    trainingProgramId: 'tp_cntt_01',
    startDate: '2026-10-01',
    endDate: '2027-01-20',
    maxStudents: 30,
    completedLessons: 5,
    totalLessons: 24
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

function enrichClass(item, programNames = new Map(), enrollmentCounts = new Map(), roomsById = new Map()) {
  const teacher = UserModel.findById(item.teacherId);
  const teacherRoles = UserModel.getRoles(teacher);
  const teacherIsLocked = Boolean(
    teacher
    && teacherRoles.includes('teacher')
    && teacher.status === 'locked'
  );
  const trainingProgramId = item.trainingProgramId || item.programId || item.training_program_id || null;
  const completedLessons = Number.isSafeInteger(item.completedLessons) && item.completedLessons >= 0
    ? item.completedLessons
    : 0;
  const totalLessons = Number.isSafeInteger(item.totalLessons) && item.totalLessons >= 0
    ? item.totalLessons
    : 0;
  const maxStudents = Number.isSafeInteger(item.maxStudents) && item.maxStudents > 0
    ? item.maxStudents
    : DEFAULT_CLASS_CAPACITY;
  const currentStudents = enrollmentCounts.get(String(item.id)) || 0;
  const room = item.roomId ? roomsById.get(String(item.roomId)) || null : null;
  const roomIssue = !item.roomId
    ? 'NO_ROOM'
    : !room
      ? 'ROOM_NOT_FOUND'
      : room.type === 'physical' && Math.max(maxStudents, currentStudents) > room.capacity
        ? 'ROOM_CAPACITY_EXCEEDED'
        : null;
  const roomWarning = roomIssue === 'NO_ROOM'
    ? 'Lớp chưa được phân công phòng học.'
    : roomIssue === 'ROOM_NOT_FOUND'
      ? 'Phòng được liên kết không còn tồn tại.'
      : roomIssue === 'ROOM_CAPACITY_EXCEEDED'
        ? `Sức chứa phòng (${room.capacity}) thấp hơn sĩ số tối đa của lớp (${maxStudents}).`
        : null;

  return {
    ...item,
    trainingProgramId,
    trainingProgramName: trainingProgramId
      ? programNames.get(String(trainingProgramId)) || 'Chương trình không xác định'
      : 'Chưa gán chương trình',
    teacherId: teacher?.id || item.teacherId || null,
    teacherName: teacher?.name || 'Chưa phân công',
    teacherEmail: teacher?.email || '',
    teacherStatus: teacher?.status || 'missing',
    teacherStatusLabel: teacher?.statusLabel || 'Không xác định',
    teacherLockReason: teacher?.lockReason || null,
    needsHandover: teacherIsLocked,
    currentStudents,
    maxStudents,
    roomId: room?.id || item.roomId || null,
    roomName: room?.name || item.room || null,
    roomType: room?.type || null,
    roomCapacity: room?.capacity ?? null,
    roomMeetingUrl: room?.meetingUrl || null,
    roomIssue,
    roomWarning,
    completedLessons,
    totalLessons,
    lessonProgressPercent: totalLessons
      ? Math.min(100, Math.round((completedLessons / totalLessons) * 100))
      : 0
  };
}

class ClassModel {
  static list(filters = {}) {
    const programs = TrainingProgramRepository.findAll();
    const programNames = new Map(programs.map(program => [String(program.id), program.name]));
    const enrollmentCounts = enrollmentModel.getCountsByClass();
    const roomsById = new Map(ClassroomModel.list().map(room => [String(room.id), room]));
    let classes = readClasses().map(item => enrichClass(item, programNames, enrollmentCounts, roomsById));

    if (filters.status) {
      classes = classes.filter(item => item.status === filters.status);
    }
    if (filters.programId) {
      classes = classes.filter(item => filters.programId === 'unassigned'
        ? !item.trainingProgramId
        : String(item.trainingProgramId || '') === filters.programId);
    }
    if (filters.teacherId) {
      classes = classes.filter(item => filters.teacherId === 'unassigned'
        ? !item.teacherId
        : String(item.teacherId || '') === filters.teacherId);
    }
    if (filters.startDate || filters.endDate) {
      classes = classes.filter(item => {
        if (!item.startDate && !item.endDate) return false;
        const classStart = item.startDate || item.endDate;
        const classEnd = item.endDate || item.startDate;
        return (!filters.startDate || classEnd >= filters.startDate)
          && (!filters.endDate || classStart <= filters.endDate);
      });
    }

    return classes;
  }

  static getFilterOptions() {
    const classes = this.list();
    const programs = TrainingProgramRepository.findAll()
      .map(program => ({ id: String(program.id), name: program.name }));
    if (classes.some(item => !item.trainingProgramId)) {
      programs.push({ id: 'unassigned', name: 'Chưa gán chương trình' });
    }

    const teachersById = new Map();
    for (const item of classes) {
      if (item.teacherId && !teachersById.has(String(item.teacherId))) {
        teachersById.set(String(item.teacherId), {
          id: String(item.teacherId),
          name: item.teacherName
        });
      }
    }

    if (classes.some(item => !item.teacherId)) {
      teachersById.set('unassigned', { id: 'unassigned', name: 'Chưa phân công' });
    }

    return {
      programs,
      teachers: [...teachersById.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    };
  }

  static listHandoverAlerts() {
    return this.list().filter(item => item.needsHandover);
  }

  static listRoomAlerts() {
    return this.list().filter(item =>
      ['active', 'planned'].includes(item.status) && item.roomWarning
    );
  }

  static assignRoom(id, roomId) {
    const classes = readClasses();
    const index = classes.findIndex(item => String(item.id) === String(id));
    if (index === -1) {
      const error = new Error('Không tìm thấy lớp học.');
      error.code = 'CLASS_NOT_FOUND';
      throw error;
    }

    let room = null;
    if (roomId !== null) {
      room = ClassroomModel.findById(roomId);
      if (!room) {
        const error = new Error('Không tìm thấy phòng học được chọn.');
        error.code = 'ROOM_NOT_FOUND';
        throw error;
      }
      if (room.type === 'physical') {
        const classSize = Number.isSafeInteger(classes[index].maxStudents) && classes[index].maxStudents > 0
          ? classes[index].maxStudents
          : DEFAULT_CLASS_CAPACITY;
        const currentStudents = enrollmentModel.countStudentsInClass(id);
        if (Math.max(classSize, currentStudents) > room.capacity) {
          const error = new Error(
            `Lớp cần tối đa ${classSize} chỗ nhưng phòng chỉ có ${room.capacity} chỗ.`
          );
          error.code = 'ROOM_CAPACITY_EXCEEDED';
          throw error;
        }
      }
    }

    classes[index] = {
      ...classes[index],
      roomId: room?.id || null,
      room: room?.name || null
    };
    writeClasses(classes);
    return this.list().find(item => String(item.id) === String(id));
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
    return this.list().find(item => item.id === id);
  }
}

ensureStore();
module.exports = ClassModel;

const fs = require('fs');
const path = require('path');
const configPath = path.resolve(__dirname, '../config/app.config.js');
const config = fs.existsSync(configPath) ? require(configPath) : {};

const DATA_FILE = process.env.TIMETABLE_DATA_FILE
  || config.TIMETABLE_DATA_FILE
  || path.resolve(__dirname, '../data/timetable.json');

const STANDARD_SHIFTS = [
  { id: 'shift_1', name: 'Ca 1 (Sáng)', startTime: '07:30', endTime: '09:30' },
  { id: 'shift_2', name: 'Ca 2 (Sáng)', startTime: '09:45', endTime: '11:45' },
  { id: 'shift_3', name: 'Ca 3 (Chiều)', startTime: '13:30', endTime: '15:30' },
  { id: 'shift_4', name: 'Ca 4 (Chiều)', startTime: '15:45', endTime: '17:45' }
];

function readTimetable() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Lỗi khi đọc file thời khóa biểu:', error);
    return [];
  }
}

function writeTimetable(data) {
  const dir = path.dirname(DATA_FILE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Kiểm tra xem 2 khoảng thời gian có bị giao nhau (overlap) không
 */
function isTimeOverlapping(start1, end1, start2, end2) {
  return start1 < end2 && end1 > start2;
}

/**
 * Chuyển đổi Date sang YYYY-MM-DD
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Lấy khoảng ngày bắt đầu và kết thúc của tuần (Thứ 2 đến Chủ nhật)
 */
function getWeekRange(dateString) {
  const date = dateString ? new Date(dateString) : new Date();
  if (isNaN(date.getTime())) {
    throw new Error('Định dạng ngày không hợp lệ. Vui lòng dùng YYYY-MM-DD.');
  }

  const dayOfWeek = date.getDay(); // 0 is Sunday, 1 is Monday...
  const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(date);
  monday.setDate(date.getDate() + distanceToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    startDate: formatDate(monday),
    endDate: formatDate(sunday),
    monday,
    sunday
  };
}

/**
 * Lấy khoảng ngày bắt đầu và kết thúc của tháng
 */
function getMonthRange(dateString) {
  const date = dateString ? new Date(dateString) : new Date();
  if (isNaN(date.getTime())) {
    throw new Error('Định dạng ngày không hợp lệ. Vui lòng dùng YYYY-MM-DD.');
  }

  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  return {
    startDate: formatDate(firstDay),
    endDate: formatDate(lastDay),
    year: date.getFullYear(),
    month: date.getMonth() + 1
  };
}

/**
 * Phát hiện các xung đột / chồng chéo giữa các buổi học
 */
function detectConflicts(sessions) {
  const conflictMap = new Map();
  const allConflicts = [];

  for (let i = 0; i < sessions.length; i++) {
    const s1 = sessions[i];

    for (let j = i + 1; j < sessions.length; j++) {
      const s2 = sessions[j];

      // Chỉ so sánh nếu cùng ngày
      if (s1.date !== s2.date) continue;

      // Kiểm tra có giao nhau về thời gian không
      if (!isTimeOverlapping(s1.startTime, s1.endTime, s2.startTime, s2.endTime)) continue;

      // 1. Trùng phòng học
      if (s1.room && s2.room && s1.room.trim().toLowerCase() === s2.room.trim().toLowerCase()) {
        const conflict1 = {
          type: 'room',
          severity: 'danger',
          message: `Trùng phòng học [${s1.room}] với lớp [${s2.classCode || s2.className}] lúc ${s2.startTime}-${s2.endTime}`,
          conflictingSessionId: s2.id,
          date: s1.date
        };
        const conflict2 = {
          type: 'room',
          severity: 'danger',
          message: `Trùng phòng học [${s2.room}] với lớp [${s1.classCode || s1.className}] lúc ${s1.startTime}-${s1.endTime}`,
          conflictingSessionId: s1.id,
          date: s2.date
        };

        if (!conflictMap.has(s1.id)) conflictMap.set(s1.id, []);
        if (!conflictMap.has(s2.id)) conflictMap.set(s2.id, []);
        conflictMap.get(s1.id).push(conflict1);
        conflictMap.get(s2.id).push(conflict2);

        allConflicts.push({
          type: 'room',
          date: s1.date,
          time: `${s1.startTime}-${s1.endTime}`,
          room: s1.room,
          sessions: [s1, s2],
          description: `Phòng ${s1.room} bị xếp trùng cho 2 lớp [${s1.classCode}] và [${s2.classCode}]`
        });
      }

      // 2. Trùng giảng viên
      if (s1.teacherId && s2.teacherId && s1.teacherId === s2.teacherId && s1.id !== s2.id) {
        const conflict1 = {
          type: 'teacher',
          severity: 'warning',
          message: `Giảng viên [${s1.teacherName}] bị trùng giờ với lớp [${s2.classCode || s2.className}] tại phòng ${s2.room}`,
          conflictingSessionId: s2.id,
          date: s1.date
        };
        const conflict2 = {
          type: 'teacher',
          severity: 'warning',
          message: `Giảng viên [${s2.teacherName}] bị trùng giờ với lớp [${s1.classCode || s1.className}] tại phòng ${s1.room}`,
          conflictingSessionId: s1.id,
          date: s2.date
        };

        if (!conflictMap.has(s1.id)) conflictMap.set(s1.id, []);
        if (!conflictMap.has(s2.id)) conflictMap.set(s2.id, []);
        conflictMap.get(s1.id).push(conflict1);
        conflictMap.get(s2.id).push(conflict2);

        allConflicts.push({
          type: 'teacher',
          date: s1.date,
          time: `${s1.startTime}-${s1.endTime}`,
          teacherName: s1.teacherName,
          sessions: [s1, s2],
          description: `Giảng viên ${s1.teacherName} bị trùng lịch giữa 2 lớp [${s1.classCode}] và [${s2.classCode}]`
        });
      }
    }
  }

  return { conflictMap, allConflicts };
}

/**
 * Phát hiện khoảng trống (Gaps) trong tuần để Quản lý đào tạo phát hiện ngay slot trống
 */
function detectGaps(sessions, weekStartDate, rooms) {
  const gaps = [];
  const start = new Date(weekStartDate);

  // Duyệt qua 6 ngày làm việc (Thứ 2 đến Thứ 7)
  for (let i = 0; i < 6; i++) {
    const curDate = new Date(start);
    curDate.setDate(start.getDate() + i);
    const dateStr = formatDate(curDate);
    const dayOfWeek = curDate.getDay() === 0 ? 8 : curDate.getDay() + 1; // 2=T2 ... 7=T7

    const sessionsOnDate = sessions.filter(s => s.date === dateStr);

    for (const shift of STANDARD_SHIFTS) {
      // Tìm xem phòng nào còn trống ở ca này
      for (const room of rooms) {
        const isOccupied = sessionsOnDate.some(s =>
          s.room && s.room.toLowerCase() === room.toLowerCase() &&
          isTimeOverlapping(s.startTime, s.endTime, shift.startTime, shift.endTime)
        );

        if (!isOccupied) {
          gaps.push({
            date: dateStr,
            dayOfWeek,
            shiftName: shift.name,
            startTime: shift.startTime,
            endTime: shift.endTime,
            room: room,
            status: 'available',
            message: `Phòng ${room} còn trống ${shift.name} (${shift.startTime} - ${shift.endTime})`
          });
        }
      }
    }
  }

  return gaps;
}

class TimetableModel {
  static getStandardShifts() {
    return STANDARD_SHIFTS;
  }

  /**
   * Lấy dữ liệu thời khóa biểu theo tuần hoặc tháng có kèm bộ lọc
   */
  static getSchedule(options = {}) {
    const view = options.view === 'month' ? 'month' : 'week';
    const rawDate = options.date || formatDate(new Date());

    let range;
    if (view === 'month') {
      range = getMonthRange(rawDate);
    } else {
      range = getWeekRange(rawDate);
    }

    const allSessions = readTimetable();

    // 1. Thu thập danh sách bộ lọc trước khi lọc
    const classesMap = new Map();
    const teachersMap = new Map();
    const roomsSet = new Set();

    for (const s of allSessions) {
      if (s.classId) classesMap.set(s.classId, { id: s.classId, code: s.classCode, name: s.className });
      if (s.teacherId) teachersMap.set(s.teacherId, { id: s.teacherId, name: s.teacherName });
      if (s.room) roomsSet.add(s.room);
    }

    const availableFilters = {
      classes: Array.from(classesMap.values()),
      teachers: Array.from(teachersMap.values()),
      rooms: Array.from(roomsSet).sort()
    };

    // 2. Lấy các session nằm trong khoảng ngày
    let periodSessions = allSessions.filter(s => s.date >= range.startDate && s.date <= range.endDate);

    // 3. Phát hiện điểm chồng chéo (xung đột) TRƯỚC KHI áp dụng filter
    // để Quản lý đào tạo luôn thấy cảnh báo tổng thể chính xác
    const { conflictMap, allConflicts } = detectConflicts(periodSessions);

    // Gắn thông tin xung đột vào từng session
    const sessionsWithConflicts = periodSessions.map(s => {
      const conflicts = conflictMap.get(s.id) || [];
      return {
        ...s,
        hasConflict: conflicts.length > 0,
        conflicts
      };
    });

    // 4. Áp dụng bộ lọc (Lớp, Giảng viên, Phòng)
    let filteredSessions = sessionsWithConflicts;
    if (options.classId) {
      filteredSessions = filteredSessions.filter(s => s.classId === options.classId);
    }
    if (options.teacherId) {
      filteredSessions = filteredSessions.filter(s => s.teacherId === options.teacherId);
    }
    if (options.room) {
      filteredSessions = filteredSessions.filter(s => s.room && s.room.toLowerCase() === options.room.toLowerCase());
    }

    // 5. Tính toán khoảng trống (Gaps) nếu ở chế độ xem tuần
    let gaps = [];
    if (view === 'week') {
      const filterRooms = options.room ? [options.room] : availableFilters.rooms.slice(0, 5);
      gaps = detectGaps(periodSessions, range.startDate, filterRooms);
    }

    return {
      view,
      targetDate: rawDate,
      range: {
        startDate: range.startDate,
        endDate: range.endDate,
        ...(view === 'month' ? { year: range.year, month: range.month } : {})
      },
      stats: {
        totalSessions: filteredSessions.length,
        totalConflicts: allConflicts.length,
        totalGaps: gaps.length
      },
      sessions: filteredSessions,
      conflicts: allConflicts,
      gaps,
      filters: availableFilters,
      shifts: STANDARD_SHIFTS
    };
  }

  /**
   * Lấy chi tiết buổi học theo ID
   */
  static findById(id) {
    const all = readTimetable();
    const session = all.find(s => String(s.id) === String(id));
    if (!session) return null;

    // Kiểm tra xung đột cho session này
    const sameDateSessions = all.filter(s => s.date === session.date);
    const { conflictMap } = detectConflicts(sameDateSessions);
    const conflicts = conflictMap.get(session.id) || [];

    return {
      ...session,
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }

  /**
   * Thêm buổi học mới (nếu cần xếp lịch)
   */
  static create(sessionData) {
    const all = readTimetable();
    const newSession = {
      id: `tt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      status: 'scheduled',
      ...sessionData
    };
    all.push(newSession);
    writeTimetable(all);
    return this.findById(newSession.id);
  }
}

module.exports = TimetableModel;

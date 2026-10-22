/**
 * DNKN-254: Backend kiểm tra trùng lịch
 * DNKN-253: API trả về chi tiết xung đột
 *
 * Xử lý:
 * - Trùng giảng viên và phòng học
 * - So sánh đúng ngày, ca học hoặc khoảng thời gian
 * - Bỏ qua lịch đã hủy (cancelled, da_huy)
 * - Không so sánh một lịch với chính nó
 * - Không trả về kết quả trùng lặp
 */

const SHIFT_TIMES = {
  'Ca 1': { startTime: '07:00', endTime: '09:15' },
  'Ca 2': { startTime: '09:30', endTime: '11:45' },
  'Ca 3': { startTime: '13:00', endTime: '15:15' },
  'Ca 4': { startTime: '15:30', endTime: '17:45' },
  'Ca 5': { startTime: '18:00', endTime: '20:15' }
};

const CANCELLED_STATUSES = new Set(['cancelled', 'da_huy', 'canceled']);

function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.trim().split(':');
  const hours = Number(parts[0]) || 0;
  const minutes = Number(parts[1]) || 0;
  return hours * 60 + minutes;
}

function resolveTimes(schedule) {
  let startTime = schedule.startTime;
  let endTime = schedule.endTime;

  if (schedule.shift && SHIFT_TIMES[schedule.shift]) {
    if (!startTime) startTime = SHIFT_TIMES[schedule.shift].startTime;
    if (!endTime) endTime = SHIFT_TIMES[schedule.shift].endTime;
  }

  return {
    startTime: startTime || '',
    endTime: endTime || ''
  };
}

function normalizeDate(dateValue) {
  if (!dateValue) return '';
  if (dateValue instanceof Date) {
    return dateValue.toISOString().slice(0, 10);
  }
  return String(dateValue).trim().slice(0, 10);
}

function isCancelled(status) {
  if (!status) return false;
  return CANCELLED_STATUSES.has(String(status).toLowerCase().trim());
}

function doTimesOverlap(startA, endA, startB, endB) {
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);

  // Không giao nhau nếu thời gian kết thúc nhỏ hơn hoặc bằng thời gian bắt đầu
  if (sA >= eA || sB >= eB) return false;

  // Hai khoảng [sA, eA] và [sB, eB] giao nhau khi sA < eB và sB < eA
  return sA < eB && sB < eA;
}

/**
 * Kiểm tra xung đột lịch học (DNKN-254 & DNKN-253)
 * @param {Object} candidate - Lịch học cần kiểm tra
 * @param {Array<Object>} existingSchedules - Danh sách lịch học hiện có
 * @param {Object} options - Tùy chọn (excludeId, ...)
 * @returns {Object} Chi tiết xung đột theo cấu trúc nhất quán
 */
function checkScheduleConflict(candidate, existingSchedules = [], options = {}) {
  const result = {
    hasConflict: false,
    conflictCount: 0,
    conflicts: [],
    summary: {
      lecturerConflicts: [],
      roomConflicts: []
    }
  };

  if (!candidate || typeof candidate !== 'object') {
    return result;
  }

  // Nếu lịch đang kiểm tra ở trạng thái đã hủy, không tính xung đột
  if (isCancelled(candidate.status)) {
    return result;
  }

  const candidateId = candidate.id || options.excludeId || null;
  const candidateDate = normalizeDate(candidate.date);
  const { startTime: candStart, endTime: candEnd } = resolveTimes(candidate);

  if (!candidateDate || !candStart || !candEnd) {
    return result;
  }

  const seenConflicts = new Set();

  for (const existing of existingSchedules) {
    if (!existing || typeof existing !== 'object') continue;

    // Không so sánh một lịch với chính nó
    if (candidateId && String(existing.id) === String(candidateId)) {
      continue;
    }

    // Bỏ qua lịch đã hủy theo quy tắc hiện có
    if (isCancelled(existing.status)) {
      continue;
    }

    // So sánh đúng ngày
    const existingDate = normalizeDate(existing.date);
    if (candidateDate !== existingDate) {
      continue;
    }

    // So sánh khoảng thời gian / ca học
    const { startTime: existStart, endTime: existEnd } = resolveTimes(existing);
    if (!existStart || !existEnd) {
      continue;
    }

    if (!doTimesOverlap(candStart, candEnd, existStart, existEnd)) {
      continue;
    }

    // 1. Kiểm tra trùng giảng viên
    const isLecturerConflict =
      Boolean(candidate.lecturerId && existing.lecturerId) &&
      String(candidate.lecturerId).trim().toLowerCase() === String(existing.lecturerId).trim().toLowerCase();

    // 2. Kiểm tra trùng phòng học
    const isRoomConflict =
      Boolean(candidate.roomId && existing.roomId) &&
      String(candidate.roomId).trim().toLowerCase() === String(existing.roomId).trim().toLowerCase();

    if (isLecturerConflict) {
      const key = `lecturer-${existing.id}`;
      if (!seenConflicts.has(key)) {
        seenConflicts.add(key);
        const conflictItem = {
          type: 'lecturer',
          message: `Giảng viên ${existing.lecturerName || candidate.lecturerName || existing.lecturerId} đã có lịch dạy lớp "${existing.className || existing.classId}" vào ngày ${existingDate} (${existing.shift || `${existStart} - ${existEnd}`}).`,
          conflictingSchedule: {
            id: existing.id,
            classId: existing.classId,
            className: existing.className,
            subjectId: existing.subjectId,
            subjectName: existing.subjectName,
            lecturerId: existing.lecturerId,
            lecturerName: existing.lecturerName,
            roomId: existing.roomId,
            roomName: existing.roomName,
            date: existingDate,
            shift: existing.shift || null,
            startTime: existStart,
            endTime: existEnd,
            status: existing.status || 'scheduled'
          }
        };
        result.conflicts.push(conflictItem);
        result.summary.lecturerConflicts.push(conflictItem);
      }
    }

    if (isRoomConflict) {
      const key = `room-${existing.id}`;
      if (!seenConflicts.has(key)) {
        seenConflicts.add(key);
        const conflictItem = {
          type: 'room',
          message: `Phòng học ${existing.roomName || candidate.roomName || existing.roomId} đã được xếp cho lớp "${existing.className || existing.classId}" vào ngày ${existingDate} (${existing.shift || `${existStart} - ${existEnd}`}).`,
          conflictingSchedule: {
            id: existing.id,
            classId: existing.classId,
            className: existing.className,
            subjectId: existing.subjectId,
            subjectName: existing.subjectName,
            lecturerId: existing.lecturerId,
            lecturerName: existing.lecturerName,
            roomId: existing.roomId,
            roomName: existing.roomName,
            date: existingDate,
            shift: existing.shift || null,
            startTime: existStart,
            endTime: existEnd,
            status: existing.status || 'scheduled'
          }
        };
        result.conflicts.push(conflictItem);
        result.summary.roomConflicts.push(conflictItem);
      }
    }
  }

  result.conflictCount = result.conflicts.length;
  result.hasConflict = result.conflictCount > 0;

  return result;
}

module.exports = {
  SHIFT_TIMES,
  CANCELLED_STATUSES,
  timeToMinutes,
  resolveTimes,
  normalizeDate,
  isCancelled,
  doTimesOverlap,
  checkScheduleConflict
};

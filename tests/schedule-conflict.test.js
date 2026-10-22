/**
 * DNKN-255: Bộ kiểm thử toàn diện cho Chức năng Quản lý Lịch học (DNKN-240)
 * Bao gồm kiểm thử:
 * - DNKN-254: Kiểm tra trùng giảng viên, trùng phòng, khác ngày, không giao nhau, lịch đã hủy, không so sánh chính nó
 * - DNKN-253: API trả về chi tiết xung đột, cấu trúc nhất quán
 * - DNKN-257: Chặn lưu mặc định, ghi đè hợp lệ bởi Quản lý đào tạo, từ chối người không đủ quyền, ghi audit nhất quán
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.NODE_ENV = 'test';

const { app } = require('../backend/server');
const {
  checkScheduleConflict,
  doTimesOverlap,
  timeToMinutes
} = require('../backend/services/scheduleConflictService');
const { scheduleRepository } = require('../backend/models/scheduleModel');
const { scheduleAuditRepository } = require('../backend/models/scheduleAuditModel');
const { scheduleService, ConflictError, ForbiddenError, ValidationError } = require('../backend/services/scheduleService');

// Dữ liệu mẫu kiểm thử
const sampleExisting = [
  {
    id: 'SCHED-TEST-1',
    classId: 'K15C6-N1',
    className: 'K15 CNTT C6 - Nhóm 1',
    subjectId: 'INT1340',
    subjectName: 'Lập trình Web nâng cao',
    lecturerId: 'GV01',
    lecturerName: 'TS. Nguyễn Văn An',
    roomId: 'P301',
    roomName: 'Phòng 301 - Giảng đường A1',
    date: '2026-11-02',
    shift: 'Ca 1',
    startTime: '07:00',
    endTime: '09:15',
    status: 'scheduled'
  },
  {
    id: 'SCHED-TEST-2',
    classId: 'K15C6-N2',
    className: 'K15 CNTT C6 - Nhóm 2',
    subjectId: 'INT1330',
    subjectName: 'Cơ sở dữ liệu nâng cao',
    lecturerId: 'GV02',
    lecturerName: 'ThS. Trần Thị Bình',
    roomId: 'P302',
    roomName: 'Phòng 302 - Giảng đường A1',
    date: '2026-11-02',
    shift: 'Ca 2',
    startTime: '09:30',
    endTime: '11:45',
    status: 'scheduled'
  },
  {
    id: 'SCHED-TEST-3',
    classId: 'K15C6-N3',
    className: 'K15 CNTT C6 - Nhóm 3',
    subjectId: 'INT1410',
    subjectName: 'Kiểm thử phần mềm',
    lecturerId: 'GV03',
    lecturerName: 'PGS.TS. Lê Hoàng Cường',
    roomId: 'LAB01',
    roomName: 'Phòng máy Lab 01',
    date: '2026-11-02',
    shift: 'Ca 1',
    startTime: '07:00',
    endTime: '09:15',
    status: 'cancelled' // Lịch đã hủy
  }
];

// Helper khởi chạy test server HTTP
let testServer = null;
let baseUrl = '';

test.before(async () => {
  await new Promise((resolve) => {
    testServer = http.createServer(app);
    testServer.listen(0, '127.0.0.1', () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }
});

// Reset dữ liệu trước mỗi nhóm kiểm thử
test.beforeEach(() => {
  scheduleRepository.resetToDefault();
  scheduleAuditRepository.clear();
});

// ============================================================================
// PHẦN 1: DNKN-254 — KIỂM TRA TRÙNG LỊCH (UNIT TESTS)
// ============================================================================

test('DNKN-254: Hàm tính thời gian và kiểm tra khoảng giao nhau doTimesOverlap', () => {
  assert.equal(timeToMinutes('07:00'), 420);
  assert.equal(timeToMinutes('09:15'), 555);

  // Giao nhau hoàn toàn
  assert.equal(doTimesOverlap('07:00', '09:15', '07:00', '09:15'), true);
  // Giao nhau một phần
  assert.equal(doTimesOverlap('07:00', '09:15', '08:00', '10:00'), true);
  assert.equal(doTimesOverlap('08:00', '10:00', '07:00', '09:15'), true);
  // Khoảng này bao trọn khoảng kia
  assert.equal(doTimesOverlap('06:30', '10:30', '07:00', '09:15'), true);
  // Liền kề nhưng không giao nhau (09:15 chạm 09:15)
  assert.equal(doTimesOverlap('07:00', '09:15', '09:15', '11:30'), false);
  // Ca 1 và Ca 2 hoàn toàn tách biệt
  assert.equal(doTimesOverlap('07:00', '09:15', '09:30', '11:45'), false);
  // Thời gian không hợp lệ (start >= end)
  assert.equal(doTimesOverlap('09:00', '08:00', '07:00', '10:00'), false);
});

test('DNKN-254: Phát hiện trùng giảng viên (Lecturer Conflict)', () => {
  const candidate = {
    classId: 'K15C6-N4',
    className: 'K15 CNTT C6 - Nhóm 4',
    subjectId: 'INT1340',
    subjectName: 'Lập trình Web nâng cao',
    lecturerId: 'GV01', // Trùng GV01
    lecturerName: 'TS. Nguyễn Văn An',
    roomId: 'P305',     // Phòng khác
    roomName: 'Phòng 305',
    date: '2026-11-02',  // Cùng ngày
    shift: 'Ca 1',      // Cùng ca 1
    startTime: '07:00',
    endTime: '09:15',
    status: 'scheduled'
  };

  const result = checkScheduleConflict(candidate, sampleExisting);

  assert.equal(result.hasConflict, true);
  assert.equal(result.conflictCount, 1);
  assert.equal(result.conflicts[0].type, 'lecturer');
  assert.equal(result.conflicts[0].conflictingSchedule.id, 'SCHED-TEST-1');
  assert.equal(result.conflicts[0].conflictingSchedule.lecturerId, 'GV01');
  assert.equal(result.summary.lecturerConflicts.length, 1);
  assert.equal(result.summary.roomConflicts.length, 0);
  assert.match(result.conflicts[0].message, /Giảng viên TS\. Nguyễn Văn An đã có lịch dạy/);
});

test('DNKN-254: Phát hiện trùng phòng học (Room Conflict)', () => {
  const candidate = {
    classId: 'K15C6-N4',
    className: 'K15 CNTT C6 - Nhóm 4',
    subjectId: 'INT1330',
    subjectName: 'Cơ sở dữ liệu nâng cao',
    lecturerId: 'GV04', // Giảng viên khác
    lecturerName: 'ThS. Phạm Thu Dung',
    roomId: 'P301',     // Trùng phòng P301
    roomName: 'Phòng 301 - Giảng đường A1',
    date: '2026-11-02',  // Cùng ngày
    shift: 'Ca 1',      // Cùng ca 1
    startTime: '07:00',
    endTime: '09:15',
    status: 'scheduled'
  };

  const result = checkScheduleConflict(candidate, sampleExisting);

  assert.equal(result.hasConflict, true);
  assert.equal(result.conflictCount, 1);
  assert.equal(result.conflicts[0].type, 'room');
  assert.equal(result.conflicts[0].conflictingSchedule.id, 'SCHED-TEST-1');
  assert.equal(result.conflicts[0].conflictingSchedule.roomId, 'P301');
  assert.equal(result.summary.lecturerConflicts.length, 0);
  assert.equal(result.summary.roomConflicts.length, 1);
  assert.match(result.conflicts[0].message, /Phòng học Phòng 301 - Giảng đường A1 đã được xếp/);
});

test('DNKN-254: Phát hiện đồng thời cả trùng giảng viên và trùng phòng học', () => {
  const candidate = {
    classId: 'K15C6-N4',
    className: 'K15 CNTT C6 - Nhóm 4',
    subjectId: 'INT1340',
    subjectName: 'Lập trình Web nâng cao',
    lecturerId: 'GV01', // Trùng giảng viên
    roomId: 'P301',     // Trùng phòng
    date: '2026-11-02',
    shift: 'Ca 1',
    startTime: '07:00',
    endTime: '09:15',
    status: 'scheduled'
  };

  const result = checkScheduleConflict(candidate, sampleExisting);

  assert.equal(result.hasConflict, true);
  assert.equal(result.conflictCount, 2);
  const types = result.conflicts.map(c => c.type).sort();
  assert.deepEqual(types, ['lecturer', 'room']);
  assert.equal(result.summary.lecturerConflicts.length, 1);
  assert.equal(result.summary.roomConflicts.length, 1);
});

test('DNKN-254: Khác ngày học -> Không xung đột', () => {
  const candidate = {
    classId: 'K15C6-N4',
    className: 'K15 CNTT C6 - Nhóm 4',
    subjectId: 'INT1340',
    subjectName: 'Lập trình Web nâng cao',
    lecturerId: 'GV01', // Cùng giảng viên
    roomId: 'P301',     // Cùng phòng
    date: '2026-11-03',  // KHÁC NGÀY (ngày hôm sau)
    shift: 'Ca 1',
    startTime: '07:00',
    endTime: '09:15',
    status: 'scheduled'
  };

  const result = checkScheduleConflict(candidate, sampleExisting);

  assert.equal(result.hasConflict, false);
  assert.equal(result.conflictCount, 0);
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.summary.lecturerConflicts.length, 0);
  assert.equal(result.summary.roomConflicts.length, 0);
});

test('DNKN-254: Cùng ngày nhưng không giao nhau về giờ / ca học -> Không xung đột', () => {
  const candidate = {
    classId: 'K15C6-N4',
    className: 'K15 CNTT C6 - Nhóm 4',
    subjectId: 'INT1340',
    subjectName: 'Lập trình Web nâng cao',
    lecturerId: 'GV01', // Cùng giảng viên GV01 (GV01 dạy Ca 1 ở SCHED-TEST-1)
    roomId: 'P301',     // Cùng phòng P301
    date: '2026-11-02',  // Cùng ngày
    shift: 'Ca 2',      // Ca 2: 09:30 - 11:45 (không giao với Ca 1: 07:00 - 09:15)
    startTime: '09:30',
    endTime: '11:45',
    status: 'scheduled'
  };

  const result = checkScheduleConflict(candidate, sampleExisting);

  assert.equal(result.hasConflict, false);
  assert.equal(result.conflictCount, 0);
  assert.equal(result.conflicts.length, 0);
});

test('DNKN-254: Lịch đã hủy (cancelled / da_huy) trong cơ sở dữ liệu -> Bỏ qua, không tính xung đột', () => {
  // SCHED-TEST-3 có lecturerId: GV03, roomId: LAB01, date: 2026-11-02, Ca 1 nhưng status: 'cancelled'
  const candidate = {
    classId: 'K15C6-N4',
    className: 'K15 CNTT C6 - Nhóm 4',
    subjectId: 'INT1410',
    subjectName: 'Kiểm thử phần mềm',
    lecturerId: 'GV03', // Cùng GV03
    roomId: 'LAB01',    // Cùng phòng LAB01
    date: '2026-11-02',
    shift: 'Ca 1',
    startTime: '07:00',
    endTime: '09:15',
    status: 'scheduled'
  };

  const result = checkScheduleConflict(candidate, sampleExisting);

  assert.equal(result.hasConflict, false);
  assert.equal(result.conflictCount, 0);
  assert.equal(result.conflicts.length, 0);
});

test('DNKN-254: Lịch đang kiểm tra có trạng thái đã hủy -> Không tính xung đột', () => {
  const candidateCancelled = {
    classId: 'K15C6-N4',
    className: 'K15 CNTT C6 - Nhóm 4',
    subjectId: 'INT1340',
    subjectName: 'Lập trình Web nâng cao',
    lecturerId: 'GV01',
    roomId: 'P301',
    date: '2026-11-02',
    shift: 'Ca 1',
    startTime: '07:00',
    endTime: '09:15',
    status: 'cancelled' // Trạng thái đã hủy
  };

  const result = checkScheduleConflict(candidateCancelled, sampleExisting);
  assert.equal(result.hasConflict, false);
  assert.equal(result.conflictCount, 0);
});

test('DNKN-254: Không so sánh một lịch với chính nó khi cập nhật (no self-conflict)', () => {
  // Khi cập nhật SCHED-TEST-1 (đổi ghi chú, giữ nguyên GV01 và P301)
  const candidateSelf = {
    id: 'SCHED-TEST-1', // Cùng ID với SCHED-TEST-1
    classId: 'K15C6-N1',
    className: 'K15 CNTT C6 - Nhóm 1',
    subjectId: 'INT1340',
    subjectName: 'Lập trình Web nâng cao',
    lecturerId: 'GV01',
    roomId: 'P301',
    date: '2026-11-02',
    shift: 'Ca 1',
    startTime: '07:00',
    endTime: '09:15',
    status: 'scheduled',
    note: 'Cập nhật ghi chú mới'
  };

  const result = checkScheduleConflict(candidateSelf, sampleExisting);

  assert.equal(result.hasConflict, false);
  assert.equal(result.conflictCount, 0);
});

test('DNKN-254: Không trả về kết quả trùng lặp', () => {
  // Trường hợp danh sách existing có nhiều lịch giống nhau
  const duplicatedExisting = [...sampleExisting, { ...sampleExisting[0] }];
  const candidate = {
    classId: 'K15C6-N4',
    className: 'K15 CNTT C6 - Nhóm 4',
    subjectId: 'INT1340',
    subjectName: 'Lập trình Web nâng cao',
    lecturerId: 'GV01',
    roomId: 'P305',
    date: '2026-11-02',
    shift: 'Ca 1',
    startTime: '07:00',
    endTime: '09:15',
    status: 'scheduled'
  };

  const result = checkScheduleConflict(candidate, duplicatedExisting);
  // Chỉ có 1 bản ghi conflict cho lecturer-SCHED-TEST-1
  assert.equal(result.conflicts.filter(c => c.conflictingSchedule.id === 'SCHED-TEST-1').length, 1);
});

// ============================================================================
// PHẦN 2: DNKN-253 — API TRẢ VỀ CHI TIẾT XUNG ĐỘT (HTTP API TESTS)
// ============================================================================

test('DNKN-253: POST /api/schedules/check-conflict trả về chi tiết xung đột và thông tin lớp, môn, GV, phòng, ngày, giờ', async () => {
  // Tạo lịch trước trong repo: ngày 2026-11-10 Ca 1 GV01 P301
  await scheduleRepository.create({
    id: 'SCHED-API-CONFLICT',
    classId: 'K15C6-N1',
    className: 'K15 CNTT C6 - Nhóm 1',
    subjectId: 'INT1340',
    subjectName: 'Lập trình Web nâng cao',
    lecturerId: 'GV01',
    lecturerName: 'TS. Nguyễn Văn An',
    roomId: 'P301',
    roomName: 'Phòng 301 - Giảng đường A1',
    date: '2026-11-10',
    shift: 'Ca 1',
    startTime: '07:00',
    endTime: '09:15',
    status: 'scheduled'
  });

  const response = await fetch(`${baseUrl}/api/schedules/check-conflict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      classId: 'K15C6-N2',
      className: 'K15 CNTT C6 - Nhóm 2',
      subjectId: 'INT1330',
      subjectName: 'Cơ sở dữ liệu nâng cao',
      lecturerId: 'GV01', // Trùng giảng viên
      lecturerName: 'TS. Nguyễn Văn An',
      roomId: 'LAB01',
      roomName: 'Phòng máy Lab 01',
      date: '2026-11-10',
      shift: 'Ca 1',
      startTime: '07:00',
      endTime: '09:15'
    })
  });

  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(body.success, true);
  assert.ok(body.data);
  assert.equal(body.data.hasConflict, true);
  assert.equal(body.data.conflictCount, 1);
  assert.equal(body.data.conflicts[0].type, 'lecturer');

  const conflicting = body.data.conflicts[0].conflictingSchedule;
  assert.equal(conflicting.id, 'SCHED-API-CONFLICT');
  assert.equal(conflicting.classId, 'K15C6-N1');
  assert.equal(conflicting.className, 'K15 CNTT C6 - Nhóm 1');
  assert.equal(conflicting.subjectId, 'INT1340');
  assert.equal(conflicting.subjectName, 'Lập trình Web nâng cao');
  assert.equal(conflicting.lecturerId, 'GV01');
  assert.equal(conflicting.lecturerName, 'TS. Nguyễn Văn An');
  assert.equal(conflicting.roomId, 'P301');
  assert.equal(conflicting.date, '2026-11-10');
  assert.equal(conflicting.startTime, '07:00');
  assert.equal(conflicting.endTime, '09:15');

  // Kiểm tra cấu trúc summary phân biệt lecturer và room
  assert.ok(Array.isArray(body.data.summary.lecturerConflicts));
  assert.ok(Array.isArray(body.data.summary.roomConflicts));
  assert.equal(body.data.summary.lecturerConflicts.length, 1);
  assert.equal(body.data.summary.roomConflicts.length, 0);
});

test('DNKN-253: POST /api/schedules/check-conflict trả về cấu trúc nhất quán khi KHÔNG có xung đột', async () => {
  const response = await fetch(`${baseUrl}/api/schedules/check-conflict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      classId: 'K15C6-N2',
      subjectId: 'INT1330',
      lecturerId: 'GV02',
      roomId: 'LAB02',
      date: '2026-12-25', // Ngày chưa có lịch
      shift: 'Ca 3',
      startTime: '13:00',
      endTime: '15:15'
    })
  });

  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(body.success, true);
  assert.deepEqual(body.data, {
    hasConflict: false,
    conflictCount: 0,
    conflicts: [],
    summary: {
      lecturerConflicts: [],
      roomConflicts: []
    }
  });
});

// ============================================================================
// PHẦN 3: DNKN-257 — CHẶN LƯU VÀ XÁC NHẬN GHI ĐÈ (PERMISSION & AUDIT)
// ============================================================================

test('DNKN-257: Backend từ chối lưu lịch khi có xung đột theo mặc định (HTTP 409 Conflict)', async () => {
  // Tạo 1 lịch có sẵn: 2026-11-15, Ca 1, GV01, P301
  await scheduleRepository.create({
    id: 'SCHED-EXISTING-1',
    classId: 'K15C6-N1',
    subjectId: 'INT1340',
    lecturerId: 'GV01',
    roomId: 'P301',
    date: '2026-11-15',
    shift: 'Ca 1',
    startTime: '07:00',
    endTime: '09:15',
    status: 'scheduled'
  });

  // Cố gắng lưu lịch trùng GV01 mà không gửi confirmOverride
  const response = await fetch(`${baseUrl}/api/schedules`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'training_manager' // Kể cả là training_manager, nếu không bật confirmOverride thì vẫn từ chối
    },
    body: JSON.stringify({
      classId: 'K15C6-N2',
      subjectId: 'INT1330',
      lecturerId: 'GV01', // Trùng GV01
      roomId: 'P302',
      date: '2026-11-15',
      shift: 'Ca 1',
      startTime: '07:00',
      endTime: '09:15'
    })
  });

  assert.equal(response.status, 409);
  const body = await response.json();

  assert.equal(body.success, false);
  assert.equal(body.code, 'SCHEDULE_CONFLICT');
  assert.ok(body.conflictDetails);
  assert.equal(body.conflictDetails.hasConflict, true);
  assert.equal(body.conflictDetails.conflicts[0].type, 'lecturer');
});

test('DNKN-257: Người có quyền Quản lý đào tạo (training_manager) được xác nhận ghi đè và ghi audit log', async () => {
  // Lịch có sẵn
  await scheduleRepository.create({
    id: 'SCHED-EXISTING-2',
    classId: 'K15C6-N1',
    subjectId: 'INT1340',
    lecturerId: 'GV02',
    roomId: 'P302',
    date: '2026-11-16',
    shift: 'Ca 2',
    startTime: '09:30',
    endTime: '11:45',
    status: 'scheduled'
  });

  const response = await fetch(`${baseUrl}/api/schedules`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'training_manager', // Vai trò Quản lý đào tạo
      'x-user-id': 'mgr-01',
      'x-user-name': encodeURIComponent('Nguyễn Quản Lý Đào Tạo')
    },
    body: JSON.stringify({
      classId: 'K15C6-N3',
      subjectId: 'INT1410',
      lecturerId: 'GV02', // Trùng GV02
      roomId: 'LAB01',
      date: '2026-11-16',
      shift: 'Ca 2',
      startTime: '09:30',
      endTime: '11:45',
      confirmOverride: true, // Xác nhận ghi đè
      overrideReason: 'Được phê duyệt bởi Ban Đào tạo: dạy song song hai nhóm tại giảng đường mở'
    })
  });

  assert.equal(response.status, 201);
  const body = await response.json();

  assert.equal(body.success, true);
  assert.equal(body.overridden, true);
  assert.equal(body.data.isOverridden, true);
  assert.equal(body.data.overrideReason, 'Được phê duyệt bởi Ban Đào tạo: dạy song song hai nhóm tại giảng đường mở');
  assert.equal(body.data.overriddenBy.id, 'mgr-01');
  assert.equal(body.data.overriddenBy.name, 'Nguyễn Quản Lý Đào Tạo');
  assert.equal(body.data.overriddenBy.role, 'training_manager');

  // Kiểm tra bản ghi Audit Log được tạo đúng cấu trúc
  assert.ok(body.audit);
  assert.equal(body.audit.action, 'SCHEDULE_OVERRIDE_CREATE');
  assert.equal(body.audit.actorId, 'mgr-01');
  assert.equal(body.audit.actorRole, 'training_manager');
  assert.equal(body.audit.scheduleId, body.data.id);
  assert.ok(Array.isArray(body.audit.conflictsOverridden));
  assert.equal(body.audit.conflictsOverridden.length, 1);

  // Kiểm tra audit log lưu trong repository
  const auditLogs = await scheduleAuditRepository.getAll({ scheduleId: body.data.id });
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].overrideReason, 'Được phê duyệt bởi Ban Đào tạo: dạy song song hai nhóm tại giảng đường mở');
});

test('DNKN-257: Người KHÔNG có quyền Quản lý đào tạo bị từ chối ghi đè (HTTP 403 Forbidden)', async () => {
  await scheduleRepository.create({
    id: 'SCHED-EXISTING-3',
    classId: 'K15C6-N1',
    subjectId: 'INT1340',
    lecturerId: 'GV01',
    roomId: 'P301',
    date: '2026-11-17',
    shift: 'Ca 1',
    startTime: '07:00',
    endTime: '09:15',
    status: 'scheduled'
  });

  // Thử ghi đè với vai trò consultant / lecturer / guest
  const response = await fetch(`${baseUrl}/api/schedules`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'lecturer', // Vai trò Giảng viên (không phải Quản lý đào tạo)
      'x-user-id': 'gv-01',
      'x-user-name': encodeURIComponent('Nguyễn Giảng Viên')
    },
    body: JSON.stringify({
      classId: 'K15C6-N2',
      subjectId: 'INT1330',
      lecturerId: 'GV01', // Trùng GV01
      roomId: 'P302',
      date: '2026-11-17',
      shift: 'Ca 1',
      startTime: '07:00',
      endTime: '09:15',
      confirmOverride: true,
      overrideReason: 'Tự ý đổi ca'
    })
  });

  assert.equal(response.status, 403);
  const body = await response.json();

  assert.equal(body.success, false);
  assert.equal(body.code, 'FORBIDDEN_OVERRIDE');
  assert.match(body.message, /Chỉ người có quyền Quản lý đào tạo/);

  // Đảm bảo KHÔNG có lịch nào được tạo thêm
  const list = await scheduleRepository.getAll({ date: '2026-11-17' });
  assert.equal(list.length, 1);

  // Đảm bảo KHÔNG có audit log nào được tạo
  const auditLogs = await scheduleAuditRepository.getAll();
  assert.equal(auditLogs.length, 0);
});

test('DNKN-257: Quản lý đào tạo ghi đè nhưng thiếu lý do -> Lỗi 400 Bad Request', async () => {
  await scheduleRepository.create({
    id: 'SCHED-EXISTING-4',
    classId: 'K15C6-N1',
    subjectId: 'INT1340',
    lecturerId: 'GV01',
    roomId: 'P301',
    date: '2026-11-18',
    shift: 'Ca 1',
    startTime: '07:00',
    endTime: '09:15',
    status: 'scheduled'
  });

  const response = await fetch(`${baseUrl}/api/schedules`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'training_manager'
    },
    body: JSON.stringify({
      classId: 'K15C6-N2',
      subjectId: 'INT1330',
      lecturerId: 'GV01',
      roomId: 'P302',
      date: '2026-11-18',
      shift: 'Ca 1',
      startTime: '07:00',
      endTime: '09:15',
      confirmOverride: true,
      overrideReason: '   ' // Lý do rỗng
    })
  });

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.match(body.message, /lý do/);
});

test('DNKN-257: Cập nhật lịch học (PUT) có xung đột cũng tuân thủ chặn lưu và xác nhận ghi đè', async () => {
  // Tạo 2 lịch khác nhau ban đầu
  const s1 = await scheduleRepository.create({
    classId: 'K15C6-N1',
    subjectId: 'INT1340',
    lecturerId: 'GV01',
    roomId: 'P301',
    date: '2026-11-20',
    shift: 'Ca 1',
    startTime: '07:00',
    endTime: '09:15'
  });

  const s2 = await scheduleRepository.create({
    classId: 'K15C6-N2',
    subjectId: 'INT1330',
    lecturerId: 'GV02',
    roomId: 'P302',
    date: '2026-11-20',
    shift: 'Ca 2',
    startTime: '09:30',
    endTime: '11:45'
  });

  // Cố đổi s2 sang Ca 1 (giao với s1) mà không override -> 409
  const updateRes1 = await fetch(`${baseUrl}/api/schedules/${s2.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: 'P301', // Đổi phòng sang P301
      shift: 'Ca 1',  // Đổi sang Ca 1
      startTime: '07:00',
      endTime: '09:15'
    })
  });
  assert.equal(updateRes1.status, 409);

  // Đổi có confirmOverride bởi training_manager -> 200 OK
  const updateRes2 = await fetch(`${baseUrl}/api/schedules/${s2.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'training_manager',
      'x-user-id': 'mgr-01'
    },
    body: JSON.stringify({
      roomId: 'P301',
      shift: 'Ca 1',
      startTime: '07:00',
      endTime: '09:15',
      confirmOverride: true,
      overrideReason: 'Dồn 2 lớp vào học chung tại phòng 301'
    })
  });
  assert.equal(updateRes2.status, 200);
  const updateBody = await updateRes2.json();
  assert.equal(updateBody.overridden, true);
  assert.equal(updateBody.data.isOverridden, true);
});

// ============================================================================
// PHẦN 4: KIỂM THỬ TÍNH HỢP LỆ VÀ XỬ LÝ LỖI (VALIDATION TESTS)
// ============================================================================

test('DNKN-255: Dữ liệu không hợp lệ trả về HTTP 400 Validation Error', async () => {
  // Thiếu classId
  const res1 = await fetch(`${baseUrl}/api/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subjectId: 'INT1340',
      lecturerId: 'GV01',
      roomId: 'P301',
      date: '2026-11-25',
      startTime: '07:00',
      endTime: '09:15'
    })
  });
  assert.equal(res1.status, 400);

  // Định dạng ngày sai
  const res2 = await fetch(`${baseUrl}/api/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      classId: 'K15C6-N1',
      subjectId: 'INT1340',
      lecturerId: 'GV01',
      roomId: 'P301',
      date: 'sai-dinh-dang',
      startTime: '07:00',
      endTime: '09:15'
    })
  });
  assert.equal(res2.status, 400);

  // Thời gian kết thúc nhỏ hơn hoặc bằng bắt đầu
  const res3 = await fetch(`${baseUrl}/api/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      classId: 'K15C6-N1',
      subjectId: 'INT1340',
      lecturerId: 'GV01',
      roomId: 'P301',
      date: '2026-11-25',
      startTime: '10:00',
      endTime: '08:00'
    })
  });
  assert.equal(res3.status, 400);
});

test('DNKN-255: API lấy Master Data trả về đầy đủ danh sách lớp, môn, GV, phòng', async () => {
  const response = await fetch(`${baseUrl}/api/schedules/master-data`);
  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data.classes));
  assert.ok(Array.isArray(body.data.subjects));
  assert.ok(Array.isArray(body.data.lecturers));
  assert.ok(Array.isArray(body.data.rooms));
  assert.ok(body.data.classes.length > 0);
  assert.ok(body.data.lecturers.length > 0);
});

test('DNKN-255: API lấy Audit Logs trả về danh sách lịch sử ghi đè', async () => {
  const response = await fetch(`${baseUrl}/api/schedules/audit-logs`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
});

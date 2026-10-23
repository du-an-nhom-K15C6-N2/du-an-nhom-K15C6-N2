const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, describe, beforeEach, afterEach } = require('node:test');

// Tạo thư mục tạm để cô lập dữ liệu kiểm thử
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'timetable-test-'));
const testDataFile = path.join(tempDir, 'timetable.json');
process.env.TIMETABLE_DATA_FILE = testDataFile;

const mockTimetableData = [
  {
    id: 'tt_test_01',
    classId: 'cls_test_01',
    classCode: 'TEST-01',
    className: 'Lập trình Web',
    teacherId: 'teacher_01',
    teacherName: 'ThS. Nguyễn Văn A',
    room: 'A101',
    date: '2026-10-19',
    dayOfWeek: 2,
    startTime: '07:30',
    endTime: '09:30',
    shift: 'Ca 1 (Sáng)',
    totalStudents: 30,
    status: 'scheduled'
  },
  {
    id: 'tt_test_02',
    classId: 'cls_test_02',
    classCode: 'TEST-02',
    className: 'Mạng máy tính',
    teacherId: 'teacher_02',
    teacherName: 'TS. Trần Văn B',
    room: 'A101', // Cố tình trùng phòng A101 cùng giờ với tt_test_01
    date: '2026-10-19',
    dayOfWeek: 2,
    startTime: '07:30',
    endTime: '09:30',
    shift: 'Ca 1 (Sáng)',
    totalStudents: 25,
    status: 'scheduled'
  },
  {
    id: 'tt_test_03',
    classId: 'cls_test_03',
    classCode: 'TEST-03',
    className: 'Cơ sở dữ liệu',
    teacherId: 'teacher_03',
    teacherName: 'ThS. Lê Thị C',
    room: 'B202',
    date: '2026-10-21',
    dayOfWeek: 4,
    startTime: '09:45',
    endTime: '11:45',
    shift: 'Ca 2 (Sáng)',
    totalStudents: 28,
    status: 'scheduled'
  },
  {
    id: 'tt_test_04',
    classId: 'cls_test_04',
    classCode: 'TEST-04',
    className: 'Trí tuệ nhân tạo',
    teacherId: 'teacher_03', // Cố tình trùng giảng viên teacher_03 cùng giờ với tt_test_03
    teacherName: 'ThS. Lê Thị C',
    room: 'C303',
    date: '2026-10-21',
    dayOfWeek: 4,
    startTime: '09:45',
    endTime: '11:45',
    shift: 'Ca 2 (Sáng)',
    totalStudents: 32,
    status: 'scheduled'
  },
  {
    id: 'tt_test_05',
    classId: 'cls_test_01',
    classCode: 'TEST-01',
    className: 'Lập trình Web',
    teacherId: 'teacher_01',
    teacherName: 'ThS. Nguyễn Văn A',
    room: 'A101',
    date: '2026-11-02', // Tháng 11
    dayOfWeek: 2,
    startTime: '07:30',
    endTime: '09:30',
    shift: 'Ca 1 (Sáng)',
    totalStudents: 30,
    status: 'scheduled'
  }
];

fs.writeFileSync(testDataFile, JSON.stringify(mockTimetableData, null, 2), 'utf8');

const TimetableModel = require('../backend/models/timetableModel');
const TimetableController = require('../backend/controllers/timetableController');

describe('Kiểm thử Thời khoá biểu Quản lý đào tạo (Timetable Module)', () => {

  test('1. Lấy dữ liệu thời khoá biểu theo chế độ Tuần (Week view)', () => {
    const result = TimetableModel.getSchedule({
      view: 'week',
      date: '2026-10-20'
    });

    assert.equal(result.view, 'week');
    assert.equal(result.range.startDate, '2026-10-19'); // Thứ 2
    assert.equal(result.range.endDate, '2026-10-25');   // Chủ nhật
    assert.equal(result.sessions.length, 4); // 4 buổi học trong tuần 19-25/10 (không tính buổi tháng 11)
    assert(result.shifts.length > 0);
  });

  test('2. Lấy dữ liệu thời khoá biểu theo chế độ Tháng (Month view)', () => {
    const result = TimetableModel.getSchedule({
      view: 'month',
      date: '2026-10-20'
    });

    assert.equal(result.view, 'month');
    assert.equal(result.range.year, 2026);
    assert.equal(result.range.month, 10);
    assert.equal(result.range.startDate, '2026-10-01');
    assert.equal(result.range.endDate, '2026-10-31');
    assert.equal(result.sessions.length, 4);
  });

  test('3. Bộ lọc thời khoá biểu theo lớp học (classId)', () => {
    const result = TimetableModel.getSchedule({
      view: 'week',
      date: '2026-10-19',
      classId: 'cls_test_01'
    });

    assert.equal(result.sessions.length, 1);
    assert.equal(result.sessions[0].classId, 'cls_test_01');
    assert.equal(result.sessions[0].classCode, 'TEST-01');
  });

  test('4. Bộ lọc thời khoá biểu theo giảng viên (teacherId)', () => {
    const result = TimetableModel.getSchedule({
      view: 'week',
      date: '2026-10-19',
      teacherId: 'teacher_03'
    });

    assert.equal(result.sessions.length, 2);
    assert(result.sessions.every(s => s.teacherId === 'teacher_03'));
  });

  test('5. Bộ lọc thời khoá biểu theo phòng học (room)', () => {
    const result = TimetableModel.getSchedule({
      view: 'week',
      date: '2026-10-19',
      room: 'A101'
    });

    assert.equal(result.sessions.length, 2);
    assert(result.sessions.every(s => s.room === 'A101'));
  });

  test('6. Phát hiện chính xác điểm chồng chéo phòng học và giảng viên', () => {
    const result = TimetableModel.getSchedule({
      view: 'week',
      date: '2026-10-19'
    });

    // Tổng số xung đột được phát hiện
    assert.equal(result.stats.totalConflicts, 2);

    // Kiểm tra xung đột phòng A101 vào ngày 2026-10-19
    const s1 = result.sessions.find(s => s.id === 'tt_test_01');
    const s2 = result.sessions.find(s => s.id === 'tt_test_02');
    assert.equal(s1.hasConflict, true);
    assert.equal(s2.hasConflict, true);
    assert.match(s1.conflicts[0].message, /Trùng phòng học \[A101\]/);

    // Kiểm tra xung đột giảng viên teacher_03 vào ngày 2026-10-21
    const s3 = result.sessions.find(s => s.id === 'tt_test_03');
    const s4 = result.sessions.find(s => s.id === 'tt_test_04');
    assert.equal(s3.hasConflict, true);
    assert.equal(s4.hasConflict, true);
    assert.match(s3.conflicts[0].message, /Giảng viên \[ThS\. Lê Thị C\] bị trùng giờ/);
  });

  test('7. Phát hiện các khoảng trống (Gaps) để Quản lý đào tạo xếp thêm lịch', () => {
    const result = TimetableModel.getSchedule({
      view: 'week',
      date: '2026-10-19'
    });

    assert(result.gaps.length > 0);
    // Ví dụ ca 3 và ca 4 ngày thứ 2 còn trống
    const afternoonGap = result.gaps.find(g => g.dayOfWeek === 2 && g.shiftName.includes('Ca 3'));
    assert(afternoonGap !== undefined);
    assert.equal(afternoonGap.status, 'available');
  });

  test('8. Xem chi tiết buổi học khi bấm vào ô lịch qua ID', () => {
    const detail = TimetableModel.findById('tt_test_01');
    assert(detail !== null);
    assert.equal(detail.id, 'tt_test_01');
    assert.equal(detail.room, 'A101');
    assert.equal(detail.hasConflict, true);
    assert.equal(detail.conflicts.length, 1);
  });

  test('9. Controller API xử lý getTimetable và getSessionDetail trả về đúng mã HTTP', () => {
    // Mock response
    const createMockRes = () => ({
      statusCode: 200,
      payload: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.payload = data; return this; }
    });

    // Test getTimetable
    const req1 = { query: { view: 'week', date: '2026-10-19' } };
    const res1 = createMockRes();
    TimetableController.getTimetable(req1, res1);
    assert.equal(res1.statusCode, 200);
    assert.equal(res1.payload.success, true);
    assert.equal(res1.payload.data.sessions.length, 4);

    // Test getSessionDetail thành công
    const req2 = { params: { id: 'tt_test_01' } };
    const res2 = createMockRes();
    TimetableController.getSessionDetail(req2, res2);
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.payload.success, true);
    assert.equal(res2.payload.data.className, 'Lập trình Web');

    // Test getSessionDetail không tìm thấy
    const req3 = { params: { id: 'non_existent_id' } };
    const res3 = createMockRes();
    TimetableController.getSessionDetail(req3, res3);
    assert.equal(res3.statusCode, 404);
    assert.equal(res3.payload.success, false);
  });
});

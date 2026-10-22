
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ClassModel = require('../../../backend/models/classModel');

const studentA = 'test_student_A';
const studentB = 'test_student_B';
const now = new Date('2026-10-23T08:00:00+07:00');

const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'dnkn243-')
);

const testFile = path.join(tempDir, 'enrollments.json');

fs.writeFileSync(testFile, JSON.stringify({
    enrollments: [
        { id: 'e1', studentId: studentA, classId: 'cls_001' },
        { id: 'e2', studentId: studentA, classId: 'cls_002' },
        { id: 'e3', studentId: studentB, classId: 'cls_003' }
    ],
    history: []
}), 'utf8');

// Phải thiết lập đường dẫn trước khi import Model.
process.env.ENROLLMENT_DATA_FILE = testFile;

const {
    getStudentSchedule,
    parseSchedule
} = require('../backend/studentScheduleModel');

test('DNKN-243: Doc duoc lich hoc dinh ky', () => {
    const firstClass = ClassModel.list()
        .find(item => item.id === 'cls_001');

    const result = parseSchedule(firstClass.schedule);

    assert.equal(result.dayOfWeek, 1);
    assert.equal(result.startMinutes, 450);
    assert.equal(result.endMinutes, 570);
});

test('DNKN-243: Hoc vien chua ghi danh co lich trong', () => {
    const result = getStudentSchedule('student_unknown', now);

    assert.equal(result.nextSession, null);
    assert.deepEqual(result.weeklySessions, []);
});

test('DNKN-243: Hoc vien A co hai buoi trong tuan', () => {
    const result = getStudentSchedule(studentA, now);

    assert.equal(result.weeklySessions.length, 2);
    assert.deepEqual(
        result.weeklySessions.map(item => item.classId),
        ['cls_001', 'cls_002']
    );
});

test('DNKN-243: Xac dinh dung buoi hoc ke tiep', () => {
    const result = getStudentSchedule(studentA, now);

    assert.equal(result.nextSession.classId, 'cls_001');
    assert.equal(result.nextSession.date, '2026-10-26');
    assert.equal(result.nextSession.startTime, '07:30');
});

test('DNKN-243: Sap xep lich theo thoi gian', () => {
    const result = getStudentSchedule(studentA, now);
    const times = result.weeklySessions.map(item => item.startAt);

    assert.deepEqual(times, [...times].sort());
});

test('DNKN-243: Hoc vien A khong thay lop cua B', () => {
    const result = getStudentSchedule(studentA, now);

    assert.ok(result.weeklySessions.every(
        item => item.classId !== 'cls_003'
    ));
});

test('DNKN-243: Hoc vien B chi thay lop cua B', () => {
    const result = getStudentSchedule(studentB, now);

    assert.deepEqual(
        result.weeklySessions.map(item => item.classId),
        ['cls_003']
    );
});

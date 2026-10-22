'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, beforeEach, test } = require('node:test');

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'course-sessions-'));
process.env.COURSE_SESSIONS_DATA_FILE = path.join(tempDirectory, 'course-sessions.json');
process.env.COURSE_CATALOG_DATA_FILE = path.join(tempDirectory, 'courses.json');

const { CourseSessionsError, CourseSessionsModel } = require('../backend/courseSessionsModel');
const courses = [
  { id: 'course-source', code: 'CS101', name: 'Môn nguồn', sessionCount: 4 },
  { id: 'course-target', code: 'CS201', name: 'Môn đích', sessionCount: 4 },
  { id: 'course-small', code: 'CS301', name: 'Môn ít buổi', sessionCount: 2 }
];

function expectCode(callback, code, status) {
  assert.throws(callback, error => (
    error instanceof CourseSessionsError
    && error.code === code
    && error.status === status
  ));
}

function addSession(courseId, number, topic = `Chủ đề ${number}`) {
  return CourseSessionsModel.create(courseId, {
    number,
    topic,
    objectives: `Mục tiêu ${number}`
  });
}

function readRecords() {
  return JSON.parse(fs.readFileSync(process.env.COURSE_SESSIONS_DATA_FILE, 'utf8'));
}

beforeEach(() => {
  fs.writeFileSync(process.env.COURSE_CATALOG_DATA_FILE, JSON.stringify(courses), 'utf8');
  fs.writeFileSync(process.env.COURSE_SESSIONS_DATA_FILE, '[]', 'utf8');
});

after(() => {
  delete process.env.COURSE_SESSIONS_DATA_FILE;
  delete process.env.COURSE_CATALOG_DATA_FILE;
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

test('creates and lists sessions sorted by unique session number', () => {
  addSession('course-source', 3);
  addSession('course-source', 1);

  const result = CourseSessionsModel.list('course-source');
  assert.deepEqual(result.sessions.map(session => session.number), [1, 3]);
  assert.equal(result.sessionCount, 4);
  assert.equal(result.course.code, 'CS101');
  assert.deepEqual(readRecords()[0].sessions.map(session => session.number), [1, 3]);
});

test('rejects duplicate and out-of-range session numbers', () => {
  addSession('course-source', 2);
  expectCode(
    () => addSession('course-source', 2, 'Chủ đề trùng'),
    'SESSION_NUMBER_DUPLICATE',
    409
  );
  expectCode(
    () => addSession('course-source', 5),
    'SESSION_NUMBER_OUT_OF_RANGE',
    400
  );
});

test('does not allow more declared sessions than the course session count', () => {
  addSession('course-small', 1);
  addSession('course-small', 2);
  expectCode(
    () => addSession('course-small', 3),
    'SESSION_LIMIT_EXCEEDED',
    409
  );
  assert.equal(CourseSessionsModel.list('course-small').sessions.length, 2);
});

test('updates session content and rejects a conflicting session number', () => {
  addSession('course-source', 1);
  addSession('course-source', 2);

  const updated = CourseSessionsModel.update('course-source', 1, {
    number: 1,
    topic: 'Chủ đề đã cập nhật',
    objectives: 'Mục tiêu đã cập nhật'
  });
  assert.equal(updated.sessions[0].topic, 'Chủ đề đã cập nhật');
  expectCode(
    () => CourseSessionsModel.update('course-source', 1, {
      number: 2,
      topic: 'Chủ đề bị trùng',
      objectives: 'Mục tiêu'
    }),
    'SESSION_NUMBER_DUPLICATE',
    409
  );
});

test('deletes a session and reports missing session identifiers', () => {
  addSession('course-source', 1);
  const result = CourseSessionsModel.remove('course-source', 1);
  assert.deepEqual(result.sessions, []);
  assert.deepEqual(readRecords(), []);
  expectCode(() => CourseSessionsModel.remove('course-source', 1), 'SESSION_NOT_FOUND', 404);
});

test('clones and replaces a target list with an independent copy', () => {
  addSession('course-source', 3);
  addSession('course-source', 1);
  addSession('course-target', 2, 'Nội dung cũ');

  const copied = CourseSessionsModel.clone('course-source', 'course-target');
  assert.deepEqual(copied.sessions.map(session => session.number), [1, 3]);
  assert.equal(copied.courseId, 'course-target');
  assert.equal(readRecords().find(record => record.courseId === 'course-target').sessions.length, 2);

  CourseSessionsModel.update('course-target', 1, {
    number: 1,
    topic: 'Chỉ sửa ở môn đích',
    objectives: 'Mục tiêu riêng'
  });
  assert.equal(CourseSessionsModel.list('course-source').sessions[0].topic, 'Chủ đề 1');
});

test('rejects a clone exceeding target capacity or using the same course', () => {
  addSession('course-source', 1);
  addSession('course-source', 2);
  addSession('course-source', 3);
  expectCode(
    () => CourseSessionsModel.clone('course-source', 'course-small'),
    'SESSION_LIMIT_EXCEEDED',
    409
  );
  expectCode(
    () => CourseSessionsModel.clone('course-source', 'course-source'),
    'SAME_SOURCE_AND_TARGET',
    400
  );

  fs.writeFileSync(process.env.COURSE_SESSIONS_DATA_FILE, JSON.stringify([{
    courseId: 'course-source',
    sessions: [{ number: 3, topic: 'Chủ đề', objectives: 'Mục tiêu' }]
  }]), 'utf8');
  expectCode(
    () => CourseSessionsModel.clone('course-source', 'course-small'),
    'SESSION_NUMBER_OUT_OF_RANGE',
    409
  );
});

test('rejects invalid course ids, missing courses, and incomplete session details', () => {
  expectCode(() => CourseSessionsModel.list('missing'), 'COURSE_NOT_FOUND', 404);
  expectCode(() => CourseSessionsModel.list('  '), 'INVALID_COURSE_ID', 400);
  assert.throws(
    () => CourseSessionsModel.create('course-source', { number: 1, topic: '', objectives: 'Mục tiêu' }),
    error => error.code === 'INVALID_SESSION_TOPIC'
  );
  assert.throws(
    () => CourseSessionsModel.create('course-source', { number: 1, topic: 'Chủ đề', objectives: '' }),
    error => error.code === 'INVALID_SESSION_OBJECTIVES'
  );
});

test('reports missing course catalog data instead of treating it as an empty catalog', () => {
  fs.rmSync(process.env.COURSE_CATALOG_DATA_FILE);
  assert.throws(() => CourseSessionsModel.list('course-source'), /Không tìm thấy dữ liệu danh mục môn học/);
});

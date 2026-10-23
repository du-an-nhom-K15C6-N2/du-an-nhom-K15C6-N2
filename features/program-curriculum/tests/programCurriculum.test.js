'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, beforeEach, test } = require('node:test');

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'program-curriculum-'));
process.env.PROGRAM_CURRICULA_DATA_FILE = path.join(tempDirectory, 'program-curricula.json');
process.env.COURSE_CATALOG_DATA_FILE = path.join(tempDirectory, 'courses.json');

const { ProgramCurriculumError, ProgramCurriculumModel } = require('../backend/programCurriculumModel');
const programId = 'CNTT-2026';
const courses = [
  { id: 'course-foundation', code: 'CS101', name: 'Nền tảng' },
  { id: 'course-intermediate', code: 'CS201', name: 'Trung cấp' },
  { id: 'course-advanced', code: 'CS301', name: 'Nâng cao' },
  { id: 'course-elective', code: 'CS401', name: 'Tự chọn' }
];

function readCurricula() {
  return JSON.parse(fs.readFileSync(process.env.PROGRAM_CURRICULA_DATA_FILE, 'utf8'));
}

function addCourses(...courseIds) {
  for (const courseId of courseIds) ProgramCurriculumModel.addCourse(programId, courseId);
}

function expectCode(callback, code, status) {
  assert.throws(callback, error => (
    error instanceof ProgramCurriculumError
    && error.code === code
    && error.status === status
  ));
}

beforeEach(() => {
  fs.writeFileSync(process.env.COURSE_CATALOG_DATA_FILE, JSON.stringify(courses), 'utf8');
  fs.writeFileSync(process.env.PROGRAM_CURRICULA_DATA_FILE, '[]', 'utf8');
});

after(() => {
  delete process.env.PROGRAM_CURRICULA_DATA_FILE;
  delete process.env.COURSE_CATALOG_DATA_FILE;
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

test('adds courses once and lists course details with persistent order', () => {
  ProgramCurriculumModel.addCourse(programId, 'course-foundation');
  ProgramCurriculumModel.addCourse(programId, 'course-intermediate');

  const result = ProgramCurriculumModel.list(programId);
  assert.deepEqual(result.courses.map(item => item.course.code), ['CS101', 'CS201']);
  assert.deepEqual(result.courses.map(item => item.order), [1, 2]);
  assert.equal(readCurricula()[0].courses[1].courseId, 'course-intermediate');
  expectCode(() => ProgramCurriculumModel.addCourse(programId, 'course-foundation'), 'COURSE_ALREADY_IN_PROGRAM', 409);
});

test('rejects courses that do not exist in the shared course catalog', () => {
  expectCode(() => ProgramCurriculumModel.addCourse(programId, 'unknown'), 'COURSE_NOT_FOUND', 404);
});

test('removes courses and renumbers the remaining stable order', () => {
  addCourses('course-foundation', 'course-intermediate', 'course-advanced');
  const result = ProgramCurriculumModel.removeCourse(programId, 'course-intermediate');
  assert.deepEqual(result.courses.map(item => [item.courseId, item.order]), [
    ['course-foundation', 1],
    ['course-advanced', 2]
  ]);
});

test('refuses to remove a course that is a prerequisite for another course', () => {
  addCourses('course-foundation', 'course-intermediate');
  ProgramCurriculumModel.setPrerequisites(programId, 'course-intermediate', ['course-foundation']);
  expectCode(
    () => ProgramCurriculumModel.removeCourse(programId, 'course-foundation'),
    'COURSE_HAS_DEPENDENTS',
    409
  );
});

test('persists a complete reordered list and rejects incomplete or prerequisite-breaking order', () => {
  addCourses('course-foundation', 'course-intermediate', 'course-advanced');
  ProgramCurriculumModel.setPrerequisites(programId, 'course-advanced', ['course-foundation']);

  const result = ProgramCurriculumModel.reorder(programId, [
    'course-intermediate',
    'course-foundation',
    'course-advanced'
  ]);
  assert.deepEqual(result.courses.map(item => item.courseId), [
    'course-intermediate',
    'course-foundation',
    'course-advanced'
  ]);
  assert.deepEqual(readCurricula()[0].courses.map(item => item.order), [1, 2, 3]);
  expectCode(
    () => ProgramCurriculumModel.reorder(programId, ['course-advanced', 'course-foundation', 'course-intermediate']),
    'PREREQUISITE_ORDER_INVALID',
    409
  );
  expectCode(
    () => ProgramCurriculumModel.reorder(programId, ['course-foundation']),
    'INVALID_COURSE_ORDER',
    400
  );
});

test('requires prerequisites to be attached earlier in the program', () => {
  addCourses('course-foundation', 'course-intermediate');
  expectCode(
    () => ProgramCurriculumModel.setPrerequisites(programId, 'course-foundation', ['course-intermediate']),
    'PREREQUISITE_ORDER_INVALID',
    409
  );
  expectCode(
    () => ProgramCurriculumModel.setPrerequisites(programId, 'course-intermediate', ['course-elective']),
    'PREREQUISITE_NOT_IN_PROGRAM',
    400
  );
});

test('rejects prerequisite cycles and returns prerequisite course details', () => {
  addCourses('course-foundation', 'course-intermediate', 'course-advanced');
  ProgramCurriculumModel.setPrerequisites(programId, 'course-intermediate', ['course-foundation']);
  ProgramCurriculumModel.setPrerequisites(programId, 'course-advanced', ['course-intermediate']);

  expectCode(
    () => ProgramCurriculumModel.setPrerequisites(programId, 'course-foundation', ['course-advanced']),
    'PREREQUISITE_CYCLE',
    409
  );
  const result = ProgramCurriculumModel.list(programId);
  assert.deepEqual(result.courses[2].prerequisites, [{
    id: 'course-intermediate',
    code: 'CS201',
    name: 'Trung cấp'
  }]);
});

test('rejects self-reference and invalid order payloads', () => {
  addCourses('course-foundation');
  expectCode(
    () => ProgramCurriculumModel.setPrerequisites(programId, 'course-foundation', ['course-foundation']),
    'PREREQUISITE_SELF_REFERENCE',
    400
  );
  expectCode(
    () => ProgramCurriculumModel.reorder(programId, ['course-foundation', 'course-foundation']),
    'INVALID_COURSE_ORDER',
    400
  );
});

test('reports missing course catalog data rather than treating it as an empty catalog', () => {
  fs.rmSync(process.env.COURSE_CATALOG_DATA_FILE);
  assert.throws(() => ProgramCurriculumModel.list(programId), /Không tìm thấy dữ liệu danh mục môn học/);
});

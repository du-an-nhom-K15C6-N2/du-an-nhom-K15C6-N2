'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, beforeEach, test } = require('node:test');

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'course-catalog-'));
process.env.COURSE_CATALOG_DATA_FILE = path.join(tempDirectory, 'courses.json');
process.env.CLASS_DATA_FILE = path.join(tempDirectory, 'classes.json');

const { CourseCatalogError, CourseCatalogModel } = require('../backend/courseCatalogModel');

function createCourse(overrides = {}) {
  return {
    code: 'CS101',
    name: 'Cơ sở dữ liệu',
    sessionCount: 12,
    weight: 1.5,
    outcomesDescription: 'Thiết kế và truy vấn cơ sở dữ liệu.',
    programIds: ['CNTT', 'QTKD'],
    ...overrides
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

beforeEach(() => {
  fs.writeFileSync(process.env.COURSE_CATALOG_DATA_FILE, '[]', 'utf8');
  fs.writeFileSync(process.env.CLASS_DATA_FILE, '[]', 'utf8');
});

after(() => {
  delete process.env.COURSE_CATALOG_DATA_FILE;
  delete process.env.CLASS_DATA_FILE;
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

test('creates a reusable course and searches it with pagination metadata', () => {
  const created = CourseCatalogModel.create(createCourse());
  assert.equal(created.code, 'CS101');
  assert.deepEqual(created.programIds, ['CNTT', 'QTKD']);
  assert.equal(created.classCount, 0);

  const result = CourseCatalogModel.list({ q: 'co so du lieu', page: 1, pageSize: 1 });
  assert.equal(result.pagination.total, 1);
  assert.equal(result.pagination.page, 1);
  assert.equal(result.items[0].id, created.id);
});

test('rejects duplicate course codes regardless of letter case', () => {
  CourseCatalogModel.create(createCourse());
  assert.throws(
    () => CourseCatalogModel.create(createCourse({ code: 'cs101' })),
    error => error instanceof CourseCatalogError
      && error.status === 409
      && error.code === 'COURSE_CODE_DUPLICATE'
  );
});

test('updates a course and prevents changing its code to a duplicate', () => {
  const first = CourseCatalogModel.create(createCourse({ code: 'DB101' }));
  const second = CourseCatalogModel.create(createCourse({ code: 'DB102', name: 'Thiết kế phần mềm' }));

  const updated = CourseCatalogModel.update(first.id, { name: 'Cơ sở dữ liệu nâng cao' });
  assert.equal(updated.name, 'Cơ sở dữ liệu nâng cao');
  assert.deepEqual(updated.programIds, ['CNTT', 'QTKD']);

  assert.throws(
    () => CourseCatalogModel.update(second.id, { code: first.code }),
    error => error instanceof CourseCatalogError && error.code === 'COURSE_CODE_DUPLICATE'
  );
});

test('refuses to delete courses referenced by a class', () => {
  const course = CourseCatalogModel.create(createCourse({ code: 'WEB101' }));
  fs.writeFileSync(process.env.CLASS_DATA_FILE, JSON.stringify([{ id: 'class-1', courseId: course.id }]), 'utf8');

  assert.throws(
    () => CourseCatalogModel.delete(course.id),
    error => error instanceof CourseCatalogError
      && error.status === 409
      && error.code === 'COURSE_HAS_CLASSES'
      && error.message.includes('1 lớp học')
  );
  assert.equal(CourseCatalogModel.list().items.some(item => item.id === course.id), true);
});

test('deletes a course that has no associated classes', () => {
  fs.writeFileSync(process.env.CLASS_DATA_FILE, '[]', 'utf8');
  const course = CourseCatalogModel.create(createCourse({ code: 'WEB102' }));

  assert.equal(CourseCatalogModel.delete(course.id).id, course.id);
  assert.equal(CourseCatalogModel.list().items.some(item => item.id === course.id), false);
});

test('fails closed when class data is missing', () => {
  const course = CourseCatalogModel.create(createCourse({ code: 'WEB103' }));
  fs.rmSync(process.env.CLASS_DATA_FILE);

  assert.throws(
    () => CourseCatalogModel.delete(course.id),
    error => error.message.includes('không thể xác minh liên kết môn học')
  );
  assert.equal(readJson(process.env.COURSE_CATALOG_DATA_FILE).some(item => item.id === course.id), true);
});

test('rejects invalid pagination and invalid course values', () => {
  assert.throws(
    () => CourseCatalogModel.list({ page: 0 }),
    error => error instanceof CourseCatalogError && error.code === 'INVALID_PAGE'
  );
  assert.throws(
    () => CourseCatalogModel.create(createCourse({ sessionCount: 0 })),
    error => error instanceof CourseCatalogError && error.code === 'INVALID_SESSION_COUNT'
  );
});

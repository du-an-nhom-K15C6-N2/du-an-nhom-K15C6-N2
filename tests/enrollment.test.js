const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const EnrollmentModel = require('../backend/models/enrollmentModel');
const { createEnrollmentController } = require('../backend/controllers/enrollmentController');
const { EnrollmentValidationService } = require('../backend/services/enrollmentValidationService');
const { hasPermission } = require('../backend/config/rolePermissions');

function createRepository({
  capacity = 2,
  existing = [],
  students = ['stu_1', 'stu_2', 'stu_3'],
  room = null
} = {}) {
  const records = [...existing];
  const history = [];
  const repository = {
    records,
    history,
    async findClassById(classId) {
      return String(classId) === 'cls_1'
        ? { id: 'cls_1', maxStudents: capacity, ...room }
        : null;
    },
    async findStudentById(studentId) {
      return students.includes(String(studentId)) ? { id: String(studentId) } : null;
    },
    async countStudentsInClass(classId) {
      return records.filter(record => String(record.classId) === String(classId)).length;
    },
    async isStudentEnrolled(classId, studentId) {
      return records.some(record =>
        String(record.classId) === String(classId)
        && String(record.studentId) === String(studentId)
      );
    },
    async createEnrollmentWithHistory(classId, studentId, entry, maxStudents) {
      if (records.some(record =>
        String(record.classId) === String(classId)
        && String(record.studentId) === String(studentId)
      )) {
        const error = new Error('duplicate');
        error.code = 'ALREADY_ENROLLED';
        throw error;
      }
      if (records.filter(record => String(record.classId) === String(classId)).length >= maxStudents) {
        const error = new Error('full');
        error.code = 'CLASS_FULL';
        throw error;
      }
      records.push({ classId, studentId, ...entry });
      history.push({ classId, studentId, ...entry });
    }
  };
  return repository;
}

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test('bulk enrollment validates duplicate students and class capacity in request order', async () => {
  const repository = createRepository({ capacity: 2 });
  const service = new EnrollmentValidationService(repository);

  const results = await service.enrollStudents('cls_1', ['stu_1', 'stu_1', 'stu_2', 'stu_3'], 'usr_admin');

  assert.deepEqual(results.map(result => result.success ? 'ENROLLED' : result.code), [
    'ENROLLED',
    'ALREADY_ENROLLED',
    'ENROLLED',
    'CLASS_FULL'
  ]);
  assert.equal(repository.records.length, 2);
  assert.equal(repository.history.length, 2);
  assert.ok(repository.history.every(entry => entry.createdBy === 'usr_admin'));
  assert.ok(repository.history.every(entry => !Number.isNaN(Date.parse(entry.enrolledAt))));
});

test('enrollment rejects invalid and missing class or student IDs without writing', async () => {
  const repository = createRepository();
  const service = new EnrollmentValidationService(repository);

  assert.equal((await service.enrollStudent('', 'stu_1', 'usr_admin')).code, 'INVALID_CLASS_ID');
  assert.equal((await service.enrollStudent('missing', 'stu_1', 'usr_admin')).code, 'CLASS_NOT_FOUND');
  assert.equal((await service.enrollStudent('cls_1', '', 'usr_admin')).code, 'INVALID_STUDENT_ID');
  assert.equal((await service.enrollStudent('cls_1', 'missing', 'usr_admin')).code, 'STUDENT_NOT_FOUND');
  assert.equal(repository.records.length, 0);
  assert.equal(repository.history.length, 0);
});

test('enrollment enforces physical room capacity independently of the class limit', async () => {
  const repository = createRepository({
    capacity: 30,
    room: { roomType: 'physical', roomCapacity: 1, roomName: 'A101' }
  });
  const service = new EnrollmentValidationService(repository);

  assert.equal((await service.enrollStudent('cls_1', 'stu_1', 'usr_admin')).success, true);
  const rejected = await service.enrollStudent('cls_1', 'stu_2', 'usr_admin');

  assert.equal(rejected.code, 'ROOM_CAPACITY_EXCEEDED');
  assert.match(rejected.message, /A101.*1 chỗ/);
  assert.equal(repository.records.length, 1);
});

test('persistence writes enrollment and its audit entry together and supports history lookup', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'enrollment-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const repository = new EnrollmentModel(path.join(directory, 'enrollments.json'));
  const enrolledAt = new Date().toISOString();

  repository.createEnrollmentWithHistory('cls_1', 'stu_1', {
    classId: 'cls_1',
    studentId: 'stu_1',
    enrolledAt,
    createdBy: 'usr_admin'
  }, 2);
  repository.createEnrollmentWithHistory('cls_1', 'stu_2', {
    classId: 'cls_1',
    studentId: 'stu_2',
    enrolledAt: new Date(Date.now() + 1).toISOString(),
    createdBy: 'usr_admin'
  }, 2);

  const persisted = JSON.parse(fs.readFileSync(path.join(directory, 'enrollments.json'), 'utf8'));
  assert.equal(persisted.enrollments.length, 2);
  assert.equal(persisted.history.length, 2);
  assert.equal(persisted.enrollments[0].studentId, 'stu_1');
  assert.equal(persisted.history[0].createdBy, 'usr_admin');
  assert.deepEqual(repository.listHistory({ classId: 'cls_1' }).map(entry => entry.studentId), ['stu_2', 'stu_1']);
});

test('controller returns the enrollment result contract and rejects invalid requests', async () => {
  const service = {
    async enrollStudents(classId, studentIds, createdBy) {
      assert.equal(classId, 'cls_1');
      assert.equal(createdBy, 'usr_admin');
      return studentIds.map(studentId => ({
        success: studentId === 'stu_1',
        classId,
        studentId,
        code: 'CLASS_FULL',
        message: 'Lớp đã đạt sĩ số tối đa.'
      }));
    }
  };
  const controller = createEnrollmentController({ service });
  const response = createResponse();

  await controller.create({
    user: { id: 'usr_admin' },
    body: { classId: 'cls_1', studentIds: ['stu_1', 'stu_2'] }
  }, response, error => { throw error; });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.data.summary, { requested: 2, succeeded: 1, failed: 1 });
  assert.equal(response.body.data.results[0].code, 'ENROLLED');
  assert.equal(response.body.data.results[1].status, 409);

  const invalidResponse = createResponse();
  await controller.create({
    user: { id: 'usr_admin' },
    body: { classId: 'cls_1', studentId: 'stu_1', studentIds: ['stu_1'] }
  }, invalidResponse, error => { throw error; });
  assert.equal(invalidResponse.statusCode, 400);
  assert.equal(invalidResponse.body.code, 'INVALID_REQUEST');
});

test('unauthenticated users cannot enroll and only student-management roles have permission', async () => {
  const controller = createEnrollmentController({
    service: { async enrollStudent() { throw new Error('service must not run'); } }
  });
  const response = createResponse();

  await controller.create({ body: { classId: 'cls_1', studentId: 'stu_1' } }, response, error => { throw error; });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.code, 'UNAUTHENTICATED');
  assert.equal(hasPermission({ role: 'admin' }, 'students.manage'), true);
  assert.equal(hasPermission({ role: 'manager' }, 'students.manage'), true);
  assert.equal(hasPermission({ role: 'training_staff' }, 'students.manage'), true);
  assert.equal(hasPermission({ role: 'student' }, 'students.manage'), false);
});

test('storage rejects corrupted enrollment data rather than replacing it with empty data', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'enrollment-corrupt-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const dataFile = path.join(directory, 'enrollments.json');
  fs.writeFileSync(dataFile, JSON.stringify({ enrollments: 'invalid', history: [] }));

  assert.throws(
    () => new EnrollmentModel(dataFile).countStudentsInClass('cls_1'),
    /Dữ liệu ghi danh không hợp lệ/
  );
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'classroom-test-'));
process.env.CLASSROOM_DATA_FILE = path.join(directory, 'classrooms.json');
process.env.CLASS_DATA_FILE = path.join(directory, 'classes.json');
process.env.ENROLLMENT_DATA_FILE = path.join(directory, 'enrollments.json');
fs.writeFileSync(process.env.CLASS_DATA_FILE, JSON.stringify([{
  id: 'cls_room_test',
  code: 'TEST-01',
  name: 'Lớp kiểm thử',
  status: 'active',
  maxStudents: 30
}]));

const ClassroomModel = require('../backend/models/classroomModel');
const ClassModel = require('../backend/models/classModel');
const { createClassroomController, validateRoomPayload } = require('../backend/controllers/classroomController');

test('room payload requires physical capacity and a safe online URL', () => {
  assert.match(validateRoomPayload({ name: 'A101', type: 'physical', capacity: 0 }).error, /số nguyên dương/);
  assert.equal(validateRoomPayload({ name: 'A101', type: 'physical', capacity: 20 }).value.capacity, 20);
  assert.match(validateRoomPayload({ name: 'Online', type: 'online', meetingUrl: 'javascript:alert(1)' }).error, /HTTP hoặc HTTPS/);
  assert.equal(validateRoomPayload({ name: 'Online', type: 'online', meetingUrl: 'https://meet.example.com/class' }).value.type, 'online');
});

test('room API creates rooms and rejects malformed physical capacity', () => {
  const controller = createClassroomController({ rooms: ClassroomModel, classes: ClassModel });
  const response = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };

  controller.create({ body: { name: 'A101', type: 'physical', capacity: 20 } }, response);
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.capacity, 20);

  controller.create({ body: { name: 'A102', type: 'physical', capacity: -1 } }, response);
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.code, 'INVALID_ROOM');
});

test('class assignment rejects a physical room smaller than planned class size and permits online rooms', () => {
  const room = ClassroomModel.create({ name: 'A102', type: 'physical', capacity: 20, meetingUrl: null });
  assert.deepEqual(
    ClassModel.listRoomAlerts().map(item => item.roomIssue),
    ['NO_ROOM']
  );

  assert.throws(
    () => ClassModel.assignRoom('cls_room_test', room.id),
    error => error.code === 'ROOM_CAPACITY_EXCEEDED'
  );

  const onlineRoom = ClassroomModel.create({
    name: 'Meet 01',
    type: 'online',
    capacity: null,
    meetingUrl: 'https://meet.example.com/class'
  });
  const assigned = ClassModel.assignRoom('cls_room_test', onlineRoom.id);
  assert.equal(assigned.roomType, 'online');
  assert.equal(assigned.roomMeetingUrl, onlineRoom.meetingUrl);
  assert.equal(ClassModel.listRoomAlerts().length, 0);
});

test('room capacity cannot be lowered below the size of an assigned class', async () => {
  const room = ClassroomModel.create({ name: 'A201', type: 'physical', capacity: 35, meetingUrl: null });
  ClassModel.assignRoom('cls_room_test', room.id);
  const controller = createClassroomController({ rooms: ClassroomModel, classes: ClassModel });
  const response = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };

  await controller.update({
    params: { id: room.id },
    body: { name: 'A201', type: 'physical', capacity: 20 }
  }, response);

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, 'ROOM_IN_USE');
  assert.equal(ClassroomModel.findById(room.id).capacity, 35);
});

test.after(() => fs.rmSync(directory, { recursive: true, force: true }));

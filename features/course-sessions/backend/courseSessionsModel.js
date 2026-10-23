'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SESSIONS_FILE = path.resolve(__dirname, '../data/course-sessions.json');
const DEFAULT_COURSES_FILE = path.resolve(__dirname, '../../../backend/data/courses.json');
const MAX_TOPIC_LENGTH = 200;
const MAX_OBJECTIVES_LENGTH = 2000;

class CourseSessionsError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'CourseSessionsError';
    this.status = status;
    this.code = code;
  }
}

function sessionsFile() {
  return process.env.COURSE_SESSIONS_DATA_FILE || DEFAULT_SESSIONS_FILE;
}

function coursesFile() {
  return process.env.COURSE_CATALOG_DATA_FILE || DEFAULT_COURSES_FILE;
}

function readArray(filePath, label, { missingIsEmpty = false } = {}) {
  if (!fs.existsSync(filePath)) {
    if (missingIsEmpty) return [];
    throw new Error(`Không tìm thấy dữ liệu ${label}: ${filePath}`);
  }

  let value;
  try {
    value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Không thể đọc dữ liệu ${label}: ${error.message}`);
  }
  if (!Array.isArray(value)) {
    throw new Error(`Dữ liệu ${label} phải có định dạng danh sách.`);
  }
  return value;
}

function readCourses() {
  return readArray(coursesFile(), 'danh mục môn học');
}

function readRecords() {
  return readArray(sessionsFile(), 'danh sách buổi học', { missingIsEmpty: true });
}

function writeRecords(records) {
  const filePath = sessionsFile();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryFile = `${filePath}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryFile, JSON.stringify(records, null, 2), 'utf8');
    fs.renameSync(temporaryFile, filePath);
  } finally {
    if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
  }
}

function validateCourseId(value, fieldName = 'Mã môn học') {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 120) {
    throw new CourseSessionsError(400, 'INVALID_COURSE_ID', `${fieldName} không hợp lệ.`);
  }
  return value.trim();
}

function getCourse(courseId, catalog) {
  const course = catalog.find(item => item && item.id === courseId);
  if (!course) {
    throw new CourseSessionsError(404, 'COURSE_NOT_FOUND', 'Không tìm thấy môn học trong danh mục.');
  }
  if (!Number.isInteger(course.sessionCount) || course.sessionCount < 0) {
    throw new Error(`Số buổi học của môn "${courseId}" không hợp lệ trong danh mục.`);
  }
  return course;
}

function validateSession(input, { sessionCount } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new CourseSessionsError(400, 'INVALID_SESSION', 'Thông tin buổi học không hợp lệ.');
  }

  const number = input.number;
  if (!Number.isInteger(number) || number < 1) {
    throw new CourseSessionsError(400, 'INVALID_SESSION_NUMBER', 'Số thứ tự buổi học phải là số nguyên dương.');
  }
  if (sessionCount !== undefined && number > sessionCount) {
    throw new CourseSessionsError(
      400,
      'SESSION_NUMBER_OUT_OF_RANGE',
      `Số thứ tự buổi học không được vượt quá ${sessionCount}.`
    );
  }

  const topic = typeof input.topic === 'string' ? input.topic.trim() : '';
  const objectives = typeof input.objectives === 'string' ? input.objectives.trim() : '';
  if (!topic || topic.length > MAX_TOPIC_LENGTH) {
    throw new CourseSessionsError(
      400,
      'INVALID_SESSION_TOPIC',
      `Chủ đề buổi học không được để trống và không vượt quá ${MAX_TOPIC_LENGTH} ký tự.`
    );
  }
  if (!objectives || objectives.length > MAX_OBJECTIVES_LENGTH) {
    throw new CourseSessionsError(
      400,
      'INVALID_SESSION_OBJECTIVES',
      `Mục tiêu buổi học không được để trống và không vượt quá ${MAX_OBJECTIVES_LENGTH} ký tự.`
    );
  }
  return { number, topic, objectives };
}

function validateStoredSessions(courseId, sessions, sessionCount) {
  if (!Array.isArray(sessions)) {
    throw new Error(`Danh sách buổi học của môn "${courseId}" phải có định dạng mảng.`);
  }
  if (sessions.length > sessionCount) {
    throw new Error(`Dữ liệu buổi học của môn "${courseId}" vượt quá số buổi cho phép.`);
  }

  const seenNumbers = new Set();
  return sessions.map(session => {
    const validated = validateSession(session, { sessionCount });
    if (seenNumbers.has(validated.number)) {
      throw new Error(`Dữ liệu buổi học của môn "${courseId}" bị trùng số thứ tự ${validated.number}.`);
    }
    seenNumbers.add(validated.number);
    return validated;
  }).sort((first, second) => first.number - second.number);
}

function loadCourse(courseId) {
  const catalog = readCourses();
  const course = getCourse(courseId, catalog);
  const records = readRecords();
  const record = records.find(item => item && item.courseId === courseId);
  const sessions = validateStoredSessions(courseId, record ? record.sessions : [], course.sessionCount);
  return { catalog, course, records, sessions };
}

function formatCourseSessions(course, sessions) {
  return {
    courseId: course.id,
    course: { id: course.id, code: course.code, name: course.name },
    sessionCount: course.sessionCount,
    sessions: [...sessions]
      .sort((first, second) => first.number - second.number)
      .map(session => ({ ...session }))
  };
}

function saveSessions(records, courseId, sessions) {
  const index = records.findIndex(record => record && record.courseId === courseId);
  if (sessions.length === 0) {
    if (index !== -1) records.splice(index, 1);
  } else {
    const record = { courseId, sessions };
    if (index === -1) records.push(record);
    else records[index] = record;
  }
  writeRecords(records);
}

function assertWithinCourseLimit(sessions, course) {
  if (sessions.length > course.sessionCount) {
    throw new CourseSessionsError(
      409,
      'SESSION_LIMIT_EXCEEDED',
      `Môn học chỉ có ${course.sessionCount} buổi; không thể khai báo thêm.`
    );
  }
}

class CourseSessionsModel {
  static list(courseIdInput) {
    const courseId = validateCourseId(courseIdInput);
    const { course, sessions } = loadCourse(courseId);
    return formatCourseSessions(course, sessions);
  }

  static create(courseIdInput, input) {
    const courseId = validateCourseId(courseIdInput);
    const { course, records, sessions } = loadCourse(courseId);
    const newSession = validateSession(input);
    if (sessions.some(session => session.number === newSession.number)) {
      throw new CourseSessionsError(
        409,
        'SESSION_NUMBER_DUPLICATE',
        `Buổi số ${newSession.number} đã được khai báo trong môn học này.`
      );
    }
    if (sessions.length >= course.sessionCount) {
      throw new CourseSessionsError(
        409,
        'SESSION_LIMIT_EXCEEDED',
        `Môn học chỉ có ${course.sessionCount} buổi; không thể khai báo thêm.`
      );
    }
    if (newSession.number > course.sessionCount) {
      throw new CourseSessionsError(
        400,
        'SESSION_NUMBER_OUT_OF_RANGE',
        `Số thứ tự buổi học không được vượt quá ${course.sessionCount}.`
      );
    }
    const updated = [...sessions, newSession].sort((first, second) => first.number - second.number);
    saveSessions(records, courseId, updated);
    return formatCourseSessions(course, updated);
  }

  static update(courseIdInput, numberInput, input) {
    const courseId = validateCourseId(courseIdInput);
    if (!Number.isInteger(numberInput) || numberInput < 1) {
      throw new CourseSessionsError(400, 'INVALID_SESSION_NUMBER', 'Số thứ tự buổi học phải là số nguyên dương.');
    }
    const { course, records, sessions } = loadCourse(courseId);
    const existingIndex = sessions.findIndex(session => session.number === numberInput);
    if (existingIndex === -1) {
      throw new CourseSessionsError(404, 'SESSION_NOT_FOUND', 'Không tìm thấy buổi học cần cập nhật.');
    }

    const updatedSession = validateSession(input, { sessionCount: course.sessionCount });
    if (
      updatedSession.number !== numberInput
      && sessions.some(session => session.number === updatedSession.number)
    ) {
      throw new CourseSessionsError(
        409,
        'SESSION_NUMBER_DUPLICATE',
        `Buổi số ${updatedSession.number} đã được khai báo trong môn học này.`
      );
    }
    const updated = sessions.map(session => (
      session.number === numberInput ? updatedSession : session
    )).sort((first, second) => first.number - second.number);
    assertWithinCourseLimit(updated, course);
    saveSessions(records, courseId, updated);
    return formatCourseSessions(course, updated);
  }

  static remove(courseIdInput, numberInput) {
    const courseId = validateCourseId(courseIdInput);
    if (!Number.isInteger(numberInput) || numberInput < 1) {
      throw new CourseSessionsError(400, 'INVALID_SESSION_NUMBER', 'Số thứ tự buổi học phải là số nguyên dương.');
    }
    const { course, records, sessions } = loadCourse(courseId);
    if (!sessions.some(session => session.number === numberInput)) {
      throw new CourseSessionsError(404, 'SESSION_NOT_FOUND', 'Không tìm thấy buổi học cần xoá.');
    }
    const updated = sessions.filter(session => session.number !== numberInput);
    saveSessions(records, courseId, updated);
    return formatCourseSessions(course, updated);
  }

  static clone(sourceCourseIdInput, targetCourseIdInput) {
    const sourceCourseId = validateCourseId(sourceCourseIdInput, 'Mã môn nguồn');
    const targetCourseId = validateCourseId(targetCourseIdInput, 'Mã môn đích');
    if (sourceCourseId === targetCourseId) {
      throw new CourseSessionsError(400, 'SAME_SOURCE_AND_TARGET', 'Môn nguồn và môn đích phải khác nhau.');
    }

    const catalog = readCourses();
    const sourceCourse = getCourse(sourceCourseId, catalog);
    const targetCourse = getCourse(targetCourseId, catalog);
    const records = readRecords();
    const sourceRecord = records.find(record => record && record.courseId === sourceCourseId);
    const sourceSessions = validateStoredSessions(
      sourceCourseId,
      sourceRecord ? sourceRecord.sessions : [],
      sourceCourse.sessionCount
    );
    assertWithinCourseLimit(sourceSessions, targetCourse);

    const copiedSessions = sourceSessions.map(session => ({ ...session }));
    for (const session of copiedSessions) {
      if (session.number > targetCourse.sessionCount) {
        throw new CourseSessionsError(
          409,
          'SESSION_NUMBER_OUT_OF_RANGE',
          `Buổi số ${session.number} vượt quá số buổi của môn đích (${targetCourse.sessionCount}).`
        );
      }
    }
    saveSessions(records, targetCourseId, copiedSessions);
    return formatCourseSessions(targetCourse, copiedSessions);
  }
}

module.exports = { CourseSessionsError, CourseSessionsModel };

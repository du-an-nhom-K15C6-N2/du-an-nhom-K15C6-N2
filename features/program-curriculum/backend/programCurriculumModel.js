'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_CURRICULA_FILE = path.resolve(__dirname, '../data/program-curricula.json');
const DEFAULT_COURSES_FILE = path.resolve(__dirname, '../../../backend/data/courses.json');

class ProgramCurriculumError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ProgramCurriculumError';
    this.status = status;
    this.code = code;
  }
}

function curriculaFile() {
  return process.env.PROGRAM_CURRICULA_DATA_FILE || DEFAULT_CURRICULA_FILE;
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

function writeCurricula(records) {
  const filePath = curriculaFile();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryFile = `${filePath}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryFile, JSON.stringify(records, null, 2), 'utf8');
    fs.renameSync(temporaryFile, filePath);
  } finally {
    if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
  }
}

function validateProgramId(programId) {
  if (typeof programId !== 'string' || !programId.trim()) {
    throw new ProgramCurriculumError(400, 'INVALID_PROGRAM_ID', 'Mã chương trình không được để trống.');
  }
  return programId.trim();
}

function validateCourseId(courseId) {
  if (typeof courseId !== 'string' || !courseId.trim()) {
    throw new ProgramCurriculumError(400, 'INVALID_COURSE_ID', 'Mã định danh môn học không hợp lệ.');
  }
  return courseId.trim();
}

function readCourses() {
  return readArray(coursesFile(), 'danh mục môn học');
}

function readCurricula() {
  return readArray(curriculaFile(), 'chương trình đào tạo', { missingIsEmpty: true });
}

function getProgramRecord(records, programId) {
  return records.find(record => record.programId === programId)
    || { programId, courses: [] };
}

function validateEntries(entries) {
  if (!Array.isArray(entries)) {
    throw new Error('Danh sách môn học trong chương trình phải có định dạng mảng.');
  }

  const seen = new Set();
  return entries.map((entry, index) => {
    if (!entry || typeof entry.courseId !== 'string' || !entry.courseId.trim()) {
      throw new Error('Dữ liệu chương trình có môn học không hợp lệ.');
    }
    const courseId = entry.courseId.trim();
    if (seen.has(courseId)) {
      throw new Error(`Dữ liệu chương trình bị trùng môn học "${courseId}".`);
    }
    seen.add(courseId);

    const prerequisiteIds = entry.prerequisiteIds === undefined ? [] : entry.prerequisiteIds;
    if (!Array.isArray(prerequisiteIds) || prerequisiteIds.some(id => typeof id !== 'string')) {
      throw new Error(`Danh sách môn tiên quyết của "${courseId}" không hợp lệ.`);
    }
    return {
      courseId,
      order: index + 1,
      prerequisiteIds: [...new Set(prerequisiteIds)]
    };
  });
}

function assertCoursesExist(entries, courseCatalog) {
  const availableIds = new Set(courseCatalog.map(course => course.id));
  for (const entry of entries) {
    if (!availableIds.has(entry.courseId)) {
      throw new ProgramCurriculumError(
        409,
        'CURRICULUM_COURSE_MISSING',
        `Môn học "${entry.courseId}" không còn trong danh mục môn học.`
      );
    }
  }
}

function assertNoPrerequisiteCycle(entries, changedCourseId, prerequisiteIds) {
  const graph = new Map(entries.map(entry => [
    entry.courseId,
    entry.courseId === changedCourseId ? prerequisiteIds : entry.prerequisiteIds
  ]));
  const visiting = new Set();
  const visited = new Set();

  function visit(courseId) {
    if (visiting.has(courseId)) return false;
    if (visited.has(courseId)) return true;
    visiting.add(courseId);
    for (const prerequisiteId of graph.get(courseId) || []) {
      if (graph.has(prerequisiteId) && !visit(prerequisiteId)) return false;
    }
    visiting.delete(courseId);
    visited.add(courseId);
    return true;
  }

  for (const courseId of graph.keys()) {
    if (!visit(courseId)) {
      throw new ProgramCurriculumError(
        409,
        'PREREQUISITE_CYCLE',
        'Không thể khai báo môn tiên quyết vì quan hệ này tạo thành vòng lặp.'
      );
    }
  }
}

function assertPrerequisitesComeFirst(entries) {
  const position = new Map(entries.map((entry, index) => [entry.courseId, index]));
  for (const entry of entries) {
    for (const prerequisiteId of entry.prerequisiteIds) {
      const prerequisitePosition = position.get(prerequisiteId);
      if (prerequisitePosition === undefined) {
        throw new ProgramCurriculumError(
          400,
          'PREREQUISITE_NOT_IN_PROGRAM',
          `Môn tiên quyết "${prerequisiteId}" phải được gắn vào chương trình trước.`
        );
      }
      if (prerequisitePosition >= position.get(entry.courseId)) {
        throw new ProgramCurriculumError(
          409,
          'PREREQUISITE_ORDER_INVALID',
          'Môn tiên quyết phải đứng trước môn học trong thứ tự chương trình.'
        );
      }
    }
  }
}

function saveProgram(records, programId, entries) {
  const index = records.findIndex(record => record.programId === programId);
  const programRecord = { programId, courses: entries };
  if (index === -1) records.push(programRecord);
  else records[index] = programRecord;
  writeCurricula(records);
}

function formatProgram(programId, entries, courseCatalog) {
  const coursesById = new Map(courseCatalog.map(course => [course.id, course]));
  return {
    programId,
    courses: entries.map(entry => ({
      courseId: entry.courseId,
      order: entry.order,
      prerequisiteIds: [...entry.prerequisiteIds],
      prerequisites: entry.prerequisiteIds.map(id => {
        const course = coursesById.get(id);
        return course ? { id: course.id, code: course.code, name: course.name } : null;
      }),
      course: (() => {
        const course = coursesById.get(entry.courseId);
        return course ? { id: course.id, code: course.code, name: course.name } : null;
      })()
    }))
  };
}

function loadProgram(programId) {
  const courseCatalog = readCourses();
  const records = readCurricula();
  const entries = validateEntries(getProgramRecord(records, programId).courses);
  assertCoursesExist(entries, courseCatalog);
  return { courseCatalog, records, entries };
}

class ProgramCurriculumModel {
  static list(programIdInput) {
    const programId = validateProgramId(programIdInput);
    const { courseCatalog, entries } = loadProgram(programId);
    return formatProgram(programId, entries, courseCatalog);
  }

  static addCourse(programIdInput, courseIdInput) {
    const programId = validateProgramId(programIdInput);
    const courseId = validateCourseId(courseIdInput);
    const { courseCatalog, records, entries } = loadProgram(programId);
    if (!courseCatalog.some(course => course.id === courseId)) {
      throw new ProgramCurriculumError(404, 'COURSE_NOT_FOUND', 'Không tìm thấy môn học trong danh mục.');
    }
    if (entries.some(entry => entry.courseId === courseId)) {
      throw new ProgramCurriculumError(409, 'COURSE_ALREADY_IN_PROGRAM', 'Môn học đã có trong chương trình.');
    }

    const updated = [...entries, { courseId, prerequisiteIds: [] }]
      .map((entry, index) => ({ ...entry, order: index + 1 }));
    saveProgram(records, programId, updated);
    return formatProgram(programId, updated, courseCatalog);
  }

  static removeCourse(programIdInput, courseIdInput) {
    const programId = validateProgramId(programIdInput);
    const courseId = validateCourseId(courseIdInput);
    const { courseCatalog, records, entries } = loadProgram(programId);
    if (!entries.some(entry => entry.courseId === courseId)) {
      throw new ProgramCurriculumError(404, 'COURSE_NOT_IN_PROGRAM', 'Môn học không có trong chương trình.');
    }
    const dependent = entries.find(entry => entry.prerequisiteIds.includes(courseId));
    if (dependent) {
      const course = courseCatalog.find(item => item.id === dependent.courseId);
      throw new ProgramCurriculumError(
        409,
        'COURSE_HAS_DEPENDENTS',
        `Không thể gỡ môn học vì đang là tiên quyết của "${course ? course.name : dependent.courseId}".`
      );
    }

    const updated = entries
      .filter(entry => entry.courseId !== courseId)
      .map((entry, index) => ({ ...entry, order: index + 1 }));
    saveProgram(records, programId, updated);
    return formatProgram(programId, updated, courseCatalog);
  }

  static reorder(programIdInput, courseIdsInput) {
    const programId = validateProgramId(programIdInput);
    if (!Array.isArray(courseIdsInput) || courseIdsInput.some(id => typeof id !== 'string')) {
      throw new ProgramCurriculumError(400, 'INVALID_COURSE_ORDER', 'Thứ tự môn học phải là một danh sách mã môn.');
    }
    const courseIds = courseIdsInput.map(id => id.trim());
    if (new Set(courseIds).size !== courseIds.length) {
      throw new ProgramCurriculumError(400, 'INVALID_COURSE_ORDER', 'Danh sách thứ tự không được có môn học trùng.');
    }

    const { courseCatalog, records, entries } = loadProgram(programId);
    const currentIds = new Set(entries.map(entry => entry.courseId));
    if (courseIds.length !== entries.length || courseIds.some(id => !currentIds.has(id))) {
      throw new ProgramCurriculumError(
        400,
        'INVALID_COURSE_ORDER',
        'Thứ tự cập nhật phải chứa chính xác tất cả môn học đang có trong chương trình.'
      );
    }

    const entriesById = new Map(entries.map(entry => [entry.courseId, entry]));
    const updated = courseIds.map((courseId, index) => ({
      ...entriesById.get(courseId),
      order: index + 1
    }));
    assertPrerequisitesComeFirst(updated);
    saveProgram(records, programId, updated);
    return formatProgram(programId, updated, courseCatalog);
  }

  static setPrerequisites(programIdInput, courseIdInput, prerequisiteIdsInput) {
    const programId = validateProgramId(programIdInput);
    const courseId = validateCourseId(courseIdInput);
    if (!Array.isArray(prerequisiteIdsInput) || prerequisiteIdsInput.some(id => typeof id !== 'string')) {
      throw new ProgramCurriculumError(400, 'INVALID_PREREQUISITES', 'Danh sách môn tiên quyết phải có định dạng mảng.');
    }
    const prerequisiteIds = prerequisiteIdsInput.map(id => id.trim());
    if (prerequisiteIds.some(id => !id) || new Set(prerequisiteIds).size !== prerequisiteIds.length) {
      throw new ProgramCurriculumError(
        400,
        'INVALID_PREREQUISITES',
        'Môn tiên quyết không được để trống hoặc trùng lặp.'
      );
    }
    if (prerequisiteIds.includes(courseId)) {
      throw new ProgramCurriculumError(400, 'PREREQUISITE_SELF_REFERENCE', 'Môn học không thể là tiên quyết của chính nó.');
    }

    const { courseCatalog, records, entries } = loadProgram(programId);
    if (!entries.some(entry => entry.courseId === courseId)) {
      throw new ProgramCurriculumError(404, 'COURSE_NOT_IN_PROGRAM', 'Môn học không có trong chương trình.');
    }
    for (const prerequisiteId of prerequisiteIds) {
      if (!entries.some(entry => entry.courseId === prerequisiteId)) {
        throw new ProgramCurriculumError(
          400,
          'PREREQUISITE_NOT_IN_PROGRAM',
          `Môn tiên quyết "${prerequisiteId}" phải được gắn vào chương trình trước.`
        );
      }
    }

    assertNoPrerequisiteCycle(entries, courseId, prerequisiteIds);
    const updated = entries.map(entry => (
      entry.courseId === courseId ? { ...entry, prerequisiteIds } : entry
    ));
    assertPrerequisitesComeFirst(updated);
    saveProgram(records, programId, updated);
    return formatProgram(programId, updated, courseCatalog);
  }
}

module.exports = { ProgramCurriculumError, ProgramCurriculumModel };

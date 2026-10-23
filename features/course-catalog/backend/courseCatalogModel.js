'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEFAULT_COURSE_FILE = path.resolve(__dirname, '../../../backend/data/courses.json');
const DEFAULT_CLASS_FILE = path.resolve(__dirname, '../../../backend/data/classes.json');
const MAX_PAGE_SIZE = 100;

class CourseCatalogError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'CourseCatalogError';
    this.status = status;
    this.code = code;
  }
}

function getCourseFile() {
  return process.env.COURSE_CATALOG_DATA_FILE || DEFAULT_COURSE_FILE;
}

function getClassFile() {
  return process.env.CLASS_DATA_FILE || DEFAULT_CLASS_FILE;
}

function readArray(filePath, label, { required = false } = {}) {
  if (!fs.existsSync(filePath)) {
    if (required) throw new Error(`Không tìm thấy dữ liệu ${label}; không thể xác minh liên kết môn học.`);
    return [];
  }

  let records;
  try {
    records = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Không thể đọc dữ liệu ${label}: ${error.message}`);
  }
  if (!Array.isArray(records)) {
    throw new Error(`Dữ liệu ${label} phải có định dạng danh sách.`);
  }
  return records;
}

function writeCourses(courses) {
  const filePath = getCourseFile();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(courses, null, 2), 'utf8');
}

function normalizeCode(code) {
  return code.trim().toLocaleUpperCase('vi');
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLocaleLowerCase('vi');
}

function normalizeProgramIds(value) {
  if (!Array.isArray(value)) {
    throw new CourseCatalogError(400, 'INVALID_PROGRAM_IDS', 'Danh sách chương trình phải là một mảng mã chương trình.');
  }

  const programIds = value.map(programId => {
    if (typeof programId !== 'string' || !programId.trim()) {
      throw new CourseCatalogError(400, 'INVALID_PROGRAM_IDS', 'Mã chương trình không được để trống.');
    }
    return programId.trim();
  });
  return [...new Set(programIds)];
}

function validateCourse(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new CourseCatalogError(400, 'INVALID_COURSE', 'Thông tin môn học không hợp lệ.');
  }

  const code = typeof input.code === 'string' ? input.code.trim() : '';
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const outcomesDescription = typeof input.outcomesDescription === 'string'
    ? input.outcomesDescription.trim()
    : '';
  const sessionCount = Number(input.sessionCount);
  const weight = Number(input.weight);

  if (!code) {
    throw new CourseCatalogError(400, 'COURSE_CODE_REQUIRED', 'Vui lòng nhập mã môn học.');
  }
  if (!name) {
    throw new CourseCatalogError(400, 'COURSE_NAME_REQUIRED', 'Vui lòng nhập tên môn học.');
  }
  if (!Number.isInteger(sessionCount) || sessionCount <= 0) {
    throw new CourseCatalogError(400, 'INVALID_SESSION_COUNT', 'Số buổi phải là số nguyên lớn hơn 0.');
  }
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new CourseCatalogError(400, 'INVALID_COURSE_WEIGHT', 'Trọng số phải là số lớn hơn 0.');
  }
  if (!outcomesDescription) {
    throw new CourseCatalogError(400, 'COURSE_OUTCOMES_REQUIRED', 'Vui lòng nhập mô tả chuẩn đầu ra.');
  }

  return {
    code: normalizeCode(code),
    name,
    sessionCount,
    weight,
    outcomesDescription,
    programIds: normalizeProgramIds(input.programIds === undefined ? [] : input.programIds)
  };
}

function getClassCount(course, classes) {
  const normalizedCode = normalizeCode(course.code);
  return classes.filter(item => item && (
    item.courseId === course.id
    || (typeof item.courseCode === 'string' && normalizeCode(item.courseCode) === normalizedCode)
  )).length;
}

function validatePagination(query = {}) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const pageSize = query.pageSize === undefined ? 20 : Number(query.pageSize);
  if (!Number.isInteger(page) || page < 1) {
    throw new CourseCatalogError(400, 'INVALID_PAGE', 'Trang phải là số nguyên lớn hơn hoặc bằng 1.');
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new CourseCatalogError(400, 'INVALID_PAGE_SIZE', `Số môn mỗi trang phải từ 1 đến ${MAX_PAGE_SIZE}.`);
  }
  return { page, pageSize };
}

class CourseCatalogModel {
  static list(query = {}) {
    const { page, pageSize } = validatePagination(query);
    const search = normalizeSearchText(query.q);
    const programId = typeof query.programId === 'string' ? query.programId.trim() : '';
    const courses = readArray(getCourseFile(), 'danh mục môn học');
    const classes = readArray(getClassFile(), 'lớp học', { required: true });

    const filtered = courses.filter(course => {
      const matchesSearch = !search || [
        course.code,
        course.name,
        course.outcomesDescription
      ].some(value => normalizeSearchText(value).includes(search));
      const matchesProgram = !programId
        || (Array.isArray(course.programIds) && course.programIds.includes(programId));
      return matchesSearch && matchesProgram;
    });

    const offset = (page - 1) * pageSize;
    return {
      items: filtered.slice(offset, offset + pageSize).map(course => ({
        ...course,
        classCount: getClassCount(course, classes)
      })),
      pagination: {
        page,
        pageSize,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / pageSize)
      }
    };
  }

  static create(input) {
    const course = validateCourse(input);
    const courses = readArray(getCourseFile(), 'danh mục môn học');
    if (courses.some(item => normalizeCode(item.code) === course.code)) {
      throw new CourseCatalogError(409, 'COURSE_CODE_DUPLICATE', `Mã môn học "${course.code}" đã được sử dụng.`);
    }

    const now = new Date().toISOString();
    const created = {
      id: `course_${crypto.randomUUID()}`,
      ...course,
      createdAt: now,
      updatedAt: now
    };
    writeCourses([...courses, created]);
    return { ...created, classCount: 0 };
  }

  static update(id, input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new CourseCatalogError(400, 'INVALID_COURSE', 'Thông tin cập nhật môn học không hợp lệ.');
    }
    const courses = readArray(getCourseFile(), 'danh mục môn học');
    const index = courses.findIndex(course => course.id === id);
    if (index === -1) {
      throw new CourseCatalogError(404, 'COURSE_NOT_FOUND', 'Không tìm thấy môn học.');
    }

    const updatedFields = validateCourse({
      ...courses[index],
      ...input
    });
    if (courses.some((course, courseIndex) => (
      courseIndex !== index && normalizeCode(course.code) === updatedFields.code
    ))) {
      throw new CourseCatalogError(409, 'COURSE_CODE_DUPLICATE', `Mã môn học "${updatedFields.code}" đã được sử dụng.`);
    }

    const updated = {
      ...courses[index],
      ...updatedFields,
      updatedAt: new Date().toISOString()
    };
    courses[index] = updated;
    writeCourses(courses);
    return {
      ...updated,
      classCount: getClassCount(updated, readArray(getClassFile(), 'lớp học', { required: true }))
    };
  }

  static delete(id) {
    const courses = readArray(getCourseFile(), 'danh mục môn học');
    const course = courses.find(item => item.id === id);
    if (!course) {
      throw new CourseCatalogError(404, 'COURSE_NOT_FOUND', 'Không tìm thấy môn học.');
    }

    const classCount = getClassCount(course, readArray(getClassFile(), 'lớp học', { required: true }));
    if (classCount > 0) {
      throw new CourseCatalogError(
        409,
        'COURSE_HAS_CLASSES',
        `Không thể xoá môn học "${course.name}" vì đang được ${classCount} lớp học sử dụng.`
      );
    }

    writeCourses(courses.filter(item => item.id !== id));
    return { ...course, classCount: 0 };
  }
}

module.exports = { CourseCatalogError, CourseCatalogModel };

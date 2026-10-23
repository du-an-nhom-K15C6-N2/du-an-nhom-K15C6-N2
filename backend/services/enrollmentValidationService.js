const DEFAULT_CLASS_CAPACITY = 30;

function isValidId(id) {
  if (typeof id === 'number') {
    return Number.isSafeInteger(id) && id > 0;
  }
  return typeof id === 'string' && id.trim().length > 0;
}

function idKey(id) {
  return String(id).trim();
}

function failure(classId, studentId, code, message) {
  return { success: false, classId, studentId, code, message };
}

class EnrollmentValidationService {
  constructor(repository) {
    this.repository = repository;
  }

  async enrollStudent(classId, studentId, createdBy) {
    if (!isValidId(classId)) {
      return failure(classId, studentId, 'INVALID_CLASS_ID', 'ID lớp học không hợp lệ.');
    }

    const classRecord = await this.repository.findClassById(classId);
    if (!classRecord) {
      return failure(classId, studentId, 'CLASS_NOT_FOUND', 'Không tìm thấy lớp học.');
    }

    const enrolledCount = await this.repository.countStudentsInClass(classRecord.id);
    return this.createEnrollmentIfValid(classRecord, studentId, enrolledCount, createdBy);
  }

  async enrollStudents(classId, studentIds, createdBy) {
    if (!isValidId(classId)) {
      return studentIds.map(studentId => failure(
        classId,
        studentId,
        'INVALID_CLASS_ID',
        'ID lớp học không hợp lệ; không thể ghi danh học viên.'
      ));
    }

    const classRecord = await this.repository.findClassById(classId);
    if (!classRecord) {
      return studentIds.map(studentId => failure(
        classId,
        studentId,
        'CLASS_NOT_FOUND',
        'Không tìm thấy lớp học; không thể ghi danh học viên.'
      ));
    }

    let enrolledCount = await this.repository.countStudentsInClass(classRecord.id);
    const enrolledInThisBatch = new Set();
    const results = [];

    for (const studentId of studentIds) {
      if (isValidId(studentId) && enrolledInThisBatch.has(idKey(studentId))) {
        results.push(failure(
          classRecord.id,
          studentId,
          'ALREADY_ENROLLED',
          'Học viên đã được ghi danh vào lớp này trong cùng danh sách.'
        ));
        continue;
      }

      const result = await this.createEnrollmentIfValid(
        classRecord,
        studentId,
        enrolledCount,
        createdBy
      );
      results.push(result);

      if (result.success) {
        enrolledCount += 1;
        enrolledInThisBatch.add(idKey(result.studentId));
      }
    }

    return results;
  }

  async createEnrollmentIfValid(classRecord, studentId, enrolledCount, createdBy) {
    if (!isValidId(studentId)) {
      return failure(classRecord.id, studentId, 'INVALID_STUDENT_ID', 'ID học viên không hợp lệ.');
    }

    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      return failure(classRecord.id, studentId, 'STUDENT_NOT_FOUND', 'Không tìm thấy học viên.');
    }

    if (await this.repository.isStudentEnrolled(classRecord.id, student.id)) {
      return failure(
        classRecord.id,
        student.id,
        'ALREADY_ENROLLED',
        'Học viên đã được ghi danh vào lớp này.'
      );
    }

    const maxStudents = Number.isSafeInteger(classRecord.maxStudents)
      && classRecord.maxStudents > 0
      ? classRecord.maxStudents
      : DEFAULT_CLASS_CAPACITY;
    if (enrolledCount >= maxStudents) {
      return failure(
        classRecord.id,
        student.id,
        'CLASS_FULL',
        `Lớp đã đạt sĩ số tối đa (${maxStudents} học viên).`
      );
    }

    const history = {
      classId: classRecord.id,
      studentId: student.id,
      enrolledAt: new Date().toISOString(),
      createdBy
    };

    try {
      await this.repository.createEnrollmentWithHistory(
        classRecord.id,
        student.id,
        history,
        maxStudents
      );
    } catch (error) {
      if (error?.code === 'ALREADY_ENROLLED' || error?.code === 'CLASS_FULL') {
        return failure(classRecord.id, student.id, error.code, error.message);
      }
      throw error;
    }

    return { success: true, classId: classRecord.id, studentId: student.id };
  }
}

module.exports = { EnrollmentValidationService, DEFAULT_CLASS_CAPACITY };

import type {
  EnrollmentHistoryEntry,
  EnrollmentHistoryRepository,
} from "../04-enrollment-history-audit/enrollment-history.repository";

export type EntityId = string | number;

export interface ClassRecord {
  id: EntityId;
  maxStudents: number;
}

export interface EnrollmentRepository extends EnrollmentHistoryRepository {
  findClassById(classId: EntityId): Promise<ClassRecord | null>;
  findStudentById(studentId: EntityId): Promise<{ id: EntityId } | null>;
  countStudentsInClass(classId: EntityId): Promise<number>;
  isStudentEnrolled(classId: EntityId, studentId: EntityId): Promise<boolean>;
}

export type EnrollmentErrorCode =
  | "INVALID_CLASS_ID"
  | "CLASS_NOT_FOUND"
  | "INVALID_STUDENT_ID"
  | "STUDENT_NOT_FOUND"
  | "CLASS_FULL"
  | "ALREADY_ENROLLED";

export type EnrollmentResult =
  | { success: true; classId: EntityId; studentId: EntityId }
  | {
      success: false;
      classId: unknown;
      studentId: unknown;
      code: EnrollmentErrorCode;
      message: string;
    };

function isValidId(id: unknown): id is EntityId {
  if (typeof id === "number") {
    return Number.isSafeInteger(id) && id > 0;
  }

  return typeof id === "string" && id.trim().length > 0;
}

function idKey(id: EntityId): string {
  return String(id).trim();
}

function failure(
  classId: unknown,
  studentId: unknown,
  code: EnrollmentErrorCode,
  message: string,
): EnrollmentResult {
  return { success: false, classId, studentId, code, message };
}

export class EnrollmentValidationService {
  constructor(private readonly repository: EnrollmentRepository) {}

  async enrollStudent(
    classId: unknown,
    studentId: unknown,
    createdBy: EntityId,
  ): Promise<EnrollmentResult> {
    if (!isValidId(classId)) {
      return failure(
        classId,
        studentId,
        "INVALID_CLASS_ID",
        "ID lớp học không hợp lệ.",
      );
    }

    const classRecord = await this.repository.findClassById(classId);
    if (!classRecord) {
      return failure(
        classId,
        studentId,
        "CLASS_NOT_FOUND",
        "Không tìm thấy lớp học.",
      );
    }

    const enrolledCount =
      await this.repository.countStudentsInClass(classRecord.id);
    return this.createEnrollmentIfValid(
      classRecord,
      studentId,
      enrolledCount,
      createdBy,
    );
  }

  async enrollStudents(
    classId: unknown,
    studentIds: readonly unknown[],
    createdBy: EntityId,
  ): Promise<EnrollmentResult[]> {
    if (!isValidId(classId)) {
      return studentIds.map((studentId) =>
        failure(
          classId,
          studentId,
          "INVALID_CLASS_ID",
          "ID lớp học không hợp lệ; không thể ghi danh học viên.",
        ),
      );
    }

    const classRecord = await this.repository.findClassById(classId);
    if (!classRecord) {
      return studentIds.map((studentId) =>
        failure(
          classId,
          studentId,
          "CLASS_NOT_FOUND",
          "Không tìm thấy lớp học; không thể ghi danh học viên.",
        ),
      );
    }

    let enrolledCount =
      await this.repository.countStudentsInClass(classRecord.id);
    const enrolledInThisBatch = new Set<string>();
    const results: EnrollmentResult[] = [];

    for (const studentId of studentIds) {
      if (isValidId(studentId) && enrolledInThisBatch.has(idKey(studentId))) {
        results.push(
          failure(
            classRecord.id,
            studentId,
            "ALREADY_ENROLLED",
            "Học viên đã được ghi danh vào lớp này trong cùng danh sách.",
          ),
        );
        continue;
      }

      const result = await this.createEnrollmentIfValid(
        classRecord,
        studentId,
        enrolledCount,
        createdBy,
      );
      results.push(result);

      if (result.success) {
        enrolledCount += 1;
        enrolledInThisBatch.add(idKey(result.studentId));
      }
    }

    return results;
  }

  private async createEnrollmentIfValid(
    classRecord: ClassRecord,
    studentId: unknown,
    enrolledCount: number,
    createdBy: EntityId,
  ): Promise<EnrollmentResult> {
    if (!isValidId(studentId)) {
      return failure(
        classRecord.id,
        studentId,
        "INVALID_STUDENT_ID",
        "ID học viên không hợp lệ.",
      );
    }

    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      return failure(
        classRecord.id,
        studentId,
        "STUDENT_NOT_FOUND",
        "Không tìm thấy học viên.",
      );
    }

    if (await this.repository.isStudentEnrolled(classRecord.id, student.id)) {
      return failure(
        classRecord.id,
        student.id,
        "ALREADY_ENROLLED",
        "Học viên đã được ghi danh vào lớp này.",
      );
    }

    if (enrolledCount >= classRecord.maxStudents) {
      return failure(
        classRecord.id,
        student.id,
        "CLASS_FULL",
        `Lớp đã đạt sĩ số tối đa (${classRecord.maxStudents} học viên).`,
      );
    }

    const history: EnrollmentHistoryEntry = {
      classId: classRecord.id,
      studentId: student.id,
      enrolledAt: new Date(),
      createdBy,
    };
    await this.repository.createEnrollmentWithHistory(
      classRecord.id,
      student.id,
      history,
    );
    return { success: true, classId: classRecord.id, studentId: student.id };
  }
}

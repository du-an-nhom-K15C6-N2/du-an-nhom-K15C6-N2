export type AuditEntityId = string | number;

export interface EnrollmentHistoryEntry {
  classId: AuditEntityId;
  studentId: AuditEntityId;
  enrolledAt: Date;
  createdBy: AuditEntityId;
}

export interface EnrollmentHistoryTransaction {
  execute(statement: string, parameters: readonly unknown[]): Promise<void>;
}

export const INSERT_ENROLLMENT_HISTORY_SQL = `
  INSERT INTO enrollment_history (class_id, student_id, enrolled_at, created_by)
  VALUES (?, ?, ?, ?)
`;

export async function insertEnrollmentHistory(
  transaction: EnrollmentHistoryTransaction,
  entry: EnrollmentHistoryEntry,
): Promise<void> {
  await transaction.execute(INSERT_ENROLLMENT_HISTORY_SQL, [
    String(entry.classId),
    String(entry.studentId),
    entry.enrolledAt,
    String(entry.createdBy),
  ]);
}

export interface EnrollmentHistoryRepository {
  /**
   * Persist the enrollment and its history row in the same database transaction.
   * Reject the operation if either write fails.
   */
  createEnrollmentWithHistory(
    classId: AuditEntityId,
    studentId: AuditEntityId,
    history: EnrollmentHistoryEntry,
  ): Promise<void>;
}

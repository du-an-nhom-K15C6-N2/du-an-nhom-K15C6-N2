import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  EnrollmentResults,
  type EnrollmentResultItem,
} from "../05-enrollment-status-feedback-ui/EnrollmentResults";
import "./BulkEnrollment.css";

export type EnrollmentId = string | number;

export interface EnrollmentStudent {
  id: EnrollmentId;
  name: string;
  email?: string;
}

export interface EnrollmentClass {
  id: EnrollmentId;
  name: string;
}

interface BulkEnrollmentProps {
  students: EnrollmentStudent[];
  classes: EnrollmentClass[];
  endpoint?: string;
}

function getErrorMessage(body: unknown, fallback: string): string {
  if (
    body &&
    typeof body === "object" &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }

  return fallback;
}

function getResults(body: unknown): EnrollmentResultItem[] | null {
  const results =
    Array.isArray(body)
      ? body
      : body &&
          typeof body === "object" &&
          "results" in body &&
          Array.isArray(body.results)
        ? body.results
        : null;

  if (
    !results ||
    !results.every(
      (result) =>
        result &&
        typeof result === "object" &&
        "studentId" in result &&
        "success" in result &&
        typeof result.success === "boolean",
    )
  ) {
    return null;
  }

  return results as EnrollmentResultItem[];
}

export function BulkEnrollment({
  students,
  classes,
  endpoint = "/api/enrollments/bulk",
}: BulkEnrollmentProps) {
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [results, setResults] = useState<EnrollmentResultItem[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allStudentsSelected =
    students.length > 0 && selectedStudentIds.size === students.length;
  const selectedCount = selectedStudentIds.size;
  const studentNames = useMemo(
    () => new Map(students.map((student) => [String(student.id), student.name])),
    [students],
  );

  function toggleStudent(studentId: EnrollmentId) {
    const key = String(studentId);
    setSelectedStudentIds((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    setResults([]);
    setError("");
  }

  function toggleAllStudents() {
    setSelectedStudentIds(
      allStudentsSelected
        ? new Set()
        : new Set(students.map((student) => String(student.id))),
    );
    setResults([]);
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClassId || selectedCount === 0 || isSubmitting) {
      return;
    }

    const selectedClass = classes.find(
      (item) => String(item.id) === selectedClassId,
    );
    if (!selectedClass) {
      setError("Vui lòng chọn lớp học hợp lệ.");
      return;
    }

    setIsSubmitting(true);
    setResults([]);
    setError("");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: selectedClass.id,
          studentIds: students
            .filter((student) =>
              selectedStudentIds.has(String(student.id)),
            )
            .map((student) => student.id),
        }),
      });

      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          getErrorMessage(body, `Không thể ghi danh (HTTP ${response.status}).`),
        );
      }

      const enrollmentResults = getResults(body);
      if (!enrollmentResults) {
        throw new Error("API trả về dữ liệu kết quả ghi danh không hợp lệ.");
      }
      setResults(enrollmentResults);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Đã xảy ra lỗi khi gửi yêu cầu ghi danh.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="bulk-enrollment" aria-labelledby="bulk-enrollment-title">
      <h2 id="bulk-enrollment-title">Ghi danh học viên vào lớp</h2>

      <form onSubmit={handleSubmit}>
        <div className="bulk-enrollment__class-field">
          <label htmlFor="enrollment-class">Lớp học đích</label>
          <select
            id="enrollment-class"
            value={selectedClassId}
            onChange={(event) => {
              setSelectedClassId(event.target.value);
              setResults([]);
              setError("");
            }}
            disabled={isSubmitting || classes.length === 0}
            required
          >
            <option value="">Chọn lớp học</option>
            {classes.map((classItem) => (
              <option key={classItem.id} value={String(classItem.id)}>
                {classItem.name}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="bulk-enrollment__students">
          <legend>Danh sách học viên</legend>
          {students.length === 0 ? (
            <p className="bulk-enrollment__empty">Không có học viên để hiển thị.</p>
          ) : (
            <>
              <label className="bulk-enrollment__student bulk-enrollment__select-all">
                <input
                  type="checkbox"
                  checked={allStudentsSelected}
                  onChange={toggleAllStudents}
                  disabled={isSubmitting}
                  aria-label="Chọn tất cả học viên"
                />
                <span>Chọn tất cả ({students.length})</span>
              </label>
              <ul>
                {students.map((student) => {
                  return (
                    <li key={student.id}>
                      <label className="bulk-enrollment__student">
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.has(String(student.id))}
                          onChange={() => toggleStudent(student.id)}
                          disabled={isSubmitting}
                        />
                        <span className="bulk-enrollment__student-info">
                          <span>{student.name}</span>
                          {student.email && (
                            <span className="bulk-enrollment__email">
                              {student.email}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </fieldset>

        {error && (
          <p className="bulk-enrollment__error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={
            isSubmitting ||
            !selectedClassId ||
            selectedCount === 0 ||
            classes.length === 0
          }
        >
          {isSubmitting
            ? "Đang ghi danh..."
            : `Ghi danh ${selectedCount > 0 ? `${selectedCount} học viên` : "học viên đã chọn"}`}
        </button>
      </form>

      <EnrollmentResults
        results={results}
        studentNames={studentNames}
      />
    </section>
  );
}

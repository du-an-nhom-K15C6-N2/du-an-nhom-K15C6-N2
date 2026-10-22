import "./EnrollmentResults.css";

export type EnrollmentResultId = string | number;

export interface EnrollmentResultItem {
  studentId: EnrollmentResultId;
  success: boolean;
  message?: string;
  code?: string;
}

interface EnrollmentResultsProps {
  results: EnrollmentResultItem[];
  studentNames: ReadonlyMap<string, string>;
}

export function EnrollmentResults({
  results,
  studentNames,
}: EnrollmentResultsProps) {
  if (results.length === 0) {
    return null;
  }

  const successfulResults = results.filter((result) => result.success);
  const rejectedResults = results.filter((result) => !result.success);
  const studentName = (studentId: EnrollmentResultId) =>
    studentNames.get(String(studentId)) ?? `ID ${studentId}`;

  return (
    <section
      className="enrollment-results"
      aria-labelledby="enrollment-results-title"
    >
      <div
        className="enrollment-results__summary"
        role="status"
        aria-live="polite"
      >
        <h3 id="enrollment-results-title">Kết quả ghi danh</h3>
        <p>
          Thành công {successfulResults.length}/{results.length} học viên
          {rejectedResults.length > 0 &&
            `; từ chối ${rejectedResults.length} học viên`}
          .
        </p>
      </div>

      {successfulResults.length > 0 && (
        <div className="enrollment-results__group">
          <h4>Ghi danh thành công ({successfulResults.length})</h4>
          <ul>
            {successfulResults.map((result, index) => (
              <li key={`${String(result.studentId)}-${index}`}>
                <span>{studentName(result.studentId)}</span>
                <span className="enrollment-results__message enrollment-results__message--success">
                  {result.message || "Ghi danh thành công."}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rejectedResults.length > 0 && (
        <div className="enrollment-results__group">
          <h4>Bị từ chối ({rejectedResults.length})</h4>
          <ul>
            {rejectedResults.map((result, index) => (
              <li key={`${String(result.studentId)}-${index}`}>
                <span>{studentName(result.studentId)}</span>
                <span className="enrollment-results__message enrollment-results__message--error">
                  {result.message || "Không thể ghi danh học viên."}
                  {result.code ? ` (${result.code})` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

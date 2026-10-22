import {
  EnrollmentValidationService,
  type EnrollmentErrorCode,
  type EnrollmentResult,
} from "../01-enrollment-validation-rules/enrollment-validation.service";

export interface EnrollmentRequest {
  body: unknown;
  user?: { id: unknown } | null;
}

export interface EnrollmentResponse {
  status(code: number): EnrollmentResponse;
  json(body: unknown): unknown;
}

export type EnrollmentHandler = (
  request: EnrollmentRequest,
  response: EnrollmentResponse,
) => void | Promise<void>;

export interface EnrollmentRouter {
  post(path: string, handler: EnrollmentHandler): unknown;
}

interface EnrollmentPayload {
  classId: unknown;
  studentIds: unknown[];
}

export interface EnrollmentItemResponse {
  classId: unknown;
  studentId: unknown;
  success: boolean;
  status: number;
  code: "ENROLLED" | EnrollmentErrorCode;
  message: string;
}

export interface EnrollmentApiResponse {
  classId: unknown;
  results: EnrollmentItemResponse[];
  summary: {
    requested: number;
    succeeded: number;
    failed: number;
  };
}

function parsePayload(body: unknown):
  | { valid: true; payload: EnrollmentPayload }
  | { valid: false; message: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      valid: false,
      message: "Request body phải là một object JSON.",
    };
  }

  const requestBody = body as Record<string, unknown>;
  const hasSingleStudent = Object.prototype.hasOwnProperty.call(
    requestBody,
    "studentId",
  );
  const hasStudentList = Object.prototype.hasOwnProperty.call(
    requestBody,
    "studentIds",
  );

  if (hasSingleStudent === hasStudentList) {
    return {
      valid: false,
      message: "Cung cấp đúng một trường studentId hoặc studentIds.",
    };
  }

  if (hasSingleStudent) {
    return {
      valid: true,
      payload: {
        classId: requestBody.classId,
        studentIds: [requestBody.studentId],
      },
    };
  }

  if (!Array.isArray(requestBody.studentIds)) {
    return {
      valid: false,
      message: "studentIds phải là một danh sách.",
    };
  }

  if (requestBody.studentIds.length === 0) {
    return {
      valid: false,
      message: "Danh sách studentIds không được để trống.",
    };
  }

  return {
    valid: true,
    payload: {
      classId: requestBody.classId,
      studentIds: requestBody.studentIds,
    },
  };
}

function toItemResponse(result: EnrollmentResult): EnrollmentItemResponse {
  if (result.success) {
    return {
      classId: result.classId,
      studentId: result.studentId,
      success: true,
      status: 201,
      code: "ENROLLED",
      message: "Ghi danh học viên thành công.",
    };
  }

  const statusByCode: Record<EnrollmentErrorCode, number> = {
    INVALID_CLASS_ID: 400,
    CLASS_NOT_FOUND: 404,
    INVALID_STUDENT_ID: 400,
    STUDENT_NOT_FOUND: 404,
    CLASS_FULL: 409,
    ALREADY_ENROLLED: 409,
  };

  return {
    classId: result.classId,
    studentId: result.studentId,
    success: false,
    status: statusByCode[result.code],
    code: result.code,
    message: result.message,
  };
}

export function createEnrollmentController(
  enrollmentService: EnrollmentValidationService,
): EnrollmentHandler {
  return async (request, response) => {
    const createdBy = request.user?.id;
    if (
      (typeof createdBy !== "string" || createdBy.trim().length === 0) &&
      (typeof createdBy !== "number" ||
        !Number.isSafeInteger(createdBy) ||
        createdBy <= 0)
    ) {
      response.status(401).json({
        code: "UNAUTHENTICATED",
        message: "Cần đăng nhập để thực hiện ghi danh.",
      });
      return;
    }

    const parsed = parsePayload(request.body);
    if (!parsed.valid) {
      response.status(400).json({
        code: "INVALID_REQUEST",
        message: parsed.message,
      });
      return;
    }

    const { classId, studentIds } = parsed.payload;
    const serviceResults =
      studentIds.length === 1
        ? [
            await enrollmentService.enrollStudent(
              classId,
              studentIds[0],
              createdBy,
            ),
          ]
        : await enrollmentService.enrollStudents(
            classId,
            studentIds,
            createdBy,
          );
    const results = serviceResults.map(toItemResponse);
    const succeeded = results.filter((result) => result.success).length;

    const body: EnrollmentApiResponse = {
      classId,
      results,
      summary: {
        requested: results.length,
        succeeded,
        failed: results.length - succeeded,
      },
    };

    response.status(200).json(body);
  };
}

export function registerEnrollmentRoutes(
  router: EnrollmentRouter,
  enrollmentService: EnrollmentValidationService,
): void {
  const handler = createEnrollmentController(enrollmentService);
  router.post("/api/enrollments", handler);
  router.post("/api/enrollments/bulk", handler);
}

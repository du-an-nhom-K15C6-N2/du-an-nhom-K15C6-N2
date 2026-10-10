import { HttpError } from "../errors.js";

const REASSIGNMENT_ROLES = new Set(["admin", "sales_manager", "training_manager", "manager", "TRAINING_MANAGER"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateInput(leadId, input) {
  if (!UUID_PATTERN.test(leadId)) {
    throw new HttpError(400, "ID lead không hợp lệ.");
  }
  if (!input || typeof input.assignedTo !== "string" || !UUID_PATTERN.test(input.assignedTo)) {
    throw new HttpError(400, "assignedTo phải là UUID của tư vấn viên.");
  }
  if (input.note !== undefined && (typeof input.note !== "string" || input.note.length > 1000)) {
    throw new HttpError(400, "note phải là chuỗi không quá 1000 ký tự.");
  }
}

export async function reassignLead({ pool, leadId, actor, input }) {
  validateInput(leadId, input);
  if (!actor?.id || !UUID_PATTERN.test(actor.id)) {
    throw new HttpError(401, "Cần đăng nhập để chuyển giao lead.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const actorResult = await client.query(
      `SELECT id, role
       FROM users
       WHERE id = $1
         AND is_active = TRUE`,
      [actor.id],
    );
    const activeActor = actorResult.rows[0];
    if (!activeActor) {
      throw new HttpError(401, "Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.");
    }

    const leadResult = await client.query(
      `SELECT id, assigned_to
       FROM leads
       WHERE id = $1
       FOR UPDATE`,
      [leadId],
    );
    const lead = leadResult.rows[0];
    if (!lead) {
      throw new HttpError(404, "Không tìm thấy lead.");
    }

    const canReassign = REASSIGNMENT_ROLES.has(activeActor.role)
      || String(lead.assigned_to) === String(activeActor.id);
    if (!canReassign) {
      throw new HttpError(403, "Bạn không có quyền chuyển giao lead này.");
    }

    const assigneeResult = await client.query(
      `SELECT id, name, email
       FROM users
       WHERE id = $1
         AND role IN ('consultant', 'academic_advisor', 'ACADEMIC_ADVISOR')
         AND is_active = TRUE`,
      [input.assignedTo],
    );
    if (!assigneeResult.rows[0]) {
      throw new HttpError(404, "Tư vấn viên mới không tồn tại, không hoạt động hoặc không hợp lệ.");
    }
    if (String(lead.assigned_to) === input.assignedTo) {
      throw new HttpError(409, "Lead đã được giao cho tư vấn viên này.");
    }

    const updatedResult = await client.query(
      `UPDATE leads
       SET assigned_to = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [leadId, input.assignedTo],
    );

    await client.query(
      `INSERT INTO lead_assignment_history
         (lead_id, from_user_id, to_user_id, changed_by, note, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [leadId, lead.assigned_to, input.assignedTo, actor.id, input.note?.trim() || null],
    );

    const result = updatedResult.rows[0];
    result.assigned_consultant = assigneeResult.rows[0];
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      error.rollbackError = rollbackError;
    }
    throw error;
  } finally {
    client.release();
  }
}

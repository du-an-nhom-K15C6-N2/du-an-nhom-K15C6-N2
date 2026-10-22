import { HttpError } from "../errors.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANAGER_ROLES = new Set(["admin", "sales_manager", "training_manager", "manager", "TRAINING_MANAGER"]);

export async function reassignLeads({ pool, actor, input }) {
  const leadIds = input?.leadIds;
  const consultantId = input?.consultantId;
  const note = input?.note;
  if (!Array.isArray(leadIds) || leadIds.length === 0 || leadIds.length > 100
    || !leadIds.every((id) => typeof id === "string" && UUID_PATTERN.test(id))
    || new Set(leadIds).size !== leadIds.length) {
    throw new HttpError(400, "leadIds phải chứa từ 1 đến 100 UUID duy nhất.");
  }
  if (typeof consultantId !== "string" || !UUID_PATTERN.test(consultantId)) {
    throw new HttpError(400, "consultantId phải là UUID của tư vấn viên.");
  }
  if (note !== undefined && note !== null && (typeof note !== "string" || note.length > 1000)) {
    throw new HttpError(400, "note phải là chuỗi không quá 1000 ký tự.");
  }
  if (!actor?.id || !UUID_PATTERN.test(actor.id)) {
    throw new HttpError(401, "Cần đăng nhập để phân công lead.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const actorResult = await client.query(
      "SELECT id, role FROM users WHERE id = $1 AND is_active = TRUE",
      [actor.id],
    );
    const activeActor = actorResult.rows[0];
    if (!activeActor) throw new HttpError(401, "Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.");
    if (!MANAGER_ROLES.has(activeActor.role)) {
      throw new HttpError(403, "Chỉ quản lý mới được phân công hàng loạt.");
    }

    const consultantResult = await client.query(
      `SELECT id, name, email
       FROM users
       WHERE id = $1
         AND role IN ('consultant', 'academic_advisor', 'ACADEMIC_ADVISOR')
         AND is_active = TRUE`,
      [consultantId],
    );
    const consultant = consultantResult.rows[0];
    if (!consultant) throw new HttpError(404, "Tư vấn viên không tồn tại hoặc không hoạt động.");

    const leadResult = await client.query(
      `SELECT id, assigned_to
       FROM leads
       WHERE id = ANY($1::uuid[])
       FOR UPDATE`,
      [leadIds],
    );
    if (leadResult.rows.length !== leadIds.length) {
      throw new HttpError(404, "Một hoặc nhiều lead không tồn tại.");
    }
    if (leadResult.rows.some((lead) => String(lead.assigned_to) === consultantId)) {
      throw new HttpError(409, "Một hoặc nhiều lead đã được giao cho tư vấn viên đã chọn.");
    }

    for (const lead of leadResult.rows) {
      await client.query(
        "UPDATE leads SET assigned_to = $2, updated_at = NOW() WHERE id = $1",
        [lead.id, consultantId],
      );
      await client.query(
        `INSERT INTO lead_assignment_history
           (lead_id, from_user_id, to_user_id, changed_by, note, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [lead.id, lead.assigned_to, consultantId, actor.id, note?.trim() || null],
      );
    }

    await client.query("COMMIT");
    return { assignedCount: leadResult.rows.length, consultant };
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

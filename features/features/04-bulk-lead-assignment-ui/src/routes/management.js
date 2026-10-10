import { Router } from "express";
import { HttpError } from "../errors.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANAGER_ROLES = new Set(["admin", "sales_manager", "training_manager", "manager", "TRAINING_MANAGER"]);
const CONSULTANT_ROLES = new Set(["consultant", "academic_advisor", "advisor", "ACADEMIC_ADVISOR"]);
const LEAD_STATUSES = new Set(["new", "contacted", "qualified", "converted", "lost", "pending"]);

function isManager(user) {
  return MANAGER_ROLES.has(user.role);
}

function normalizePhone(value) {
  if (typeof value !== "string") return "";
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0084")) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith("84")) digits = `0${digits.slice(2)}`;
  return digits;
}

function ensureUuid(value, label) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new HttpError(400, `${label} không hợp lệ.`);
  }
}

function ensureManager(user) {
  if (!isManager(user)) throw new HttpError(403, "Bạn không có quyền thực hiện thao tác này.");
}

async function canAccessLead(pool, leadId, user) {
  const result = await pool.query(
    "SELECT id, assigned_to FROM leads WHERE id = $1",
    [leadId],
  );
  const lead = result.rows[0];
  if (!lead) throw new HttpError(404, "Không tìm thấy lead.");
  if (!isManager(user) && String(lead.assigned_to) !== String(user.id)) {
    throw new HttpError(403, "Bạn không có quyền truy cập lead này.");
  }
  return lead;
}

function leadInput(body, { partial = false } = {}) {
  const input = {};
  if (!partial || body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 200) {
      throw new HttpError(400, "Tên lead là bắt buộc và không vượt quá 200 ký tự.");
    }
    input.name = body.name.trim();
  }
  if (!partial || body.phone !== undefined) {
    input.phone = normalizePhone(body.phone);
    if (input.phone.length < 9 || input.phone.length > 15) {
      throw new HttpError(400, "Số điện thoại phải có từ 9 đến 15 chữ số.");
    }
  }
  for (const field of ["email", "source", "status"]) {
    if (partial && body[field] === undefined) continue;
    const value = body[field] == null ? "" : body[field];
    if (typeof value !== "string") throw new HttpError(400, `${field} phải là chuỗi.`);
    input[field] = value.trim();
  }
  if (input.email && (input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))) {
    throw new HttpError(400, "Email không hợp lệ.");
  }
  if (input.source !== undefined && input.source.length > 100) throw new HttpError(400, "source không vượt quá 100 ký tự.");
  if (input.status !== undefined && !LEAD_STATUSES.has(input.status)) {
    throw new HttpError(400, "Trạng thái lead không hợp lệ.");
  }
  if (body.assignedTo !== undefined || body.consultantId !== undefined) {
    input.assignedTo = body.assignedTo ?? body.consultantId;
    if (input.assignedTo !== null && input.assignedTo !== "") ensureUuid(input.assignedTo, "assignedTo");
    if (input.assignedTo === "") input.assignedTo = null;
  }
  return input;
}

async function findActiveConsultant(pool, consultantId) {
  if (consultantId == null) return null;
  const result = await pool.query(
    `SELECT id, name, email, phone
     FROM users
     WHERE id = $1
       AND role IN ('consultant', 'academic_advisor', 'ACADEMIC_ADVISOR')
       AND is_active = TRUE`,
    [consultantId],
  );
  if (!result.rows[0]) throw new HttpError(404, "Tư vấn viên không tồn tại hoặc không hoạt động.");
  return result.rows[0];
}

export function createManagementRouter({ pool }) {
  const router = Router();

  router.get("/consultants", async (req, res, next) => {
    try {
      ensureManager(req.user);
      const result = await pool.query(
        `SELECT id, name, email, phone, team
         FROM users
         WHERE role IN ('consultant', 'academic_advisor', 'ACADEMIC_ADVISOR')
           AND is_active = TRUE
         ORDER BY name`,
      );
      res.json({ items: result.rows });
    } catch (error) {
      next(error);
    }
  });

  router.get("/leads/phone-check", async (req, res, next) => {
    try {
      const phone = normalizePhone(req.query.phone);
      const excludeId = req.query.excludeId;
      if (phone.length < 9 || phone.length > 15) throw new HttpError(400, "Số điện thoại không hợp lệ.");
      if (excludeId) ensureUuid(excludeId, "excludeId");
      const result = await pool.query(
        `SELECT EXISTS (
           SELECT 1 FROM leads
           WHERE regexp_replace(phone, '[^0-9]', '', 'g') = $1
             AND ($2::uuid IS NULL OR id <> $2::uuid)
         ) AS duplicate`,
        [phone, excludeId || null],
      );
      res.json({ phone, duplicate: result.rows[0].duplicate });
    } catch (error) {
      next(error);
    }
  });

  router.get("/leads/:id", async (req, res, next) => {
    try {
      ensureUuid(req.params.id, "ID lead");
      const lead = await canAccessLead(pool, req.params.id, req.user);
      const result = await pool.query(
        `SELECT l.id, l.name, l.email, l.phone, l.source, l.status, l.assigned_to,
                l.created_at, l.updated_at, u.name AS assigned_name
         FROM leads l
         LEFT JOIN users u ON u.id = l.assigned_to
         WHERE l.id = $1`,
        [lead.id],
      );
      res.json({ data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  });

  router.get("/leads/:id/transfer-history", async (req, res, next) => {
    try {
      ensureUuid(req.params.id, "ID lead");
      await canAccessLead(pool, req.params.id, req.user);
      const result = await pool.query(
        `SELECT h.id, h.lead_id, h.from_user_id, h.to_user_id, h.changed_by,
                h.note, h.created_at,
                from_user.name AS from_name,
                to_user.name AS to_name,
                actor.name AS actor_name
         FROM lead_assignment_history h
         LEFT JOIN users from_user ON from_user.id = h.from_user_id
         LEFT JOIN users to_user ON to_user.id = h.to_user_id
         LEFT JOIN users actor ON actor.id = h.changed_by
         WHERE h.lead_id = $1
         ORDER BY h.created_at DESC, h.id DESC`,
        [req.params.id],
      );
      res.json({
        items: result.rows.map((row) => ({
          id: row.id,
          leadId: row.lead_id,
          fromConsultant: row.from_user_id ? { id: row.from_user_id, name: row.from_name || "" } : null,
          toConsultant: { id: row.to_user_id, name: row.to_name || "" },
          performedBy: { id: row.changed_by, name: row.actor_name || "" },
          transferredAt: row.created_at,
          note: row.note,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/leads", async (req, res, next) => {
    try {
      const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
      const pageSize = Math.max(1, Math.min(100, Number.parseInt(req.query.pageSize, 10) || 10));
      const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 200) : "";
      const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
      const consultantId = typeof req.query.consultantId === "string" ? req.query.consultantId : "";
      if (status && !LEAD_STATUSES.has(status)) throw new HttpError(400, "Trạng thái lead không hợp lệ.");
      if (consultantId) {
        ensureManager(req.user);
        ensureUuid(consultantId, "consultantId");
      }

      const conditions = [];
      const values = [];
      const addCondition = (condition, value) => {
        values.push(value);
        conditions.push(condition.replace("?", `$${values.length}`));
      };
      if (!isManager(req.user)) {
        if (!CONSULTANT_ROLES.has(req.user.role)) throw new HttpError(403, "Vai trò không có quyền xem lead.");
        addCondition("l.assigned_to = ?", req.user.id);
      } else if (consultantId) {
        addCondition("l.assigned_to = ?", consultantId);
      }
      if (status) addCondition("l.status = ?", status);
      if (search) {
        values.push(`%${search}%`, `%${search}%`, `%${search}%`);
        const firstSearchValue = values.length - 2;
        conditions.push(`(l.name ILIKE $${firstSearchValue} OR l.email ILIKE $${firstSearchValue + 1} OR l.phone ILIKE $${firstSearchValue + 2})`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const count = await pool.query(`SELECT COUNT(*)::int AS total FROM leads l ${where}`, values);
      const total = count.rows[0].total;
      const listValues = [...values, pageSize, (page - 1) * pageSize];
      const items = await pool.query(
        `SELECT l.id, l.name, l.email, l.phone, l.source, l.status, l.assigned_to,
                l.created_at, l.updated_at, u.name AS assigned_name
         FROM leads l
         LEFT JOIN users u ON u.id = l.assigned_to
         ${where}
         ORDER BY l.created_at DESC, l.id
         LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
        listValues,
      );
      res.json({
        items: items.rows.map((lead) => ({
          ...lead,
          createdAt: lead.created_at,
          assignedToId: lead.assigned_to,
          consultantId: lead.assigned_to,
          assignedConsultant: lead.assigned_to ? { id: lead.assigned_to, name: lead.assigned_name || "" } : null,
          assigned_consultant: lead.assigned_to ? { id: lead.assigned_to, name: lead.assigned_name || "" } : null,
        })),
        total,
        page,
        pageSize,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/leads", async (req, res, next) => {
    try {
      if (!isManager(req.user) && !CONSULTANT_ROLES.has(req.user.role)) {
        throw new HttpError(403, "Bạn không có quyền tạo lead.");
      }
      const input = leadInput(req.body || {});
      let assignedTo = input.assignedTo || null;
      if (!isManager(req.user)) {
        if (assignedTo && assignedTo !== req.user.id) throw new HttpError(403, "Bạn chỉ có thể tự nhận lead mình tạo.");
        assignedTo = req.user.id;
      } else if (assignedTo) {
        await findActiveConsultant(pool, assignedTo);
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query(
          `INSERT INTO leads (name, email, phone, source, status, assigned_to, created_by)
           VALUES ($1, NULLIF($2, ''), $3, NULLIF($4, ''), COALESCE(NULLIF($5, ''), 'new'), $6, $7)
           RETURNING id, name, email, phone, source, status, assigned_to, created_at, updated_at`,
          [input.name, input.email, input.phone, input.source, input.status, assignedTo, req.user.id],
        );
        const lead = result.rows[0];
        if (assignedTo) {
          await client.query(
            `INSERT INTO lead_assignment_history (lead_id, from_user_id, to_user_id, changed_by, note)
             VALUES ($1, NULL, $2, $3, 'Tạo lead')`,
            [lead.id, assignedTo, req.user.id],
          );
        }
        await client.query("COMMIT");
        res.status(201).json({ data: lead });
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
    } catch (error) {
      next(error);
    }
  });

  router.patch("/leads/:id", async (req, res, next) => {
    try {
      ensureUuid(req.params.id, "ID lead");
      const existing = await canAccessLead(pool, req.params.id, req.user);
      const input = leadInput(req.body || {}, { partial: true });
      if (!Object.keys(input).length) throw new HttpError(400, "Không có trường nào để cập nhật.");
      if (input.assignedTo !== undefined) {
        ensureManager(req.user);
        await findActiveConsultant(pool, input.assignedTo);
        if (String(existing.assigned_to) !== String(input.assignedTo)) {
          throw new HttpError(400, "Hãy dùng API chuyển giao để đổi tư vấn viên phụ trách.");
        }
      }
      const fields = ["name", "email", "phone", "source", "status"];
      const values = [];
      const updates = [];
      for (const field of fields) {
        if (input[field] === undefined) continue;
        values.push(input[field]);
        const column = field === "email" || field === "source" ? `NULLIF($${values.length}, '')` : `$${values.length}`;
        updates.push(`${field} = ${column}`);
      }
      values.push(req.params.id);
      const result = await pool.query(
        `UPDATE leads SET ${updates.join(", ")}, updated_at = NOW()
         WHERE id = $${values.length}
         RETURNING id, name, email, phone, source, status, assigned_to, created_at, updated_at`,
        values,
      );
      res.json({ data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/leads/:id", async (req, res, next) => {
    try {
      ensureManager(req.user);
      ensureUuid(req.params.id, "ID lead");
      const result = await pool.query("DELETE FROM leads WHERE id = $1 RETURNING id", [req.params.id]);
      if (!result.rows[0]) throw new HttpError(404, "Không tìm thấy lead.");
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

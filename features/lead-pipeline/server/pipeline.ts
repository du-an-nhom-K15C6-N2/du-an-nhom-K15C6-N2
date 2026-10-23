import type { Database } from "better-sqlite3";

export const statuses = [
  "Mới",
  "Đã liên hệ",
  "Đang tư vấn",
  "Hẹn học thử",
  "Chốt",
  "Từ chối",
] as const;

export type LeadStatus = (typeof statuses)[number];

export const rejectionReasons = [
  "Không phù hợp nhu cầu",
  "Không liên hệ được",
  "Học phí",
  "Lịch học",
  "Đã chọn nơi khác",
] as const;

export interface Lead {
  id: number;
  name: string;
  phone: string;
  course: string;
  source: string;
  status: LeadStatus;
  nextCallAt: string | null;
  updatedAt: string;
}

export interface StatusHistory {
  id: number;
  leadId: number;
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus;
  reason: string | null;
  changedAt: string;
  changedBy: string;
}

export interface LeadBoard {
  statuses: readonly LeadStatus[];
  counts: Record<LeadStatus, number>;
  leadsByStatus: Record<LeadStatus, Lead[]>;
}

export class PipelineError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "PipelineError";
  }
}

function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && statuses.includes(value as LeadStatus);
}

export function getBoard(db: Database): LeadBoard {
  const leads = db
    .prepare(
      `SELECT id, name, phone, course, source, status, next_call_at AS nextCallAt, updated_at AS updatedAt
       FROM leads
       ORDER BY CASE WHEN next_call_at IS NULL THEN 1 ELSE 0 END, next_call_at, name`,
    )
    .all() as Lead[];

  const leadsByStatus = Object.fromEntries(
    statuses.map((status) => [status, [] as Lead[]]),
  ) as Record<LeadStatus, Lead[]>;
  for (const lead of leads) {
    if (isLeadStatus(lead.status)) leadsByStatus[lead.status].push(lead);
  }

  const counts = Object.fromEntries(
    statuses.map((status) => [status, leadsByStatus[status].length]),
  ) as Record<LeadStatus, number>;

  return { statuses, counts, leadsByStatus };
}

export function updateLeadStatus(
  db: Database,
  leadId: number,
  input: {
    status: unknown;
    reason?: unknown;
    changedBy?: unknown;
  },
): StatusHistory {
  if (!Number.isSafeInteger(leadId) || leadId < 1) {
    throw new PipelineError("Mã lead không hợp lệ.", 400);
  }
  const toStatus = input.status;
  if (!isLeadStatus(toStatus)) {
    throw new PipelineError("Trạng thái lead không hợp lệ.", 400);
  }
  const changedBy = input.changedBy;
  if (typeof changedBy !== "string" || !changedBy.trim()) {
    throw new PipelineError("Vui lòng cung cấp người thực hiện.", 400);
  }

  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (toStatus === "Từ chối" && !rejectionReasons.includes(reason as (typeof rejectionReasons)[number])) {
    throw new PipelineError("Vui lòng chọn một lý do từ chối hợp lệ.", 400);
  }
  if (toStatus !== "Từ chối" && reason) {
    throw new PipelineError("Chỉ trạng thái Từ chối mới nhận lý do từ chối.", 400);
  }

  const lead = db
    .prepare("SELECT status FROM leads WHERE id = ?")
    .get(leadId) as { status: LeadStatus } | undefined;
  if (!lead) throw new PipelineError("Không tìm thấy lead.", 404);
  if (lead.status === toStatus) {
    throw new PipelineError("Lead đã ở trạng thái này.", 409);
  }

  const changedAt = new Date().toISOString();
  const transaction = db.transaction(() => {
    db.prepare("UPDATE leads SET status = ?, updated_at = ? WHERE id = ?").run(
      toStatus,
      changedAt,
      leadId,
    );
    const result = db
      .prepare(
        `INSERT INTO lead_status_history
          (lead_id, from_status, to_status, reason, changed_at, changed_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        leadId,
        lead.status,
        toStatus,
        reason || null,
        changedAt,
        changedBy.trim(),
      );

    return {
      id: Number(result.lastInsertRowid),
      leadId,
      fromStatus: lead.status,
      toStatus,
      reason: reason || null,
      changedAt,
      changedBy: changedBy.trim(),
    } satisfies StatusHistory;
  });

  return transaction();
}

export function getLeadHistory(db: Database, leadId: number): StatusHistory[] {
  if (!Number.isSafeInteger(leadId) || leadId < 1) {
    throw new PipelineError("Mã lead không hợp lệ.", 400);
  }
  const lead = db.prepare("SELECT id FROM leads WHERE id = ?").get(leadId);
  if (!lead) throw new PipelineError("Không tìm thấy lead.", 404);
  return db
    .prepare(
      `SELECT id, lead_id AS leadId, from_status AS fromStatus, to_status AS toStatus,
              reason, changed_at AS changedAt, changed_by AS changedBy
       FROM lead_status_history WHERE lead_id = ? ORDER BY changed_at DESC, id DESC`,
    )
    .all(leadId) as StatusHistory[];
}

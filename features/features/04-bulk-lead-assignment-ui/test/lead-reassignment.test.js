import assert from "node:assert/strict";
import test from "node:test";
import { reassignLead } from "../src/services/lead-reassignment.js";

const leadId = "0a3db5b3-76af-42c6-8769-424db58c9c24";
const oldAssigneeId = "b5b8fa2f-11d9-4a62-b2a2-f2806d989d9c";
const newAssigneeId = "0e46cd64-4924-4a4e-85b0-9810d97ab21c";
const actorId = "c3ed9011-9c89-47f5-a395-b4bd7b276428";

function createPool({
  lead = { id: leadId, assigned_to: oldAssigneeId },
  activeActor = { id: oldAssigneeId, role: "consultant" },
  assignee = { id: newAssigneeId, name: "Consultant", email: "consultant@example.com" },
  failHistory = false,
} = {}) {
  const calls = [];
  const client = {
    async query(sql, values) {
      const normalizedSql = sql.trim().replace(/\s+/g, " ");
      calls.push({ sql: normalizedSql, values });

      if (normalizedSql.startsWith("SELECT id, role FROM users")) {
        return { rows: activeActor ? [{ ...activeActor, id: values[0] }] : [] };
      }
      if (normalizedSql.startsWith("SELECT id, assigned_to")) return { rows: lead ? [lead] : [] };
      if (normalizedSql.startsWith("SELECT id, name, email FROM users")) return { rows: assignee ? [assignee] : [] };
      if (normalizedSql.startsWith("UPDATE leads")) {
        return { rows: [{ id: leadId, assigned_to: values[1], full_name: "Lead test" }] };
      }
      if (normalizedSql.startsWith("INSERT INTO lead_assignment_history")) {
        if (failHistory) throw new Error("history insert failed");
        return { rows: [] };
      }
      return { rows: [] };
    },
    release() {
      calls.push({ sql: "RELEASE" });
    },
  };
  return {
    calls,
    pool: { async connect() { return client; } },
  };
}

const validInput = { assignedTo: newAssigneeId, note: "Chuyển nhóm phụ trách" };

test("updates the lead and records its assignment history in one transaction", async () => {
  const { pool, calls } = createPool();

  const lead = await reassignLead({
    pool,
    leadId,
    actor: { id: oldAssigneeId },
    input: validInput,
  });

  assert.equal(lead.assigned_to, newAssigneeId);
  assert.deepEqual(lead.assigned_consultant, {
    id: newAssigneeId,
    name: "Consultant",
    email: "consultant@example.com",
  });
  assert.deepEqual(calls.find((call) => call.sql.startsWith("INSERT INTO lead_assignment_history")).values, [
    leadId,
    oldAssigneeId,
    newAssigneeId,
    oldAssigneeId,
    validInput.note,
  ]);
  assert.equal(calls.at(-2).sql, "COMMIT");
  assert.equal(calls.at(-1).sql, "RELEASE");
});

test("rejects an unrelated consultant and rolls back without updating", async () => {
  const { pool, calls } = createPool();

  await assert.rejects(
    reassignLead({
      pool,
      leadId,
      actor: { id: actorId },
      input: validInput,
    }),
    { status: 403 },
  );

  assert.equal(calls.at(-2).sql, "ROLLBACK");
  assert.equal(calls.some((call) => call.sql.startsWith("UPDATE leads")), false);
});

test("rolls back the lead update if history cannot be written", async () => {
  const { pool, calls } = createPool({ failHistory: true });

  await assert.rejects(
    reassignLead({
      pool,
      leadId,
      actor: { id: oldAssigneeId },
      input: validInput,
    }),
    /history insert failed/,
  );

  assert.equal(calls.at(-2).sql, "ROLLBACK");
});

test("rejects an inactive or non-consultant target", async () => {
  const { pool, calls } = createPool({
    activeActor: { id: actorId, role: "admin" },
    assignee: null,
  });

  await assert.rejects(
    reassignLead({
      pool,
      leadId,
      actor: { id: actorId },
      input: validInput,
    }),
    { status: 404 },
  );

  assert.equal(calls.some((call) => call.sql.startsWith("UPDATE leads")), false);
});

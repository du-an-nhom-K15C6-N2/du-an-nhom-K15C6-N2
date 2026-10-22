import assert from "node:assert/strict";
import test from "node:test";
import { reassignLeads } from "../src/services/bulk-lead-assignment.js";

const leadIds = [
  "0a3db5b3-76af-42c6-8769-424db58c9c24",
  "b5b8fa2f-11d9-4a62-b2a2-f2806d989d9c",
];
const consultantId = "0e46cd64-4924-4a4e-85b0-9810d97ab21c";
const actorId = "c3ed9011-9c89-47f5-a395-b4bd7b276428";

function createPool({ role = "admin", failHistory = false } = {}) {
  const calls = [];
  const client = {
    async query(sql) {
      const normalized = sql.trim().replace(/\s+/g, " ");
      calls.push(normalized);
      if (normalized.startsWith("SELECT id, role FROM users")) return { rows: [{ id: actorId, role }] };
      if (normalized.startsWith("SELECT id, name, email FROM users")) {
        return { rows: [{ id: consultantId, name: "Advisor", email: "advisor@example.test" }] };
      }
      if (normalized.startsWith("SELECT id, assigned_to")) {
        return { rows: leadIds.map((id) => ({ id, assigned_to: null })) };
      }
      if (normalized.startsWith("INSERT INTO lead_assignment_history") && failHistory) {
        throw new Error("history unavailable");
      }
      return { rows: [] };
    },
    release() { calls.push("RELEASE"); },
  };
  return { calls, pool: { async connect() { return client; } } };
}

test("bulk assignment records history and commits all lead updates atomically", async () => {
  const { pool, calls } = createPool();
  const result = await reassignLeads({
    pool,
    actor: { id: actorId },
    input: { leadIds, consultantId, note: "Chia nhóm" },
  });

  assert.equal(result.assignedCount, 2);
  assert.equal(result.consultant.id, consultantId);
  assert.equal(calls.filter((sql) => sql.startsWith("UPDATE leads")).length, 2);
  assert.equal(calls.filter((sql) => sql.startsWith("INSERT INTO lead_assignment_history")).length, 2);
  assert.equal(calls.at(-2), "COMMIT");
  assert.equal(calls.at(-1), "RELEASE");
});

test("bulk assignment rolls back when any history insert fails", async () => {
  const { pool, calls } = createPool({ failHistory: true });

  await assert.rejects(
    reassignLeads({
      pool,
      actor: { id: actorId },
      input: { leadIds, consultantId },
    }),
    /history unavailable/,
  );
  assert.equal(calls.at(-2), "ROLLBACK");
  assert.equal(calls.at(-1), "RELEASE");
});

test("bulk assignment rejects consultants and malformed batches before updating", async () => {
  const { pool, calls } = createPool({ role: "consultant" });

  await assert.rejects(
    reassignLeads({
      pool,
      actor: { id: actorId },
      input: { leadIds, consultantId },
    }),
    { status: 403 },
  );
  assert.equal(calls.some((sql) => sql.startsWith("UPDATE leads")), false);
  await assert.rejects(
    reassignLeads({
      pool,
      actor: { id: actorId },
      input: { leadIds: ["bad"], consultantId },
    }),
    { status: 400 },
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { createAuthenticate } from "../src/middleware/authenticate.js";

const jwtSecret = "a-test-signing-secret-with-at-least-32-characters";
const manager = {
  id: "c3ed9011-9c89-47f5-a395-b4bd7b276428",
  email: "manager@example.test",
  name: "Manager",
  role: "sales_manager",
};
const lead = {
  id: "0a3db5b3-76af-42c6-8769-424db58c9c24",
  name: "Test Lead",
  email: "lead@example.test",
  phone: "0901234567",
  source: "Website",
  status: "new",
  assigned_to: null,
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
  assigned_name: null,
};

async function withServer(pool, role = manager, authenticate) {
  const app = createApp({
    pool,
    jwtSecret,
    authenticate: authenticate || ((_req, _res, next) => {
      _req.user = role;
      next();
    }),
  });
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

test("health endpoint checks the configured PostgreSQL pool", async () => {
  const pool = { async query(sql) { assert.equal(sql, "SELECT 1"); return { rows: [{ "?column?": 1 }] }; } };
  const server = await withServer(pool);
  try {
    const response = await fetch(`${server.url}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok", database: "connected" });
  } finally {
    await server.close();
  }
});

test("lead listing returns the requested page and applies consultant scope in SQL", async () => {
  const queries = [];
  const consultant = { ...manager, id: "b5b8fa2f-11d9-4a62-b2a2-f2806d989d9c", role: "consultant" };
  const pool = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.includes("COUNT(*)")) return { rows: [{ total: 1 }] };
      if (sql.includes("SELECT l.id")) return { rows: [lead] };
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const server = await withServer(pool, consultant);
  try {
    const response = await fetch(`${server.url}/api/leads?page=1&pageSize=10&search=Test`);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.total, 1);
    assert.equal(result.items[0].consultantId, null);
    assert.ok(queries[0].sql.includes("l.assigned_to = $1"));
    assert.equal(queries[0].values[0], consultant.id);
  } finally {
    await server.close();
  }
});

test("API rejects unauthenticated requests and denies consultant deletion", async () => {
  const pool = { async query() { return { rows: [] }; } };
  const unauthenticated = await withServer(pool, manager, (_req, res) => res.status(401).json({ message: "Unauthorized" }));
  try {
    const response = await fetch(`${unauthenticated.url}/api/leads`);
    assert.equal(response.status, 401);
  } finally {
    await unauthenticated.close();
  }

  const consultantServer = await withServer(pool, { ...manager, role: "consultant" });
  try {
    const response = await fetch(`${consultantServer.url}/api/leads/${lead.id}`, { method: "DELETE" });
    assert.equal(response.status, 403);
  } finally {
    await consultantServer.close();
  }
});

test("phone check normalizes Vietnamese country-code input without returning lead details", async () => {
  let queryValues;
  const pool = {
    async query(_sql, values) {
      queryValues = values;
      return { rows: [{ duplicate: true }] };
    },
  };
  const server = await withServer(pool);
  try {
    const response = await fetch(`${server.url}/api/leads/phone-check?phone=%2B84%20901%20234%20567`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { phone: "0901234567", duplicate: true });
    assert.deepEqual(queryValues, ["0901234567", null]);
  } finally {
    await server.close();
  }
});

test("creating an assigned lead normalizes its phone and records first assignment atomically", async () => {
  const calls = [];
  const pool = {
    async query(sql) {
      assert.ok(sql.includes("FROM users"));
      return { rows: [{ id: "0e46cd64-4924-4a4e-85b0-9810d97ab21c", name: "Advisor" }] };
    },
    async connect() {
      return {
        async query(sql, values) {
          const normalized = sql.trim().replace(/\s+/g, " ");
          calls.push({ sql: normalized, values });
          if (normalized.startsWith("INSERT INTO leads")) return { rows: [{ ...lead, phone: values[2] }] };
          return { rows: [] };
        },
        release() { calls.push({ sql: "RELEASE" }); },
      };
    },
  };
  const server = await withServer(pool);
  try {
    const response = await fetch(`${server.url}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "New Lead",
        phone: "+84 901 234 567",
        email: "",
        source: "Website",
        status: "new",
        assignedTo: "0e46cd64-4924-4a4e-85b0-9810d97ab21c",
      }),
    });
    assert.equal(response.status, 201);
    const insertedLead = calls.find((call) => call.sql.startsWith("INSERT INTO leads"));
    assert.equal(insertedLead.values[2], "0901234567");
    assert.ok(calls.some((call) => call.sql.startsWith("INSERT INTO lead_assignment_history")));
    assert.equal(calls.at(-2).sql, "COMMIT");
    assert.equal(calls.at(-1).sql, "RELEASE");
  } finally {
    await server.close();
  }
});

test("transfer history endpoint returns the shared UI contract after checking lead scope", async () => {
  const history = {
    id: "5",
    lead_id: lead.id,
    from_user_id: null,
    to_user_id: manager.id,
    changed_by: manager.id,
    note: "Phân công ban đầu",
    created_at: "2026-10-01T00:00:00.000Z",
    from_name: null,
    to_name: "Manager",
    actor_name: "Manager",
  };
  const pool = {
    async query(sql) {
      if (sql.includes("SELECT id, assigned_to")) return { rows: [{ id: lead.id, assigned_to: null }] };
      if (sql.includes("FROM lead_assignment_history")) return { rows: [history] };
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const server = await withServer(pool);
  try {
    const response = await fetch(`${server.url}/api/leads/${lead.id}/transfer-history`);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.items[0].performedBy.name, "Manager");
    assert.equal(result.items[0].fromConsultant, null);
    assert.equal(result.items[0].toConsultant.name, "Manager");
  } finally {
    await server.close();
  }
});

test("JWT authentication derives current role from PostgreSQL rather than token claims", async () => {
  const pool = {
    async query(sql) {
      if (sql.includes("SELECT id, email, name, role") && sql.includes("is_active")) return { rows: [manager] };
      if (sql.includes("SELECT id, name, email, phone, team")) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const authenticate = createAuthenticate({ secret: jwtSecret, pool });
  const server = await withServer(pool, manager, authenticate);
  try {
    const token = jwt.sign({ sub: manager.id, role: "consultant" }, jwtSecret, { algorithm: "HS256" });
    const response = await fetch(`${server.url}/api/consultants`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { items: [] });
  } finally {
    await server.close();
  }
});

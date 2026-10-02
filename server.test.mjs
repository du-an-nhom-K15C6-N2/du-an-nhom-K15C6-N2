import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createAppServer } from "./server.mjs";

const adminEmail = "admin@test.local";
const adminPassword = "test-admin-password";
const demoPassword = "demo-password";

async function startServer(t, dataFile = null) {
  const directory = dataFile ? null : mkdtempSync(join(tmpdir(), "academy-admin-test-"));
  const storePath = dataFile ?? join(directory, "store.json");
  const server = createAppServer({ dataFile: storePath, adminEmail, adminPassword, demoPassword });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    await new Promise(resolve => {
      server.close(resolve);
      server.closeAllConnections();
    });
    if (directory) rmSync(directory, { recursive: true, force: true });
  });
  return { baseUrl, storePath };
}

async function request(baseUrl, path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { response, data: await response.json() };
}

async function loginAdmin(baseUrl) {
  const { response, data } = await request(baseUrl, "/api/admin/login", {
    method: "POST",
    body: { email: adminEmail, password: adminPassword }
  });
  assert.equal(response.status, 200);
  return data.token;
}

async function loginUser(baseUrl, email) {
  return request(baseUrl, "/api/auth/login", {
    method: "POST",
    body: { email, password: demoPassword }
  });
}

test("locking rejects login, revokes active sessions, audits, and creates unique handovers", async t => {
  const { baseUrl } = await startServer(t);
  const adminToken = await loginAdmin(baseUrl);
  const userEmail = "minhanh.nguyen@example.edu.vn";
  const userLogin = await loginUser(baseUrl, userEmail);
  assert.equal(userLogin.response.status, 200);
  assert.equal((await request(baseUrl, "/api/accounts", { token: userLogin.data.token })).response.status, 403);

  const lock = await request(baseUrl, "/api/admin/accounts/u-1001/lock", {
    method: "POST",
    token: adminToken,
    body: { reason: "  Vi phạm chính sách  " }
  });
  assert.equal(lock.response.status, 200);
  assert.equal(lock.data.account.reason, "Vi phạm chính sách");
  assert.equal(lock.data.account.activeSessions, 0);
  assert.equal(lock.data.revokedSessions, 1);
  assert.equal(lock.data.createdHandoverAlerts, 2);

  const revokedSession = await request(baseUrl, "/api/auth/me", { token: userLogin.data.token });
  assert.equal(revokedSession.response.status, 401);
  const deniedLogin = await loginUser(baseUrl, userEmail);
  assert.equal(deniedLogin.response.status, 403);
  assert.equal(deniedLogin.data.error, "ACCOUNT_LOCKED");

  const classes = await request(baseUrl, "/api/classes", { token: adminToken });
  const handovers = classes.data.classes.filter(item => item.instructor.id === "u-1001");
  assert.equal(handovers.length, 2);
  assert.ok(handovers.every(item => item.needsHandover));

  const auditBeforeRepeat = await request(baseUrl, "/api/audit", { token: adminToken });
  const repeatedLock = await request(baseUrl, "/api/admin/accounts/u-1001/lock", {
    method: "POST",
    token: adminToken,
    body: { reason: "Lý do thay thế không được ghi đè" }
  });
  const auditAfterRepeat = await request(baseUrl, "/api/audit", { token: adminToken });
  assert.equal(repeatedLock.data.createdHandoverAlerts, 0);
  assert.equal(auditAfterRepeat.data.audit.length, auditBeforeRepeat.data.audit.length);
  assert.equal(repeatedLock.data.account.reason, "Vi phạm chính sách");
});

test("blank reasons are rejected and unlock permits a new login without restoring old sessions", async t => {
  const { baseUrl } = await startServer(t);
  const adminToken = await loginAdmin(baseUrl);
  const userEmail = "duclong.pham@example.edu.vn";

  const invalidLock = await request(baseUrl, "/api/admin/accounts/u-1004/lock", {
    method: "POST",
    token: adminToken,
    body: { reason: "   " }
  });
  assert.equal(invalidLock.response.status, 422);
  assert.equal((await loginUser(baseUrl, userEmail)).response.status, 200);

  const userLogin = await loginUser(baseUrl, userEmail);
  const locked = await request(baseUrl, "/api/admin/accounts/u-1004/lock", {
    method: "POST",
    token: adminToken,
    body: { reason: "Rà soát bảo mật" }
  });
  assert.equal(locked.response.status, 200);
  assert.equal((await request(baseUrl, "/api/auth/me", { token: userLogin.data.token })).response.status, 401);

  const unlocked = await request(baseUrl, "/api/admin/accounts/u-1004/unlock", {
    method: "POST",
    token: adminToken
  });
  assert.equal(unlocked.response.status, 200);
  assert.equal(unlocked.data.account.locked, false);
  assert.equal(unlocked.data.account.reason, "");
  assert.equal((await request(baseUrl, "/api/auth/me", { token: userLogin.data.token })).response.status, 401);
  assert.equal((await loginUser(baseUrl, userEmail)).response.status, 200);

  const audit = await request(baseUrl, "/api/audit", { token: adminToken });
  assert.deepEqual(audit.data.audit.slice(0, 2).map(item => item.action), ["Mở khoá tài khoản", "Khoá tài khoản"]);
  assert.equal(audit.data.audit[1].reason, "Rà soát bảo mật");
});

test("account state and audit survive server restart; admin APIs require authentication", async t => {
  const first = await startServer(t);
  const adminToken = await loginAdmin(first.baseUrl);
  const locked = await request(first.baseUrl, "/api/admin/accounts/u-1005/lock", {
    method: "POST",
    token: adminToken,
    body: { reason: "Yêu cầu kiểm tra" }
  });
  assert.equal(locked.response.status, 200);

  const second = await startServer(t, first.storePath);
  assert.equal((await request(second.baseUrl, "/api/accounts")).response.status, 401);
  const secondAdminToken = await loginAdmin(second.baseUrl);
  const accounts = await request(second.baseUrl, "/api/accounts", { token: secondAdminToken });
  assert.equal(accounts.data.accounts.find(item => item.id === "u-1005").locked, true);
  assert.equal((await loginUser(second.baseUrl, "ngocmai.vu@example.edu.vn")).response.status, 403);
  const audit = await request(second.baseUrl, "/api/audit", { token: secondAdminToken });
  assert.equal(audit.data.audit[0].reason, "Yêu cầu kiểm tra");
});

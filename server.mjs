import { createServer } from "node:http";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(appDirectory, "index.html");
const defaultDataFile = resolve(appDirectory, "data", "store.json");
const sessionLifetimeMs = 8 * 60 * 60 * 1000;
const seedAccounts = [
  { id: "u-1001", name: "Nguyễn Minh Anh", email: "minhanh.nguyen@example.edu.vn", role: "Giảng viên", courses: ["Lập trình Web cơ bản", "Cơ sở dữ liệu"], locked: false, reason: "", lockedAt: null },
  { id: "u-1002", name: "Trần Quốc Bảo", email: "quocbao.tran@example.edu.vn", role: "Giảng viên", courses: ["Phân tích dữ liệu"], locked: true, reason: "Nghỉ việc theo quyết định nhân sự", lockedAt: "2026-09-29T09:15:00.000Z" },
  { id: "u-1003", name: "Lê Thu Hà", email: "thuha.le@example.edu.vn", role: "Quản lý đào tạo", courses: [], locked: false, reason: "", lockedAt: null },
  { id: "u-1004", name: "Phạm Đức Long", email: "duclong.pham@example.edu.vn", role: "Giảng viên", courses: ["Thiết kế giao diện", "Nguyên lý UX"], locked: false, reason: "", lockedAt: null },
  { id: "u-1005", name: "Vũ Ngọc Mai", email: "ngocmai.vu@example.edu.vn", role: "Học viên", courses: [], locked: false, reason: "", lockedAt: null }
];

function passwordHash(password, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function verifyPassword(password, encodedHash) {
  if (typeof password !== "string" || typeof encodedHash !== "string") return false;
  const [salt, hash] = encodedHash.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function makeHandover(account, courseIndex, at) {
  return {
    id: `CLS-${account.id}-${courseIndex + 1}`,
    accountId: account.id,
    courseName: account.courses[courseIndex],
    status: "needs_handover",
    createdAt: at,
    updatedAt: at
  };
}

function createInitialState(demoPassword) {
  const accounts = seedAccounts.map(account => ({
    ...account,
    passwordHash: passwordHash(demoPassword)
  }));
  const initialLockAt = "2026-09-29T09:15:00.000Z";
  return {
    accounts,
    audit: [{
      id: "a-1",
      accountId: "u-1002",
      action: "Khoá tài khoản",
      reason: "Nghỉ việc theo quyết định nhân sự",
      actorName: "Admin",
      at: initialLockAt
    }],
    handovers: [makeHandover(accounts[1], 0, initialLockAt)],
    updatedAt: new Date().toISOString()
  };
}

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(data));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new ApiError(413, "BODY_TOO_LARGE", "Request body is too large.");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
}

function bearerToken(request) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.authorization ?? "");
  return match?.[1] ?? null;
}

export function createAppServer({
  dataFile = process.env.DATA_FILE ?? defaultDataFile,
  adminEmail = process.env.ADMIN_EMAIL ?? "admin@academy.local",
  adminPassword = process.env.ADMIN_PASSWORD ?? "12345678",
  demoPassword = process.env.DEMO_USER_PASSWORD ?? "demo-password",
  sessionTtlMs = sessionLifetimeMs
} = {}) {
  const sessions = new Map();
  const resolvedDataFile = resolve(dataFile);
  let store;

  if (existsSync(resolvedDataFile)) {
    store = JSON.parse(readFileSync(resolvedDataFile, "utf8"));
  } else {
    store = createInitialState(demoPassword);
    persistStore();
  }

  function persistStore() {
    mkdirSync(dirname(resolvedDataFile), { recursive: true });
    const temporaryPath = `${resolvedDataFile}.${process.pid}.${randomUUID()}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(store, null, 2), { mode: 0o600 });
    renameSync(temporaryPath, resolvedDataFile);
  }

  function currentSession(request) {
    const token = bearerToken(request);
    const session = token ? sessions.get(token) : null;
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      sessions.delete(token);
      return null;
    }
    return { ...session, token };
  }

  function requireAdmin(request) {
    const session = currentSession(request);
    if (!session) throw new ApiError(401, "UNAUTHORIZED", "Admin authentication is required.");
    if (session.role !== "admin") throw new ApiError(403, "FORBIDDEN", "Admin permission is required.");
    return session;
  }

  function issueSession(role, accountId, email) {
    const token = randomBytes(32).toString("base64url");
    sessions.set(token, { role, accountId, email, expiresAt: Date.now() + sessionTtlMs });
    return token;
  }

  function activeSessionCount(accountId) {
    const now = Date.now();
    let count = 0;
    for (const [token, session] of sessions) {
      if (session.expiresAt <= now) sessions.delete(token);
      else if (session.role === "user" && session.accountId === accountId) count += 1;
    }
    return count;
  }

  function publicAccount(account) {
    const { passwordHash: _passwordHash, ...safeAccount } = account;
    return { ...safeAccount, activeSessions: activeSessionCount(account.id) };
  }

  function listClasses() {
    return store.accounts
      .filter(account => account.role === "Giảng viên")
      .flatMap(account => account.courses.map((name, index) => {
        const id = `CLS-${account.id}-${index + 1}`;
        const handover = store.handovers.find(item => item.id === id);
        return {
          id,
          name,
          instructor: { id: account.id, name: account.name, locked: account.locked },
          needsHandover: handover?.status === "needs_handover",
          status: handover?.status ?? "assigned"
        };
      }));
  }

  async function handle(request, response) {
    const url = new URL(request.url, "http://localhost");
    const pathname = url.pathname;

    if (request.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(readFileSync(htmlPath));
      return;
    }
    if (request.method === "GET" && pathname === "/api/health") {
      sendJson(response, 200, { status: "ok" });
      return;
    }

    if (request.method === "POST" && pathname === "/api/admin/login") {
      const body = await readJson(request);
      const emailMatches = typeof body.email === "string" && body.email.toLowerCase() === adminEmail.toLowerCase();
      if (!emailMatches || !verifyPassword(body.password, passwordHash(adminPassword, "admin-login-salt"))) {
        throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
      }
      const token = issueSession("admin", null, adminEmail);
      sendJson(response, 200, { token, user: { email: adminEmail, role: "admin" } });
      return;
    }

    if (request.method === "POST" && pathname === "/api/auth/login") {
      const body = await readJson(request);
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const account = store.accounts.find(item => item.email.toLowerCase() === email);
      if (!account) throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
      if (account.locked) throw new ApiError(403, "ACCOUNT_LOCKED", "Tài khoản đã bị khoá.");
      if (!verifyPassword(body.password, account.passwordHash)) {
        throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
      }
      const token = issueSession("user", account.id, account.email);
      sendJson(response, 200, { token, user: { id: account.id, email: account.email, role: account.role } });
      return;
    }

    if (request.method === "GET" && pathname === "/api/auth/me") {
      const session = currentSession(request);
      if (!session || session.role !== "user") throw new ApiError(401, "SESSION_REVOKED", "Session is invalid or has expired.");
      const account = store.accounts.find(item => item.id === session.accountId);
      if (!account || account.locked) throw new ApiError(401, "SESSION_REVOKED", "Session is invalid or has been revoked.");
      sendJson(response, 200, { user: { id: account.id, email: account.email, role: account.role } });
      return;
    }

    if (request.method === "POST" && pathname === "/api/auth/logout") {
      const session = currentSession(request);
      if (session) sessions.delete(session.token);
      sendJson(response, 200, { ok: true });
      return;
    }

    const lockRoute = /^\/api\/admin\/accounts\/([^/]+)\/(lock|unlock)$/.exec(pathname);
    if (request.method === "POST" && lockRoute) {
      const actor = requireAdmin(request);
      const accountId = decodeURIComponent(lockRoute[1]);
      const action = lockRoute[2];
      const account = store.accounts.find(item => item.id === accountId);
      if (!account) throw new ApiError(404, "ACCOUNT_NOT_FOUND", "Account was not found.");

      if (action === "lock") {
        const body = await readJson(request);
        const reason = typeof body.reason === "string" ? body.reason.trim() : "";
        if (!reason || reason.length > 500) {
          throw new ApiError(422, "INVALID_LOCK_REASON", "Lý do khoá bắt buộc và không được vượt quá 500 ký tự.");
        }
        if (!account.locked) {
          const now = new Date().toISOString();
          const revokedSessions = [...sessions.entries()].filter(([, session]) => session.role === "user" && session.accountId === account.id);
          for (const [token] of revokedSessions) sessions.delete(token);
          account.locked = true;
          account.reason = reason;
          account.lockedAt = now;
          let createdHandoverAlerts = 0;
          for (const [courseIndex] of account.courses.entries()) {
            const handoverId = `CLS-${account.id}-${courseIndex + 1}`;
            if (!store.handovers.some(item => item.id === handoverId)) {
              store.handovers.push(makeHandover(account, courseIndex, now));
              createdHandoverAlerts += 1;
            }
          }
          store.audit.unshift({ id: randomUUID(), accountId, action: "Khoá tài khoản", reason, actorName: actor.email, at: now });
          store.updatedAt = now;
          persistStore();
          sendJson(response, 200, {
            account: publicAccount(account),
            revokedSessions: revokedSessions.length,
            createdHandoverAlerts
          });
          return;
        }
        sendJson(response, 200, { account: publicAccount(account), revokedSessions: 0, createdHandoverAlerts: 0 });
        return;
      }

      if (account.locked) {
        const now = new Date().toISOString();
        account.locked = false;
        account.reason = "";
        account.lockedAt = null;
        store.audit.unshift({ id: randomUUID(), accountId, action: "Mở khoá tài khoản", reason: "", actorName: actor.email, at: now });
        store.updatedAt = now;
        persistStore();
      }
      sendJson(response, 200, { account: publicAccount(account) });
      return;
    }

    if (request.method === "GET" && ["/api/accounts", "/api/classes", "/api/audit"].includes(pathname)) {
      requireAdmin(request);
      if (pathname === "/api/accounts") {
        sendJson(response, 200, { accounts: store.accounts.map(publicAccount), updatedAt: store.updatedAt });
      } else if (pathname === "/api/classes") {
        sendJson(response, 200, { classes: listClasses() });
      } else {
        sendJson(response, 200, { audit: store.audit.slice(0, 200) });
      }
      return;
    }

    throw new ApiError(404, "NOT_FOUND", "Route was not found.");
  }

  return createServer((request, response) => {
    handle(request, response).catch(error => {
      if (response.headersSent) {
        response.destroy(error);
        return;
      }
      if (error instanceof ApiError) {
        sendJson(response, error.status, { error: error.code, message: error.message });
        return;
      }
      console.error(error);
      sendJson(response, 500, { error: "INTERNAL_ERROR", message: "Unexpected server error." });
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const adminPassword = process.env.ADMIN_PASSWORD ?? "12345678";
  const server = createAppServer({ adminPassword });
  const port = Number(process.env.PORT ?? 5173);
  server.listen(port, "127.0.0.1", () => {
    console.log(`Academy Admin is running at http://localhost:${port}`);
    console.log(`Admin email: ${process.env.ADMIN_EMAIL ?? "admin@academy.local"}`);
  });
}

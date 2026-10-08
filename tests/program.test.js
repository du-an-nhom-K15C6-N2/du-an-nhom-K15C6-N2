const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { hashPassword } = require('../backend/security/password');

let baseUrl;
let server;
let tempDir;
let adminToken;

async function api(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  return { response, data: await response.json() };
}

function jsonRequest(body, token, method = 'POST') {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  };
}

function authRequest(token) {
  return {
    headers: {
      Authorization: ['Bearer', token].join(' ')
    }
  };
}

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ttcs-program-test-'));
  process.env.DATA_FILE = path.join(tempDir, 'users.json');
  process.env.PROGRAMS_DB_FILE = path.join(tempDir, 'programs.sqlite');
  process.env.SESSION_STORE_FILE = path.join(tempDir, 'revoked-sessions.json');
  process.env.LOGIN_ATTEMPT_STORE_FILE = path.join(tempDir, 'login-attempts.json');
  process.env.ATTENDANCE_DATA_FILE = path.join(tempDir, 'attendance.json');
  process.env.AUTH_TOKEN_SECRET = 'test-secret-program-testing';
  const legacyDatabase = new (require('better-sqlite3'))(process.env.PROGRAMS_DB_FILE);
  legacyDatabase.exec(`
    CREATE TABLE programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL COLLATE NOCASE UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  legacyDatabase.close();
  await fs.writeFile(process.env.DATA_FILE, JSON.stringify([{
    id: 'program-admin',
    name: 'Program Admin',
    email: 'admin@program.test',
    role: 'admin',
    status: 'active',
    passwordHash: await hashPassword('Admin@12345')
  }]));

  const { app } = require('../backend/server');
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const login = await api('/api/auth/login', jsonRequest({
    email: 'admin@program.test',
    password: 'Admin@12345'
  }));
  assert.equal(login.response.status, 200);
  adminToken = login.data.token;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
  require('../backend/models/programModel').close();
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
  delete process.env.DATA_FILE;
  delete process.env.PROGRAMS_DB_FILE;
  delete process.env.SESSION_STORE_FILE;
  delete process.env.LOGIN_ATTEMPT_STORE_FILE;
  delete process.env.ATTENDANCE_DATA_FILE;
  delete process.env.AUTH_TOKEN_SECRET;
});

test('creating a program stores a normalized unique code', async () => {
  const created = await api('/api/programs', jsonRequest({
    code: '  k15-cs  ',
    name: 'Chương trình Công nghệ thông tin',
    totalDuration: 120,
    standardTuition: 750000,
    status: 'active'
  }, adminToken));

  assert.equal(created.response.status, 201);
  assert.equal(created.data.success, true);
  assert.equal(created.data.data.code, 'K15-CS');
  assert.equal(created.data.data.totalDuration, 120);
  assert.equal(created.data.data.standardTuition, 750000);
  assert.equal(created.data.data.status, 'active');
});

test('served frontend includes admin program list, search, create, and edit controls', async () => {
  const response = await fetch(baseUrl);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /id="tab-nav-programs"/);
  assert.match(html, /id="portal-programs"/);
  assert.match(html, /id="program-search-input"/);
  assert.match(html, /id="program-code-filter"/);
  assert.match(html, /id="program-form"/);
  assert.match(html, /id="program-form-duration"/);
  assert.match(html, /id="program-form-tuition"/);
  assert.match(html, /id="program-form-status"/);
  assert.match(html, /id="program-table-body"/);
  assert.match(html, /Lớp đang chạy/);
});

test('duplicate program codes are rejected with a clear Vietnamese response', async () => {
  const duplicate = await api('/api/programs', jsonRequest({
    code: 'k15-cs',
    name: 'Chương trình trùng mã'
  }, adminToken));

  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.data.code, 'PROGRAM_CODE_ALREADY_EXISTS');
  assert.match(duplicate.data.message, /Mã chương trình đã tồn tại/i);
});

test('SQLite enforces program code uniqueness independently of the application check', () => {
  const ProgramModel = require('../backend/models/programModel');
  assert.throws(
    () => ProgramModel.create({ code: 'k15-cs', name: 'Trùng mã ở tầng dữ liệu' }),
    error => error.code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
});

test('program listing searches, filters by code, and returns paginated results', async () => {
  const second = await api('/api/programs', jsonRequest({
    code: 'K15-IT',
    name: 'Công nghệ thông tin'
  }, adminToken));
  const third = await api('/api/programs', jsonRequest({
    code: 'K16-IT',
    name: 'Công nghệ thông tin nâng cao'
  }, adminToken));
  assert.equal(second.response.status, 201);
  assert.equal(third.response.status, 201);

  const firstPage = await api('/api/programs?search=IT&page=1&pageSize=1', {
    ...authRequest(adminToken)
  });
  assert.equal(firstPage.response.status, 200);
  assert.equal(firstPage.data.data.length, 1);
  assert.equal(firstPage.data.data[0].code, 'K15-IT');
  assert.deepEqual(firstPage.data.pagination, {
    currentPage: 1,
    pageSize: 1,
    totalRecords: 2,
    totalPages: 2,
    startIndex: 1,
    endIndex: 1
  });

  const secondPage = await api('/api/programs?search=IT&page=2&pageSize=1', {
    ...authRequest(adminToken)
  });
  assert.equal(secondPage.data.data[0].code, 'K16-IT');
  assert.equal(secondPage.data.pagination.currentPage, 2);

  const codeFilter = await api('/api/programs?code=k15-it', {
    ...authRequest(adminToken)
  });
  assert.equal(codeFilter.data.data.length, 1);
  assert.equal(codeFilter.data.data[0].code, 'K15-IT');
});

test('program listing rejects invalid pagination parameters', async () => {
  const result = await api('/api/programs?page=0&pageSize=101', {
    ...authRequest(adminToken)
  });

  assert.equal(result.response.status, 400);
  assert.equal(result.data.code, 'INVALID_PAGINATION');
});

test('program creation validates duration, tuition, and status values', async () => {
  for (const [payload, errorCode] of [
    [{ code: 'BAD-DURATION', name: 'Invalid duration', totalDuration: -1 }, 'PROGRAM_DURATION_INVALID'],
    [{ code: 'BAD-TUITION', name: 'Invalid tuition', standardTuition: 10.5 }, 'PROGRAM_TUITION_INVALID'],
    [{ code: 'BAD-STATUS', name: 'Invalid status', status: 'pending' }, 'PROGRAM_STATUS_INVALID']
  ]) {
    const result = await api('/api/programs', jsonRequest(payload, adminToken));
    assert.equal(result.response.status, 400);
    assert.equal(result.data.code, errorCode);
  }
});

test('programs can be edited while preserving code uniqueness', async () => {
  const created = await api('/api/programs', jsonRequest({
    code: 'EDIT-ME',
    name: 'Tên ban đầu',
    totalDuration: 90,
    standardTuition: 500000,
    status: 'active'
  }, adminToken));
  const other = await api('/api/programs', jsonRequest({
    code: 'KEEP-ME',
    name: 'Chương trình còn lại'
  }, adminToken));
  assert.equal(created.response.status, 201);
  assert.equal(other.response.status, 201);

  const updated = await api(`/api/programs/${created.data.data.id}`, jsonRequest({
    code: 'edit-me',
    name: 'Tên đã cập nhật',
    description: 'Mô tả mới',
    totalDuration: 150,
    standardTuition: 1250000,
    status: 'inactive'
  }, adminToken, 'PUT'));
  assert.equal(updated.response.status, 200);
  assert.equal(updated.data.data.code, 'EDIT-ME');
  assert.equal(updated.data.data.name, 'Tên đã cập nhật');
  assert.equal(updated.data.data.description, 'Mô tả mới');
  assert.equal(updated.data.data.totalDuration, 150);
  assert.equal(updated.data.data.standardTuition, 1250000);
  assert.equal(updated.data.data.status, 'inactive');

  const legacyUpdate = await api(`/api/programs/${created.data.data.id}`, jsonRequest({
    code: 'EDIT-ME',
    name: 'Cập nhật từ client cũ'
  }, adminToken, 'PUT'));
  assert.equal(legacyUpdate.response.status, 200);
  assert.equal(legacyUpdate.data.data.totalDuration, 150);
  assert.equal(legacyUpdate.data.data.standardTuition, 1250000);
  assert.equal(legacyUpdate.data.data.status, 'inactive');

  const duplicate = await api(`/api/programs/${created.data.data.id}`, jsonRequest({
    code: 'KEEP-ME',
    name: 'Tên khác'
  }, adminToken, 'PUT'));
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.data.code, 'PROGRAM_CODE_ALREADY_EXISTS');

  const missing = await api('/api/programs/9999', jsonRequest({
    code: 'MISSING',
    name: 'Không tồn tại'
  }, adminToken, 'PUT'));
  assert.equal(missing.response.status, 404);
  assert.equal(missing.data.code, 'PROGRAM_NOT_FOUND');
});

test('program endpoints require an administrator session', async () => {
  const result = await api('/api/programs', jsonRequest({
    code: 'NO-AUTH',
    name: 'Không được tạo'
  }));

  assert.equal(result.response.status, 401);
  assert.equal(result.data.success, false);
});

test('deleting a program with a running class deactivates it, then hard-deletes when the class ends', async () => {
  const created = await api('/api/programs', jsonRequest({
    code: 'PROGRAM-WITH-CLASS',
    name: 'Chương trình có lớp đang chạy'
  }, adminToken));
  assert.equal(created.response.status, 201);
  const programId = created.data.data.id;

  const linked = await api(`/api/programs/${programId}/classes`, jsonRequest({
    classCode: 'K15-CLASS-01',
    className: 'Lớp K15 số 1'
  }, adminToken));
  assert.equal(linked.response.status, 201);
  assert.equal(linked.data.data.classCode, 'K15-CLASS-01');

  const listing = await api('/api/programs?code=PROGRAM-WITH-CLASS', authRequest(adminToken));
  assert.equal(listing.data.data[0].runningClassCount, 1);

  const blockedDelete = await api(`/api/programs/${programId}`, {
    ...authRequest(adminToken),
    method: 'DELETE'
  });
  assert.equal(blockedDelete.response.status, 200);
  assert.equal(blockedDelete.data.code, 'PROGRAM_DEACTIVATED_IN_USE');
  assert.equal(blockedDelete.data.data.status, 'inactive');
  assert.equal(blockedDelete.data.runningClassCount, 1);
  const stillPresent = await api('/api/programs?code=PROGRAM-WITH-CLASS', authRequest(adminToken));
  assert.equal(stillPresent.data.data[0].status, 'inactive');

  const rejectedNewClass = await api(`/api/programs/${programId}/classes`, jsonRequest({
    classCode: 'K15-CLASS-02',
    className: 'Lớp K15 số 2'
  }, adminToken));
  assert.equal(rejectedNewClass.response.status, 409);
  assert.equal(rejectedNewClass.data.code, 'PROGRAM_INACTIVE');

  const classes = await api(`/api/programs/${programId}/classes`, authRequest(adminToken));
  assert.equal(classes.response.status, 200);
  assert.equal(classes.data.data.length, 1);

  const ended = await api(`/api/programs/${programId}/classes/${linked.data.data.id}`, {
    ...authRequest(adminToken),
    method: 'DELETE'
  });
  assert.equal(ended.response.status, 200);
  const noLongerRunning = await api(`/api/programs/${programId}/classes`, authRequest(adminToken));
  assert.equal(noLongerRunning.data.data.length, 0);

  const deleted = await api(`/api/programs/${programId}`, {
    ...authRequest(adminToken),
    method: 'DELETE'
  });
  assert.equal(deleted.response.status, 200);
  assert.equal(deleted.data.code, 'PROGRAM_DELETED');
  const missing = await api('/api/programs?code=PROGRAM-WITH-CLASS', authRequest(adminToken));
  assert.equal(missing.data.data.length, 0);
});

test('unused programs can be hard-deleted immediately', async () => {
  const created = await api('/api/programs', jsonRequest({
    code: 'PROGRAM-UNUSED',
    name: 'Chương trình chưa được sử dụng'
  }, adminToken));
  assert.equal(created.response.status, 201);

  const deleted = await api(`/api/programs/${created.data.data.id}`, {
    ...authRequest(adminToken),
    method: 'DELETE'
  });
  assert.equal(deleted.response.status, 200);
  assert.equal(deleted.data.code, 'PROGRAM_DELETED');
});

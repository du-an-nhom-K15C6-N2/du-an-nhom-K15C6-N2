const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fsSync = require('node:fs');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const { hashPassword, verifyPassword } = require('../backend/security/password');
const LoginAttemptService = require('../backend/services/loginAttemptService');

let baseUrl;
let server;
let tempDir;
let dataFile;
let sessionStoreFile;
let loginAttemptStoreFile;
let attendanceDataFile;

async function api(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  return {
    response,
    data: await response.json()
  };
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

test('root URL serves the original EduClass portal login interface', async () => {
  const response = await fetch(baseUrl);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /EduClass/);
  assert.match(html, /id="auth-section"/);
  assert.match(html, /id="attempt-meter-container"/);
});

test('unknown API routes return the shared resource-not-found error shape', async () => {
  const result = await api('/api/route-that-does-not-exist');
  assert.equal(result.response.status, 404);
  assert.equal(result.data.success, false);
  assert.equal(result.data.code, 'RESOURCE_NOT_FOUND');
  assert.equal(result.data.errorType, 'not-found');
  assert.equal(result.data.resource, '/api/route-that-does-not-exist');
  assert.match(result.data.message, /không tồn tại/i);
});

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ttcs-auth-test-'));
  dataFile = path.join(tempDir, 'users.json');
  sessionStoreFile = path.join(tempDir, 'revoked-sessions.json');
  loginAttemptStoreFile = path.join(tempDir, 'login-attempts.json');
  attendanceDataFile = path.join(tempDir, 'attendance.json');
  process.env.DATA_FILE = dataFile;
  process.env.SESSION_STORE_FILE = sessionStoreFile;
  process.env.LOGIN_ATTEMPT_STORE_FILE = loginAttemptStoreFile;
  process.env.ATTENDANCE_DATA_FILE = attendanceDataFile;
  process.env.AUTH_TOKEN_SECRET = 'test-secret-that-is-not-used-outside-tests';

  const studentHash = await hashPassword('Student@123');
  const adminHash = await hashPassword('Admin@12345');
  const teacherHash = await hashPassword('Teacher@12345');
  await fs.writeFile(dataFile, JSON.stringify([
    {
      id: 'student-1',
      name: 'Test Student',
      email: 'student@test.edu',
      role: 'student',
      roleLabel: 'Học sinh',
      status: 'active',
      passwordHash: studentHash
    },
    {
      id: 'admin-1',
      name: 'Test Admin',
      email: 'admin@test.edu',
      role: 'admin',
      roleLabel: 'Quản trị viên',
      status: 'active',
      passwordHash: adminHash
    },
    {
      id: 'teacher-1',
      name: 'Test Teacher',
      email: 'teacher@test.edu',
      role: 'teacher',
      roleLabel: 'Giảng viên',
      status: 'active',
      passwordHash: teacherHash
    }
  ]));

  const { app } = require('../backend/server');
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
  delete process.env.DATA_FILE;
  delete process.env.SESSION_STORE_FILE;
  delete process.env.LOGIN_ATTEMPT_STORE_FILE;
  delete process.env.ATTENDANCE_DATA_FILE;
  delete process.env.AUTH_TOKEN_SECRET;
});

test('passwords are stored as hashes and only the correct password verifies', async () => {
  const passwordHash = await hashPassword('Example@123');
  assert.notEqual(passwordHash, 'Example@123');
  assert.match(passwordHash, /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.equal(await verifyPassword('Example@123', passwordHash), true);
  assert.equal(await verifyPassword('Wrong@123', passwordHash), false);
  assert.equal(await verifyPassword('dummy-password', undefined), false);
  assert.equal(await verifyPassword('Example@123', 'invalid-hash'), false);
});

test('valid login returns the account role and a signed JWT session', async () => {
  const { response, data } = await api('/api/auth/login', jsonRequest({
    email: 'student@test.edu',
    password: 'Student@123'
  }));

  assert.equal(response.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.user.role, 'student');
  assert.match(data.token, /^[^.]+\.[^.]+\.[^.]+$/);
  assert.equal(data.token.includes('mock'), false);

  const me = await api('/api/auth/me', {
    headers: { Authorization: `Bearer ${data.token}` }
  });
  assert.equal(me.response.status, 200);
  assert.equal(me.data.user.email, 'student@test.edu');
  assert.equal('passwordHash' in me.data.user, false);

  const logout = await api('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${data.token}` }
  });
  assert.equal(logout.response.status, 200);
  const expiredSession = await api('/api/auth/me', {
    headers: { Authorization: `Bearer ${data.token}` }
  });
  assert.equal(expiredSession.response.status, 401);
  assert.equal(expiredSession.data.code, 'SESSION_EXPIRED');
  const tokenModulePath = require.resolve('../backend/security/token');
  delete require.cache[tokenModulePath];
  const restartedTokenService = require('../backend/security/token');
  assert.equal(restartedTokenService.verifyToken(data.token), null);
});

test('changing a password requires the current password and invalidates the old password', async () => {
  const login = await api('/api/auth/login', jsonRequest({
    email: 'teacher@test.edu',
    password: 'Teacher@12345'
  }));
  assert.equal(login.response.status, 200);

  const wrongCurrentPassword = await api('/api/auth/change-password', jsonRequest({
    currentPassword: 'Wrong@123',
    newPassword: 'UpdatedTeacher@123'
  }, login.data.token, 'PATCH'));
  assert.equal(wrongCurrentPassword.response.status, 400);
  assert.equal(wrongCurrentPassword.data.code, 'CURRENT_PASSWORD_INVALID');

  const shortNewPassword = await api('/api/auth/change-password', jsonRequest({
    currentPassword: 'Teacher@12345',
    newPassword: 'short'
  }, login.data.token, 'PATCH'));
  assert.equal(shortNewPassword.response.status, 400);

  const changedPassword = await api('/api/auth/change-password', jsonRequest({
    currentPassword: 'Teacher@12345',
    newPassword: 'UpdatedTeacher@123'
  }, login.data.token, 'PATCH'));
  assert.equal(changedPassword.response.status, 200);

  const oldPasswordLogin = await api('/api/auth/login', jsonRequest({
    email: 'teacher@test.edu',
    password: 'Teacher@12345'
  }));
  const newPasswordLogin = await api('/api/auth/login', jsonRequest({
    email: 'teacher@test.edu',
    password: 'UpdatedTeacher@123'
  }));
  assert.equal(oldPasswordLogin.response.status, 401);
  assert.equal(newPasswordLogin.response.status, 200);

  const restoreTestPassword = await api('/api/auth/change-password', jsonRequest({
    currentPassword: 'UpdatedTeacher@123',
    newPassword: 'Teacher@12345'
  }, login.data.token, 'PATCH'));
  assert.equal(restoreTestPassword.response.status, 200);
});

test('attendance API protects roles, validates records, and persists entries', async () => {
  const { data: studentLogin } = await api('/api/auth/login', jsonRequest({
    email: 'student@test.edu',
    password: 'Student@123'
  }));
  const studentForbidden = await api('/api/attendance', jsonRequest({
    className: 'Lớp 10A',
    studentEmail: 'student@test.edu',
    attendanceDate: '2026-10-04',
    status: 'present'
  }, studentLogin.token));
  assert.equal(studentForbidden.response.status, 403);
  assert.equal(studentForbidden.data.code, 'ACCESS_FORBIDDEN');
  assert.equal(studentForbidden.data.errorType, 'forbidden');
  assert.equal(studentForbidden.data.featureName, 'quản lý điểm danh');
  assert.equal(studentForbidden.data.role, 'student');

  const { data: teacherLogin } = await api('/api/auth/login', jsonRequest({
    email: 'teacher@test.edu',
    password: 'Teacher@12345'
  }));
  const students = await api('/api/attendance/students', {
    headers: { Authorization: ['Bearer', teacherLogin.token].join(' ') }
  });
  assert.equal(students.response.status, 200);
  assert.ok(students.data.data.some(student =>
    student.id === 'student-1'
    && student.name === 'Test Student'
    && student.email === 'student@test.edu'
  ));
  assert.equal(students.data.data.some(student => student.email === 'admin@test.edu'), false);
  assert.equal(students.data.data.some(student => 'passwordHash' in student), false);

  const forbiddenStudentList = await api('/api/attendance/students', {
    headers: { Authorization: ['Bearer', studentLogin.token].join(' ') }
  });
  assert.equal(forbiddenStudentList.response.status, 403);
  assert.equal(forbiddenStudentList.data.code, 'ACCESS_FORBIDDEN');
  assert.equal(forbiddenStudentList.data.featureName, 'quản lý điểm danh');

  const invalidDate = await api('/api/attendance', jsonRequest({
    className: 'Lớp 10A',
    studentEmail: 'student@test.edu',
    attendanceDate: '2026-02-30',
    status: 'present'
  }, teacherLogin.token));
  assert.equal(invalidDate.response.status, 400);

  const record = await api('/api/attendance', jsonRequest({
    className: 'Lớp 10A',
    studentId: 'student-1',
    attendanceDate: '2026-10-04',
    status: 'late',
    note: 'Xe buýt đến muộn'
  }, teacherLogin.token));
  assert.equal(record.response.status, 201);
  assert.equal(record.data.data.studentId, 'student-1');
  assert.equal(record.data.data.studentName, 'Test Student');
  assert.equal(record.data.data.studentEmail, 'student@test.edu');
  assert.equal(record.data.data.createdBy, 'teacher-1');

  const invalidStudent = await api('/api/attendance', jsonRequest({
    className: 'Lớp 10A',
    studentId: 'admin-1',
    attendanceDate: '2026-10-05',
    status: 'present'
  }, teacherLogin.token));
  assert.equal(invalidStudent.response.status, 404);

  const records = await api('/api/attendance', {
    headers: { Authorization: `Bearer ${teacherLogin.token}` }
  });
  assert.equal(records.response.status, 200);
  assert.equal(records.data.data.length, 1);
  assert.equal(records.data.data[0].status, 'late');
  assert.deepEqual(JSON.parse(await fs.readFile(attendanceDataFile, 'utf8')), records.data.data);

  const duplicate = await api('/api/attendance', jsonRequest({
    className: 'Lớp 10A',
    studentEmail: 'student@test.edu',
    attendanceDate: '2026-10-04',
    status: 'present'
  }, teacherLogin.token));
  assert.equal(duplicate.response.status, 409);
});

test('revoked sessions are shared by concurrent server processes', async () => {
  const projectRoot = path.resolve(__dirname, '..');
  const sessionIds = ['concurrent-session-a', 'concurrent-session-b'];
  const children = sessionIds.map(sessionId => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      '-e',
      "require('./backend/security/token').revokeSession(process.argv[1], Math.floor(Date.now() / 1000) + 3600)",
      sessionId
    ], {
      cwd: projectRoot,
      env: {
        ...process.env,
        AUTH_TOKEN_SECRET: 'test-secret-that-is-not-used-outside-tests',
        SESSION_STORE_FILE: sessionStoreFile
      },
      stdio: 'ignore'
    });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`Session store worker exited with code ${code}`));
    });
  }));

  await Promise.all(children);
  const { isRevoked } = require('../backend/security/sessionStore');
  for (const sessionId of sessionIds) {
    assert.equal(isRevoked('not-a-token-hash', sessionId, Math.floor(Date.now() / 1000)), true);
  }
});

test('refresh renews an active session and logout revokes every token in it', async () => {
  const { data: login } = await api('/api/auth/login', jsonRequest({
    email: 'student@test.edu',
    password: 'Student@123'
  }));
  const refresh = await api('/api/auth/refresh', {
    method: 'POST',
    headers: { Authorization: `Bearer ${login.token}` }
  });

  assert.equal(refresh.response.status, 200);
  assert.notEqual(refresh.data.token, login.token);
  assert.equal(refresh.data.expiresIn, 24 * 60 * 60);

  const logout = await api('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${refresh.data.token}` }
  });
  assert.equal(logout.response.status, 200);

  for (const token of [login.token, refresh.data.token]) {
    const result = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(result.response.status, 401);
    assert.equal(result.data.code, 'SESSION_EXPIRED');
  }
});

test('expired tokens return an explicit session-expired response', async () => {
  const { createToken } = require('../backend/security/token');
  const expiredToken = createToken(
    { id: 'student-1', role: 'student' },
    'expired-test-session',
    -1
  );
  const { response, data } = await api('/api/auth/me', {
    headers: { Authorization: `Bearer ${expiredToken}` }
  });

  assert.equal(response.status, 401);
  assert.equal(data.code, 'SESSION_EXPIRED');
  assert.match(data.message, /hết hạn/i);
});

test('wrong password and unknown email have the same public error', async () => {
  const wrongPassword = await api('/api/auth/login', jsonRequest({
    email: 'student@test.edu',
    password: 'Wrong@123'
  }));
  const unknownEmail = await api('/api/auth/login', jsonRequest({
    email: 'missing@test.edu',
    password: 'Wrong@123'
  }));

  assert.equal(wrongPassword.response.status, 401);
  assert.equal(unknownEmail.response.status, 401);
  assert.deepEqual(wrongPassword.data, {
    success: false,
    code: 'INVALID_CREDENTIALS',
    message: 'Email hoặc mật khẩu không đúng'
  });
  assert.deepEqual(unknownEmail.data, wrongPassword.data);
});

test('five consecutive failures activate a 15-minute lockout with the same error', async () => {
  let lastResult;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    lastResult = await api('/api/auth/login', jsonRequest({
      email: 'locked-test@test.edu',
      password: 'Wrong@123'
    }));
  }
  assert.equal(lastResult.response.status, 401);
  assert.equal(lastResult.response.headers.get('retry-after'), '900');
  assert.equal(lastResult.data.message, 'Email hoặc mật khẩu không đúng');
  assert.equal(lastResult.data.retryAfterSeconds, 900);

  const stillLocked = await api('/api/auth/login', jsonRequest({
    email: 'locked-test@test.edu',
    password: 'Wrong@123'
  }));
  assert.equal(stillLocked.response.status, 401);
  assert.ok(Number(stillLocked.response.headers.get('retry-after')) > 0);
  assert.ok(stillLocked.data.retryAfterSeconds > 0);
  assert.ok(stillLocked.data.retryAfterSeconds <= lastResult.data.retryAfterSeconds);
  assert.equal(stillLocked.data.code, lastResult.data.code);
  assert.equal(stillLocked.data.message, lastResult.data.message);
});

test('lockout automatically expires after 15 minutes', () => {
  const email = 'expiry-test@test.edu';
  const start = 1_000_000;
  for (let attempt = 0; attempt < LoginAttemptService.MAX_ATTEMPTS; attempt += 1) {
    LoginAttemptService.recordFailedAttempt(email, start + attempt);
  }

  const lockedUntil = start + LoginAttemptService.MAX_ATTEMPTS - 1 + LoginAttemptService.LOCKOUT_TIME;
  assert.equal(LoginAttemptService.isLocked(email, lockedUntil - 1), true);
  assert.equal(LoginAttemptService.isLocked(email, lockedUntil), false);
  assert.equal(LoginAttemptService.getAttempts(email).count, 0);
});

test('failed login attempts persist across service restarts without storing email addresses', () => {
  const email = 'persistent-lockout@test.edu';
  LoginAttemptService.resetAttempts(email);
  for (let attempt = 0; attempt < LoginAttemptService.MAX_ATTEMPTS; attempt += 1) {
    LoginAttemptService.recordFailedAttempt(email);
  }

  const storeContents = fsSync.readFileSync(loginAttemptStoreFile, 'utf8');
  assert.equal(storeContents.includes(email), false);

  const servicePath = require.resolve('../backend/services/loginAttemptService');
  delete require.cache[servicePath];
  const restartedService = require('../backend/services/loginAttemptService');
  assert.equal(restartedService.isLocked(email), true);
  assert.ok(restartedService.getLockoutRemainingMs(email) > 0);
  restartedService.resetAttempts(email);
});

test('user APIs require an authenticated admin and never expose password hashes', async () => {
  const { data: studentLogin } = await api('/api/auth/login', jsonRequest({
    email: 'student@test.edu',
    password: 'Student@123'
  }));
  const unauthenticated = await api('/api/users');
  const studentAccess = await api('/api/users', {
    headers: { Authorization: `Bearer ${studentLogin.token}` }
  });
  assert.equal(unauthenticated.response.status, 401);
  assert.equal(studentAccess.response.status, 403);
  assert.equal(studentAccess.data.code, 'ACCESS_FORBIDDEN');
  assert.equal(studentAccess.data.errorType, 'forbidden');
  assert.equal(studentAccess.data.featureName, 'quản lý người dùng');
  assert.equal(studentAccess.data.role, 'student');

  const { data: adminLogin } = await api('/api/auth/login', jsonRequest({
    email: 'admin@test.edu',
    password: 'Admin@12345'
  }));
  const adminUsers = await api('/api/users', {
    headers: { Authorization: `Bearer ${adminLogin.token}` }
  });
  assert.equal(adminUsers.response.status, 200);
  assert.equal(adminUsers.data.data.some(user => 'passwordHash' in user), false);

  const missingUser = await api('/api/users/not-a-real-user', {
    headers: { Authorization: ['Bearer', adminLogin.token].join(' ') }
  });
  assert.equal(missingUser.response.status, 404);
  assert.equal(missingUser.data.code, 'RESOURCE_NOT_FOUND');
  assert.equal(missingUser.data.errorType, 'not-found');
  assert.equal(missingUser.data.resource, 'user');

  const created = await api('/api/users', jsonRequest({
    name: 'New Student',
    email: 'new@test.edu',
    role: 'student',
    password: 'NewStudent@123'
  }, adminLogin.token));
  assert.equal(created.response.status, 201);
  assert.equal('passwordHash' in created.data.data, false);
  const users = JSON.parse(await fs.readFile(dataFile, 'utf8'));
  const newUser = users.find(user => user.email === 'new@test.edu');
  assert.equal(await verifyPassword('NewStudent@123', newUser.passwordHash), true);

  const reset = await api('/api/users/student-1/password', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminLogin.token}`
    },
    body: JSON.stringify({ password: 'ResetStudent@123' })
  });
  assert.equal(reset.response.status, 200);
  assert.equal('passwordHash' in reset.data.data, false);
  const resetLogin = await api('/api/auth/login', jsonRequest({
    email: 'student@test.edu',
    password: 'ResetStudent@123'
  }));
  assert.equal(resetLogin.response.status, 200);
});

test('frontend resolves a distinct home route for every school role', async () => {
  const { createServer } = await import('vite');
  const vite = await createServer({
    configFile: false,
    root: path.resolve(__dirname, '..'),
    server: { middlewareMode: true },
    appType: 'custom'
  });

  try {
    const {
      getAppRouteError,
      getSafePreviousPath,
      getSafeAppPath,
      isKnownAppPath,
      resolveNavigationByRole
    } = await vite.ssrLoadModule('/src/core/navigation.js');
    assert.equal(resolveNavigationByRole('admin').path, '/admin/dashboard');
    assert.equal(resolveNavigationByRole('teacher').path, '/teacher/dashboard');
    assert.equal(resolveNavigationByRole('assistant').path, '/assistant/dashboard');
    assert.equal(resolveNavigationByRole('student').path, '/student/workspace');
    assert.throws(() => resolveNavigationByRole('unknown'), /vai trò/i);
    assert.equal(isKnownAppPath('/'), true);
    assert.equal(isKnownAppPath('/student/workspace/'), true);
    assert.equal(isKnownAppPath('/unknown-page'), false);
    assert.equal(getAppRouteError('/unknown-page', true, 'admin'), 'not-found');
    assert.equal(getAppRouteError('/admin/dashboard', true, 'student'), 'forbidden');
    assert.equal(getAppRouteError('/student/workspace/', true, 'student'), null);
    assert.equal(getAppRouteError('/admin/dashboard', false, null), null);
    assert.equal(getSafeAppPath(true, { path: '/admin/dashboard' }), '/admin/dashboard');
    assert.equal(getSafeAppPath(false, null), '/login');
    assert.equal(
      getSafePreviousPath('http://localhost/student/workspace?tab=courses', 'http://localhost', 'student', '/student/workspace'),
      '/student/workspace?tab=courses'
    );
    assert.equal(
      getSafePreviousPath('https://external.example/', 'http://localhost', 'student', '/student/workspace'),
      '/student/workspace'
    );
    assert.equal(
      getSafePreviousPath('http://localhost/admin/dashboard', 'http://localhost', 'student', '/student/workspace'),
      '/student/workspace'
    );
  } finally {
    await vite.close();
  }
});

test('shared error screens show matching messages and safe navigation actions', async () => {
  const { createServer } = await import('vite');
  const vite = await createServer({
    configFile: false,
    root: path.resolve(__dirname, '..'),
    server: { middlewareMode: true },
    appType: 'custom'
  });
  const globalNames = ['window', 'document', 'CustomEvent'];
  const originalGlobals = globalNames.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);

  try {
    const { renderAppErrorScreen } = await vite.ssrLoadModule('/src/components/AppErrorScreen.js');
    const navigationPaths = [];
    globalThis.window = {
      location: { origin: 'http://localhost:5173' },
      history: {
        pushState: (state, title, path) => navigationPaths.push(path)
      },
      dispatchEvent: () => true
    };
    globalThis.document = {
      referrer: 'http://localhost:5173/student/workspace?tab=courses'
    };
    globalThis.CustomEvent = class {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    };

    const handlers = new Map();
    const container = {
      innerHTML: '',
      querySelector(selector) {
        return {
          addEventListener: (eventName, handler) => handlers.set(selector, handler)
        };
      }
    };

    renderAppErrorScreen(container, { type: 'not-found', safePath: '/login' });
    assert.match(container.innerHTML, /data-error-type="not-found"/);
    assert.match(container.innerHTML, />404</);
    assert.match(container.innerHTML, /đường dẫn này không tồn tại/i);
    assert.match(container.innerHTML, /Quay lại màn hình an toàn/);
    assert.match(container.innerHTML, /Về trang chủ/);
    assert.doesNotMatch(container.innerHTML, /btn-previous-page/);
    handlers.get('#btn-safe-screen')();
    handlers.get('#btn-home')();
    assert.deepEqual(navigationPaths, ['/login', '/']);

    handlers.clear();
    renderAppErrorScreen(container, {
      type: 'forbidden',
      safePath: '/student/workspace',
      featureName: '<script>alert(1)</script>',
      role: 'STUDENT'
    });
    assert.match(container.innerHTML, /data-error-type="forbidden"/);
    assert.match(container.innerHTML, />403</);
    assert.match(container.innerHTML, /chưa được cấp quyền/i);
    assert.match(container.innerHTML, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(container.innerHTML, /Vai trò: <strong>STUDENT<\/strong>/);
    assert.match(container.innerHTML, /Quay lại trang trước/);
    handlers.get('#btn-previous-page')();
    assert.equal(navigationPaths.at(-1), '/student/workspace?tab=courses');
  } finally {
    for (const [key, descriptor] of originalGlobals) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        delete globalThis[key];
      }
    }
    await vite.close();
  }
});

test('restored form drafts remain available until the form is successfully saved', async () => {
  const { createServer } = await import('vite');
  const vite = await createServer({
    configFile: false,
    root: path.resolve(__dirname, '..'),
    server: { middlewareMode: true },
    appType: 'custom'
  });
  const originalGlobals = ['HTMLFormElement', 'HTMLSelectElement', 'window', 'document', 'sessionStorage']
    .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);

  try {
    class MockForm {}
    class MockSelect {}
    const storage = new Map();
    const field = {
      name: 'className',
      type: 'text',
      value: 'Lớp 10A',
      matches: () => false,
      dispatchEvent: () => true
    };
    const form = {
      id: 'attendance-form',
      name: '',
      dataset: { draftKey: 'attendance-entry' },
      elements: [field]
    };
    globalThis.HTMLFormElement = MockForm;
    globalThis.HTMLSelectElement = MockSelect;
    Object.setPrototypeOf(form, MockForm.prototype);
    globalThis.window = { location: { pathname: '/teacher/dashboard' } };
    globalThis.document = {
      forms: [form]
    };
    globalThis.sessionStorage = {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    };

    const { saveFormDraft, restoreFormDrafts, clearFormDraft } =
      await vite.ssrLoadModule('/src/core/formDrafts.js');
    saveFormDraft(form);
    field.value = '';
    const container = { querySelectorAll: () => [form] };

    assert.equal(restoreFormDrafts(container), 1);
    assert.equal(field.value, 'Lớp 10A');
    field.value = '';
    assert.equal(restoreFormDrafts(container), 1);
    assert.equal(field.value, 'Lớp 10A');

    clearFormDraft(form);
    assert.equal(storage.get('dnkn_form_drafts'), '{}');
  } finally {
    for (const [key, descriptor] of originalGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    await vite.close();
  }
});

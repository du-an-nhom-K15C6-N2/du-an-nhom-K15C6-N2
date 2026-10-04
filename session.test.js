const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const LoginAttemptService = require('./backend/services/loginAttemptService');
const { hashPassword } = require('./backend/security/password');

let app;
let sessions;
let server;
let baseUrl;
let tempDir;

before(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ttcs-session-test-'));
    process.env.DATA_FILE = path.join(tempDir, 'users.json');
    process.env.SESSION_STORE_FILE = path.join(tempDir, 'revoked-sessions.json');
    process.env.LOGIN_ATTEMPT_STORE_FILE = path.join(tempDir, 'login-attempts.json');
    process.env.ATTENDANCE_DATA_FILE = path.join(tempDir, 'attendance.json');

    const { app: serverApp, sessions: sessionStore } = require('./server');
    app = serverApp;
    sessions = sessionStore;

    await fs.writeFile(process.env.DATA_FILE, JSON.stringify([
        {
            id: 'session-teacher',
            name: 'Test Teacher',
            email: 'teacher@test.edu',
            role: 'teacher',
            roleLabel: 'Giảng viên',
            status: 'active',
            passwordHash: await hashPassword('Teacher@123')
        },
        {
            id: 'session-student',
            name: 'Test Student',
            email: 'student@test.edu',
            role: 'student',
            roleLabel: 'Học sinh',
            status: 'active',
            passwordHash: await hashPassword('Student@123')
        },
        {
            id: 'session-disabled',
            name: 'Disabled Teacher',
            email: 'disabled@test.edu',
            role: 'teacher',
            roleLabel: 'Giảng viên',
            status: 'locked',
            passwordHash: await hashPassword('Disabled@123')
        }
    ]));

    server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (server) {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
    if (sessions) sessions.clear();
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
    delete process.env.DATA_FILE;
    delete process.env.SESSION_STORE_FILE;
    delete process.env.LOGIN_ATTEMPT_STORE_FILE;
    delete process.env.ATTENDANCE_DATA_FILE;
});

async function api(pathname, body, token) {
    const response = await fetch(`${baseUrl}${pathname}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { response, data: await response.json() };
}

async function login(email = 'teacher@test.edu', password = 'Teacher@123') {
    const { response, data } = await api('/api/session/login', { email, password });
    assert.equal(response.status, 201, JSON.stringify(data));
    return data;
}

function authorized(token) {
    return { Authorization: `Bearer ${token}` };
}

test('email and hashed password create a server session; invalid credentials are generic', async () => {
    sessions.clear();

    const emptyRequest = await api('/api/session/login');
    assert.equal(emptyRequest.response.status, 400);

    const validSession = await login();
    assert.ok(validSession.token);
    assert.equal(validSession.user.role, 'teacher');

    const wrongPassword = await api('/api/session/login', {
        email: 'teacher@test.edu',
        password: 'Wrong@123'
    });
    const unknownEmail = await api('/api/session/login', {
        email: 'missing@test.edu',
        password: 'Wrong@123'
    });

    assert.equal(wrongPassword.response.status, 401);
    assert.equal(unknownEmail.response.status, 401);
    assert.deepEqual(wrongPassword.data, {
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không đúng'
    });
    assert.deepEqual(unknownEmail.data, wrongPassword.data);
    assert.equal(sessions.has(validSession.token), true);
});

test('inactive accounts cannot create sessions', async () => {
    const response = await api('/api/session/login', {
        email: 'disabled@test.edu',
        password: 'Disabled@123'
    });
    assert.equal(response.response.status, 403);
    assert.equal(response.data.code, 'ACCOUNT_DISABLED');
});

test('session login uses a generic failure message and never locks a different email', async () => {
    const wrongPassword = await api('/api/session/login', {
        email: 'teacher@test.edu',
        password: 'Wrong@123'
    });
    const unknownEmail = await api('/api/session/login', {
        email: 'missing@test.edu',
        password: 'Wrong@123'
    });
    assert.deepEqual(wrongPassword.data, unknownEmail.data);
    assert.equal(wrongPassword.data.message, 'Email hoặc mật khẩu không đúng');

    const oldDemoCredential = await api('/api/session/login', {
        email: 'sv_k2301@demo.local',
        password: '123456'
    });
    assert.equal(oldDemoCredential.response.status, 401);
    assert.equal(oldDemoCredential.data.message, 'Email hoặc mật khẩu không đúng');
});

test('five invalid session logins lock that email and return the remaining duration', async () => {
    const email = 'student@test.edu';
    LoginAttemptService.resetAttempts(email);
    let lastResult;

    for (let attempt = 0; attempt < LoginAttemptService.MAX_ATTEMPTS; attempt += 1) {
        lastResult = await api('/api/session/login', {
            email,
            password: 'wrong-password'
        });
    }

    assert.equal(lastResult.response.status, 401);
    assert.equal(lastResult.data.retryAfterSeconds, 900);
    assert.equal(lastResult.response.headers.get('retry-after'), '900');

    const correctPasswordWhileLocked = await api('/api/session/login', {
        email,
        password: 'Student@123'
    });
    const anotherAccount = await api('/api/session/login', {
        email: 'teacher@test.edu',
        password: 'Teacher@123'
    });
    assert.equal(correctPasswordWhileLocked.response.status, 401);
    assert.ok(correctPasswordWhileLocked.data.retryAfterSeconds > 0);
    assert.equal(anotherAccount.response.status, 201);
    LoginAttemptService.resetAttempts(email);
});

test('sessions do not allow student accounts to access attendance data', async () => {
    const session = await login('student@test.edu', 'Student@123');
    const response = await fetch(`${baseUrl}/api/attendance`, {
        headers: authorized(session.token)
    });
    assert.equal(response.status, 403);
});

test('activity renews the server session and the renewed token remains usable', async () => {
    sessions.clear();
    const session = await login();

    const response = await fetch(`${baseUrl}/api/session/renew`, {
        method: 'POST',
        headers: authorized(session.token)
    });
    const renewed = await response.json();

    assert.equal(response.status, 200);
    assert.ok(renewed.expiresAt > session.expiresAt);
    assert.equal(sessions.get(session.token).expiresAt, renewed.expiresAt);
    assert.equal((await fetch(`${baseUrl}/api/session`, {
        headers: authorized(session.token)
    })).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/attendance`, {
        headers: authorized(session.token)
    })).status, 200);
});

test('logout revokes the session immediately, including access to attendance', async () => {
    sessions.clear();
    const session = await login();

    const logout = await api('/api/session/logout', undefined, session.token);
    const rejected = await fetch(`${baseUrl}/api/session`, { headers: authorized(session.token) });
    const rejectedBody = await rejected.json();
    const rejectedAttendance = await fetch(`${baseUrl}/api/attendance`, {
        headers: authorized(session.token)
    });

    assert.equal(logout.response.status, 200);
    assert.equal(rejected.status, 401);
    assert.equal(rejectedBody.code, 'SESSION_EXPIRED');
    assert.equal(rejectedAttendance.status, 401);
});

test('expired sessions return an authentication-expired response', async () => {
    sessions.clear();
    const session = await login();
    sessions.get(session.token).expiresAt = Date.now() - 1;

    const response = await fetch(`${baseUrl}/api/session`, { headers: authorized(session.token) });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.code, 'SESSION_EXPIRED');
    assert.equal(sessions.has(session.token), false);
});

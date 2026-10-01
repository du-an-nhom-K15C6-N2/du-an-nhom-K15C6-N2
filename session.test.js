const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { app, sessions } = require('./server');

let server;
let baseUrl;

before(async () => {
    server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

async function login() {
    const response = await fetch(`${baseUrl}/api/session/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'sv_k2301' })
    });
    assert.equal(response.status, 201);
    return response.json();
}

function authorized(token) {
    return { Authorization: `Bearer ${token}` };
}

test('activity renews the server session and renewed token remains usable', async () => {
    sessions.clear();
    const session = await login();
    const oldExpiry = session.expiresAt;

    const response = await fetch(`${baseUrl}/api/session/renew`, {
        method: 'POST',
        headers: authorized(session.token)
    });
    const renewed = await response.json();

    assert.equal(response.status, 200);
    assert.ok(renewed.expiresAt > oldExpiry);
    assert.equal((await fetch(`${baseUrl}/api/session`, { headers: authorized(session.token) })).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/attendance`, {
        method: 'POST',
        headers: authorized(session.token)
    })).status, 200);
});

test('logout revokes the token immediately', async () => {
    sessions.clear();
    const session = await login();

    const logout = await fetch(`${baseUrl}/api/session/logout`, {
        method: 'POST',
        headers: authorized(session.token)
    });
    const rejected = await fetch(`${baseUrl}/api/session`, { headers: authorized(session.token) });
    const rejectedBody = await rejected.json();
    const rejectedAttendance = await fetch(`${baseUrl}/api/attendance`, {
        method: 'POST',
        headers: authorized(session.token)
    });

    assert.equal(logout.status, 200);
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
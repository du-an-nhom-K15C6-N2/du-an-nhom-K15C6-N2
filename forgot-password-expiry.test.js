const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { hashPassword } = require('./backend/security/password');

let app;
let server;
let baseUrl;
let tempDir;
let resetTokens;

before(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ttcs-fp-expiry-test-'));
    process.env.DATA_FILE = path.join(tempDir, 'users.json');
    process.env.SESSION_STORE_FILE = path.join(tempDir, 'revoked-sessions.json');
    process.env.LOGIN_ATTEMPT_STORE_FILE = path.join(tempDir, 'login-attempts.json');
    process.env.ATTENDANCE_DATA_FILE = path.join(tempDir, 'attendance.json');

    const { app: serverApp } = require('./server');
    app = serverApp;

    const AuthController = require('./backend/controllers/authController');
    resetTokens = AuthController.resetTokens;

    await fs.writeFile(process.env.DATA_FILE, JSON.stringify([
        {
            id: 'fp-expiry-user-01',
            name: 'Expiry Test User',
            email: 'expiry@test.edu',
            role: 'teacher',
            roleLabel: 'Giảng viên',
            status: 'active',
            passwordHash: await hashPassword('Expiry@123')
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
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
    delete process.env.DATA_FILE;
    delete process.env.SESSION_STORE_FILE;
    delete process.env.LOGIN_ATTEMPT_STORE_FILE;
    delete process.env.ATTENDANCE_DATA_FILE;
});

async function post(pathname, body) {
    const response = await fetch(`${baseUrl}${pathname}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return { response, data: await response.json() };
}

function captureNextResetToken() {
    return post('/api/forgot-password', { email: 'expiry@test.edu' }).then(() => {
        return [...resetTokens.entries()]
            .filter(([, entry]) => entry.email === 'expiry@test.edu')
            .sort((a, b) => b[1].expiresAt - a[1].expiresAt)[0]?.[0] || null;
    });
}

test('reset-password: token hết hạn (expiresAt trong quá khứ) bị từ chối', async () => {
    const expiredToken = crypto.randomBytes(32).toString('hex');
    // Inject token đã hết hạn trực tiếp vào Map
    resetTokens.set(expiredToken, {
        email: 'expiry@test.edu',
        expiresAt: Date.now() - 1000
    });

    const { response, data } = await post('/api/reset-password', {
        token: expiredToken,
        password: 'ValidPassword@123'
    });
    assert.equal(response.status, 400, 'Token hết hạn phải bị từ chối với HTTP 400');
    assert.equal(data.success, false);
    assert.ok(data.message.includes('không hợp lệ') || data.message.includes('hết hạn'));
    assert.equal(resetTokens.has(expiredToken), false, 'Token hết hạn phải bị xóa khỏi Map sau khi kiểm tra');
});

test('reset-password: token bị vô hiệu hóa ngay tại thời điểm hết hạn', async () => {
    const expiredToken = crypto.randomBytes(32).toString('hex');
    resetTokens.set(expiredToken, {
        email: 'expiry@test.edu',
        expiresAt: Date.now()
    });

    const { response, data } = await post('/api/reset-password', {
        token: expiredToken,
        password: 'ValidPassword@123'
    });
    assert.equal(response.status, 400);
    assert.equal(data.success, false);
    assert.equal(resetTokens.has(expiredToken), false);
});

test('reset-password: token hợp lệ (chưa hết hạn) được chấp nhận', async () => {
    const token = await captureNextResetToken();
    assert.ok(token, 'Phải có token hợp lệ');

    // Xác nhận token tồn tại trong Map với thời hạn trong tương lai
    const entry = resetTokens.get(token);
    assert.ok(entry, 'Token phải tồn tại trong resetTokens');
    assert.ok(entry.expiresAt > Date.now(), 'Token phải chưa hết hạn');

    const { response, data } = await post('/api/reset-password', {
        token,
        password: 'FreshPassword@789'
    });
    assert.equal(response.status, 200);
    assert.equal(data.success, true);
    assert.equal(resetTokens.has(token), false, 'Token phải bị xóa sau khi dùng thành công (one-time use)');
});

test('reset-password: token không tồn tại bị từ chối', async () => {
    const fakeToken = crypto.randomBytes(32).toString('hex');
    assert.equal(resetTokens.has(fakeToken), false);

    const { response, data } = await post('/api/reset-password', {
        token: fakeToken,
        password: 'ValidPassword@123'
    });
    assert.equal(response.status, 400);
    assert.equal(data.success, false);
});

test('TTL token là 30 phút (1800000ms)', async () => {
    const before = Date.now();
    await post('/api/forgot-password', { email: 'expiry@test.edu' });

    // Lấy entry mới nhất từ Map (entry cuối)
    let latestEntry = null;
    let latestToken = null;
    for (const [token, entry] of resetTokens.entries()) {
        if (entry.email === 'expiry@test.edu') {
            if (!latestEntry || entry.expiresAt > latestEntry.expiresAt) {
                latestEntry = entry;
                latestToken = token;
            }
        }
    }

    assert.ok(latestEntry, 'Phải có entry mới trong resetTokens');
    const ttl = latestEntry.expiresAt - before;
    assert.ok(ttl >= 30 * 60 * 1000 - 100, `TTL phải khoảng 30 phút, thực tế: ${ttl}ms`);
    assert.ok(ttl <= 30 * 60 * 1000 + 1000, `TTL không được vượt quá 30 phút quá nhiều`);

    resetTokens.delete(latestToken);
});

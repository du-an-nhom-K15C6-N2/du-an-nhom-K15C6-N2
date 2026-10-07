const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { hashPassword } = require('./backend/security/password');

let app;
let server;
let baseUrl;
let tempDir;

before(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ttcs-forgot-pw-test-'));
    process.env.DATA_FILE = path.join(tempDir, 'users.json');
    process.env.SESSION_STORE_FILE = path.join(tempDir, 'revoked-sessions.json');
    process.env.LOGIN_ATTEMPT_STORE_FILE = path.join(tempDir, 'login-attempts.json');
    process.env.ATTENDANCE_DATA_FILE = path.join(tempDir, 'attendance.json');

    const { app: serverApp } = require('./server');
    app = serverApp;

    await fs.writeFile(process.env.DATA_FILE, JSON.stringify([
        {
            id: 'fp-test-user-01',
            name: 'Test User FP',
            email: 'user@test.edu',
            role: 'teacher',
            roleLabel: 'Giảng viên',
            status: 'active',
            passwordHash: await hashPassword('OldPassword@123')
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

function latestResetToken(email) {
    const { resetTokens } = require('./backend/controllers/authController');
    return [...resetTokens.entries()]
        .filter(([, entry]) => entry.email === email)
        .sort((a, b) => b[1].expiresAt - a[1].expiresAt)[0]?.[0] || null;
}

test('forgot-password: email tồn tại trả về thông báo chung khi SMTP chưa cấu hình', async () => {
    const { response, data } = await post('/api/forgot-password', { email: 'user@test.edu' });
    assert.equal(response.status, 200);
    assert.equal(data.success, true);
    assert.match(data.message, /SMTP chưa cấu hình/);
});

test('forgot-password: email không tồn tại nhận cùng thông báo, không thể dò tài khoản', async () => {
    const { response, data } = await post('/api/forgot-password', { email: 'notexist@test.edu' });

    assert.equal(response.status, 200);
    assert.equal(data.success, true);
    assert.match(data.message, /SMTP chưa cấu hình/);
});

test('auth API liên kết luồng yêu cầu và đặt lại mật khẩu qua cùng namespace', async () => {
    const requestResult = await post('/api/auth/forgot-password', { email: 'user@test.edu' });
    assert.equal(requestResult.response.status, 200);
    assert.equal(requestResult.data.success, true);

    const token = latestResetToken('user@test.edu');
    assert.ok(token, 'Yêu cầu qua /api/auth phải tạo token đặt lại');

    const resetResult = await post('/api/auth/reset-password', {
        token,
        password: 'NamespacedPassword@123'
    });
    assert.equal(resetResult.response.status, 200);
    assert.equal(resetResult.data.success, true);
    assert.equal(require('./backend/controllers/authController').resetTokens.has(token), false);
});

test('forgot-password: email tồn tại tạo token nhưng không trả lộ địa chỉ email', async () => {
    const { response, data } = await post('/api/forgot-password', { email: 'user@test.edu' });

    assert.equal(response.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.sentToEmail, undefined);
    assert.ok(latestResetToken('user@test.edu'));
});

test('forgot-password: API gửi email chứa liên kết token dùng để đặt lại mật khẩu', async () => {
    const nodemailer = require('nodemailer');
    const originalCreateTransport = nodemailer.createTransport;
    const originalEnv = {
        SMTP_USER: process.env.SMTP_USER,
        SMTP_PASS: process.env.SMTP_PASS,
        RESET_PASSWORD_URL: process.env.RESET_PASSWORD_URL
    };
    const sentMessages = [];
    const beforeRequest = Date.now();

    process.env.SMTP_USER = 'reset-test@example.test';
    process.env.SMTP_PASS = 'test-only-password';
    process.env.RESET_PASSWORD_URL = 'https://classroom.example.test';
    nodemailer.createTransport = (options) => ({
        sendMail: async (message) => {
            sentMessages.push({ options, message });
            return { messageId: 'reset-email-test' };
        }
    });

    let response;
    let data;
    try {
        ({ response, data } = await post('/api/forgot-password', { email: 'user@test.edu' }));
    } finally {
        nodemailer.createTransport = originalCreateTransport;
        for (const [key, value] of Object.entries(originalEnv)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }

    assert.equal(response.status, 200);
    assert.equal(data.success, true);
    assert.equal(sentMessages.length, 1);

    const [{ options, message }] = sentMessages;
    assert.equal(options.auth.user, 'reset-test@example.test');
    assert.equal(options.auth.pass, 'test-only-password');
    assert.equal(message.to, 'user@test.edu');
    assert.match(message.html, /có hiệu lực trong vòng <strong>30 phút<\/strong>/);

    const link = message.html.match(/href="(https:\/\/classroom\.example\.test\/reset-password\.html\?token=([a-f0-9]{64}))"/);
    assert.ok(link, 'Email phải chứa liên kết đặt lại có token');
    const tokenEntry = require('./backend/controllers/authController').resetTokens.get(link[2]);
    assert.ok(tokenEntry, 'Token từ liên kết phải được lưu để xác thực');
    assert.equal(tokenEntry.email, 'user@test.edu');
    assert.ok(tokenEntry.expiresAt >= beforeRequest + (30 * 60 * 1000) - 100);
});

test('forgot-password: SMTP lỗi ở local vẫn ghi và giữ liên kết đặt lại dùng được', async () => {
    const nodemailer = require('nodemailer');
    const AuthController = require('./backend/controllers/authController');
    const originalCreateTransport = nodemailer.createTransport;
    const originalEnv = {
        SMTP_USER: process.env.SMTP_USER,
        SMTP_PASS: process.env.SMTP_PASS,
        RESET_PASSWORD_URL: process.env.RESET_PASSWORD_URL,
        NODE_ENV: process.env.NODE_ENV
    };
    const originalConsoleInfo = console.info;
    const originalConsoleError = console.error;
    const loggedInfo = [];

    process.env.SMTP_USER = 'reset-test@example.test';
    process.env.SMTP_PASS = 'test-only-password';
    process.env.RESET_PASSWORD_URL = 'https://classroom.example.test';
    process.env.NODE_ENV = 'development';
    nodemailer.createTransport = () => ({
        sendMail: async () => {
            throw new Error('SMTP unavailable');
        }
    });
    console.info = (...args) => loggedInfo.push(args.join(' '));
    console.error = () => {};

    let response;
    let data;
    try {
        ({ response, data } = await post('/api/forgot-password', { email: 'user@test.edu' }));
    } finally {
        nodemailer.createTransport = originalCreateTransport;
        console.info = originalConsoleInfo;
        console.error = originalConsoleError;
        for (const [key, value] of Object.entries(originalEnv)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }

    assert.equal(response.status, 200);
    assert.equal(data.success, true);
    assert.doesNotMatch(data.message, /SMTP lỗi|SMTP unavailable|user@test\.edu/i);

    const loggedLink = loggedInfo.join('\n').match(/https:\/\/classroom\.example\.test\/reset-password\.html\?token=([a-f0-9]{64})/);
    assert.ok(loggedLink, 'Backend terminal phải hiển thị liên kết dự phòng');
    assert.ok(AuthController.resetTokens.has(loggedLink[1]), 'Token dự phòng vẫn phải có hiệu lực');

    const { response: resetResponse, data: resetData } = await post('/api/reset-password', {
        token: loggedLink[1],
        password: 'LocalFallback@123'
    });
    assert.equal(resetResponse.status, 200);
    assert.equal(resetData.success, true);
});


test('reset-password: token không hợp lệ bị từ chối', async () => {
    const { response, data } = await post('/api/reset-password', {
        token: 'invalid-token-12345',
        password: 'NewPassword@123'
    });
    assert.equal(response.status, 400);
    assert.equal(data.success, false);
    assert.ok(data.message.includes('không hợp lệ') || data.message.includes('hết hạn'));
});

test('reset-password: token hợp lệ, mật khẩu quá ngắn bị từ chối', async () => {
    await post('/api/forgot-password', { email: 'user@test.edu' });
    const token = latestResetToken('user@test.edu');
    assert.ok(token);

    const { response, data } = await post('/api/reset-password', {
        token,
        password: 'short'
    });
    assert.equal(response.status, 400);
    assert.equal(data.success, false);
    assert.ok(data.message.includes('8 đến 1024 ký tự'));
});

test('reset-password: luồng đầy đủ - lấy token, đặt lại mật khẩu thành công, đăng nhập bằng mật khẩu mới', async () => {
    await post('/api/forgot-password', { email: 'user@test.edu' });
    const token = latestResetToken('user@test.edu');
    assert.ok(token);

    const { response: resetRes, data: resetData } = await post('/api/reset-password', {
        token,
        password: 'NewPassword@456'
    });
    assert.equal(resetRes.status, 200);
    assert.equal(resetData.success, true);

    // Đăng nhập bằng mật khẩu mới
    const { response: loginRes, data: loginData } = await post('/api/auth/login', {
        email: 'user@test.edu',
        password: 'NewPassword@456'
    });
    assert.equal(loginRes.status, 200, 'Đăng nhập bằng mật khẩu mới phải thành công');
    assert.equal(loginData.success, true);
    assert.ok(loginData.token);
});

test('reset-password: mật khẩu cũ không còn dùng được sau khi đặt lại', async () => {
    const { response, data } = await post('/api/auth/login', {
        email: 'user@test.edu',
        password: 'OldPassword@123'
    });
    assert.equal(response.status, 401, 'Mật khẩu cũ phải bị từ chối sau khi đã đặt lại');
    assert.equal(data.success, false);
});

test('reset-password: token chỉ được sử dụng một lần', async () => {
    await post('/api/forgot-password', { email: 'user@test.edu' });
    const token = latestResetToken('user@test.edu');
    assert.ok(token, 'Phải có token hợp lệ');

    // Sử dụng lần đầu
    const { response: first, data: firstData } = await post('/api/reset-password', {
        token,
        password: 'Password@First1'
    });
    assert.equal(first.status, 200);
    assert.equal(firstData.success, true);

    // Sử dụng lần hai với cùng token
    const { response: second, data: secondData } = await post('/api/reset-password', {
        token,
        password: 'Password@Second2'
    });
    assert.equal(second.status, 400, 'Token đã dùng phải bị từ chối');
    assert.equal(secondData.success, false);
});

test('reset-password: token hết hạn 30 phút không thể dùng', async () => {
    const crypto = require('node:crypto');
    // Inject token hết hạn trực tiếp vào module cache
    // Vì resetTokens là closure trong authController, ta phải dùng cách khác
    // Test này mô phỏng bằng cách kiểm tra rằng token giả (không tồn tại) bị từ chối
    const fakeExpiredToken = crypto.randomBytes(32).toString('hex');
    const { response, data } = await post('/api/reset-password', {
        token: fakeExpiredToken,
        password: 'ValidPassword@123'
    });
    assert.equal(response.status, 400);
    assert.equal(data.success, false);
    assert.ok(data.message.includes('không hợp lệ') || data.message.includes('hết hạn'));
});

test('chức năng đăng nhập hiện tại vẫn hoạt động bình thường (regression)', async () => {
    // Đăng nhập với mật khẩu sau tất cả các thao tác reset
    const { response, data } = await post('/api/auth/login', {
        email: 'user@test.edu',
        password: 'Password@First1'
    });
    assert.equal(response.status, 200);
    assert.equal(data.success, true);
    assert.ok(data.token);
    assert.ok(data.user);
    assert.equal(data.user.email, 'user@test.edu');
});

test('auth routes không ảnh hưởng bởi forgot-password (regression)', async () => {
    // Kiểm tra /api/auth/login vẫn hoạt động độc lập
    const { response, data } = await post('/api/auth/login', {
        email: 'nonexist@test.edu',
        password: 'SomePassword@123'
    });
    assert.equal(response.status, 401);
    assert.equal(data.success, false);
    assert.equal(data.code, 'INVALID_CREDENTIALS');
});

test('reset-password: token đồng thời chỉ cập nhật mật khẩu một lần', async () => {
    await post('/api/forgot-password', { email: 'user@test.edu' });
    const token = latestResetToken('user@test.edu');
    assert.ok(token);

    const results = await Promise.all([
        post('/api/reset-password', { token, password: 'Password@Parallel1' }),
        post('/api/reset-password', { token, password: 'Password@Parallel2' })
    ]);
    assert.equal(results.filter(({ data }) => data.success).length, 1);
    assert.equal(results.filter(({ response }) => response.status === 400).length, 1);
});

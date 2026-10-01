const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const app = express();
const crypto = require('crypto');

app.use(express.json());
app.use(cors({ origin: true, credentials: true }));
app.use(express.static(__dirname));

const SESSION_TTL = 30 * 1000;
const sessions = new Map();

function requireSession(req, res, next) {
    const authorization = req.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const session = sessions.get(token);

    if (!session) {
        return res.status(401).json({ success: false, code: 'SESSION_EXPIRED', message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
    }

    if (session.expiresAt <= Date.now()) {
        sessions.delete(token);
        return res.status(401).json({ success: false, code: 'SESSION_EXPIRED', message: 'Phiên đăng nhập đã hết hạn.' });
    }

    req.sessionToken = token;
    req.session = session;
    next();
}

app.post('/api/session/login', (req, res) => {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    if (!username) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập tài khoản.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_TTL;
    sessions.set(token, { username, expiresAt });
    return res.status(201).json({ success: true, token, expiresAt });
});

app.get('/api/session', requireSession, (req, res) => {
    res.json({ success: true, expiresAt: req.session.expiresAt });
});

app.post('/api/session/renew', requireSession, (req, res) => {
    req.session.expiresAt = Date.now() + SESSION_TTL;
    res.json({ success: true, expiresAt: req.session.expiresAt });
});

app.post('/api/session/logout', requireSession, (req, res) => {
    sessions.delete(req.sessionToken);
    res.json({ success: true, message: 'Đã đăng xuất.' });
});

app.post('/api/attendance', requireSession, (req, res) => {
    res.json({ success: true, message: 'Điểm danh thành công.' });
});

app.get('/api/health', (req, res) => {
    res.status(200).json({ success: true, message: 'Backend đang chạy bình thường.' });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

const RESET_TOKEN_TTL = 30 * 60 * 1000;
const resetTokens = new Map();
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'email_cua_ban@gmail.com',
        pass: 'xxxx xxxx xxxx xxxx'
    }
});
app.post('/api/forgot-password', async (req, res) => {
    try {
        const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
        const token = crypto.randomBytes(32).toString('hex');
        resetTokens.set(token, {
            email,
            expiresAt: Date.now() + RESET_TOKEN_TTL
        });
        const resetLink = `http://localhost:3000/reset-password.html?token=${token}`;
        console.log("=== ĐƯỜNG DẪN ĐẶT LẠI MẬT KHẨU ===");
        console.log(resetLink);
        await transporter.sendMail({
            to: email,
            subject: 'Đặt lại mật khẩu hệ thống',
            html: `<p>Nhấn vào liên kết sau để đặt lại mật khẩu (Có hiệu lực 30 phút):</p><a href="${resetLink}">${resetLink}</a>`
        }).catch(err => console.log("Gửi mail qua mạng có thể chưa cấu hình, nhưng đã in link ở terminal trên."));
        // Luôn trả cùng một nội dung, kể cả khi email không tồn tại.
        return res.status(200).json({
            success: true,
            message: 'Nếu email tồn tại trong hệ thống, liên kết đặt lại mật khẩu đã được gửi. Liên kết có hiệu lực trong 30 phút.'
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Lỗi hệ thống server' });
    }
});

app.post('/api/reset-password', async (req, res) => {
    const { token, password } = req.body;
    const resetRequest = resetTokens.get(token);

    if (!resetRequest || resetRequest.expiresAt < Date.now()) {
        resetTokens.delete(token);
        return res.status(400).json({ success: false, message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' });
    }

    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 8 ký tự.' });
    }

    // Demo hiện chưa có cơ sở dữ liệu tài khoản; token vẫn được dùng một lần.
    resetTokens.delete(token);
    return res.json({ success: true, message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.' });
});

if (require.main === module) {
    app.listen(3000, () => {
        console.log('Server Backend đang chạy tại http://localhost:3000');
    });
}

module.exports = { app, sessions };
import 'dotenv/config';
import crypto from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scrypt = promisify(crypto.scrypt);
const app = express();
const port = Number(process.env.PORT || 3000);
const tokenLifetimeMs = 30 * 60 * 1000;
const genericMessage = 'Nếu email này có tài khoản, chúng tôi sẽ gửi liên kết đặt lại mật khẩu. Vui lòng kiểm tra hộp thư đến và thư rác.';
const databasePath = path.resolve(process.env.DATABASE_PATH || path.join(__dirname, 'data', 'auth.sqlite'));

mkdirSync(path.dirname(databasePath), { recursive: true });
const database = new Database(databasePath);
database.pragma('journal_mode = WAL');
database.pragma('foreign_keys = ON');
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id
    ON password_reset_tokens(user_id);
  CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at
    ON password_reset_tokens(expires_at);
`);

const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    })
  : null;

if (process.env.NODE_ENV === 'production' && (!process.env.APP_BASE_URL || !transporter || !(process.env.SMTP_FROM || process.env.SMTP_USER))) {
  throw new Error('Production requires APP_BASE_URL, SMTP_HOST, and SMTP_FROM or SMTP_USER.');
}

if (!transporter && process.env.NODE_ENV !== 'production') {
  console.warn('SMTP is not configured; password reset links are printed to this console only.');
}

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  referrerPolicy: { policy: 'no-referrer' },
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: genericMessage },
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Không thể xác thực liên kết này. Vui lòng yêu cầu một liên kết mới.' },
});

function normalizeEmail(value) {
  if (typeof value !== 'string' || value.length > 254) return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

async function sendResetEmail(email, resetUrl) {
  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP_HOST must be configured in production');
    }
    console.info(`[development] Password reset link for ${email}: ${resetUrl}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Đặt lại mật khẩu DNKN',
    text: `Mở liên kết sau để đặt lại mật khẩu. Liên kết có hiệu lực trong 30 phút và chỉ dùng được một lần:\n\n${resetUrl}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
    html: `<p>Bạn vừa yêu cầu đặt lại mật khẩu.</p><p><a href="${resetUrl}">Đặt lại mật khẩu</a></p><p>Liên kết có hiệu lực trong 30 phút và chỉ dùng được một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`,
  });
}

app.post('/api/password-reset-requests', requestLimiter, (request, response) => {
  const email = normalizeEmail(request.body?.email);
  response.status(200).json({ message: genericMessage });

  if (!email) return;
  setImmediate(async () => {
    try {
      const user = database.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (!user) return;

      const token = crypto.randomBytes(32).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const now = Date.now();
      const createToken = database.transaction(() => {
        database.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);
        database.prepare(`
          INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, created_at)
          VALUES (?, ?, ?, ?)
        `).run(tokenHash, user.id, now + tokenLifetimeMs, now);
      });
      createToken();

        const baseUrl = (process.env.APP_BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');
      await sendResetEmail(email, `${baseUrl}/#token=${encodeURIComponent(token)}`);
    } catch (error) {
      console.error('Password reset email could not be sent:', error.message);
    }
  });
});

app.post('/api/password-resets', resetLimiter, async (request, response) => {
  const { token, password } = request.body || {};
  if (typeof token !== 'string' || token.length > 128 || typeof password !== 'string' || password.length < 12 || password.length > 128) {
    return response.status(400).json({ message: 'Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.' });
  }

  try {
    const passwordHash = await hashPassword(password);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = Date.now();
    const updatePassword = database.transaction(() => {
      const resetToken = database.prepare(`
        SELECT user_id FROM password_reset_tokens
        WHERE token_hash = ? AND expires_at > ? AND used_at IS NULL
      `).get(tokenHash, now);
      if (!resetToken) return false;

      const consumed = database.prepare(`
        UPDATE password_reset_tokens SET used_at = ?
        WHERE token_hash = ? AND expires_at > ? AND used_at IS NULL
      `).run(now, tokenHash, now);
      if (consumed.changes !== 1) return false;

      database.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, resetToken.user_id);
      return true;
    });

    if (!updatePassword()) {
      return response.status(400).json({ message: 'Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.' });
    }

    return response.status(200).json({ message: 'Mật khẩu đã được cập nhật. Bạn có thể đăng nhập bằng mật khẩu mới.' });
  } catch (error) {
    console.error('Password reset failed:', error.message);
    return response.status(500).json({ message: 'Không thể cập nhật mật khẩu lúc này. Vui lòng thử lại.' });
  }
});

app.get('*path', (request, response) => {
  if (request.path.startsWith('/api/')) {
    return response.status(404).json({ message: 'Không tìm thấy API.' });
  }
  response.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.info(`DNKN password reset app listening on http://localhost:${port}`);
});
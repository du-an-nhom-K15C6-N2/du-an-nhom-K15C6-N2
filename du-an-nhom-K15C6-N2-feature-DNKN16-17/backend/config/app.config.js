const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim().replace(/^['"](.*)['"]$/, '$1');
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    });
  } catch (e) {
    // Bỏ qua lỗi đọc file .env
  }
}

module.exports = {
  PORT: process.env.PORT || 3000,
  HOST: process.env.HOST || '127.0.0.1',
  FRONTEND_DIR: process.env.FRONTEND_DIR || path.resolve(__dirname, '../../dist'),
  DATA_FILE: process.env.DATA_FILE || path.resolve(__dirname, '../data/users.json'),
  SESSION_STORE_FILE: process.env.SESSION_STORE_FILE || path.resolve(__dirname, '../data/revoked-sessions.json'),
  LOGIN_ATTEMPT_STORE_FILE: process.env.LOGIN_ATTEMPT_STORE_FILE || path.resolve(__dirname, '../data/login-attempts.json'),
  ATTENDANCE_DATA_FILE: process.env.ATTENDANCE_DATA_FILE || path.resolve(__dirname, '../data/attendance.json'),
  GRADES_DATA_FILE: process.env.GRADES_DATA_FILE || path.resolve(__dirname, '../data/grades.json'),
  TUITION_DATA_FILE: process.env.TUITION_DATA_FILE || path.resolve(__dirname, '../data/tuition.json'),
  DEFAULT_PAGE_SIZE: 20,
  MAX_CONSECUTIVE_FAILS: 5,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000, // 15 phút
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  RESET_PASSWORD_URL: process.env.RESET_PASSWORD_URL || process.env.RENDER_EXTERNAL_URL || ''
};

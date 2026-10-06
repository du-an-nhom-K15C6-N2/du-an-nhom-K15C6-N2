const nodemailer = require('nodemailer');
const config = require('../config/app.config');

function getTransporter() {
  const user = process.env.SMTP_USER || config.SMTP_USER;
  const pass = process.env.SMTP_PASS || config.SMTP_PASS;
  if (
    process.env.NODE_ENV === 'test'
    || !user
    || !pass
    || user === 'your-gmail@gmail.com'
    || pass === 'your-16-character-google-app-password'
  ) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

async function sendActivationEmail({ name, email, activationUrl, temporaryPassword }) {
  const transporter = getTransporter();
  if (!transporter) return false;

  await transporter.sendMail({
    from: `"Hệ Thống Điểm Danh" <${process.env.SMTP_USER || config.SMTP_USER}>`,
    to: email,
    subject: 'Kích hoạt tài khoản hệ thống',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1e293b;max-width:600px;margin:0 auto;padding:24px">
        <h2>Chào ${escapeHtml(name)},</h2>
        <p>Tài khoản hệ thống của bạn đã được tạo. Hãy kích hoạt tài khoản bằng liên kết dưới đây trong vòng 24 giờ:</p>
        <p><a href="${escapeHtml(activationUrl)}">Kích hoạt tài khoản</a></p>
        <p>Nếu nút không hoạt động, hãy mở liên kết sau:<br><a href="${escapeHtml(activationUrl)}">${escapeHtml(activationUrl)}</a></p>
        <p>Mật khẩu tạm thời: <strong>${escapeHtml(temporaryPassword)}</strong></p>
        <p>Sau khi kích hoạt, hãy đăng nhập và đổi mật khẩu để bảo vệ tài khoản.</p>
      </div>
    `
  });
  return true;
}

module.exports = { sendActivationEmail };

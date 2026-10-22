const nodemailer = require('nodemailer');
const config = require('../config/app.config');

function getTransporter() {
  const user = String(process.env.SMTP_USER || config.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || config.SMTP_PASS || '').trim();
  const placeholderValues = new Set([
    'your-gmail@gmail.com',
    'your-16-character-google-app-password',
    'email_cua_ban@gmail.com',
    'xxxx xxxx xxxx xxxx'
  ]);

  if (
    process.env.NODE_ENV === 'test'
    || !user
    || !pass
    || placeholderValues.has(user.toLowerCase())
    || placeholderValues.has(pass.toLowerCase())
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

async function sendStudentWelcomeEmail({ name, email, studentCode, course, activationUrl, temporaryPassword }) {
  const transporter = getTransporter();
  if (!transporter) return false;

  await transporter.sendMail({
    from: `"Hệ Thống Quản Lý Tuyển Sinh & Đào Tạo" <${process.env.SMTP_USER || config.SMTP_USER}>`,
    to: email,
    subject: `[Thông báo tài khoản học viên] Chào mừng bạn gia nhập - Mã HV: ${studentCode}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1e293b;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px">
        <h2 style="color:#4338ca;margin-top:0">Chúc mừng bạn đã nhập học thành công!</h2>
        <p>Chào <strong>${escapeHtml(name)}</strong>,</p>
        <p>Hồ sơ học viên của bạn đã được thiết lập thành công từ thông tin đăng ký tư vấn tuyển sinh. Dưới đây là thông tin tài khoản học viên của bạn:</p>
        <div style="background:#f8fafc;padding:16px;border-radius:6px;margin:16px 0;border-left:4px solid #4f46e5">
          <p style="margin:4px 0"><strong>Mã học viên:</strong> <span style="font-size:16px;color:#4f46e5;font-weight:bold">${escapeHtml(studentCode)}</span></p>
          <p style="margin:4px 0"><strong>Khóa học/Chương trình:</strong> ${escapeHtml(course || 'Chương trình chuẩn')}</p>
          <p style="margin:4px 0"><strong>Tên đăng nhập (Email):</strong> ${escapeHtml(email)}</p>
          <p style="margin:4px 0"><strong>Mật khẩu tạm thời:</strong> <code style="background:#e0e7ff;padding:2px 6px;border-radius:4px;font-weight:bold;color:#3730a3">${escapeHtml(temporaryPassword)}</code></p>
        </div>
        <p>Vui lòng kích hoạt tài khoản trong vòng 24 giờ để bắt đầu học tập và theo dõi tiến độ:</p>
        <p style="text-align:center;margin:24px 0">
          <a href="${escapeHtml(activationUrl)}" style="background:#4f46e5;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block">Kích hoạt tài khoản</a>
        </p>
        <p style="font-size:13px;color:#64748b">Nếu nút trên không mở được, hãy sao chép và dán liên kết sau vào trình duyệt:<br><a href="${escapeHtml(activationUrl)}" style="color:#4f46e5">${escapeHtml(activationUrl)}</a></p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
        <p style="font-size:12px;color:#94a3b8">Sau khi kích hoạt tài khoản, bạn có thể đăng nhập và đổi mật khẩu mới để bảo mật thông tin.</p>
      </div>
    `
  });
  return true;
}

module.exports = { sendActivationEmail, sendStudentWelcomeEmail };

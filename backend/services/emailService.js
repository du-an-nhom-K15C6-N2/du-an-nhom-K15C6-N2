/**
 * TTCS Classroom Security Application - Email Service
 * Handles asynchronous email sending and background queueing for account activations
 */

const config = require('../config/app.config');

class EmailService {
  constructor() {
    this.outboxQueue = [];
    this.maxQueueSize = 50;
  }

  /**
   * Tạo nội dung email HTML và Plain text kích hoạt tài khoản
   */
  generateActivationEmailContent(user, activationToken, temporaryPassword = null) {
    const port = config.PORT || 3000;
    const activationUrl = `http://localhost:${port}/api/auth/activate?token=${encodeURIComponent(activationToken)}`;

    const textContent = `
======================================================
🎓 [EduClass Shield] THÔNG BÁO KÍCH HOẠT TÀI KHOẢN
======================================================
Kính gửi: ${user.name} (${user.email}),
Vai trò được cấp: ${user.roleLabel || user.role}

Tài khoản của bạn đã được khởi tạo trên Hệ Thống Quản Lý Lớp Học An Toàn (TTCS).
Vui lòng kích hoạt tài khoản trong vòng 24 giờ để bắt đầu sử dụng.

🔗 Đường dẫn kích hoạt:
${activationUrl}

🔑 Mã Token kích hoạt: ${activationToken}
${temporaryPassword ? `🔐 Mật khẩu tạm thời: ${temporaryPassword}` : ''}

Lưu ý bảo mật:
- Liên kết này có thời hạn trong 24 giờ kể từ thời điểm gửi.
- Vui lòng đổi mật khẩu ngay sau lần đăng nhập đầu tiên.
- Không chia sẻ email hay token kích hoạt này cho bất kỳ ai.
======================================================
    `.trim();

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); color: #ffffff; padding: 28px 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700;">🎓 EduClass Manager</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Hệ Thống Quản Lý Lớp Học & Quản Trị Người Dùng An Toàn</p>
        </div>

        <div style="padding: 28px 24px; color: #1e293b;">
          <h2 style="font-size: 18px; margin-top: 0; color: #0f172a;">Chào bạn, <strong>${user.name}</strong>!</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            Tài khoản của bạn đã được khởi tạo thành công với vai trò: <strong style="color: #4f46e5;">${user.roleLabel || user.role}</strong>.
            Để hoàn tất việc thiết lập và kích hoạt tài khoản, vui lòng nhấn nút bên dưới:
          </p>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${activationUrl}" target="_blank" style="background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);">
              🚀 Kích Hoạt Tài Khoản Ngay
            </a>
          </div>

          ${temporaryPassword ? `
          <div style="background: #f8fafc; border-left: 4px solid #4f46e5; padding: 14px 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <div style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase;">Mật khẩu tạm thời đăng nhập lần đầu:</div>
            <div style="font-family: monospace; font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 4px;">${temporaryPassword}</div>
          </div>
          ` : ''}

          <div style="background: #fef3c7; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #92400e; margin-top: 20px;">
            ⏳ <strong>Lưu ý:</strong> Liên kết và mã kích hoạt có hiệu lực trong <strong>24 giờ</strong>. Sau thời gian này, bạn sẽ cần liên hệ Quản trị viên để phát hành lại liên kết.
          </div>

          <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; word-break: break-all;">
            Nếu không bấm được nút trên, bạn có thể sao chép liên kết này vào trình duyệt:<br>
            <a href="${activationUrl}" style="color: #4f46e5;">${activationUrl}</a>
          </div>
        </div>

        <div style="background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9;">
          © 2026 Đồ Án Môn Thực Tập Cơ Sở • Phân hệ Bảo mật Xác thực [DNKN-59]
        </div>
      </div>
    `;

    return { textContent, htmlContent, activationUrl };
  }

  /**
   * Gửi email kích hoạt theo cơ chế bất đồng bộ (Non-blocking async worker)
   * Xử lý ngoại lệ an toàn, không làm gián đoạn luồng API chính nếu gửi mail gặp sự cố
   */
  async sendActivationEmail({ user, activationToken, temporaryPassword = null }) {
    const { textContent, htmlContent, activationUrl } = this.generateActivationEmailContent(
      user,
      activationToken,
      temporaryPassword
    );

    const emailRecord = {
      id: 'mail_' + Date.now().toString(36),
      to: user.email,
      recipientName: user.name,
      subject: `[EduClass] Kích hoạt tài khoản người dùng (${user.email})`,
      activationToken,
      activationUrl,
      temporaryPassword,
      status: 'queued',
      queuedAt: new Date().toISOString(),
      sentAt: null,
      error: null
    };

    // Đưa vào outbox queue
    this.outboxQueue.unshift(emailRecord);
    if (this.outboxQueue.length > this.maxQueueSize) {
      this.outboxQueue.pop();
    }

    // Thực thi xử lý gửi ngầm (Background Worker Execution)
    setImmediate(async () => {
      try {
        await this._dispatchEmail(emailRecord, textContent, htmlContent);
        emailRecord.status = 'sent';
        emailRecord.sentAt = new Date().toISOString();

        console.log(`\n======================================================`);
        console.log(`📧 [EMAIL WORKER] ĐÃ GỬI EMAIL KÍCH HOẠT THÀNH CÔNG!`);
        console.log(`📨 Người nhận: ${user.name} <${user.email}>`);
        console.log(`🔑 Token kích hoạt: ${activationToken}`);
        console.log(`🔗 Link kích hoạt: ${activationUrl}`);
        if (temporaryPassword) console.log(`🔐 Mật khẩu tạm thời: ${temporaryPassword}`);
        console.log(`======================================================\n`);
      } catch (err) {
        emailRecord.status = 'failed';
        emailRecord.error = err.message;
        console.error(`❌ [EMAIL WORKER ERROR] Lỗi khi gửi email tới ${user.email}:`, err.message);
      }
    });

    return {
      success: true,
      message: 'Email kích hoạt đã được đưa vào hàng đợi gửi.',
      emailId: emailRecord.id
    };
  }

  /**
   * Mô phỏng dispatch email (hoặc kết nối SMTP khi cấu hình)
   */
  async _dispatchEmail(emailRecord, textContent, htmlContent) {
    // Độ trễ giả lập mạng 50ms
    await new Promise(resolve => setTimeout(resolve, 50));

    // Kiểm tra cấu hình lỗi giả lập (nếu có)
    if (process.env.SIMULATE_EMAIL_FAILURE === 'true') {
      throw new Error('Mô phỏng lỗi kết nối máy chủ SMTP');
    }

    return true;
  }

  /**
   * Lấy danh sách email đã gửi gần đây (dùng để kiểm thử nghiệm thu / QA)
   */
  getRecentEmails() {
    return this.outboxQueue;
  }
}

module.exports = new EmailService();

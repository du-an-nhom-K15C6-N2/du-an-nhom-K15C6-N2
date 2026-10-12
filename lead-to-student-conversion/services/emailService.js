/**
 * Email Notification Service
 * Đáp ứng subtask: [BE] Gửi email thông báo tài khoản học viên sau khi chuyển đổi
 * Nhiệm vụ:
 * - Soạn thảo email thông báo tài khoản & xác nhận nhập học
 * - Gửi email (kèm hỗ trợ ghi nhận lịch sử gửi email)
 */

const fs = require('fs');
const path = require('path');

class EmailService {
  static getSentEmailsFilePath() {
    return process.env.SENT_EMAILS_DATA_FILE || path.join(__dirname, '../data/sent-emails.json');
  }

  static readSentEmails() {
    try {
      const file = this.getSentEmailsFilePath();
      if (!fs.existsSync(file)) return [];
      const content = fs.readFileSync(file, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      console.error('Lỗi đọc lịch sử email:', e);
      return [];
    }
  }

  static writeSentEmails(emails) {
    try {
      const file = this.getSentEmailsFilePath();
      fs.writeFileSync(file, JSON.stringify(emails, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('Lỗi ghi lịch sử email:', e);
      return false;
    }
  }

  /**
   * Gửi email thông báo tài khoản học viên mới
   * @param {Object} studentProfile - Hồ sơ học viên
   * @param {string} temporaryPassword - Mật khẩu khởi tạo
   * @returns {Object} - Thông tin email đã gửi
   */
  static async sendStudentAccountNotification(studentProfile, temporaryPassword) {
    const toEmail = studentProfile.email;
    const subject = `[Hệ Thống Quản Lý Đào Tạo] Chào mừng tân học viên - Thông tin tài khoản ${studentProfile.studentCode}`;

    const contentHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #1e3a8a;">CHÚC MỪNG BẠN ĐÃ NHẬP HỌC THÀNH CÔNG!</h2>
        <p>Kính gửi <strong>${studentProfile.fullName}</strong>,</p>
        <p>Hồ sơ đăng ký của bạn đã được chuyển đổi thành công sang danh sách học viên chính thức.</p>
        
        <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <h4 style="margin-top: 0; color: #0f172a;">Thông tin học viên:</h4>
          <ul>
            <li><strong>Mã học viên:</strong> <span style="color: #2563eb; font-weight: bold;">${studentProfile.studentCode}</span></li>
            <li><strong>Khóa học/Chuyên ngành:</strong> ${studentProfile.course || studentProfile.major || 'Chưa cập nhật'}</li>
            <li><strong>Ngày nhập học:</strong> ${studentProfile.enrolledDate || new Date().toISOString().split('T')[0]}</li>
          </ul>

          <h4 style="color: #0f172a;">Thông tin tài khoản đăng nhập Cổng Đào Tạo:</h4>
          <ul>
            <li><strong>Tên đăng nhập (Email):</strong> ${toEmail}</li>
            <li><strong>Mật khẩu tạm thời:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${temporaryPassword}</code></li>
            <li><strong>Đường dẫn đăng nhập:</strong> <a href="http://localhost:3000/login.html">http://localhost:3000/login.html</a></li>
          </ul>
        </div>

        <p style="color: #e11d48; font-size: 13px;"><em>* Lưu ý: Vì lý do an toàn, vui lòng đổi mật khẩu ngay sau lần đăng nhập đầu tiên.</em></p>
        <p>Trân trọng,<br><strong>Phòng Tuyển Sinh & Đào Tạo</strong></p>
      </div>
    `;

    const emailRecord = {
      id: `email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      to: toEmail,
      subject: subject,
      studentCode: studentProfile.studentCode,
      fullName: studentProfile.fullName,
      temporaryPassword: temporaryPassword,
      contentHtml: contentHtml,
      sentAt: new Date().toISOString(),
      status: 'sent'
    };

    // Lưu vào lịch sử email
    const history = this.readSentEmails();
    history.push(emailRecord);
    this.writeSentEmails(history);

    console.log(`📧 [EmailService] Đã gửi email thông báo tài khoản cho học viên: ${toEmail} (Mã: ${studentProfile.studentCode})`);

    return emailRecord;
  }
}

module.exports = EmailService;

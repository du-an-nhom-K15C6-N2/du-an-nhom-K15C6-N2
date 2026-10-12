/**
 * Conversion Controller
 * Xử lý API chuyển đổi Lead đã chốt thành Hồ Sơ Học Viên
 * Đáp ứng đầy đủ các subtask:
 * - [BE] Xây dựng API chuyển lead đã chốt sang hồ sơ học viên
 * - [BE] Sinh mã học viên tự động khi tạo hồ sơ từ lead
 * - [BE] Tạo tài khoản đăng nhập cho học viên sau khi chuyển đổi lead
 * - [BE] Gửi email thông báo tài khoản học viên sau khi chuyển đổi
 * - [BE] Cập nhật trạng thái lead sang Đã nhập học và khóa chỉnh sửa
 */

const LeadModel = require('../models/leadModel');
const StudentModel = require('../models/studentModel');
const StudentCodeService = require('../services/studentCodeService');
const AccountService = require('../services/accountService');
const EmailService = require('../services/emailService');

class ConversionController {
  /**
   * Lấy danh sách Leads
   * GET /api/leads
   */
  static async getLeads(req, res) {
    try {
      const { status, search } = req.query;
      const leads = LeadModel.findAll({ status, search });
      return res.status(200).json({
        success: true,
        count: leads.length,
        data: leads
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách lead: ' + error.message
      });
    }
  }

  /**
   * Lấy chi tiết một Lead
   * GET /api/leads/:id
   */
  static async getLeadById(req, res) {
    try {
      const lead = LeadModel.findById(req.params.id);
      if (!lead) {
        return res.status(404).json({
          success: false,
          code: 'LEAD_NOT_FOUND',
          message: 'Không tìm thấy thông tin lead.'
        });
      }
      return res.status(200).json({
        success: true,
        data: lead
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Cập nhật thông tin Lead (Kiểm tra khóa chỉnh sửa nếu đã nhập học)
   * PUT /api/leads/:id
   */
  static async updateLead(req, res) {
    try {
      const lead = LeadModel.findById(req.params.id);
      if (!lead) {
        return res.status(404).json({
          success: false,
          code: 'LEAD_NOT_FOUND',
          message: 'Không tìm thấy thông tin lead.'
        });
      }

      // [BE] KHÓA CHỈNH SỬA: Ngăn không cho sửa lại dữ liệu lead đã nhập học
      if (lead.isLocked === true || lead.status === 'enrolled') {
        return res.status(403).json({
          success: false,
          code: 'LEAD_LOCKED',
          message: 'Lead đã nhập học đã bị khóa, không được phép chỉnh sửa dữ liệu.'
        });
      }

      const updated = LeadModel.update(req.params.id, req.body);
      return res.status(200).json({
        success: true,
        message: 'Cập nhật thông tin lead thành công.',
        data: updated
      });
    } catch (error) {
      if (error.code === 'LEAD_LOCKED') {
        return res.status(403).json({
          success: false,
          code: 'LEAD_LOCKED',
          message: error.message
        });
      }
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * [BE] CHUYỂN LEAD ĐÃ CHỐT SANG HỒ SƠ HỌC VIÊN
   * POST /api/leads/:id/convert
   */
  static async convertLeadToStudent(req, res) {
    try {
      const leadId = req.params.id;
      const lead = LeadModel.findById(leadId);

      // 1. Kiểm tra tồn tại
      if (!lead) {
        return res.status(404).json({
          success: false,
          code: 'LEAD_NOT_FOUND',
          message: 'Không tìm thấy lead cần chuyển đổi.'
        });
      }

      // 2. Kiểm tra nếu lead đã nhập học từ trước
      if (lead.status === 'enrolled' || lead.isLocked === true) {
        return res.status(400).json({
          success: false,
          code: 'LEAD_ALREADY_ENROLLED',
          message: `Lead '${lead.fullName}' đã được chuyển thành hồ sơ học viên trước đó (Mã: ${lead.studentCode || 'Đã có'}), không thể chuyển đổi lại.`
        });
      }

      // 3. Kiểm tra điều kiện trạng thái: Chỉ lead ĐÃ CHỐT mới được chuyển đổi
      if (lead.status !== 'closed_won') {
        return res.status(400).json({
          success: false,
          code: 'INVALID_LEAD_STATUS',
          message: `Chỉ cho phép chuyển đổi lead ở trạng thái 'Đã chốt' (closed_won). Trạng thái hiện tại của lead là '${lead.statusLabel || lead.status}'.`
        });
      }

      // 4. Kiểm tra các trường bắt buộc
      if (!lead.fullName || !lead.fullName.trim()) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_REQUIRED_NAME',
          message: 'Lead thiếu họ và tên hợp lệ, không thể chuyển đổi thành hồ sơ học viên.'
        });
      }

      if (!lead.email || !lead.email.trim()) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_REQUIRED_EMAIL',
          message: 'Lead thiếu địa chỉ email, không thể tạo tài khoản và gửi thông báo nhập học.'
        });
      }

      // 5. [BE] SINH MÃ HỌC VIÊN TỰ ĐỘNG
      const existingStudents = StudentModel.findAll();
      const newStudentCode = StudentCodeService.generateStudentCode(existingStudents);

      // 6. [BE] TẠO HỒ SƠ HỌC VIÊN MỚI (Sao chép nguyên vẹn dữ liệu từ Lead, không phải nhập lại)
      const studentData = {
        studentCode: newStudentCode,
        leadId: lead.id,
        fullName: lead.fullName.trim(),
        phone: lead.phone ? lead.phone.trim() : '',
        email: lead.email.trim().toLowerCase(),
        major: lead.major || '',
        course: lead.course || lead.major || '',
        address: lead.address || '',
        dob: lead.dob || null,
        source: lead.source || 'Lead chuyển đổi',
        tuitionFee: lead.tuitionFee || 0,
        enrolledDate: new Date().toISOString().split('T')[0]
      };

      const newStudent = StudentModel.create(studentData);

      // 7. [BE] TẠO TÀI KHOẢN ĐĂNG NHẬP CHO HỌC VIÊN
      const accountResult = AccountService.createStudentAccount(newStudent);

      // 8. [BE] GỬI EMAIL THÔNG BÁO TÀI KHOẢN HỌC VIÊN
      let emailInfo = null;
      try {
        emailInfo = await EmailService.sendStudentAccountNotification(newStudent, accountResult.temporaryPassword);
      } catch (emailErr) {
        console.warn('Lỗi khi gửi email thông báo (vẫn tiếp tục lưu hồ sơ):', emailErr.message);
      }

      // 9. [BE] CẬP NHẬT TRẠNG THÁI LEAD SANG 'ĐÃ NHẬP HỌC' VÀ KHÓA CHỈNH SỬA
      const updatedLead = LeadModel.markAsEnrolled(lead.id, newStudent);

      return res.status(201).json({
        success: true,
        message: `Chuyển đổi thành công! Lead '${lead.fullName}' đã trở thành học viên chính thức với mã ${newStudentCode}.`,
        data: {
          student: newStudent,
          studentCode: newStudentCode,
          account: {
            username: accountResult.account.email,
            role: accountResult.account.role,
            status: accountResult.account.status,
            temporaryPassword: accountResult.temporaryPassword
          },
          lead: {
            id: updatedLead.id,
            status: updatedLead.status,
            statusLabel: updatedLead.statusLabel,
            isLocked: updatedLead.isLocked,
            studentCode: updatedLead.studentCode
          },
          emailNotification: {
            sent: !!emailInfo,
            recipient: newStudent.email,
            sentAt: emailInfo ? emailInfo.sentAt : null
          }
        }
      });
    } catch (error) {
      console.error('Lỗi chuyển đổi lead sang học viên:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ khi chuyển đổi lead: ' + error.message
      });
    }
  }

  /**
   * Lấy danh sách học viên đã chuyển đổi
   * GET /api/students
   */
  static async getStudents(req, res) {
    try {
      const students = StudentModel.findAll();
      return res.status(200).json({
        success: true,
        count: students.length,
        data: students
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = ConversionController;

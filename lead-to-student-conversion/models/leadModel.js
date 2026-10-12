/**
 * Lead Model
 * Đáp ứng subtask: [BE] Cập nhật trạng thái lead sang Đã nhập học và khóa chỉnh sửa
 * Quản lý dữ liệu lead, kiểm tra trạng thái và ngăn chặn sửa lead đã nhập học
 */

const fs = require('fs');
const path = require('path');

class LeadModel {
  static getLeadsFilePath() {
    return process.env.LEADS_DATA_FILE || path.join(__dirname, '../data/leads.json');
  }

  static readLeads() {
    try {
      const file = this.getLeadsFilePath();
      if (!fs.existsSync(file)) return [];
      const content = fs.readFileSync(file, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      console.error('Lỗi đọc dữ liệu leads:', e);
      return [];
    }
  }

  static writeLeads(leads) {
    try {
      const file = this.getLeadsFilePath();
      fs.writeFileSync(file, JSON.stringify(leads, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('Lỗi ghi dữ liệu leads:', e);
      return false;
    }
  }

  static findAll(filter = {}) {
    let leads = this.readLeads();
    if (filter.status && filter.status !== 'all') {
      leads = leads.filter(l => l.status === filter.status);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      leads = leads.filter(l => 
        (l.fullName && l.fullName.toLowerCase().includes(q)) ||
        (l.phone && l.phone.includes(q)) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.major && l.major.toLowerCase().includes(q))
      );
    }
    return leads;
  }

  static findById(id) {
    const leads = this.readLeads();
    return leads.find(l => l.id === id) || null;
  }

  /**
   * Cập nhật thông tin lead thông thường (ví dụ sửa ghi chú, số điện thoại...)
   * NẾU LEAD ĐÃ NHẬP HỌC (isLocked === true) THÌ BỊ KHÓA, TỪ CHỐI CHỈNH SỬA
   */
  static update(id, updateData = {}) {
    const leads = this.readLeads();
    const index = leads.findIndex(l => l.id === id);

    if (index === -1) {
      throw new Error('LEAD_NOT_FOUND');
    }

    const lead = leads[index];

    // KIỂM TRA KHÓA CHỈNH SỬA
    if (lead.isLocked === true || lead.status === 'enrolled') {
      const err = new Error('Lead đã nhập học đã bị khóa, không được phép chỉnh sửa dữ liệu.');
      err.code = 'LEAD_LOCKED';
      err.statusCode = 403;
      throw err;
    }

    // Cập nhật các trường được phép
    const allowedFields = ['fullName', 'phone', 'email', 'major', 'course', 'address', 'dob', 'notes', 'tuitionFee'];
    allowedFields.forEach(f => {
      if (updateData[f] !== undefined) {
        leads[index][f] = updateData[f];
      }
    });

    leads[index].updatedAt = new Date().toISOString();
    this.writeLeads(leads);
    return leads[index];
  }

  /**
   * Cập nhật trạng thái lead sang 'Đã nhập học' và KHÓA CHỈNH SỬA (Subtask 1)
   */
  static markAsEnrolled(id, studentInfo) {
    const leads = this.readLeads();
    const index = leads.findIndex(l => l.id === id);

    if (index === -1) {
      throw new Error('LEAD_NOT_FOUND');
    }

    leads[index].status = 'enrolled';
    leads[index].statusLabel = 'Đã nhập học';
    leads[index].isLocked = true; // Khóa chỉnh sửa vĩnh viễn
    leads[index].studentId = studentInfo.id;
    leads[index].studentCode = studentInfo.studentCode;
    leads[index].convertedAt = new Date().toISOString();
    leads[index].updatedAt = new Date().toISOString();

    this.writeLeads(leads);
    return leads[index];
  }
}

module.exports = LeadModel;

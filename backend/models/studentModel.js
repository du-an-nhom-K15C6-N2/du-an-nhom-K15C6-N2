/**
 * Student Model
 * Quản lý dữ liệu hồ sơ học viên được tạo mới từ lead đã chốt
 */

const fs = require('fs');
const path = require('path');

class StudentModel {
  static getStudentsFilePath() {
    return process.env.STUDENTS_DATA_FILE || path.join(__dirname, '../data/students.json');
  }

  static readStudents() {
    try {
      const file = this.getStudentsFilePath();
      if (!fs.existsSync(file)) return [];
      const content = fs.readFileSync(file, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      console.error('Lỗi đọc dữ liệu students:', e);
      return [];
    }
  }

  static writeStudents(students) {
    try {
      const file = this.getStudentsFilePath();
      fs.writeFileSync(file, JSON.stringify(students, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('Lỗi ghi dữ liệu students:', e);
      return false;
    }
  }

  static findAll() {
    return this.readStudents();
  }

  static findById(id) {
    const students = this.readStudents();
    return students.find(s => s.id === id) || null;
  }

  static findByCode(code) {
    const students = this.readStudents();
    return students.find(s => s.studentCode === code) || null;
  }

  static findByLeadId(leadId) {
    const students = this.readStudents();
    return students.find(s => s.leadId === leadId) || null;
  }

  /**
   * Tạo hồ sơ học viên mới được chuyển đổi từ Lead
   */
  static create(studentData) {
    const students = this.readStudents();

    const newStudent = {
      id: studentData.id || `stu_${studentData.studentCode}`,
      studentCode: studentData.studentCode,
      leadId: studentData.leadId,
      fullName: studentData.fullName,
      phone: studentData.phone,
      email: studentData.email,
      major: studentData.major || '',
      course: studentData.course || studentData.major || '',
      address: studentData.address || '',
      dob: studentData.dob || null,
      source: studentData.source || 'Lead chuyển đổi',
      tuitionFee: studentData.tuitionFee || 0,
      enrolledDate: studentData.enrolledDate || new Date().toISOString().split('T')[0],
      status: 'enrolled',
      statusLabel: 'Đang theo học',
      createdAt: new Date().toISOString()
    };

    students.push(newStudent);
    this.writeStudents(students);
    return newStudent;
  }
}

module.exports = StudentModel;

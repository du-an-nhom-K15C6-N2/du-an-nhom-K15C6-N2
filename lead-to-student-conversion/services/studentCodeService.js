/**
 * Student Code Generator Service (Mã học viên tự động)
 * Đáp ứng subtask: [BE] Sinh mã học viên tự động khi tạo hồ sơ từ lead
 * Quy chuẩn:
 * - Định dạng: HV{YYYY}{XXXX} (Ví dụ: HV20260001, HV20260002)
 * - Tự động tăng tuần tự theo năm hiện tại
 * - Đảm bảo tính duy nhất, không trùng lặp với hồ sơ đã có trong hệ thống
 */

class StudentCodeService {
  /**
   * Sinh mã học viên tiếp theo dựa trên danh sách học viên hiện có
   * @param {Array} existingStudents - Danh sách học viên hiện có trong hệ thống
   * @param {number|null} targetYear - Năm sinh mã (mặc định lấy năm hiện tại)
   * @returns {string} - Mã học viên duy nhất (Ví dụ: HV20260002)
   */
  static generateStudentCode(existingStudents = [], targetYear = null) {
    const year = targetYear || new Date().getFullYear();
    const prefix = `HV${year}`;
    const codeRegex = new RegExp(`^HV${year}(\\d{4})$`);

    let maxSequence = 0;
    const existingCodeSet = new Set();

    if (Array.isArray(existingStudents)) {
      for (const student of existingStudents) {
        const code = String(student.studentCode || student.code || '').trim();
        if (code) {
          existingCodeSet.add(code.toUpperCase());
          const match = code.match(codeRegex);
          if (match && match[1]) {
            const seq = parseInt(match[1], 10);
            if (!isNaN(seq) && seq > maxSequence) {
              maxSequence = seq;
            }
          }
        }
      }
    }

    // Tăng tuần tự
    let nextSeq = maxSequence + 1;
    let candidateCode = `${prefix}${String(nextSeq).padStart(4, '0')}`;

    // Đảm bảo tuyệt đối không trùng lặp (Uniqueness Guarantee)
    while (existingCodeSet.has(candidateCode.toUpperCase())) {
      nextSeq += 1;
      candidateCode = `${prefix}${String(nextSeq).padStart(4, '0')}`;
    }

    return candidateCode;
  }

  /**
   * Kiểm tra định dạng mã học viên có hợp lệ hay không
   * @param {string} code - Mã cần kiểm tra
   * @returns {boolean}
   */
  static isValidStudentCode(code) {
    if (typeof code !== 'string') return false;
    return /^HV\d{4}\d{4}$/.test(code.trim());
  }
}

module.exports = StudentCodeService;

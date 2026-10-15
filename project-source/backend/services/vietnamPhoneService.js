/**
 * Service xác thực và chuẩn hóa số điện thoại di động Việt Nam.
 * Áp dụng theo quy chuẩn đầu số mạng viễn thông Việt Nam (Quy hoạch kho số viễn thông - Bộ TT&TT).
 * 
 * Đầu số di động 10 số hợp lệ:
 * - Viettel: 032, 033, 034, 035, 036, 037, 038, 039, 086, 096, 097, 098
 * - Mobifone: 070, 076, 077, 078, 079, 089, 090, 093
 * - Vinaphone: 081, 082, 083, 084, 085, 088, 091, 094
 * - Vietnamobile: 052, 056, 058, 092
 * - Gmobile: 059, 099
 * - Itelecom: 087
 * - Wintel: 055
 * 
 * Tổng quát regex đầu số: 0(3[2-9]|5[25689]|7[06-9]|8[1-9]|9\d)\d{7}
 */

// Regex kiểm tra số điện thoại di động Việt Nam chuẩn (10 chữ số bắt đầu bằng 0)
const VN_MOBILE_REGEX = /^0(3[2-9]|5[25689]|7[06-9]|8[1-9]|9\d)\d{7}$/;

/**
 * Xác thực và chuẩn hóa số điện thoại Việt Nam.
 * Chuyển các định dạng +84, 84, 0084, khoảng trắng, gạch ngang... về chuẩn 10 chữ số bắt đầu bằng 0.
 * 
 * @param {string} phone
 * @returns {{ isValid: boolean, normalized: string | null, error: string | null }}
 */
function normalizeVietnamesePhone(phone) {
  if (typeof phone !== 'string') {
    return {
      isValid: false,
      normalized: null,
      error: 'Số điện thoại không hợp lệ.'
    };
  }

  const trimmed = phone.trim();
  if (!trimmed) {
    return {
      isValid: false,
      normalized: null,
      error: 'Vui lòng nhập số điện thoại.'
    };
  }

  // Loại bỏ các ký tự phân cách: khoảng trắng, dấu chấm, gạch ngang, ngoặc đơn
  const cleaned = trimmed.replace(/[\s().-]/g, '');

  // Kiểm tra chỉ chứa chữ số và dấu + ở đầu
  if (!/^\+?\d+$/.test(cleaned)) {
    return {
      isValid: false,
      normalized: null,
      error: 'Số điện thoại chỉ được chứa các chữ số, không chứa chữ cái hoặc ký tự đặc biệt.'
    };
  }

  // Chuẩn hóa tiền tố quốc tế về đầu số 0
  let digits = cleaned;
  if (digits.startsWith('+84')) {
    digits = '0' + digits.slice(3);
  } else if (digits.startsWith('0084')) {
    digits = '0' + digits.slice(4);
  } else if (digits.startsWith('84') && digits.length === 11) {
    digits = '0' + digits.slice(2);
  }

  // Kiểm tra độ dài chữ số
  if (digits.length !== 10) {
    return {
      isValid: false,
      normalized: null,
      error: `Số điện thoại Việt Nam phải bao gồm đúng 10 chữ số (hiện có ${digits.length} số).`
    };
  }

  // Kiểm tra đầu số mạng di động Việt Nam
  if (!VN_MOBILE_REGEX.test(digits)) {
    return {
      isValid: false,
      normalized: null,
      error: 'Số điện thoại không đúng định dạng mạng di động Việt Nam (đầu số hợp lệ: 03, 05, 07, 08, 09).'
    };
  }

  return {
    isValid: true,
    normalized: digits,
    error: null
  };
}

module.exports = {
  VN_MOBILE_REGEX,
  normalizeVietnamesePhone
};

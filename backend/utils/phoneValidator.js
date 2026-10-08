/**
 * Vietnam Phone Number Validator and Normalizer Utility
 * Chuẩn hóa và xác thực số điện thoại Việt Nam theo quy chuẩn các nhà mạng viễn thông:
 * - Đầu số di động 10 chữ số: 03, 05, 07, 08, 09
 * - Hỗ trợ tiền tố quốc tế +84 hoặc 84
 * - Hỗ trợ các ký tự phân cách thông dụng: khoảng trắng, dấu gạch ngang, dấu chấm, dấu ngoặc
 */

/**
 * Chuẩn hóa chuỗi số điện thoại Việt Nam về định dạng chuẩn 10 chữ số (bắt đầu bằng số 0)
 * @param {string} phone - Chuỗi số điện thoại đầu vào
 * @returns {string|null} - Chuỗi chuẩn hóa 10 số (ví dụ: '0981234567') hoặc null nếu không hợp lệ
 */
function normalizeVietnamPhone(phone) {
  if (typeof phone !== 'string') return null;

  // Loại bỏ các ký tự khoảng trắng, dấu gạch nối, dấu chấm, ngoặc đơn
  let cleaned = phone.trim().replace(/[\s.\-()]/g, '');

  // Xử lý mã quốc tế +84
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('84') && cleaned.length === 11) {
    cleaned = '0' + cleaned.slice(2);
  }

  return cleaned;
}

/**
 * Kiểm tra xem chuỗi số điện thoại có đúng định dạng Việt Nam hợp lệ hay không
 * Định dạng chuẩn: 10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09
 * @param {string} phone - Chuỗi số điện thoại cần kiểm tra
 * @returns {boolean} - true nếu hợp lệ, false nếu không hợp lệ
 */
function isValidVietnamPhone(phone) {
  const normalized = normalizeVietnamPhone(phone);
  if (!normalized) return false;

  // Regex kiểm tra số di động Việt Nam 10 chữ số:
  // 03x: Viettel
  // 05x: Vietnamobile, Gmobile
  // 07x: Mobifone
  // 08x: Vinaphone, Viettel, Itelecom, Wintel
  // 09x: Tất cả nhà mạng
  const vietnamPhoneRegex = /^0[35789]\d{8}$/;

  return vietnamPhoneRegex.test(normalized);
}

module.exports = {
  normalizeVietnamPhone,
  isValidVietnamPhone
};

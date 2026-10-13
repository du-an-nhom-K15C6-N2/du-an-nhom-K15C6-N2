/**
 * DNKN-3: Quy tắc nghiệp vụ & Kiểm tra dữ liệu (Validation)
 * 1. Kiểm tra định dạng Email hợp lệ (RFC 5322 regex).
 * 2. Bắt buộc nhập cả 2 trường Email và Mật khẩu trước khi bấm gửi.
 */

// Regex kiểm tra định dạng email tiêu chuẩn
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Kiểm tra tính hợp lệ của trường Email
 * @param {string} email
 * @returns {{ isValid: boolean, error: string | null }}
 */
export function validateEmail(email) {
  const trimmedEmail = (email || '').trim();

  if (!trimmedEmail) {
    return {
      isValid: false,
      error: 'Vui lòng nhập địa chỉ email.'
    };
  }

  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return {
      isValid: false,
      error: 'Email không đúng định dạng (Ví dụ: name@company.com).'
    };
  }

  return {
    isValid: true,
    error: null
  };
}

/**
 * Kiểm tra tính hợp lệ của trường Mật khẩu
 * @param {string} password
 * @returns {{ isValid: boolean, error: string | null }}
 */
export function validatePassword(password) {
  if (!password || password.length === 0) {
    return {
      isValid: false,
      error: 'Vui lòng nhập mật khẩu.'
    };
  }

  if (password.length < 6) {
    return {
      isValid: false,
      error: 'Mật khẩu phải có ít nhất 6 ký tự.'
    };
  }

  return {
    isValid: true,
    error: null
  };
}

/**
 * Kiểm tra toàn bộ form đăng nhập trước khi submit
 * Bắt buộc nhập cả 2 trường Email và Mật khẩu
 * @param {{ email: string, password: string }} formData
 * @returns {{ isValid: boolean, errors: { email: string | null, password: string | null } }}
 */
export function validateLoginForm(formData = {}) {
  const emailValidation = validateEmail(formData.email);
  const passwordValidation = validatePassword(formData.password);

  const errors = {
    email: emailValidation.error,
    password: passwordValidation.error
  };

  const isValid = emailValidation.isValid && passwordValidation.isValid;

  return {
    isValid,
    errors
  };
}

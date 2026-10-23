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

/**
 * Regex chuẩn số điện thoại di động Việt Nam (10 chữ số)
 * Đầu số 03, 05, 07, 08, 09
 */
export const VN_PHONE_REGEX = /^0(3[2-9]|5[25689]|7[06-9]|8[1-9]|9\d)\d{7}$/;

/**
 * Kiểm tra định dạng số điện thoại Việt Nam ở phía giao diện
 * Ràng buộc nhập số điện thoại theo định dạng Việt Nam, hiển thị thông báo lỗi khi không hợp lệ
 * @param {string} phone
 * @returns {{ isValid: boolean, normalized: string, error: string | null }}
 */
export function validateVietnamesePhone(phone) {
  const trimmed = (phone || '').trim();
  if (!trimmed) {
    return {
      isValid: false,
      normalized: '',
      error: 'Vui lòng nhập số điện thoại.'
    };
  }

  // Loại bỏ các ký tự định dạng: khoảng trắng, dấu chấm, gạch ngang, ngoặc đơn
  const cleaned = trimmed.replace(/[\s().-]/g, '');

  if (!/^\+?\d+$/.test(cleaned)) {
    return {
      isValid: false,
      normalized: '',
      error: 'Số điện thoại chỉ được chứa các chữ số, không chứa chữ cái hoặc ký tự đặc biệt.'
    };
  }

  let digits = cleaned;
  if (digits.startsWith('+84')) {
    digits = '0' + digits.slice(3);
  } else if (digits.startsWith('0084')) {
    digits = '0' + digits.slice(4);
  } else if (digits.startsWith('84') && digits.length === 11) {
    digits = '0' + digits.slice(2);
  }

  if (digits.length !== 10) {
    return {
      isValid: false,
      normalized: '',
      error: `Số điện thoại Việt Nam phải có 10 chữ số (hiện có ${digits.length} số).`
    };
  }

  if (!VN_PHONE_REGEX.test(digits)) {
    return {
      isValid: false,
      normalized: '',
      error: 'Số điện thoại không đúng định dạng mạng di động Việt Nam (đầu số hợp lệ: 03, 05, 07, 08, 09).'
    };
  }

  return {
    isValid: true,
    normalized: digits,
    error: null
  };
}

/**
 * Kiểm tra toàn bộ form hồ sơ cá nhân
 * @param {{ name: string, phone: string, dateOfBirth?: string, address?: string }} formData
 * @returns {{ isValid: boolean, errors: Record<string, string | null> }}
 */
export function validateProfileForm(formData = {}) {
  const errors = {
    name: null,
    phone: null,
    dateOfBirth: null,
    address: null
  };

  const trimmedName = (formData.name || '').trim();
  if (!trimmedName) {
    errors.name = 'Họ và tên không được để trống.';
  } else if (trimmedName.length < 2 || trimmedName.length > 120) {
    errors.name = 'Họ và tên phải có từ 2 đến 120 ký tự.';
  }

  const phoneValidation = validateVietnamesePhone(formData.phone);
  if (!phoneValidation.isValid) {
    errors.phone = phoneValidation.error;
  }

  if (formData.dateOfBirth) {
    const dobStr = String(formData.dateOfBirth).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dobStr)) {
      errors.dateOfBirth = 'Ngày sinh phải có định dạng YYYY-MM-DD.';
    } else {
      const dobDate = new Date(dobStr);
      if (Number.isNaN(dobDate.getTime())) {
        errors.dateOfBirth = 'Ngày sinh không hợp lệ.';
      } else if (dobDate > new Date()) {
        errors.dateOfBirth = 'Ngày sinh không thể là ngày trong tương lai.';
      } else if (dobDate.getFullYear() < 1900) {
        errors.dateOfBirth = 'Năm sinh không hợp lệ (phải từ năm 1900 trở lại đây).';
      }
    }
  }

  if (formData.address && String(formData.address).trim().length > 255) {
    errors.address = 'Địa chỉ không được vượt quá 255 ký tự.';
  }

  const isValid = !errors.name && !errors.phone && !errors.dateOfBirth && !errors.address;
  return { isValid, errors };
}

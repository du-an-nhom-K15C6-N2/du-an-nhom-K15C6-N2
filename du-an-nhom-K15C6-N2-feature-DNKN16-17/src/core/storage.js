/**
 * DNKN-3: Quản lý lưu trữ thông tin xác thực (Token / Session / Role)
 * Hỗ trợ lưu trữ bền vững (localStorage) hoặc theo phiên làm việc (sessionStorage)
 */

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'dnkn_auth_token',
  USER_INFO: 'dnkn_user_info',
  USER_ROLE: 'dnkn_user_role',
  REMEMBER_ME: 'dnkn_remember_me',
  LOGIN_TIMESTAMP: 'dnkn_login_timestamp'
};

/**
 * Lưu thông tin xác thực sau khi đăng nhập thành công
 * @param {Object} params
 * @param {string} params.token - JWT access token hoặc session id
 * @param {Object} params.user - Thông tin người dùng bao gồm id, email, fullName, role
 * @param {boolean} [params.rememberMe=false] - Tuỳ chọn duy trì đăng nhập
 */
export function saveAuthSession({ token, user, rememberMe = false }) {
  const storage = rememberMe ? localStorage : sessionStorage;
  
  // Dọn dẹp cả 2 storage để tránh xung đột dữ liệu cũ
  clearAuthSession();

  try {
    storage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
    storage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(user));
    storage.setItem(STORAGE_KEYS.USER_ROLE, user?.role || 'GUEST');
    storage.setItem(STORAGE_KEYS.REMEMBER_ME, String(rememberMe));
    storage.setItem(STORAGE_KEYS.LOGIN_TIMESTAMP, new Date().toISOString());
  } catch (error) {
    console.error('Không thể lưu session vào Web Storage:', error);
  }
}

/**
 * Lấy thông tin session và token hiện tại
 * @returns {{ token: string | null, user: Object | null, role: string | null, isAuthenticated: boolean }}
 */
export function getAuthSession() {
  // Kiểm tra trước trong localStorage, nếu không có kiểm tra sessionStorage
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const rawUser = localStorage.getItem(STORAGE_KEYS.USER_INFO) || sessionStorage.getItem(STORAGE_KEYS.USER_INFO);
  const role = localStorage.getItem(STORAGE_KEYS.USER_ROLE) || sessionStorage.getItem(STORAGE_KEYS.USER_ROLE);

  let user = null;
  if (rawUser) {
    try {
      user = JSON.parse(rawUser);
    } catch {
      user = null;
    }
  }

  return {
    token,
    user,
    role: role || (user?.role ?? null),
    isAuthenticated: Boolean(token && user)
  };
}

/**
 * Xóa toàn bộ phiên đăng nhập (Token, User info, Role)
 */
export function clearAuthSession() {
  [localStorage, sessionStorage].forEach((storage) => {
    storage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    storage.removeItem(STORAGE_KEYS.USER_INFO);
    storage.removeItem(STORAGE_KEYS.USER_ROLE);
    storage.removeItem(STORAGE_KEYS.REMEMBER_ME);
    storage.removeItem(STORAGE_KEYS.LOGIN_TIMESTAMP);
  });
}

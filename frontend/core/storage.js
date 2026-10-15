/**
 * Storage helper cho Standalone Preview Module DNKN-86
 */

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'dnkn_auth_token',
  USER_INFO: 'dnkn_user_info',
  USER_ROLE: 'dnkn_user_role',
  REMEMBER_ME: 'dnkn_remember_me',
  LOGIN_TIMESTAMP: 'dnkn_login_timestamp'
};

export function saveAuthSession({ token, user, rememberMe = false }) {
  const storage = rememberMe ? localStorage : sessionStorage;
  clearAuthSession();

  try {
    storage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
    storage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(user));
    storage.setItem(STORAGE_KEYS.USER_ROLE, user?.role || 'GUEST');
    storage.setItem(STORAGE_KEYS.REMEMBER_ME, String(rememberMe));
    storage.setItem(STORAGE_KEYS.LOGIN_TIMESTAMP, new Date().toISOString());
  } catch (error) {
    console.error('Không thể lưu session:', error);
  }
}

export function getAuthSession() {
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

export function clearAuthSession() {
  [localStorage, sessionStorage].forEach((storage) => {
    storage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    storage.removeItem(STORAGE_KEYS.USER_INFO);
    storage.removeItem(STORAGE_KEYS.USER_ROLE);
    storage.removeItem(STORAGE_KEYS.REMEMBER_ME);
    storage.removeItem(STORAGE_KEYS.LOGIN_TIMESTAMP);
  });
}

/**
 * DNKN-3: Quản lý trạng thái luồng đăng nhập (State Management)
 * Quản lý isLoading, isSubmitting, user, token, role, error, fieldErrors
 */

import { saveAuthSession, getAuthSession, clearAuthSession, STORAGE_KEYS } from './storage.js';
import { clearFormDrafts } from './formDrafts.js';
import { validateLoginForm } from './validation.js';
import { getCurrentUser, loginApi, logoutApi, refreshSessionApi } from './authService.js';
import { resolveNavigationByRole, navigateTo } from './navigation.js';

const SESSION_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const ACTIVE_SESSION_WINDOW_MS = 20 * 60 * 1000;
const SESSION_EXPIRED_MESSAGE = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại. Bản nháp biểu mẫu được lưu tạm trên thiết bị này nếu có.';
const LOGIN_LOCKOUT_STORAGE_KEY = 'dnkn_login_lockout';

class AuthStateManager {
  constructor() {
    const existingSession = getAuthSession();
    let savedLockout = null;
    try {
      savedLockout = JSON.parse(sessionStorage.getItem(LOGIN_LOCKOUT_STORAGE_KEY) || 'null');
    } catch (error) {
      console.warn('Không thể khôi phục trạng thái khóa đăng nhập:', error);
      sessionStorage.removeItem(LOGIN_LOCKOUT_STORAGE_KEY);
    }
    const activeLockout = savedLockout
      && typeof savedLockout.email === 'string'
      && Number.isFinite(savedLockout.lockoutUntil)
      && savedLockout.lockoutUntil > Date.now()
      ? savedLockout
      : null;
    if (!activeLockout) sessionStorage.removeItem(LOGIN_LOCKOUT_STORAGE_KEY);

    this.state = {
      // 1. Quản lý trạng thái gửi request
      isLoading: Boolean(existingSession.token),
      isSubmitting: false,

      // 2. Quản lý trạng thái xác thực & Role
      isAuthenticated: false,
      user: null,
      token: existingSession.token,
      role: null,

      // 3. Quản lý trạng thái lỗi
      error: activeLockout ? 'Email hoặc mật khẩu không đúng' : null,
      lockoutUntil: activeLockout?.lockoutUntil || null,
      lockoutEmail: activeLockout?.email || null,
      fieldErrors: {
        email: null,
        password: null
      },

      // Lưu trữ thông tin điều hướng sau khi đăng nhập
      navigationTarget: null,
      rememberMe: false
    };

    this.listeners = new Set();
    this.refreshTimer = null;
    this.refreshInProgress = false;
    this.lastActivityAt = Date.now();
    this.handleSessionExpired = this.handleSessionExpired.bind(this);
    this.handleStorageChange = this.handleStorageChange.bind(this);
    this.recordActivity = this.recordActivity.bind(this);
    window.addEventListener('auth:session-expired', this.handleSessionExpired);
    window.addEventListener('storage', this.handleStorageChange);
    ['pointerdown', 'keydown', 'input', 'change', 'touchstart'].forEach((eventName) => {
      document.addEventListener(eventName, this.recordActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.recordActivity();
        this.refreshActiveSession();
      }
    });
    this.sessionReady = existingSession.token
      ? this.restoreSession(existingSession.token)
      : Promise.resolve();
  }

  recordActivity() {
    this.lastActivityAt = Date.now();
  }

  startSessionRefresh() {
    this.stopSessionRefresh();
    this.lastActivityAt = Date.now();
    this.refreshTimer = window.setInterval(() => this.refreshActiveSession(), SESSION_REFRESH_INTERVAL_MS);
  }

  stopSessionRefresh() {
    if (this.refreshTimer !== null) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async refreshActiveSession() {
    const token = this.state.token;
    if (
      !this.state.isAuthenticated
      || !token
      || this.refreshInProgress
      || document.visibilityState === 'hidden'
      || Date.now() - this.lastActivityAt > ACTIVE_SESSION_WINDOW_MS
    ) {
      return;
    }

    this.refreshInProgress = true;
    try {
      const renewedToken = await refreshSessionApi(token);
      if (!this.state.isAuthenticated || this.state.token !== token) return;

      const rememberMe = Boolean(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN));
      saveAuthSession({ token: renewedToken, user: this.state.user, rememberMe });
      this.setState({ token: renewedToken });
    } catch (error) {
      if (error.code !== 'SESSION_EXPIRED') {
        console.error('Không thể tự động gia hạn phiên đăng nhập:', error);
      }
    } finally {
      this.refreshInProgress = false;
    }
  }

  handleSessionExpired() {
    if (!this.state.token && !this.state.isAuthenticated) return;
    this.stopSessionRefresh();
    clearAuthSession();
    this.setState({
      isLoading: false,
      isSubmitting: false,
      isAuthenticated: false,
      user: null,
      token: null,
      role: null,
      error: SESSION_EXPIRED_MESSAGE,
      fieldErrors: { email: null, password: null },
      navigationTarget: null
    });
    navigateTo('/login');
  }

  handleStorageChange(event) {
    if (
      event.key !== STORAGE_KEYS.ACCESS_TOKEN
      || event.newValue !== null
      || !this.state.isAuthenticated
    ) {
      return;
    }

    this.stopSessionRefresh();
    clearAuthSession();
    this.setState({
      isLoading: false,
      isSubmitting: false,
      isAuthenticated: false,
      user: null,
      token: null,
      role: null,
      error: 'Phiên đăng nhập đã được kết thúc ở một thẻ khác. Vui lòng đăng nhập lại.',
      fieldErrors: { email: null, password: null },
      navigationTarget: null
    });
    navigateTo('/login');
  }

  async restoreSession(token) {
    try {
      const user = await getCurrentUser(token);
      const targetNav = resolveNavigationByRole(user.role);
      const rememberMe = Boolean(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN));
      saveAuthSession({ token, user, rememberMe });
      this.setState({
        isLoading: false,
        isAuthenticated: true,
        user,
        token,
        role: user.role,
        navigationTarget: targetNav
      });
      this.startSessionRefresh();
      navigateTo(targetNav.path, { role: user.role, user });
    } catch (error) {
      if (error.code === 'SESSION_EXPIRED') {
        this.handleSessionExpired();
      } else {
        this.setState({
          isLoading: false,
          error: 'Không thể xác minh phiên đăng nhập do lỗi kết nối. Vui lòng thử đăng nhập lại.'
        });
      }
    }
  }

  /**
   * Đăng ký hàm lắng nghe sự thay đổi của State
   * @param {Function} listener
   * @returns {Function} Hàm hủy đăng ký (unsubscribe)
   */
  subscribe(listener) {
    this.listeners.add(listener);
    // Bắn state hiện tại ngay khi đăng ký
    listener(this.getState());

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Thông báo cho toàn bộ listeners
   */
  notify() {
    const currentState = this.getState();
    Array.from(this.listeners).forEach((listener) => {
      try {
        listener(currentState);
      } catch (err) {
        console.error('Lỗi trong subscriber listener:', err);
      }
    });
  }

  /**
   * Lấy bản sao state hiện tại
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Cập nhật một phần state
   * @param {Partial<this.state>} partialState
   */
  setState(partialState) {
    this.state = { ...this.state, ...partialState };
    this.notify();
  }

  /**
   * Cập nhật lỗi cho từng field cụ thể
   */
  setFieldError(field, errorMessage) {
    this.setState({
      fieldErrors: {
        ...this.state.fieldErrors,
        [field]: errorMessage
      }
    });
  }

  /**
   * Xóa toàn bộ lỗi hiển thị
   */
  clearErrors() {
    this.setState({
      error: null,
      fieldErrors: { email: null, password: null }
    });
  }

  /**
   * Xử lý luồng đăng nhập chính của Subtask [DNKN-3]
   * Bao gồm: Validation -> Bật IsSubmitting -> Gọi API -> Lưu Token/Role -> Navigation
   * @param {{ email: string, password: string, rememberMe?: boolean }} formInput
   * @returns {Promise<{ success: boolean, role?: string, error?: string }>}
   */
  async handleLogin({ email, password, rememberMe = false }) {
    await this.sessionReady;

    if (
      this.state.lockoutUntil > Date.now()
      && email.trim().toLowerCase() === this.state.lockoutEmail
    ) {
      return { success: false, error: this.state.error };
    }

    // 1. Kiểm tra validation trước khi gửi
    this.clearErrors();
    const validationResult = validateLoginForm({ email, password });

    if (!validationResult.isValid) {
      this.setState({
        fieldErrors: validationResult.errors,
        error: 'Vui lòng kiểm tra lại thông tin đăng nhập.'
      });
      return { success: false, error: 'Validation failed' };
    }

    // 2. Kích hoạt trạng thái gửi request (IsLoading, IsSubmitting)
    this.setState({
      isLoading: true,
      isSubmitting: true,
      error: null,
      rememberMe
    });

    try {
      // 3. Gọi service đăng nhập
      const response = await loginApi({ email, password });

      // 4. Đăng nhập thành công: Lưu trữ xác thực (Token/Session) & Role
      const targetNav = resolveNavigationByRole(response.role);
      saveAuthSession({
        token: response.token,
        user: response.user,
        rememberMe
      });
      this.startSessionRefresh();

      // 5. Chuẩn bị hành vi chuyển hướng (Navigation logic) theo Role
      this.setState({
        isLoading: false,
        isSubmitting: false,
        isAuthenticated: true,
        user: response.user,
        role: response.role,
        token: response.token,
        navigationTarget: targetNav,
        error: null,
        lockoutUntil: null,
        lockoutEmail: null,
        fieldErrors: { email: null, password: null }
      });
      sessionStorage.removeItem(LOGIN_LOCKOUT_STORAGE_KEY);

      // 6. Kích hoạt chuyển hướng giao diện
      navigateTo(targetNav.path, { role: response.role, user: response.user });

      return {
        success: true,
        role: response.role,
        user: response.user,
        path: targetNav.path
      };
    } catch (err) {
      // 7. Xử lý khi đăng nhập thất bại: Nhận thông báo lỗi từ API và lưu vào state lỗi
      const errorMessage = err.message || 'Đã có lỗi xảy ra trong quá trình đăng nhập.';
      const hasNewLockout = Boolean(err.retryAfterSeconds);
      const preserveLockout = this.state.lockoutUntil > Date.now();
      const lockoutUntil = hasNewLockout
        ? Date.now() + err.retryAfterSeconds * 1000
        : preserveLockout ? this.state.lockoutUntil : null;
      const lockoutEmail = hasNewLockout
        ? email.trim().toLowerCase()
        : preserveLockout ? this.state.lockoutEmail : null;
      this.setState({
        isLoading: false,
        isSubmitting: false,
        isAuthenticated: false,
        error: errorMessage,
        lockoutUntil,
        lockoutEmail
      });
      if (hasNewLockout) {
        sessionStorage.setItem(LOGIN_LOCKOUT_STORAGE_KEY, JSON.stringify({
          email: lockoutEmail,
          lockoutUntil
        }));
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Đăng xuất và dọn dẹp state
   */
  async handleLogout() {
    this.stopSessionRefresh();
    this.setState({ isLoading: true });
    let logoutError = null;
    try {
      await logoutApi(this.state.token);
    } catch (error) {
      console.error('Không thể thu hồi phiên đăng nhập trên máy chủ:', error);
      logoutError = 'Không thể kết nối để thu hồi phiên. Hãy đóng trình duyệt nếu bạn đang dùng thiết bị công cộng.';
    } finally {
      clearAuthSession();
      clearFormDrafts();
      this.setState({
        isLoading: false,
        isSubmitting: false,
        isAuthenticated: false,
        user: null,
        token: null,
        role: null,
        error: logoutError,
        fieldErrors: { email: null, password: null },
        navigationTarget: null
      });
      navigateTo('/login');
    }
  }
}

// Singleton instance dùng xuyên suốt ứng dụng
export const authState = new AuthStateManager();

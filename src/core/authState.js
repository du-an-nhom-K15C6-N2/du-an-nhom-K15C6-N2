/**
 * DNKN-3: Quản lý trạng thái luồng đăng nhập (State Management)
 * Quản lý isLoading, isSubmitting, user, token, role, error, fieldErrors
 */

import { saveAuthSession, getAuthSession, clearAuthSession } from './storage.js';
import { validateLoginForm } from './validation.js';
import { loginApi, logoutApi } from './authService.js';
import { resolveNavigationByRole, navigateTo } from './navigation.js';

class AuthStateManager {
  constructor() {
    const existingSession = getAuthSession();

    this.state = {
      // 1. Quản lý trạng thái gửi request
      isLoading: false,
      isSubmitting: false,

      // 2. Quản lý trạng thái xác thực & Role
      isAuthenticated: existingSession.isAuthenticated,
      user: existingSession.user,
      token: existingSession.token,
      role: existingSession.role,

      // 3. Quản lý trạng thái lỗi
      error: null,
      fieldErrors: {
        email: null,
        password: null
      },

      // Lưu trữ thông tin điều hướng sau khi đăng nhập
      navigationTarget: existingSession.role ? resolveNavigationByRole(existingSession.role) : null,
      rememberMe: false
    };

    this.listeners = new Set();
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
    this.listeners.forEach((listener) => {
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
      saveAuthSession({
        token: response.token,
        user: response.user,
        rememberMe
      });

      // 5. Chuẩn bị hành vi chuyển hướng (Navigation logic) theo Role
      const targetNav = resolveNavigationByRole(response.role);

      this.setState({
        isLoading: false,
        isSubmitting: false,
        isAuthenticated: true,
        user: response.user,
        role: response.role,
        token: response.token,
        navigationTarget: targetNav,
        error: null,
        fieldErrors: { email: null, password: null }
      });

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
      this.setState({
        isLoading: false,
        isSubmitting: false,
        isAuthenticated: false,
        error: errorMessage
      });

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
    this.setState({ isLoading: true });
    try {
      await logoutApi();
    } finally {
      clearAuthSession();
      this.setState({
        isLoading: false,
        isSubmitting: false,
        isAuthenticated: false,
        user: null,
        token: null,
        role: null,
        error: null,
        fieldErrors: { email: null, password: null },
        navigationTarget: null
      });
      navigateTo('/login');
    }
  }
}

// Singleton instance dùng xuyên suốt ứng dụng
export const authState = new AuthStateManager();

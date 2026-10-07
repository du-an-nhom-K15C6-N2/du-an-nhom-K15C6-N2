/**
 * DNKN-3: Giao diện Form Đăng nhập & Điều khiển luồng người dùng
 */

import { authState } from '../core/authState.js';
import { validateEmail, validatePassword } from '../core/validation.js';

export function renderLoginForm(container) {
  let isPasswordVisible = false;
  let lockoutTimer = null;
  let activeLockoutUntil = null;
  let formValues = {
    email: '',
    password: '',
    rememberMe: false
  };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);

  function formatRemainingTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  function update() {
    const state = authState.getState();
    const currentEmail = (formValues.email || state.lockoutEmail || '').trim().toLowerCase();
    const isLocked = Boolean(
      state.lockoutUntil > Date.now()
      && currentEmail === state.lockoutEmail
    );
    const remainingSeconds = isLocked
      ? Math.ceil((state.lockoutUntil - Date.now()) / 1000)
      : 0;

    container.innerHTML = `
      <div class="login-wrapper">
        <!-- Subtask Header Info -->
        <div class="task-badge-container">
          <span class="task-badge">
            <span class="badge-dot"></span>
            Subtask [DNKN-3]: Thiết kế luồng đăng nhập phía Frontend
          </span>
        </div>

        <div class="login-card glass-panel">
          <div class="card-header">
            <div class="brand-logo">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <h1 class="card-title">Đăng Nhập Hệ Thống</h1>
            <p class="card-subtitle">Nhập email và mật khẩu của bạn để truy cập không gian làm việc</p>
          </div>

          <!-- Alert thông báo lỗi API (State: error) -->
          ${state.error ? `
            <div class="alert-box error-alert slide-down" id="api-error-alert">
              <div class="alert-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <div class="alert-content">
                <span class="alert-title">Đăng nhập không thành công</span>
                <span class="alert-desc">${escapeHtml(state.error)}</span>
              </div>
              <button class="alert-close" id="btn-close-alert" title="Đóng thông báo">
                &times;
              </button>
            </div>
          ` : ''}

          ${isLocked ? `
            <div class="lockout-countdown-box" id="login-lockout-countdown" role="status" aria-live="polite">
              Có thể thử lại sau ${formatRemainingTime(remainingSeconds)}
            </div>
          ` : ''}

          <!-- Form đăng nhập -->
          <form id="dnkn-login-form" novalidate>
            <!-- Field: Email -->
            <div class="form-group ${state.fieldErrors.email ? 'has-error' : ''}">
              <label for="login-email" class="form-label">
                Địa chỉ Email <span class="required">*</span>
              </label>
              <div class="input-container">
                <span class="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                </span>
                <input 
                  type="email" 
                  id="login-email" 
                  name="email" 
                  class="form-input" 
                  placeholder="name@company.com" 
                  value="${escapeHtml(formValues.email || state.lockoutEmail)}"
                  ${state.isSubmitting || state.isLoading ? 'disabled' : ''}
                  autocomplete="username"
                  required
                />
              </div>
              ${state.fieldErrors.email ? `
                <div class="field-error-message">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <span>${state.fieldErrors.email}</span>
                </div>
              ` : ''}
            </div>

            <!-- Field: Mật khẩu -->
            <div class="form-group ${state.fieldErrors.password ? 'has-error' : ''}">
              <div class="label-row">
                <label for="login-password" class="form-label">
                  Mật khẩu <span class="required">*</span>
                </label>
                <a href="#forgot" class="forgot-link" id="link-forgot-password">Quên mật khẩu?</a>
              </div>
              <div class="input-container">
                <span class="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </span>
                <input 
                  type="${isPasswordVisible ? 'text' : 'password'}" 
                  id="login-password" 
                  name="password" 
                  class="form-input" 
                  placeholder="Nhập mật khẩu (ít nhất 6 ký tự)" 
                  value="${escapeHtml(formValues.password)}"
                  ${state.isSubmitting || state.isLoading || isLocked ? 'disabled' : ''}
                  autocomplete="current-password"
                  required
                />
                <button 
                  type="button" 
                  class="btn-toggle-password" 
                  id="btn-toggle-password" 
                  title="${isPasswordVisible ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}"
                  tabindex="-1"
                >
                  ${isPasswordVisible ? `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ` : `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  `}
                </button>
              </div>
              ${state.fieldErrors.password ? `
                <div class="field-error-message">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <span>${state.fieldErrors.password}</span>
                </div>
              ` : ''}
            </div>

            <!-- Ghi nhớ phiên đăng nhập -->
            <div class="form-check-group">
              <label class="custom-checkbox">
                <input 
                  type="checkbox" 
                  id="chk-remember-me" 
                  ${formValues.rememberMe ? 'checked' : ''}
                  ${state.isSubmitting || state.isLoading || isLocked ? 'disabled' : ''}
                />
                <span class="checkmark"></span>
                <span class="label-text">Duy trì đăng nhập (Lưu Session bền vững)</span>
              </label>
            </div>

            <!-- Nút gửi Submit với trạng thái IsSubmitting / IsLoading -->
            <button 
              type="submit" 
              class="btn-submit ${state.isSubmitting || state.isLoading ? 'btn-loading' : ''}"
              id="btn-login-submit"
              ${state.isSubmitting || state.isLoading || isLocked ? 'disabled' : ''}
            >
              ${state.isLoading && !state.isSubmitting ? `
                <span class="spinner-icon"></span>
                <span>Đang kiểm tra phiên đăng nhập...</span>
              ` : state.isSubmitting ? `
                <span class="spinner-icon"></span>
                <span>Đang xác thực thông tin...</span>
              ` : `
                <span>Đăng Nhập</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              `}
            </button>
          </form>

        </div>

        <div class="feature-checklist glass-panel">
          <h3 class="checklist-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            Bảo vệ tài khoản:
          </h3>
          <ul class="checklist-items">
            <li class="active">
              <span class="check-icon">✓</span>
              <div>
                <strong>Xác thực:</strong> Mật khẩu được kiểm tra ở máy chủ và lưu dưới dạng băm an toàn.
              </div>
            </li>
            <li class="active">
              <span class="check-icon">✓</span>
              <div>
                <strong>Thông báo:</strong> Sai email hoặc mật khẩu luôn nhận cùng một thông báo chung.
              </div>
            </li>
            <li class="active">
              <span class="check-icon">✓</span>
              <div>
                <strong>Giới hạn thử:</strong> Tài khoản bị khóa tạm thời 15 phút sau 5 lần nhập sai liên tiếp.
              </div>
            </li>
          </ul>
        </div>
      </div>
    `;

    bindEvents();
    syncLockoutTimer();
  }

  function syncLockoutTimer() {
    const lockoutUntil = authState.getState().lockoutUntil;
    if (lockoutUntil && lockoutUntil > Date.now()) {
      if (activeLockoutUntil !== lockoutUntil) {
        if (lockoutTimer !== null) window.clearInterval(lockoutTimer);
        activeLockoutUntil = lockoutUntil;
        lockoutTimer = window.setInterval(() => {
          if (authState.getState().lockoutUntil !== activeLockoutUntil) {
            syncLockoutTimer();
            return;
          }
          const remainingSeconds = Math.ceil((activeLockoutUntil - Date.now()) / 1000);
          const countdown = container.querySelector('#login-lockout-countdown');
          if (remainingSeconds <= 0) {
            window.clearInterval(lockoutTimer);
            lockoutTimer = null;
            activeLockoutUntil = null;
            sessionStorage.removeItem('dnkn_login_lockout');
            authState.setState({ lockoutUntil: null, lockoutEmail: null, error: null });
          } else if (countdown) {
            countdown.textContent = `Có thể thử lại sau ${formatRemainingTime(remainingSeconds)}`;
          }
        }, 1000);
      }
      return;
    }

    if (lockoutTimer !== null) {
      window.clearInterval(lockoutTimer);
      lockoutTimer = null;
    }
    activeLockoutUntil = null;
  }

  function bindEvents() {
    const form = container.querySelector('#dnkn-login-form');
    const emailInput = container.querySelector('#login-email');
    const passwordInput = container.querySelector('#login-password');
    const togglePasswordBtn = container.querySelector('#btn-toggle-password');
    const rememberMeChk = container.querySelector('#chk-remember-me');
    const closeAlertBtn = container.querySelector('#btn-close-alert');

    // Cập nhật giá trị form vào biến tạm khi người dùng gõ
    if (emailInput) {
      emailInput.addEventListener('input', (e) => {
        formValues.email = e.target.value;
        const isThisEmailLocked = authState.getState().lockoutUntil > Date.now()
          && formValues.email.trim().toLowerCase() === authState.getState().lockoutEmail;
        const unavailable = isThisEmailLocked
          || authState.getState().isSubmitting
          || authState.getState().isLoading;
        if (passwordInput) passwordInput.disabled = unavailable;
        if (rememberMeChk) rememberMeChk.disabled = unavailable;
        const submitButton = container.querySelector('#btn-login-submit');
        if (submitButton) submitButton.disabled = unavailable;
      });
      // Realtime validation onBlur
      emailInput.addEventListener('blur', () => {
        const valRes = validateEmail(formValues.email);
        if (!valRes.isValid && formValues.email.length > 0) {
          authState.setFieldError('email', valRes.error);
        } else if (valRes.isValid) {
          authState.setFieldError('email', null);
        }
      });
    }

    if (passwordInput) {
      passwordInput.addEventListener('input', (e) => {
        formValues.password = e.target.value;
      });
      // Realtime validation onBlur
      passwordInput.addEventListener('blur', () => {
        const valRes = validatePassword(formValues.password);
        if (!valRes.isValid && formValues.password.length > 0) {
          authState.setFieldError('password', valRes.error);
        } else if (valRes.isValid) {
          authState.setFieldError('password', null);
        }
      });
    }

    if (rememberMeChk) {
      rememberMeChk.addEventListener('change', (e) => {
        formValues.rememberMe = e.target.checked;
      });
    }

    // Toggle ẩn/hiện mật khẩu
    if (togglePasswordBtn) {
      togglePasswordBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isPasswordVisible = !isPasswordVisible;
        if (passwordInput) {
          passwordInput.type = isPasswordVisible ? 'text' : 'password';
        }
        update();
      });
    }

    // Đóng alert lỗi
    if (closeAlertBtn) {
      closeAlertBtn.addEventListener('click', () => {
        authState.clearErrors();
      });
    }

    // Xử lý gửi form đăng nhập
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await authState.handleLogin({
          email: formValues.email,
          password: formValues.password,
          rememberMe: formValues.rememberMe
        });
      });
    }

  }

  // Đăng ký theo dõi authState để tự render lại khi state thay đổi
  const unsubscribe = authState.subscribe(() => {
    // Chỉ render login form nếu chưa authenticate
    const state = authState.getState();
    if (!state.isAuthenticated) {
      update();
    }
  });

  return () => {
    unsubscribe();
    if (lockoutTimer !== null) {
      window.clearInterval(lockoutTimer);
      lockoutTimer = null;
      activeLockoutUntil = null;
    }
  };
}

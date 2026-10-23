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
      <div class="edu-shell">
        <header class="edu-topbar">
          <div class="edu-brand" aria-label="EduClass Manager">
            <div class="edu-brand-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <rect x="3" y="11" width="18" height="10" rx="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <div class="edu-brand-text">
              <span class="edu-brand-name">EduClass</span>
              <span class="edu-brand-role">Manager</span>
            </div>
          </div>

          <button type="button" class="edu-support-btn" aria-label="Trung tâm hỗ trợ">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M12 8h.01"></path>
              <path d="M11 12h1v4h1"></path>
            </svg>
            Trung tâm hỗ trợ
          </button>
        </header>

        <main class="edu-login-layout">
          <section class="edu-feature-panel">
            <div class="feature-copy">
              <span class="feature-caption">QUẢN TRỊ &amp; BẢO MẬT LỚP HỌC</span>
              <h1>Quản lý tập trung.<br> Kết nối lớp học.</h1>
              <p>Một hệ thống quản lý quy trình học tập, điểm danh, tài khoản và phân quyền được kiểm soát rõ ràng từ một giao diện duy nhất.</p>
            </div>

            <ul class="feature-list">
              <li class="feature-item">
                <span class="feature-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 8h10v10H7z"></path><path d="M9 5h6v3H9z"></path></svg></span>
                <div>
                  <strong>Khóa học</strong>
                  <small>Quản lý lớp học và lịch trình</small>
                </div>
              </li>
              <li class="feature-item">
                <span class="feature-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21a8 8 0 0 0-16 0"></path><circle cx="12" cy="7" r="4"></circle></svg></span>
                <div>
                  <strong>Quản lý người dùng</strong>
                  <small>Phân quyền rõ ràng, kiểm soát truy cập</small>
                </div>
              </li>
              <li class="feature-item">
                <span class="feature-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 3v4"></path><path d="M17 3v4"></path><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18"></path></svg></span>
                <div>
                  <strong>Điểm danh</strong>
                  <small>Theo dõi sự hiện diện theo từng lớp</small>
                </div>
              </li>
              <li class="feature-item">
                <span class="feature-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18"></path><path d="M12 3v18"></path><circle cx="12" cy="12" r="9"></circle></svg></span>
                <div>
                  <strong>Bàn giao lớp</strong>
                  <small>Đổi lịch, phân công, đồng bộ nhanh chóng</small>
                </div>
              </li>
            </ul>

            <div class="feature-footnote">
              <span class="tiny-check">✓</span>
              Truy cập an toàn theo vai trò được cấp phép.
            </div>
          </section>

          <section class="edu-form-panel glass-panel login-card">
            <div class="card-header">
              <span class="login-eyebrow">ĐĂNG NHẬP HỆ THỐNG</span>
              <h1 class="card-title">Chào mừng trở lại!</h1>
              <p class="card-subtitle">Đăng nhập vào EduClass Manager bằng tài khoản được cấp quyền.</p>
            </div>

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

            <form id="dnkn-login-form" novalidate>
              <div class="form-group ${state.fieldErrors.email ? 'has-error' : ''}">
                <label for="login-email" class="form-label">Địa chỉ Email</label>
                <div class="input-container">
                  <span class="input-icon" aria-hidden="true">
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
                    placeholder="Nhập email của bạn" 
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

              <div class="form-group ${state.fieldErrors.password ? 'has-error' : ''}">
                <label for="login-password" class="form-label">Mật khẩu</label>
                <div class="input-container">
                  <span class="input-icon" aria-hidden="true">
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
                    placeholder="Nhập mật khẩu" 
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

              <div class="form-check-group">
                <label class="custom-checkbox">
                  <input 
                    type="checkbox" 
                    id="chk-remember-me" 
                    ${formValues.rememberMe ? 'checked' : ''}
                    ${state.isSubmitting || state.isLoading || isLocked ? 'disabled' : ''}
                  />
                  <span class="checkmark"></span>
                  <span class="label-text">Ghi nhớ đăng nhập</span>
                </label>
                <a href="/forgot-password.html" class="forgot-link" id="link-forgot-password">Quên mật khẩu?</a>
              </div>

              <button 
                type="submit" 
                class="btn-submit ${state.isSubmitting || state.isLoading ? 'btn-loading' : ''}"
                id="btn-login-submit"
                ${state.isSubmitting || state.isLoading || isLocked ? 'disabled' : ''}
              >
                ${state.isLoading && !state.isSubmitting ? `
                  <span class="spinner-icon"></span>
                  <span>Đang kiểm tra phiên...</span>
                ` : state.isSubmitting ? `
                  <span class="spinner-icon"></span>
                  <span>Đang xác thực...</span>
                ` : `
                  <span>Đăng nhập</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                `}
              </button>
            </form>

            <div class="support-note">
              <span class="info-mark">i</span>
              <span>Bạn chưa có tài khoản? <a href="#">Liên hệ quản trị để được cấp quyền.</a></span>
            </div>
          </section>
        </main>

        <footer class="edu-footer">
          <span>© 2026 EduClass Manager. Hệ thống quản lý lớp học.</span>
          <div class="footer-meta">
            <span>Chính sách bảo mật</span>
            <span>Điều khoản sử dụng</span>
          </div>
        </footer>
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

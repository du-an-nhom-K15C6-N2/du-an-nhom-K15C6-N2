/**
 * Component: Màn hình Xem và Form Cập nhật Hồ sơ cá nhân
 * 
 * Đáp ứng các yêu cầu:
 * [FE] Xây dựng màn hình xem hồ sơ cá nhân: họ tên, email, vai trò, số điện thoại, ngày sinh, địa chỉ
 * [FE] Xây dựng form cập nhật hồ sơ cá nhân: cho phép sửa họ tên, SĐT, ngày sinh, địa chỉ; giữ email và vai trò chỉ đọc (readonly)
 * [FE] Kiểm tra và hiển thị lỗi định dạng số điện thoại Việt Nam trước khi gửi lên máy chủ
 */

import './UserProfilePanel.css';
import { authState } from '../core/authState.js';
import { getAuthSession, saveAuthSession, STORAGE_KEYS } from '../core/storage.js';
import {
  getProfileApi,
  updateProfileApi,
  uploadAvatarApi,
  formatDisplayDate
} from '../core/profileService.js';
import { validateVietnamesePhone, validateProfileForm } from '../core/validation.js';
import { cropAvatar } from '../core/avatarCrop.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);

export function renderUserProfilePanel(container) {
  let isEditing = false;
  let isLoading = false;
  let feedback = { type: null, message: '' };
  let currentUserData = null;

  // Lấy ngày hiện tại dạng YYYY-MM-DD làm max date cho ngày sinh
  const todayIso = new Date().toISOString().split('T')[0];

  function getAvatarInitials(name, email) {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.trim().slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return 'ND';
  }

  async function loadProfile() {
    isLoading = true;
    render();
    try {
      const session = getAuthSession();
      const token = session.token || authState.getState().token;
      const profile = await getProfileApi(token);
      currentUserData = profile;
      // Đồng bộ thông tin mới vào authState nếu có thay đổi
      authState.setState({ user: profile });
    } catch (error) {
      feedback = {
        type: 'error',
        message: error.message || 'Không thể tải thông tin hồ sơ từ máy chủ.'
      };
    } finally {
      isLoading = false;
      render();
    }
  }

  function render() {
    const state = authState.getState();
    const session = getAuthSession();
    const user = currentUserData || state.user || session.user || {};

    const displayName = user.name || user.fullName || (user.email ? user.email.split('@')[0] : 'Người dùng');
    const roleLabel = user.roleLabel || (Array.isArray(user.roleLabels) ? user.roleLabels.join(', ') : (user.role || 'Người dùng'));
    const initials = getAvatarInitials(displayName, user.email);
    const dobFormatted = formatDisplayDate(user.dateOfBirth || user.dob);

    container.innerHTML = `
   
      <section class="user-profile-panel">
        <!-- Khối thông tin tiêu đề chung -->
        <div class="profile-card">  
          <div class="profile-header-banner">
            <div class="profile-user-summary">
             <div class="profile-avatar-wrapper">
  <div class="profile-avatar-large" id="dnkn87-current-avatar">
    ${user.avatar
        ? `<img src="${escapeHtml(user.avatar)}" alt="Ảnh đại diện"
          style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : escapeHtml(initials)}
  </div>

  <button type="button" id="dnkn87-change-avatar-btn"
    class="btn btn-primary">
    Đổi ảnh đại diện
  </button>

  <input
  type="file"
  id="dnkn87-avatar-input"
  accept="image/jpeg,image/png"
  style="display:none;"
>

</div>
              <div class="profile-user-info">
                <h2>${escapeHtml(displayName)}</h2>
                <div class="profile-user-badges">
                  <span class="badge-role">${escapeHtml(roleLabel)}</span>
                  <span class="badge-status is-active">● ${escapeHtml(user.statusLabel || 'Đang hoạt động')}</span>
                </div>
              </div>
            </div>
            <div class="profile-header-actions">
              ${!isEditing ? `
                <button type="button" class="btn-profile-secondary" id="btn-refresh-profile" title="Tải lại thông tin mới nhất">
                  <span>🔄</span> Làm mới
                </button>
                <button type="button" class="btn-profile-primary" id="btn-start-edit">
                  <span>✏️</span> Chỉnh sửa hồ sơ
                </button>
              ` : `
                <button type="button" class="btn-profile-secondary" id="btn-cancel-edit">
                  <span>✕</span> Hủy chỉnh sửa
                </button>
              `}
            </div>
          </div>

          <!-- Thông báo phản hồi -->
          ${feedback.message ? `
            <div class="profile-alert is-${feedback.type}" role="status" aria-live="polite">
              <span>${feedback.type === 'success' ? '✓' : '⚠️'}</span>
              <div>${escapeHtml(feedback.message)}</div>
            </div>
          ` : ''}

          <!-- Chế độ 1: MÀN HÌNH XEM HỒ SƠ CÁ NHÂN -->
          ${!isEditing ? `
            <div class="profile-info-grid">
              <div class="profile-info-item">
                <span class="profile-info-label">
                  Họ và tên
                </span>
                <span class="profile-info-value">${escapeHtml(user.name || user.fullName || '-')}</span>
              </div>

              <div class="profile-info-item">
                <span class="profile-info-label">
                  Địa chỉ Email
                  <span class="badge-readonly" title="Email do quản trị viên cấp, người dùng không thể tự thay đổi">🔒 Chỉ đọc</span>
                </span>
                <span class="profile-info-value">${escapeHtml(user.email || '-')}</span>
                <span class="profile-info-note">Email dùng để đăng nhập và nhận thông báo chính thức</span>
              </div>

              <div class="profile-info-item">
                <span class="profile-info-label">
                  Vai trò hệ thống
                  <span class="badge-readonly" title="Vai trò do ban quản trị phân quyền">🔒 Chỉ đọc</span>
                </span>
                <span class="profile-info-value">${escapeHtml(roleLabel)}</span>
                <span class="profile-info-note">Quyền hạn truy cập các chức năng trong hệ thống</span>
              </div>

              <div class="profile-info-item">
                <span class="profile-info-label">Số điện thoại liên lạc</span>
                <span class="profile-info-value ${!user.phone ? 'is-empty' : ''}">
                  ${user.phone ? escapeHtml(user.phone) : 'Chưa cập nhật số điện thoại'}
                </span>
                <span class="profile-info-note">Dùng để trung tâm liên hệ khi cần thông báo gấp</span>
              </div>

              <div class="profile-info-item">
                <span class="profile-info-label">Ngày sinh</span>
                <span class="profile-info-value ${!dobFormatted || dobFormatted === '-' ? 'is-empty' : ''}">
                  ${dobFormatted && dobFormatted !== '-' ? escapeHtml(dobFormatted) : 'Chưa cập nhật ngày sinh'}
                </span>
              </div>

              <div class="profile-info-item">
                <span class="profile-info-label">Địa chỉ liên hệ</span>
                <span class="profile-info-value ${!user.address ? 'is-empty' : ''}">
                  ${user.address ? escapeHtml(user.address) : 'Chưa cập nhật địa chỉ'}
                </span>
              </div>
            </div>
          ` : `
            <!-- Chế độ 2: FORM CẬP NHẬT HỒ SƠ CÁ NHÂN -->
            <form id="profile-edit-form" class="profile-form" novalidate>
              <div class="profile-form-grid">
                <!-- Họ và tên (Cho phép sửa) -->
                <div class="profile-form-group">
                  <label class="profile-form-label" for="profile-input-name">
                    Họ và tên <span class="required">*</span>
                  </label>
                  <input
                    class="profile-form-input"
                    type="text"
                    id="profile-input-name"
                    name="name"
                    value="${escapeHtml(user.name || user.fullName || '')}"
                    placeholder="Nhập họ và tên đầy đủ"
                    required
                    maxlength="120"
                  />
                  <span class="profile-field-error" id="error-profile-name"></span>
                </div>

                <!-- Số điện thoại (Cho phép sửa + Ràng buộc kiểm tra định dạng Việt Nam) -->
                <div class="profile-form-group">
                  <label class="profile-form-label" for="profile-input-phone">
                    Số điện thoại Việt Nam <span class="required">*</span>
                  </label>
                  <input
                    class="profile-form-input"
                    type="tel"
                    id="profile-input-phone"
                    name="phone"
                    value="${escapeHtml(user.phone || '')}"
                    placeholder="Ví dụ: 0912 345 678 hoặc +84912345678"
                    required
                  />
                  <span class="profile-field-hint">Bao gồm 10 chữ số di động (đầu số 03, 05, 07, 08, 09)</span>
                  <span class="profile-field-error" id="error-profile-phone"></span>
                </div>

                <!-- Email (Chỉ đọc - Khóa sửa) -->
                <div class="profile-form-group">
                  <label class="profile-form-label" for="profile-input-email">
                    Địa chỉ Email
                    <span class="badge-readonly">🔒 Không thể đổi</span>
                  </label>
                  <input
                    class="profile-form-input"
                    type="email"
                    id="profile-input-email"
                    name="email"
                    value="${escapeHtml(user.email || '')}"
                    readonly
                    disabled
                  />
                  <span class="profile-field-hint">Địa chỉ email do quản trị viên cấp, không thể tự thay đổi.</span>
                </div>

                <!-- Vai trò (Chỉ đọc - Khóa sửa) -->
                <div class="profile-form-group">
                  <label class="profile-form-label" for="profile-input-role">
                    Vai trò tài khoản
                    <span class="badge-readonly">🔒 Không thể đổi</span>
                  </label>
                  <input
                    class="profile-form-input"
                    type="text"
                    id="profile-input-role"
                    name="role"
                    value="${escapeHtml(roleLabel)}"
                    readonly
                    disabled
                  />
                  <span class="profile-field-hint">Vai trò và quyền hạn được phân quyền bởi quản trị viên hệ thống.</span>
                </div>

                <!-- Ngày sinh (Cho phép sửa) -->
                <div class="profile-form-group">
                  <label class="profile-form-label" for="profile-input-dob">
                    Ngày sinh
                  </label>
                  <input
                    class="profile-form-input"
                    type="date"
                    id="profile-input-dob"
                    name="dateOfBirth"
                    value="${escapeHtml(user.dateOfBirth || user.dob || '')}"
                    max="${todayIso}"
                    min="1900-01-01"
                  />
                  <span class="profile-field-hint">Định dạng YYYY-MM-DD. Không được chọn ngày trong tương lai.</span>
                  <span class="profile-field-error" id="error-profile-dateOfBirth"></span>
                </div>

                <!-- Địa chỉ (Cho phép sửa) -->
                <div class="profile-form-group is-fullwidth">
                  <label class="profile-form-label" for="profile-input-address">
                    Địa chỉ liên hệ
                  </label>
                  <textarea
                    class="profile-form-textarea"
                    id="profile-input-address"
                    name="address"
                    placeholder="Nhập địa chỉ liên hệ của bạn (Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố...)"
                    maxlength="255"
                  >${escapeHtml(user.address || '')}</textarea>
                  <span class="profile-field-hint">Tối đa 255 ký tự để trung tâm gửi tài liệu hoặc liên lạc khi cần</span>
                  <span class="profile-field-error" id="error-profile-address"></span>
                </div>
              </div>

              <!-- Nút hành động của Form -->
              <div class="profile-form-actions">
                <button type="button" class="btn-profile-secondary" id="btn-cancel-form">
                  Hủy bỏ
                </button>
                <button type="submit" class="btn-profile-primary" id="btn-submit-profile">
                  <span>💾</span> Lưu thông tin hồ sơ
                </button>
              </div>
            </form>
          `}
        </div>
      </section>
    `;

    const changeAvatarBtn = container.querySelector('#dnkn87-change-avatar-btn');
    const avatarInput = container.querySelector('#dnkn87-avatar-input');

    if (changeAvatarBtn && avatarInput) {
      changeAvatarBtn.addEventListener('click', () => {
        avatarInput.click();
      });

      avatarInput.addEventListener('change', async () => {
        const file = avatarInput.files?.[0];
        if (!file) return;

        if (!['image/jpeg', 'image/png'].includes(file.type)) {
          alert('Chỉ chấp nhận ảnh JPG hoặc PNG.');
          avatarInput.value = '';
          return;
        }

        if (file.size > 2 * 1024 * 1024) {
          alert('Ảnh không được vượt quá 2 MB.');
          avatarInput.value = '';
          return;
        }

        const session = getAuthSession();
        const token = session.token || authState.getState().token;

        if (!token) {
          alert('Vui lòng đăng nhập để đổi ảnh đại diện.');
          avatarInput.value = '';
          return;
        }

        let croppedFile;

        try {
          croppedFile = await cropAvatar(file);
        } catch (error) {
          alert(error.message || 'Không thể cắt ảnh.');
          avatarInput.value = '';
          return;
        }

        if (!croppedFile) {
          avatarInput.value = '';
          return;
        }

        if (!confirm('Bạn có muốn lưu ảnh đại diện đã cắt không?')) {
          avatarInput.value = '';
          return;
        }

        changeAvatarBtn.disabled = true;

        try {
          const result = await uploadAvatarApi(token, croppedFile);

          const updatedUser = result?.user || {
            ...(currentUserData || authState.getState().user || {}),
            avatar: result?.avatar
          };

          currentUserData = updatedUser;
          authState.setState({ user: updatedUser });

          render();
          alert('Đổi ảnh đại diện thành công!');
        } catch (error) {
          alert(error.message || 'Không thể đổi ảnh đại diện.');
        } finally {
          changeAvatarBtn.disabled = false;
          avatarInput.value = '';
        }
      });
    }

    bindEvents();
  }

  function bindEvents() {
    // 1. Chuyển sang chế độ chỉnh sửa
    const startEditBtn = container.querySelector('#btn-start-edit');
    if (startEditBtn) {
      startEditBtn.addEventListener('click', () => {
        isEditing = true;
        feedback = { type: null, message: '' };
        render();
      });
    }

    // 2. Hủy chỉnh sửa
    const cancelEditBtn = container.querySelector('#btn-cancel-edit') || container.querySelector('#btn-cancel-form');
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener('click', () => {
        isEditing = false;
        feedback = { type: null, message: '' };
        render();
      });
    }

    // 3. Làm mới dữ liệu từ server
    const refreshBtn = container.querySelector('#btn-refresh-profile');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        feedback = { type: null, message: '' };
        loadProfile();
      });
    }

    // 4. Form xử lý cập nhật
    const form = container.querySelector('#profile-edit-form');
    if (form) {
      const nameInput = form.querySelector('#profile-input-name');
      const phoneInput = form.querySelector('#profile-input-phone');
      const dobInput = form.querySelector('#profile-input-dob');
      const addressInput = form.querySelector('#profile-input-address');

      const nameError = form.querySelector('#error-profile-name');
      const phoneError = form.querySelector('#error-profile-phone');
      const dobError = form.querySelector('#error-profile-dateOfBirth');
      const addressError = form.querySelector('#error-profile-address');

      // [FE] Kiểm tra realtime định dạng SĐT Việt Nam khi rời trường (blur) hoặc gõ phím
      phoneInput?.addEventListener('blur', () => {
        const phoneVal = phoneInput.value.trim();
        if (phoneVal) {
          const result = validateVietnamesePhone(phoneVal);
          if (!result.isValid) {
            phoneError.textContent = result.error;
            phoneInput.classList.add('is-invalid');
          } else {
            phoneError.textContent = '';
            phoneInput.classList.remove('is-invalid');
          }
        } else {
          phoneError.textContent = 'Vui lòng nhập số điện thoại.';
          phoneInput.classList.add('is-invalid');
        }
      });

      phoneInput?.addEventListener('input', () => {
        if (phoneInput.classList.contains('is-invalid')) {
          const result = validateVietnamesePhone(phoneInput.value.trim());
          if (result.isValid) {
            phoneError.textContent = '';
            phoneInput.classList.remove('is-invalid');
          }
        }
      });

      nameInput?.addEventListener('input', () => {
        if (nameInput.value.trim().length >= 2) {
          nameError.textContent = '';
          nameInput.classList.remove('is-invalid');
        }
      });

      // Submit Form
      form.addEventListener('submit', async (event) => {
        event.preventDefault();

        // Thu thập dữ liệu
        const formData = {
          name: nameInput?.value.trim() || '',
          phone: phoneInput?.value.trim() || '',
          dateOfBirth: dobInput?.value.trim() || '',
          address: addressInput?.value.trim() || ''
        };

        // Reset errors
        nameError.textContent = '';
        phoneError.textContent = '';
        dobError.textContent = '';
        addressError.textContent = '';
        [nameInput, phoneInput, dobInput, addressInput].forEach(el => el?.classList.remove('is-invalid'));

        // [FE] Kiểm tra dữ liệu trước khi gửi lên máy chủ
        const validation = validateProfileForm(formData);
        if (!validation.isValid) {
          if (validation.errors.name) {
            nameError.textContent = validation.errors.name;
            nameInput.classList.add('is-invalid');
          }
          if (validation.errors.phone) {
            phoneError.textContent = validation.errors.phone;
            phoneInput.classList.add('is-invalid');
          }
          if (validation.errors.dateOfBirth) {
            dobError.textContent = validation.errors.dateOfBirth;
            dobInput.classList.add('is-invalid');
          }
          if (validation.errors.address) {
            addressError.textContent = validation.errors.address;
            addressInput.classList.add('is-invalid');
          }
          return;
        }

        const submitBtn = form.querySelector('#btn-submit-profile');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>⏳</span> Đang lưu...';
        }

        try {
          const session = getAuthSession();
          const token = session.token || authState.getState().token;
          const updatedProfile = await updateProfileApi(token, formData);

          currentUserData = updatedProfile;

          // Cập nhật lại session lưu trữ và authState
          const rememberMe = Boolean(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN));
          saveAuthSession({ token, user: updatedProfile, rememberMe });
          authState.setState({ user: updatedProfile });

          // Cập nhật hiển thị trên navbar nếu có
          const navUserName = document.querySelector('.user-name');
          if (navUserName) navUserName.textContent = updatedProfile.name;
          const sidebarUserName = document.querySelector('.sidebar-user strong');
          if (sidebarUserName) sidebarUserName.textContent = updatedProfile.name;

          feedback = {
            type: 'success',
            message: 'Cập nhật hồ sơ cá nhân thành công! Thông tin liên lạc của bạn đã được lưu trữ an toàn.'
          };
          isEditing = false;
          render();
        } catch (error) {
          feedback = {
            type: 'error',
            message: error.message || 'Cập nhật hồ sơ thất bại. Vui lòng kiểm tra lại thông tin.'
          };
          render();
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>💾</span> Lưu thông tin hồ sơ';
          }
        }
      });
    }
  }

  // Khởi động nạp thông tin hồ sơ ban đầu
  loadProfile();
}

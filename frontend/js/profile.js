/**
 * profile.js - Logic điều khiển Màn hình Xem và Form Cập Nhật Hồ Sơ Cá Nhân
 * Đồ án TTCS - Subtask DNKN-86
 */

(function () {
  'use strict';

  const STORAGE_KEYS = {
    ACCESS_TOKEN: 'educlass_access_token',
    CURRENT_USER: 'educlass_current_authenticated_user',
    REMEMBER_ME: 'educlass_remember_me',
    THEME: 'educlass_ui_theme'
  };

  let currentUserData = null;

  // Lấy Auth Token từ LocalStorage hoặc SessionStorage
  function getAuthToken() {
    return localStorage.getItem('dnkn_auth_token')
      || sessionStorage.getItem('dnkn_auth_token')
      || localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
      || sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  function getStoredUser() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER)
        || sessionStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveStoredUser(user) {
    const isRemember = localStorage.getItem(STORAGE_KEYS.REMEMBER_ME) === 'true';
    const target = isRemember ? localStorage : (sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) ? sessionStorage : localStorage);
    target.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  }

  // Toast Notification
  function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} slide-in`;

    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || 'ℹ'}</div>
      <div class="toast-content">
        <span class="toast-title">${type === 'success' ? 'Thành công' : type === 'error' ? 'Có lỗi xảy ra' : 'Thông báo'}</span>
        <span class="toast-msg">${message}</span>
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()" aria-label="Đóng">&times;</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // Khởi tạo Theme
  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
    document.documentElement.setAttribute('data-theme', saved);

    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem(STORAGE_KEYS.THEME, next);
      });
    }
  }

  // ====================================================================
  // [FE] XÁC THỰC VÀ CHUẨN HÓA SỐ ĐIỆN THOẠI VIỆT NAM TRÊN GIAO DIỆN
  // ====================================================================
  function normalizePhone(phone) {
    if (!phone || typeof phone !== 'string') return '';
    let cleaned = phone.trim().replace(/[\s.\-()]/g, '');
    if (cleaned.startsWith('+84')) {
      cleaned = '0' + cleaned.slice(3);
    } else if (cleaned.startsWith('84') && cleaned.length === 11) {
      cleaned = '0' + cleaned.slice(2);
    }
    return cleaned;
  }

  function isValidVietnamPhone(phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) return false;
    // 10 chữ số, các đầu số di động: 03, 05, 07, 08, 09
    return /^0[35789]\d{8}$/.test(normalized);
  }

  // Format ngày sinh hiển thị dạng DD/MM/YYYY
  function formatDateDisplay(dateStr) {
    if (!dateStr) return 'Chưa cập nhật';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch (e) {
      return dateStr;
    }
  }

  // Lấy avatar chữ cái viết tắt
  function getInitials(name) {
    if (!name) return 'US';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  // ====================================================================
  // API CLIENT
  // ====================================================================
  async function fetchProfileApi() {
    const token = getAuthToken();
    if (!token) {
      window.location.href = '/login.html';
      return null;
    }

    try {
      const res = await fetch('/api/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.status === 401) {
        showToast('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.', 'error');
        setTimeout(() => { window.location.href = '/login.html'; }, 1500);
        return null;
      }

      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
      return null;
    } catch (err) {
      console.warn('Không thể kết nối API /api/profile, sử dụng dữ liệu cục bộ:', err);
      return getStoredUser();
    }
  }

  async function updateProfileApi(payload) {
    const token = getAuthToken();
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    return { ok: res.ok, status: res.status, data: json };
  }

  // ====================================================================
  // UI RENDERERS
  // ====================================================================
  function renderViewMode(user) {
    if (!user) return;

    currentUserData = user;

    // Header Meta
    const initials = getInitials(user.fullName || user.name);

    const avatarEl = document.getElementById('page-avatar');
    const navAvatarEl = document.getElementById('nav-user-avatar');

    // DNKN-116: Hiển thị lại ảnh đại diện đã lưu
    function displayAvatar(element, imageUrl) {
      if (!element) return;

      element.textContent = '';

      if (imageUrl) {
        const img = document.createElement('img');

        img.src = imageUrl;
        img.alt = 'Ảnh đại diện';

        img.style.cssText =
          'width:100%;height:100%;object-fit:cover;border-radius:50%;';

        img.onerror = () => {
          element.textContent = initials;
        };

        element.appendChild(img);
      } else {
        element.textContent = initials;
      }
    }

    displayAvatar(avatarEl, user.avatar);
    displayAvatar(navAvatarEl, user.avatarThumbnail || user.avatar);

    const displayName = user.fullName || user.name || 'Người dùng';
    const fullnameEl = document.getElementById('page-fullname');
    if (fullnameEl) fullnameEl.textContent = displayName;
    const navNameEl = document.getElementById('nav-user-name');
    if (navNameEl) navNameEl.textContent = displayName;

    const roleName = user.roleLabel || user.role || 'Người dùng';
    const roleBadgeEl = document.getElementById('page-role-badge');
    if (roleBadgeEl) roleBadgeEl.textContent = roleName;
    const navRoleEl = document.getElementById('nav-role-badge');
    if (navRoleEl) navRoleEl.textContent = roleName;

    const emailEl = document.getElementById('page-email');
    if (emailEl) emailEl.textContent = user.email || '';

    // Chi tiết Grid
    const vName = document.getElementById('view-fullname');
    if (vName) vName.textContent = displayName;

    const vEmail = document.getElementById('view-email');
    if (vEmail) vEmail.textContent = user.email || 'Chưa cập nhật';

    const vRole = document.getElementById('view-role');
    if (vRole) vRole.textContent = `${roleName} (${user.role || 'user'})`;

    const vPhone = document.getElementById('view-phone');
    if (vPhone) vPhone.textContent = user.phone || 'Chưa cập nhật';

    const vDob = document.getElementById('view-dob');
    if (vDob) vDob.textContent = formatDateDisplay(user.dob);

    const vAddress = document.getElementById('view-address');
    if (vAddress) vAddress.textContent = user.address || 'Chưa cập nhật';

    // Cập nhật lại form input sẵn sàng
    prefillEditForm(user);
  }

  function prefillEditForm(user) {
    if (!user) return;

    const editName = document.getElementById('edit-name');
    if (editName) editName.value = user.fullName || user.name || '';

    // Email và Vai trò CHỈ ĐỌC
    const editEmail = document.getElementById('edit-email');
    if (editEmail) editEmail.value = user.email || '';

    const editRole = document.getElementById('edit-role');
    if (editRole) editRole.value = `${user.roleLabel || user.role} (Cố định)`;

    const editPhone = document.getElementById('edit-phone');
    if (editPhone) {
      editPhone.value = user.phone || '';
      validatePhoneUI(editPhone);
    }

    const editDob = document.getElementById('edit-dob');
    if (editDob) editDob.value = user.dob || '';

    const editAddress = document.getElementById('edit-address');
    if (editAddress) editAddress.value = user.address || '';

    // Reset các thông báo lỗi
    clearFormErrors();
  }

  function clearFormErrors() {
    ['edit-name-error', 'edit-phone-error', 'edit-dob-error'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
    const gen = document.getElementById('edit-general-error');
    if (gen) {
      gen.textContent = '';
      gen.style.display = 'none';
    }
  }

  // ====================================================================
  // [FE] VALIDATION REAL-TIME SỐ ĐIỆN THOẠI VIỆT NAM
  // ====================================================================
  function validatePhoneUI(input) {
    const errorEl = document.getElementById('edit-phone-error');
    const hintEl = document.getElementById('edit-phone-hint');
    const checkIcon = document.getElementById('edit-phone-check-icon');

    const value = input.value.trim();

    if (!value) {
      input.classList.remove('input-valid', 'input-invalid');
      if (errorEl) errorEl.textContent = 'Số điện thoại không được để trống.';
      if (checkIcon) checkIcon.style.display = 'none';
      if (hintEl) hintEl.style.display = 'none';
      return false;
    }

    if (!isValidVietnamPhone(value)) {
      input.classList.remove('input-valid');
      input.classList.add('input-invalid');
      if (errorEl) errorEl.textContent = 'Số điện thoại không đúng định dạng Việt Nam (10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09).';
      if (checkIcon) checkIcon.style.display = 'none';
      if (hintEl) hintEl.style.display = 'none';
      return false;
    }

    // Hợp lệ
    input.classList.remove('input-invalid');
    input.classList.add('input-valid');
    if (errorEl) errorEl.textContent = '';
    if (checkIcon) checkIcon.style.display = 'inline-block';
    if (hintEl) {
      hintEl.style.display = 'block';
      hintEl.textContent = `✓ Định dạng hợp lệ. Chuẩn hóa: ${normalizePhone(value)}`;
    }
    return true;
  }

  // ====================================================================
  // CONTROLLER ACTIONS
  // ====================================================================
  const profileApp = {
    init: async function () {
      initTheme();

      const user = await fetchProfileApi();
      if (user) {
        renderViewMode(user);
      }
    },

    toggleEditMode: function (forceState) {
      const viewSection = document.getElementById('section-view-profile');
      const editSection = document.getElementById('section-edit-profile');
      const btnToggle = document.getElementById('btn-toggle-edit-text');

      const isCurrentlyViewing = viewSection.style.display !== 'none';
      const shouldEdit = typeof forceState === 'boolean' ? forceState : isCurrentlyViewing;

      if (shouldEdit) {
        viewSection.style.display = 'none';
        editSection.style.display = 'block';
        if (btnToggle) btnToggle.textContent = 'Hủy Chỉnh Sửa';
        if (currentUserData) prefillEditForm(currentUserData);
      } else {
        viewSection.style.display = 'block';
        editSection.style.display = 'none';
        if (btnToggle) btnToggle.textContent = 'Chỉnh Sửa Hồ Sơ';
      }
    },

    handlePhoneInput: function (input) {
      validatePhoneUI(input);
    },

    handlePhoneBlur: function (input) {
      validatePhoneUI(input);
    },

    handleSubmit: async function (event) {
      event.preventDefault();
      clearFormErrors();

      const form = document.getElementById('profile-edit-form');
      const nameInput = document.getElementById('edit-name');
      const phoneInput = document.getElementById('edit-phone');
      const dobInput = document.getElementById('edit-dob');
      const addressInput = document.getElementById('edit-address');

      let hasError = false;

      // 1. Kiểm tra họ và tên
      const nameVal = nameInput.value.trim();
      if (!nameVal) {
        const nameErr = document.getElementById('edit-name-error');
        if (nameErr) nameErr.textContent = 'Họ và tên không được để trống.';
        nameInput.classList.add('input-invalid');
        hasError = true;
      }

      // 2. [FE] Kiểm tra định dạng số điện thoại Việt Nam
      const isPhoneValid = validatePhoneUI(phoneInput);
      if (!isPhoneValid) {
        hasError = true;
      }

      // 3. Kiểm tra ngày sinh (nếu nhập không được trong tương lai)
      const dobVal = dobInput.value ? dobInput.value.trim() : '';
      if (dobVal) {
        const selectedDate = new Date(dobVal);
        if (isNaN(selectedDate.getTime())) {
          const dobErr = document.getElementById('edit-dob-error');
          if (dobErr) dobErr.textContent = 'Ngày sinh không hợp lệ.';
          hasError = true;
        } else if (selectedDate > new Date()) {
          const dobErr = document.getElementById('edit-dob-error');
          if (dobErr) dobErr.textContent = 'Ngày sinh không thể là ngày trong tương lai.';
          hasError = true;
        }
      }

      if (hasError) {
        showToast('Vui lòng kiểm tra lại các trường thông tin chưa hợp lệ.', 'warning');
        return;
      }

      // 4. Gửi yêu cầu cập nhật lên Backend
      const spinner = document.getElementById('btn-save-spinner');
      const btnLabel = document.getElementById('btn-save-label');
      const submitBtn = document.getElementById('btn-submit-save');

      if (spinner) spinner.style.display = 'inline-block';
      if (btnLabel) btnLabel.textContent = 'Đang lưu hồ sơ...';
      if (submitBtn) submitBtn.disabled = true;

      try {
        const payload = {
          name: nameVal,
          phone: phoneInput.value.trim(),
          dob: dobVal,
          address: addressInput.value ? addressInput.value.trim() : ''
        };

        const result = await updateProfileApi(payload);

        if (result.ok && result.data.success) {
          showToast('Cập nhật hồ sơ cá nhân thành công!', 'success');
          const updatedUser = result.data.data;

          // Cập nhật Storage
          saveStoredUser(updatedUser);

          // Cập nhật View
          renderViewMode(updatedUser);

          // Chuyển lại về chế độ xem
          profileApp.toggleEditMode(false);
        } else {
          const errorMsg = result.data.message || 'Lỗi khi cập nhật hồ sơ cá nhân.';
          const genErr = document.getElementById('edit-general-error');
          if (genErr) {
            genErr.textContent = errorMsg;
            genErr.style.display = 'block';
          }
          showToast(errorMsg, 'error');
        }
      } catch (err) {
        console.error('Lỗi khi gọi API cập nhật hồ sơ:', err);
        showToast('Lỗi kết nối máy chủ khi lưu hồ sơ.', 'error');
      } finally {
        if (spinner) spinner.style.display = 'none';
        if (btnLabel) btnLabel.textContent = 'Lưu Hồ Sơ Cá Nhân';
        if (submitBtn) submitBtn.disabled = false;
      }
    },

    logout: function () {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      sessionStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      showToast('Đã đăng xuất khỏi hệ thống.', 'info');
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 500);
    }
  };

  window.profileApp = profileApp;
  document.addEventListener('DOMContentLoaded', () => {
    profileApp.init();
  });
  // DNKN-112: Chọn và xem trước ảnh đại diện
  function initAvatarUpload() {
    const selectBtn = document.getElementById('avatar-select-btn');
    const fileInput = document.getElementById('avatar-file-input');
    const preview = document.getElementById('avatar-preview');
    const previewContainer = document.getElementById('avatar-preview-container');
    const status = document.getElementById('avatar-upload-status');
    const cropContainer = document.getElementById('avatar-crop-container');
    const cropImage = document.getElementById('avatar-crop-image');
    const cropBtn = document.getElementById('avatar-crop-btn');

    const saveBtn = document.getElementById('avatar-save-btn');
    let croppedBlob = null;

    if (!selectBtn || !fileInput || !preview || !previewContainer ||
      !status || !cropContainer || !cropImage || !cropBtn) return;

    let cropper = null;
    let imageUrl = null;

    selectBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;

      if (cropper) {
        cropper.destroy();
        cropper = null;
      }

      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        imageUrl = null;
      }

      cropContainer.style.display = 'none';
      previewContainer.style.display = 'none';

      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        status.textContent = 'Chỉ chấp nhận ảnh JPG hoặc PNG!';
        fileInput.value = '';
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        status.textContent = 'Ảnh không được vượt quá 2MB!';
        fileInput.value = '';
        return;
      }

      if (typeof Cropper === 'undefined') {
        status.textContent = 'Chưa tải được thư viện cắt ảnh.';
        return;
      }

      imageUrl = URL.createObjectURL(file);

      cropImage.onload = () => {
        cropContainer.style.display = 'block';

        cropper = new Cropper(cropImage, {
          aspectRatio: 1,
          viewMode: 1,
          dragMode: 'move',
          autoCropArea: 0.9,
          zoomable: true,
          movable: true,
          responsive: true
        });
      };

      cropImage.onerror = () => {
        status.textContent = 'Không thể đọc ảnh đã chọn.';
      };

      cropImage.src = imageUrl;
      status.textContent = 'Hãy điều chỉnh vùng cắt ảnh.';
    });

    cropBtn.addEventListener('click', () => {
      if (!cropper) return;

      const canvas = cropper.getCroppedCanvas({
        width: 300,
        height: 300,
        imageSmoothingQuality: 'high'
      });

      if (!canvas) {
        status.textContent = 'Không thể cắt ảnh.';
        return;
      }

      preview.src = canvas.toDataURL('image/png');
      previewContainer.style.display = 'block';
      cropContainer.style.display = 'none';
      // Chuẩn bị ảnh đã cắt để tải lên máy chủ
      croppedBlob = null;
      if (saveBtn) saveBtn.style.display = 'none';

      canvas.toBlob((blob) => {
        if (!blob) {
          status.textContent = 'Không thể tạo ảnh để lưu.';
          return;
        }

        croppedBlob = blob;

        if (saveBtn) {
          saveBtn.style.display = 'inline-block';
        }

        status.textContent = 'Ảnh đã cắt. Nhấn Lưu ảnh đại diện.';
      }, 'image/png');

      cropper.destroy();
      cropper = null;

    });
    // DNKN-116: Lưu ảnh đại diện lên máy chủ
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        if (!croppedBlob) {
          status.textContent = 'Vui lòng chọn và cắt ảnh trước.';
          return;
        }

        const token = getAuthToken();

        if (!token) {
          status.textContent = 'Vui lòng đăng nhập trước khi đổi ảnh.';
          return;
        }

        const formData = new FormData();
        formData.append('avatar', croppedBlob, 'avatar.png');

        saveBtn.disabled = true;
        status.textContent = 'Đang tải ảnh lên...';

        try {
          const response = await fetch('/api/profile/avatar', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`
            },
            body: formData
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.message || 'Không thể lưu ảnh.');
          }

          const avatarUrl = result.data.avatar;

          const pageAvatar = document.getElementById('page-avatar');

          if (pageAvatar) {
            pageAvatar.textContent = '';

            const img = document.createElement('img');
            img.src = avatarUrl;
            img.alt = 'Ảnh đại diện';
            img.style.cssText =
              'width:100%;height:100%;object-fit:cover;border-radius:50%';

            pageAvatar.appendChild(img);
          }

          status.textContent = 'Đã lưu ảnh đại diện thành công!';
          saveBtn.style.display = 'none';
          croppedBlob = null;

        } catch (error) {
          status.textContent = error.message;
        } finally {
          saveBtn.disabled = false;
        }
      });
    }
  }

  // Khởi tạo chức năng chọn ảnh
  document.addEventListener('DOMContentLoaded', initAvatarUpload);
})();

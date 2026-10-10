/**
 * app.js - Logic điều khiển giao diện Quản Lý Hồ Sơ Cá Nhân (Story DNKN-86)
 * Hỗ trợ cả 2 chế độ:
 * 1. Online: Kết nối API RESTful (GET & PUT /api/profile)
 * 2. Offline Demo: Mở trực tiếp file index.html qua trình duyệt mà không cần chạy server
 */

// Mock Data phục vụ demo khi chạy offline (không qua server)
const fallbackProfiles = {
  student: {
    id: "usr_003",
    name: "Nguyễn Văn An",
    fullName: "Nguyễn Văn An",
    email: "student@edu.vn",
    phone: "0901234567",
    role: "student",
    roleLabel: "Học sinh",
    status: "active",
    statusLabel: "Đang hoạt động",
    dob: "2004-03-12",
    address: "Số 234 Hoàng Quốc Việt, Cầu Giấy, Hà Nội"
  },
  teacher: {
    id: "usr_002",
    name: "ThS. Trần Thị Mai",
    fullName: "ThS. Trần Thị Mai",
    email: "teacher@edu.vn",
    phone: "0912345678",
    role: "teacher",
    roleLabel: "Giảng viên",
    status: "active",
    statusLabel: "Đang hoạt động",
    dob: "1988-10-20",
    address: "Số 144 Xuân Thủy, Cầu Giấy, Hà Nội"
  },
  admin: {
    id: "usr_001",
    name: "Giáp Văn Hiếu",
    fullName: "Giáp Văn Hiếu",
    email: "admin@edu.vn",
    phone: "0981234567",
    role: "admin",
    roleLabel: "Quản trị viên",
    status: "active",
    statusLabel: "Đang hoạt động",
    dob: "1995-05-15",
    address: "Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội"
  }
};

let currentRoleKey = 'student';
let currentProfile = null;
let isEditMode = false;
let isServerOnline = false;

// ====================================================================
// TIỆN ÍCH KIỂM TRA & CHUẨN HÓA SỐ ĐIỆN THOẠI VIỆT NAM (AC3 & SUBTASK 5)
// ====================================================================

function normalizeVietnamPhone(phone) {
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
  const normalized = normalizeVietnamPhone(phone);
  if (!normalized) return false;
  // Đầu số di động Việt Nam 10 chữ số: 03x, 05x, 07x, 08x, 09x
  return /^0[35789]\d{8}$/.test(normalized);
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return 'Chưa cập nhật';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  } catch (e) {
    return dateStr;
  }
}

function getInitials(name) {
  if (!name) return 'US';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Toast thông báo nổi
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    warning: 'bg-amber-500 text-white',
    info: 'bg-indigo-600 text-white'
  };

  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-xmark',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };

  toast.className = `toast pointer-events-auto flex items-center space-x-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type]} text-base"></i>
    <span class="flex-1">${message}</span>
    <button onclick="this.parentElement.remove()" class="text-white/80 hover:text-white ml-2">&times;</button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ====================================================================
// KIỂM TRA TRẠNG THÁI SERVER & LOAD DỮ LIỆU
// ====================================================================

async function checkServerConnection() {
  const badgeEl = document.getElementById('demo-mode-badge');
  const textEl = document.getElementById('demo-mode-text');

  try {
    const res = await fetch('/api/profile', {
      headers: { Authorization: `Bearer ${currentRoleKey}` }
    });
    if (res.ok) {
      isServerOnline = true;
      if (badgeEl) badgeEl.className = 'bg-emerald-50 border-b border-emerald-200 py-1.5 px-4 text-center text-xs text-emerald-800 flex items-center justify-center space-x-1';
      if (textEl) textEl.innerHTML = '<i class="fa-solid fa-server mr-1"></i>Đang kết nối trực tiếp Máy Chủ API (Live Backend Mode)';
      return true;
    }
  } catch (e) {
    // Không thể kết nối API
  }

  isServerOnline = false;
  if (badgeEl) badgeEl.className = 'bg-amber-50 border-b border-amber-200 py-1.5 px-4 text-center text-xs text-amber-800 flex items-center justify-center space-x-1';
  if (textEl) textEl.innerHTML = '<i class="fa-solid fa-laptop-code mr-1"></i>Chế độ Offline Demo (Đang mở trực tiếp HTML, dữ liệu lưu cục bộ trong trình duyệt)';
  return false;
}

async function loadProfile() {
  if (isServerOnline) {
    try {
      const res = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${currentRoleKey}` }
      });
      const data = await res.json();
      if (data.success && data.data) {
        currentProfile = data.data;
        renderProfileView();
        return;
      }
    } catch (e) {
      console.warn('Lỗi gọi API, chuyển về fallback data:', e);
    }
  }

  // Chế độ Offline: Đọc từ LocalStorage hoặc Fallback
  const stored = localStorage.getItem(`profile_cache_${currentRoleKey}`);
  if (stored) {
    try {
      currentProfile = JSON.parse(stored);
    } catch (e) {
      currentProfile = fallbackProfiles[currentRoleKey];
    }
  } else {
    currentProfile = fallbackProfiles[currentRoleKey];
  }

  renderProfileView();
}

// ====================================================================
// RENDER GIAO DIỆN
// ====================================================================

function renderProfileView() {
  if (!currentProfile) return;

  const fullName = currentProfile.fullName || currentProfile.name || 'Người dùng';
  const roleName = currentProfile.roleLabel || currentProfile.role || 'Người dùng';

  // Header
  document.getElementById('avatar-initials').textContent = getInitials(fullName);
  document.getElementById('header-fullname').textContent = fullName;
  document.getElementById('header-role-badge').textContent = roleName;
  document.getElementById('header-email').textContent = currentProfile.email || '';
  document.getElementById('nav-user-name').textContent = fullName;
  document.getElementById('nav-user-role').textContent = roleName;

  // View Section
  document.getElementById('view-fullname').textContent = fullName;
  document.getElementById('view-email').textContent = currentProfile.email || 'Chưa cập nhật';
  document.getElementById('view-role').textContent = `${roleName} (${currentProfile.role || 'user'})`;
  
  const phoneEl = document.getElementById('view-phone');
  if (phoneEl) {
    phoneEl.innerHTML = `
      <span>${currentProfile.phone || 'Chưa cập nhật'}</span>
      ${currentProfile.phone ? `<span class="text-xs font-normal text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"><i class="fa-solid fa-check mr-1"></i>Hợp lệ</span>` : ''}
    `;
  }

  document.getElementById('view-dob').textContent = formatDateDisplay(currentProfile.dob);
  document.getElementById('view-address').textContent = currentProfile.address || 'Chưa cập nhật';

  // Fill vào Form chuẩn bị sẵn
  document.getElementById('input-fullname').value = fullName;
  document.getElementById('input-phone').value = currentProfile.phone || '';
  document.getElementById('input-email').value = currentProfile.email || '';
  document.getElementById('input-role').value = `${roleName} (${currentProfile.role || 'user'})`;
  document.getElementById('input-dob').value = currentProfile.dob || '';
  document.getElementById('input-address').value = currentProfile.address || '';

  // Reset validate phone badge
  validatePhoneRealtime(document.getElementById('input-phone'));
}

// ====================================================================
// FORM VALIDATION & SỰ KIỆN
// ====================================================================

function toggleEditMode(forceState) {
  isEditMode = typeof forceState === 'boolean' ? forceState : !isEditMode;

  const viewSec = document.getElementById('section-view');
  const editSec = document.getElementById('section-edit');
  const btnLabel = document.getElementById('btn-toggle-label');
  const btnIcon = document.getElementById('btn-toggle-icon');

  if (isEditMode) {
    viewSec.classList.add('hidden');
    editSec.classList.remove('hidden');
    btnLabel.textContent = 'Hủy Chỉnh Sửa';
    btnIcon.className = 'fa-solid fa-xmark';
    renderProfileView();
  } else {
    viewSec.classList.remove('hidden');
    editSec.classList.add('hidden');
    btnLabel.textContent = 'Chỉnh Sửa Hồ Sơ';
    btnIcon.className = 'fa-solid fa-pen-to-square';
    clearErrors();
  }
}

function clearErrors() {
  document.getElementById('form-general-error').classList.add('hidden');
  ['fullname', 'phone', 'dob'].forEach(field => {
    const errEl = document.getElementById(`error-${field}`);
    if (errEl) {
      errEl.textContent = '';
      errEl.classList.add('hidden');
    }
    const inputEl = document.getElementById(`input-${field}`);
    if (inputEl) {
      inputEl.classList.remove('border-rose-500', 'border-emerald-500');
    }
  });
}

function validatePhoneRealtime(input) {
  const errorEl = document.getElementById('error-phone');
  const badgeEl = document.getElementById('phone-valid-badge');
  const val = input.value.trim();

  if (!val) {
    input.classList.remove('border-rose-500', 'border-emerald-500');
    if (badgeEl) badgeEl.classList.add('hidden');
    if (errorEl) { errorEl.textContent = ''; errorEl.classList.add('hidden'); }
    return false;
  }

  if (!isValidVietnamPhone(val)) {
    input.classList.remove('border-emerald-500');
    input.classList.add('border-rose-500');
    if (badgeEl) badgeEl.classList.add('hidden');
    if (errorEl) {
      errorEl.textContent = 'Số điện thoại không đúng định dạng Việt Nam (10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09).';
      errorEl.classList.remove('hidden');
    }
    return false;
  }

  // Hợp lệ
  input.classList.remove('border-rose-500');
  input.classList.add('border-emerald-500');
  if (errorEl) { errorEl.textContent = ''; errorEl.classList.add('hidden'); }
  if (badgeEl) badgeEl.classList.remove('hidden');
  return true;
}

async function handleFormSubmit(event) {
  event.preventDefault();
  clearErrors();

  const nameInput = document.getElementById('input-fullname');
  const phoneInput = document.getElementById('input-phone');
  const dobInput = document.getElementById('input-dob');
  const addressInput = document.getElementById('input-address');

  let hasError = false;

  // 1. Kiểm tra Họ và Tên
  const nameVal = nameInput.value.trim();
  if (!nameVal) {
    const err = document.getElementById('error-fullname');
    err.textContent = 'Họ và tên không được để trống.';
    err.classList.remove('hidden');
    nameInput.classList.add('border-rose-500');
    hasError = true;
  }

  // 2. [FE] Kiểm tra định dạng số điện thoại Việt Nam (Subtask 5)
  if (!phoneInput.value.trim()) {
    const err = document.getElementById('error-phone');
    err.textContent = 'Số điện thoại không được để trống.';
    err.classList.remove('hidden');
    phoneInput.classList.add('border-rose-500');
    hasError = true;
  } else if (!validatePhoneRealtime(phoneInput)) {
    hasError = true;
  }

  // 3. Kiểm tra Ngày sinh (không được ở tương lai)
  const dobVal = dobInput.value ? dobInput.value.trim() : '';
  if (dobVal) {
    const selectedDate = new Date(dobVal);
    if (isNaN(selectedDate.getTime())) {
      const err = document.getElementById('error-dob');
      err.textContent = 'Ngày sinh không hợp lệ.';
      err.classList.remove('hidden');
      hasError = true;
    } else if (selectedDate > new Date()) {
      const err = document.getElementById('error-dob');
      err.textContent = 'Ngày sinh không thể là ngày trong tương lai.';
      err.classList.remove('hidden');
      dobInput.classList.add('border-rose-500');
      hasError = true;
    }
  }

  if (hasError) {
    showToast('Vui lòng kiểm tra lại thông tin chưa hợp lệ.', 'warning');
    return;
  }

  // Gửi cập nhật
  const submitBtn = document.getElementById('btn-submit');
  const submitText = document.getElementById('btn-submit-text');
  submitBtn.disabled = true;
  submitText.textContent = 'Đang lưu hồ sơ...';

  const payload = {
    name: nameVal,
    phone: normalizeVietnamPhone(phoneInput.value),
    dob: dobVal,
    address: addressInput.value.trim()
  };

  try {
    if (isServerOnline) {
      // Gửi lên Backend API
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentRoleKey}`
        },
        body: JSON.stringify(payload)
      });
      const result = await res.json();

      if (res.ok && result.success) {
        currentProfile = result.data;
        showToast('Cập nhật hồ sơ cá nhân thành công!', 'success');
        toggleEditMode(false);
      } else {
        const errorMsg = result.message || 'Lỗi khi cập nhật hồ sơ cá nhân.';
        document.getElementById('form-general-error').classList.remove('hidden');
        document.getElementById('form-general-error-text').textContent = errorMsg;
        showToast(errorMsg, 'error');
      }
    } else {
      // Lưu Offline vào LocalStorage
      currentProfile.name = payload.name;
      currentProfile.fullName = payload.name;
      currentProfile.phone = payload.phone;
      currentProfile.dob = payload.dob;
      currentProfile.address = payload.address;

      localStorage.setItem(`profile_cache_${currentRoleKey}`, JSON.stringify(currentProfile));
      showToast('Cập nhật thành công (Lưu chế độ Offline Demo)!', 'success');
      toggleEditMode(false);
    }
  } catch (err) {
    console.error('Lỗi khi lưu hồ sơ:', err);
    showToast('Lỗi kết nối khi cập nhật hồ sơ.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitText.textContent = 'Lưu Cập Nhật Hồ Sơ';
  }
}

// ====================================================================
// KHỞI CHẠY KHI TẢI TRANG
// ====================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Bắt sự kiện chuyển đổi vai trò
  const selectRole = document.getElementById('select-demo-user');
  if (selectRole) {
    selectRole.addEventListener('change', (e) => {
      currentRoleKey = e.target.value;
      loadProfile();
      showToast(`Đã chuyển sang tài khoản ${currentRoleKey.toUpperCase()}`, 'info');
    });
  }

  await checkServerConnection();
  await loadProfile();
});

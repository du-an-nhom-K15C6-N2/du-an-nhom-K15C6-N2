/**
 * Preview Controller cho Task DNKN-14: Menu điều hướng theo quyền & Tối ưu 360px
 */

import { createRoleNavigation, showAccessDeniedScreen } from './components/RoleNavigation.js';
import { renderAppErrorScreen } from './components/AppErrorScreen.js';
import { getSafeAppPath, ROLE_NAVIGATION_MAP, resolveNavigationByRole } from './core/navigation.js';
import { saveAuthSession, getAuthSession } from './core/storage.js';
import { authState } from './core/authState.js';

// Danh sách tài khoản mẫu kiểm thử chuẩn
const DEMO_USERS = {
  ADMIN: {
    email: 'admin@edu.vn',
    password: 'Password@123',
    name: 'Giáp Văn Hiếu',
    role: 'ADMIN',
    roleLabel: 'Quản trị viên cấp cao'
  },
  TEACHER: {
    email: 'teacher@edu.vn',
    password: 'Password@123',
    name: 'ThS. Trần Thị Mai',
    role: 'TEACHER',
    roleLabel: 'Giảng viên'
  },
  STUDENT: {
    email: 'student@edu.vn',
    password: 'Password@123',
    name: 'Nguyễn Văn An',
    role: 'STUDENT',
    roleLabel: 'Học sinh'
  },
  ASSISTANT: {
    email: 'thao.le@edu.vn',
    password: 'Password@123',
    name: 'Lê Thị Thu Thảo',
    role: 'ASSISTANT',
    roleLabel: 'Trợ giảng'
  },
  MANAGER: {
    email: 'hoang@edu.vn',
    password: 'Password@123',
    name: 'Lê Huy Hoàng',
    role: 'MANAGER',
    roleLabel: 'Quản lý đào tạo'
  }
};

let currentRoleKey = 'ADMIN';
let currentActiveNavId = 'dashboard';
let currentToken = null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

/**
 * Đăng nhập tài khoản demo và lấy JWT token từ backend
 */
async function authenticateUser(roleKey) {
  const account = DEMO_USERS[roleKey] || DEMO_USERS.ADMIN;
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: account.email, password: account.password })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      currentToken = data.token;
      saveAuthSession({ token: data.token, user: data.user, rememberMe: true });
      authState.setState({
        token: data.token,
        user: data.user,
        role: data.user.role?.toUpperCase(),
        isAuthenticated: true
      });
      return data.user;
    }
  } catch (err) {
    console.warn('Backend login fallback to local session:', err);
  }

  // Fallback giả lập nếu server đang offline
  const fallbackUser = {
    id: `usr_${roleKey.toLowerCase()}`,
    name: account.name,
    fullName: account.name,
    email: account.email,
    role: roleKey.toLowerCase(),
    roles: [roleKey.toLowerCase()],
    roleLabel: account.roleLabel,
    status: 'active'
  };
  currentToken = `mock_token_${roleKey}`;
  saveAuthSession({ token: currentToken, user: fallbackUser, rememberMe: true });
  return fallbackUser;
}

/**
 * Render toàn bộ Dashboard & Menu điều hướng
 */
async function renderDashboard() {
  const container = document.getElementById('app');
  if (!container) return;

  const user = await authenticateUser(currentRoleKey);
  const role = currentRoleKey.toUpperCase();
  const roleMeta = ROLE_NAVIGATION_MAP[role] || {
    title: 'Khu vực người dùng',
    badgeColor: '#3b82f6',
    description: 'Không gian làm việc hệ thống'
  };

  const displayName = user.fullName || user.name || user.email.split('@')[0];
  const initials = displayName.split(/\s+/).slice(-2).map(p => p[0]).join('').toUpperCase();
  const avatarUrl = user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`;

  currentActiveNavId = role === 'ADMIN' ? 'user-management' : 'dashboard';

  container.innerHTML = `
    <div class="dashboard-wrapper">
      <!-- Sidebar điều hướng -->
      <aside class="dash-sidebar">
        <a class="sidebar-brand" href="/" aria-label="EduClass Manager">
          <span class="sidebar-brand-icon">🎓</span>
          <span><strong>EduClass</strong><small>Manager</small></span>
        </a>
        <span class="sidebar-section-label">QUẢN LÝ HỆ THỐNG</span>
        <div id="role-nav-mount"></div>
        <div class="sidebar-bottom">
          <div class="sidebar-role-card">
            <span class="sidebar-role-icon">🛡️</span>
            <span><strong>Phân quyền &amp; Bảo mật</strong><small>DNKN-14 RBAC Viewport</small></span>
          </div>
          <div class="sidebar-user" title="Thông tin người dùng hiện tại">
            <span class="sidebar-user-avatar">${escapeHtml(initials)}</span>
            <span><strong>${escapeHtml(displayName)}</strong><small>${escapeHtml(role)}</small></span>
            <span class="sidebar-user-shield">✓</span>
          </div>
        </div>
      </aside>

      <!-- Top Header hiển thị tài khoản & vai trò -->
      <header class="dash-navbar glass-panel">
        <div class="dash-nav-left">
          <div class="dash-breadcrumb">
            <span>🏠 &nbsp;${escapeHtml(roleMeta.title)}</span>
            <b>›</b>
            <strong id="dashboard-breadcrumb">Bảng điều khiển</strong>
          </div>
        </div>

        <div class="dash-nav-right">
          <!-- Subtask 2 [FE]: Khu vực hiển thị thông tin tài khoản & vai trò -->
          <div class="user-pill glass-panel" title="Tài khoản đang đăng nhập">
            <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)}" class="user-avatar" />
            <div class="user-meta">
              <span class="user-name">${escapeHtml(displayName)}</span>
              <span class="user-email">${escapeHtml(user.email)}</span>
            </div>
            <span class="role-badge role-${role.toLowerCase()}">${escapeHtml(role)}</span>
          </div>

          <button type="button" class="btn-logout" id="btn-demo-logout" title="Đăng xuất">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Đăng xuất</span>
          </button>
        </div>
      </header>

      <!-- Vùng hiển thị nội dung chính -->
      <main class="dash-main-content">
        <div id="main-content-area">
          ${renderActiveViewContent(currentActiveNavId, role)}
        </div>
      </main>
    </div>
  `;

  // Gắn menu điều hướng động (Subtask 3)
  const navMount = container.querySelector('#role-nav-mount');
  if (navMount) {
    const navEl = createRoleNavigation(role);
    navMount.append(navEl);

    // Bắt sự kiện chuyển tab menu
    navEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-nav-id]');
      if (!btn) return;
      const navId = btn.dataset.navId;
      currentActiveNavId = navId;

      // Cập nhật breadcrumb
      const breadcrumb = container.querySelector('#dashboard-breadcrumb');
      if (breadcrumb) breadcrumb.textContent = btn.querySelector('.nav-item-label')?.textContent || navId;

      // Render nội dung tương ứng
      const contentArea = container.querySelector('#main-content-area');
      if (contentArea) {
        contentArea.innerHTML = renderActiveViewContent(navId, role);
      }
    });
  }

  // Nút đăng xuất demo
  container.querySelector('#btn-demo-logout')?.addEventListener('click', () => {
    alert(`Đã đăng xuất tài khoản ${displayName}.`);
  });
}

/**
 * Tạo nội dung mô phỏng cho từng view được chọn
 */
function renderActiveViewContent(navId, role) {
  const titles = {
    'user-management': 'Quản lý người dùng & Phân quyền',
    'attendance': 'Điểm danh lớp học',
    'class-management': 'Bàn giao & Quản lý lớp học',
    'dashboard': 'Bảng điều khiển tổng quan',
    'user-profile': 'Hồ sơ cá nhân & Thông tin liên hệ',
    'course-catalog': 'Danh mục môn học & Chương trình',
    'teaching-assignment': 'Phân công giảng dạy',
    'enrollment-management': 'Ghi danh học viên',
    'student-status': 'Bảo lưu, Chuyển lớp & Thôi học',
    'system-logs': 'Nhật ký hệ thống & Audit Trail',
    'my-courses': 'Lớp học của tôi',
    'my-tasks': 'Nhiệm vụ được giao',
    'approval': 'Phê duyệt yêu cầu',
    'training-management': 'Quản lý đào tạo',
    'lead-management': 'Quản lý tư vấn tuyển sinh (Leads)',
    'profile-security': 'Đổi mật khẩu & Bảo mật tài khoản'
  };

  const title = titles[navId] || 'Chức năng hệ thống';

  return `
    <section class="dashboard-content-view">
      <header class="dashboard-section-heading">
        <span class="dashboard-section-eyebrow">KHÔNG GIAN LÀM VIỆC THEO VAI TRÒ (${role})</span>
        <h2>${escapeHtml(title)}</h2>
        <p>Menu điều hướng đã hiển thị chính xác theo quyền của bạn. Không hiển thị các chức năng ngoài phạm vi.</p>
      </header>

      <div style="background: rgba(15, 23, 42, 0.45); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; padding: 1.5rem; margin-top: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
          <span style="font-size: 1.5rem;">✅</span>
          <div>
            <h3 style="margin: 0; font-size: 1.1rem; color: #6ee7b7;">Chức năng hợp lệ: ${escapeHtml(title)}</h3>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #94a3b8;">Mã định danh chức năng: <code>${escapeHtml(navId)}</code> | Vai trò: <code>${escapeHtml(role)}</code></p>
          </div>
        </div>
        <p style="color: #cbd5e1; font-size: 0.9rem; line-height: 1.6;">
          Hệ thống đã xác thực thành công danh sách quyền trong <code>RBAC_SEED</code> và chỉ mở quyền truy cập chức năng này cho các vai trò được cấu hình.
        </p>
      </div>
    </section>
  `;
}

/**
 * Khởi tạo bộ chuyển đổi vai trò
 */
function initRoleSwitcher() {
  const buttons = document.querySelectorAll('[data-role]');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const role = btn.dataset.role;
      if (!role || role === currentRoleKey) return;
      buttons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      currentRoleKey = role;
      renderDashboard();
    });
  });
}

/**
 * Khởi tạo bộ chuyển đổi màn hình (Desktop, Tablet, 360px)
 */
function initViewportSwitcher() {
  const container = document.getElementById('viewport-container');
  const buttons = document.querySelectorAll('[data-viewport]');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.viewport;
      buttons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      container.classList.remove('mode-tablet', 'mode-mobile-360');
      if (mode === 'tablet') {
        container.classList.add('mode-tablet');
      } else if (mode === 'mobile-360') {
        container.classList.add('mode-mobile-360');
      }
    });
  });
}

/**
 * Nút thử nghiệm lỗi 403 Forbidden
 */
function initForbiddenTrigger() {
  const btn = document.getElementById('btn-trigger-forbidden');
  btn?.addEventListener('click', () => {
    const mainContent = document.getElementById('main-content-area');
    if (!mainContent) return;

    // Giả lập thử truy cập chức năng "Quản trị phân quyền cấp cao" khi không có quyền
    renderAppErrorScreen(mainContent, {
      type: 'forbidden',
      safePath: getSafeAppPath(true, ROLE_NAVIGATION_MAP[currentRoleKey]),
      featureName: 'Quản lý người dùng & Phân quyền hệ thống',
      role: currentRoleKey
    });

    // Bắt sự kiện quay lại an toàn
    mainContent.querySelector('#btn-safe-screen')?.addEventListener('click', () => {
      mainContent.innerHTML = renderActiveViewContent('dashboard', currentRoleKey);
    });
    mainContent.querySelector('#btn-home')?.addEventListener('click', () => {
      mainContent.innerHTML = renderActiveViewContent('dashboard', currentRoleKey);
    });
  });
}

/**
 * Nút xem API JSON
 */
function initApiModal() {
  const modal = document.getElementById('api-modal');
  const closeBtn = document.getElementById('btn-close-modal');
  const viewBtn = document.getElementById('btn-view-api');
  const jsonContent = document.getElementById('api-json-content');

  viewBtn?.addEventListener('click', async () => {
    modal.classList.add('is-open');
    jsonContent.textContent = 'Đang gửi yêu cầu GET /api/auth/permissions và GET /api/auth/me...';

    try {
      const headers = currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
      const [permRes, meRes] = await Promise.all([
        fetch('/api/auth/permissions', { headers }),
        fetch('/api/auth/me', { headers })
      ]);

      const permData = await permRes.json();
      const meData = await meRes.json();

      jsonContent.textContent = JSON.stringify({
        endpoint_GET_api_auth_permissions: permData,
        endpoint_GET_api_auth_me: meData
      }, null, 2);
    } catch (err) {
      jsonContent.textContent = `Lỗi kết nối API: ${err.message}`;
    }
  });

  closeBtn?.addEventListener('click', () => modal.classList.remove('is-open'));
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('is-open');
  });
}

// Khởi chạy khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  initRoleSwitcher();
  initViewportSwitcher();
  initForbiddenTrigger();
  initApiModal();
  renderDashboard();
});

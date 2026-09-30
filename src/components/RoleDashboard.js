/**
 * DNKN-3: Màn hình hiển thị sau khi điều hướng dựa trên Role (Role-based Navigation)
 * Chứng minh kết quả chuyển hướng, quản lý session/token và vai trò người dùng
 */

import { authState } from '../core/authState.js';
import { getAuthSession } from '../core/storage.js';

export function renderRoleDashboard(container) {
  function update() {
    const state = authState.getState();
    const session = getAuthSession();
    const user = state.user || session.user;
    const role = state.role || session.role || 'USER';
    const targetNav = state.navigationTarget || { path: '/portal/home', title: 'Không gian làm việc' };

    if (!user) {
      return;
    }

    // Xác định cấu hình hiển thị theo vai trò
    const roleMeta = {
      ADMIN: {
        title: 'Hệ Thống Quản Trị Cấp Cao',
        route: '/admin/dashboard',
        badgeClass: 'role-admin',
        accentColor: '#ef4444',
        icon: '🛡️',
        modules: [
          { name: 'Quản lý Người dùng & Phân quyền', desc: 'Thêm, sửa, xóa, khóa tài khoản nhân sự toàn hệ thống', status: 'Toàn quyền' },
          { name: 'Giám sát Hệ thống & Server Logs', desc: 'Theo dõi tài nguyên server, hiệu năng API và bảo mật', status: 'Toàn quyền' },
          { name: 'Cấu hình Chính sách Bảo mật (RBAC)', desc: 'Thiết lập quy tắc xác thực 2FA, Token Expiration', status: 'Toàn quyền' },
          { name: 'Báo cáo Kiểm toán Doanh nghiệp', desc: 'Xuất dữ liệu thống kê hoạt động định kỳ', status: 'Toàn quyền' }
        ]
      },
      MANAGER: {
        title: 'Bảng Điều Khiển Quản Lý Phòng Ban',
        route: '/manager/dashboard',
        badgeClass: 'role-manager',
        accentColor: '#f59e0b',
        icon: '📊',
        modules: [
          { name: 'Phê duyệt Yêu cầu & Tài liệu', desc: 'Duyệt các đề xuất ngân sách và đề nghị cấp phép từ nhân viên', status: 'Trưởng nhóm' },
          { name: 'Theo dõi Tiến độ Dự án Nhóm', desc: 'Cập nhật KPI, tiến độ các task [DNKN-3] và phân bổ công việc', status: 'Trưởng nhóm' },
          { name: 'Báo cáo Hoạt động Tuần/Tháng', desc: 'Tổng hợp số liệu năng suất phòng ban', status: 'Trưởng nhóm' }
        ]
      },
      USER: {
        title: 'Không Gian Làm Việc Nhân Viên',
        route: '/user/workspace',
        badgeClass: 'role-user',
        accentColor: '#3b82f6',
        icon: '💼',
        modules: [
          { name: 'Danh sách Nhiệm vụ Được giao', desc: 'Xem chi tiết các đầu việc cần hoàn thành trong sprint', status: 'Cá nhân' },
          { name: 'Hồ sơ Cá nhân & Bảo mật', desc: 'Cập nhật avatar, đổi mật khẩu và xem lịch sử đăng nhập', status: 'Cá nhân' },
          { name: 'Kho Tài nguyên & Hướng dẫn', desc: 'Truy cập tài liệu nội bộ và quy trình dự án', status: 'Cá nhân' }
        ]
      }
    };

    const currentMeta = roleMeta[role] || roleMeta.USER;

    container.innerHTML = `
      <div class="dashboard-wrapper">
        <!-- Header điều hướng theo Role -->
        <header class="dash-navbar glass-panel">
          <div class="dash-nav-left">
            <div class="dash-logo">
              <span class="role-icon-big">${currentMeta.icon}</span>
              <div>
                <h2 class="dash-brand-title">${currentMeta.title}</h2>
                <div class="route-indicator">
                  <span class="pulse-indicator"></span>
                  <span class="route-badge">Đường dẫn hiện tại: <strong>${targetNav.path || currentMeta.route}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <div class="dash-nav-right">
            <div class="user-pill glass-panel">
              <img src="${user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}" alt="${user.fullName}" class="user-avatar" />
              <div class="user-meta">
                <span class="user-name">${user.fullName}</span>
                <span class="user-email">${user.email}</span>
              </div>
              <span class="role-badge ${currentMeta.badgeClass}">${role}</span>
            </div>

            <button type="button" class="btn-logout" id="btn-logout" title="Đăng xuất khỏi hệ thống">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Đăng Xuất</span>
            </button>
          </div>
        </header>

        <!-- Nội dung chính minh chứng hoàn thành Subtask DNKN-3 -->
        <main class="dash-main-content">
          <!-- Notification thành công -->
          <div class="success-banner slide-down">
            <div class="success-icon">✓</div>
            <div class="success-text">
              <strong>Xác thực thành công!</strong> Luồng [DNKN-3] đã hoàn tất: Dữ liệu hợp lệ -> State quản lý thành công -> Lưu Token/Session -> Điều hướng đúng route dành riêng cho vai trò <strong>${role}</strong>.
            </div>
          </div>

          <div class="dash-grid">
            <!-- Thẻ 1: Thông tin phiên đăng nhập & Token lưu trữ -->
            <div class="dash-card glass-panel">
              <div class="card-title-row">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                  <line x1="6" y1="8" x2="18" y2="8"></line>
                  <line x1="6" y1="12" x2="14" y2="12"></line>
                </svg>
                <h3>Trạng thái Session & Token Lưu Trữ</h3>
              </div>
              <p class="card-desc">Thông tin xác thực đã được lưu vào Web Storage theo yêu cầu DNKN-3:</p>

              <div class="token-inspector">
                <div class="token-field">
                  <span class="field-label">Kiểu lưu trữ:</span>
                  <span class="storage-tag">${localStorage.getItem('dnkn_auth_token') ? 'localStorage (Duy trì)' : 'sessionStorage (Theo phiên)'}</span>
                </div>
                <div class="token-field">
                  <span class="field-label">Thời điểm đăng nhập:</span>
                  <span class="field-val">${new Date().toLocaleString('vi-VN')}</span>
                </div>
                <div class="token-field">
                  <span class="field-label">Access Token (JWT):</span>
                  <div class="token-code-box">
                    <code>${state.token || session.token || 'Chưa có token'}</code>
                  </div>
                </div>
              </div>
            </div>

            <!-- Thẻ 2: Danh sách quyền hạn theo Vai trò (RBAC) -->
            <div class="dash-card glass-panel">
              <div class="card-title-row">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                <h3>Quyền hạn Theo Vai Trò (${role})</h3>
              </div>
              <p class="card-desc">Giao diện và phân hệ được cấp phép tương ứng với Role của bạn:</p>

              <div class="modules-list">
                ${currentMeta.modules.map(mod => `
                  <div class="module-item">
                    <div class="module-header">
                      <span class="module-name">${mod.name}</span>
                      <span class="module-badge ${currentMeta.badgeClass}">${mod.status}</span>
                    </div>
                    <p class="module-desc">${mod.desc}</p>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Bottom Actions -->
          <div class="dash-footer-actions">
            <button type="button" class="btn-secondary" id="btn-switch-account">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="1 4 1 10 7 10"></polyline>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
              </svg>
              <span>Đăng nhập tài khoản khác (Kiểm thử vai trò khác)</span>
            </button>
          </div>
        </main>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    const logoutBtn = container.querySelector('#btn-logout');
    const switchAccountBtn = container.querySelector('#btn-switch-account');

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await authState.handleLogout();
      });
    }

    if (switchAccountBtn) {
      switchAccountBtn.addEventListener('click', async () => {
        await authState.handleLogout();
      });
    }
  }

  const unsubscribe = authState.subscribe(() => {
    const state = authState.getState();
    if (state.isAuthenticated) {
      update();
    }
  });

  update();

  return unsubscribe;
}

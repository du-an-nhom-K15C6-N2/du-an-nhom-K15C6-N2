/**
 * DNKN-3: Màn hình hiển thị sau khi điều hướng dựa trên Role (Role-based Navigation)
 * Chứng minh kết quả chuyển hướng, quản lý session/token và vai trò người dùng
 */

import { authState } from '../core/authState.js';
import { getAuthSession } from '../core/storage.js';
import { clearFormDraft, restoreFormDrafts } from '../core/formDrafts.js';
import { createAttendanceRecord, getAttendanceRecords, getAttendanceStudents } from '../core/attendanceService.js';
import { getClasses } from '../core/classService.js';
import { getDashboardSummary } from '../core/dashboardService.js';
import { changePasswordApi } from '../core/authService.js';
import { createRoleNavigation } from './RoleNavigation.js';
import { renderImportUsersPanel } from './ImportUsersPanel.js';
import { renderUserManagementPanel } from './UserManagementPanel.js';
import { renderClassHandoverPanel } from './ClassHandoverPanel.js';
import { renderEnrollmentPanel } from './EnrollmentPanel.js';
import { renderTeachingAssignmentPanel } from './TeachingAssignmentPanel.js';
import { renderUserProfilePanel } from './UserProfilePanel.js';

export function renderRoleDashboard(container) {
  let attendanceRecords = [];
  let activeViewId = null;

  function getLocalToday() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  async function loadDashboardMetrics() {
    const metrics = container.querySelector('#dashboard-metrics');
    const status = container.querySelector('#dashboard-metrics-status');
    if (!metrics || !status) return;

    status.textContent = 'Đang tải số liệu từ hệ thống...';
    status.className = 'dashboard-metrics-status';
    metrics.replaceChildren();

    try {
      const summary = await getDashboardSummary();
      if (container.querySelector('#dashboard-metrics') !== metrics) return;
      const formatNumber = value => new Intl.NumberFormat('vi-VN').format(value);
      const cards = [];

      if (summary.users) {
        cards.push({
          label: 'Tài khoản',
          value: summary.users.total,
          detail: `${formatNumber(summary.users.active)} hoạt động · ${formatNumber(summary.users.pending)} chờ kích hoạt · ${formatNumber(summary.users.locked)} bị khóa`,
          color: 'violet'
        });
      }
      if (summary.classes) {
        cards.push({
          label: 'Lớp học',
          value: summary.classes.total,
          detail: `${formatNumber(summary.classes.active)} đang hoạt động · ${formatNumber(summary.classes.handoverRequired)} cần bàn giao`,
          color: 'blue'
        });
      }
      if (summary.attendance) {
        cards.push({
          label: 'Lượt điểm danh',
          value: summary.attendance.total,
          detail: `${formatNumber(summary.attendance.today)} lượt trong hôm nay`,
          color: 'green'
        });
      }

      if (!cards.length) {
        status.textContent = 'Tài khoản hiện chưa được cấp quyền xem số liệu tổng quan.';
        return;
      }

      metrics.innerHTML = cards.map(card => `
        <article class="dashboard-metric-card is-${card.color}">
          <span>${card.label}</span>
          <strong>${formatNumber(card.value)}</strong>
          <small>${card.detail}</small>
        </article>
      `).join('');

      const generatedAt = new Date(summary.generatedAt);
      status.textContent = Number.isNaN(generatedAt.valueOf())
        ? 'Số liệu được đồng bộ trực tiếp từ máy chủ.'
        : `Dữ liệu máy chủ cập nhật lúc ${generatedAt.toLocaleString('vi-VN')}.`;
      status.className = 'dashboard-metrics-status is-success';
    } catch (error) {
      if (container.querySelector('#dashboard-metrics') !== metrics) return;
      status.textContent = error.message || 'Không thể tải số liệu tổng quan từ máy chủ.';
      status.className = 'dashboard-metrics-status is-error';
    }
  }

  function update() {
    const state = authState.getState();
    const session = getAuthSession();
    const user = state.user || session.user;
    const displayName = user?.fullName || user?.name || (user?.email ? user.email.split('@')[0] : 'Người dùng');
    const role = (state.role || session.role || 'USER').toUpperCase();
    const defaultNavId = role === 'ADMIN' ? 'user-management' : 'dashboard';
    const currentNavId = activeViewId || defaultNavId;
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
      TEACHER: {
        title: 'Khu Vực Giảng Viên',
        route: '/teacher/dashboard',
        badgeClass: 'role-manager',
        accentColor: '#f59e0b',
        icon: '📚',
        modules: [
          { name: 'Quản lý lớp học', desc: 'Theo dõi lớp học và hoạt động giảng dạy được phân công', status: 'Giảng viên' },
          { name: 'Tài liệu và bài tập', desc: 'Quản lý tài nguyên học tập và nhiệm vụ của lớp', status: 'Giảng viên' }
        ]
      },
      ASSISTANT: {
        title: 'Khu Vực Trợ Giảng',
        route: '/assistant/dashboard',
        badgeClass: 'role-manager',
        accentColor: '#8b5cf6',
        icon: '🧑‍🏫',
        modules: [
          { name: 'Hỗ trợ lớp học', desc: 'Hỗ trợ giảng viên trong các hoạt động lớp học', status: 'Trợ giảng' },
          { name: 'Theo dõi nhiệm vụ', desc: 'Theo dõi tiến độ nhiệm vụ được phân công', status: 'Trợ giảng' }
        ]
      },
      STUDENT: {
        title: 'Không Gian Học Tập',
        route: '/student/workspace',
        badgeClass: 'role-user',
        accentColor: '#3b82f6',
        icon: '🎓',
        modules: [
          { name: 'Lớp học của tôi', desc: 'Truy cập lớp học và tài nguyên được cấp quyền', status: 'Cá nhân' },
          { name: 'Nhiệm vụ học tập', desc: 'Xem và cập nhật nhiệm vụ của bạn', status: 'Cá nhân' }
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
      ACCOUNTANT: {
        title: 'Khu Vực Kế Toán',
        route: '/accountant/dashboard',
        badgeClass: 'role-manager',
        accentColor: '#10b981',
        icon: '💰',
        modules: [
          { name: 'Quản lý học phí', desc: 'Theo dõi và cập nhật nghiệp vụ học phí', status: 'Kế toán' },
          { name: 'Báo cáo tài chính', desc: 'Xem báo cáo tài chính được phân quyền', status: 'Kế toán' }
        ]
      },
      DEPARTMENT_HEAD: {
        title: 'Khu Vực Trưởng Bộ Môn',
        route: '/department-head/dashboard',
        badgeClass: 'role-manager',
        accentColor: '#8b5cf6',
        icon: '🏫',
        modules: [
          { name: 'Theo dõi chuyên môn', desc: 'Theo dõi lớp học, điểm và báo cáo học thuật', status: 'Trưởng bộ môn' }
        ]
      },
      TRAINING_STAFF: {
        title: 'Khu Vực Nhân Viên Đào Tạo',
        route: '/training/dashboard',
        badgeClass: 'role-manager',
        accentColor: '#06b6d4',
        icon: '🗂️',
        modules: [
          { name: 'Hồ sơ học viên', desc: 'Quản lý hồ sơ người học theo quyền được cấp', status: 'Nhân viên đào tạo' },
          { name: 'Quản lý lớp học', desc: 'Theo dõi và cập nhật thông tin lớp học', status: 'Nhân viên đào tạo' }
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

    const currentMeta = roleMeta[role] || roleMeta.STUDENT;
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
    const avatarUrl = typeof user.avatar === 'string' && user.avatar.startsWith('https://')
      ? user.avatar
      : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100';
    const canManageAttendance = ['ADMIN', 'TEACHER', 'ASSISTANT'].includes(role);
    const canManageUsers = role === 'ADMIN';
    const canManageEnrollments = ['ADMIN', 'MANAGER', 'TRAINING_STAFF'].includes(role);
    const canManageAssignments = ['ADMIN', 'MANAGER'].includes(role);

    container.innerHTML = `
      <div class="dashboard-wrapper">
        <aside class="dash-sidebar">
          <a class="sidebar-brand" href="/" aria-label="EduClass Manager">
            <span class="sidebar-brand-icon">♧</span>
            <span><strong>EduClass</strong><small>Manager</small></span>
          </a>
          <span class="sidebar-section-label">QUẢN LÝ HỆ THỐNG</span>
          <div id="role-nav-mount"></div>
          <div class="sidebar-bottom">
            <div class="sidebar-role-card">
              <span class="sidebar-role-icon">♙</span>
              <span><strong>Quản trị &amp; bảo mật lớp học</strong><small>Đồ án thực tập cơ sở</small></span>
            </div>
            <button type="button" class="sidebar-action" id="btn-sidebar-password"><span>⚿</span> Đổi mật khẩu</button>
            <button type="button" class="sidebar-action is-logout" id="btn-logout"><span>⇥</span> Đăng xuất</button>
            <div class="sidebar-user" style="cursor: pointer;" title="Xem hồ sơ cá nhân">
              <span class="sidebar-user-avatar">${escapeHtml(displayName.split(/\s+/).slice(-2).map(part => part[0]).join('').toUpperCase())}</span>
              <span><strong>${escapeHtml(displayName)}</strong><small>${escapeHtml(role)}</small></span>
              <span class="sidebar-user-shield">◇</span>
            </div>
          </div>
        </aside>
        <!-- Header điều hướng theo Role -->
        <header class="dash-navbar glass-panel">
          <div class="dash-nav-left">
            <div class="dash-breadcrumb"><span>⌂ &nbsp;${escapeHtml(currentMeta.title)}</span><b>›</b><strong id="dashboard-breadcrumb">${role === 'ADMIN' ? 'Quản lý người dùng' : 'Bảng điều khiển'}</strong></div>
          </div>

          <div class="dash-nav-right">
            <div class="user-pill glass-panel" style="cursor: pointer;" title="Xem hồ sơ cá nhân">
              <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(user.fullName)}" class="user-avatar" />
              <div class="user-meta">
                <span class="user-name">${escapeHtml(user?.fullName || user?.name || (user?.email ? user.email.split('@')[0] : 'Quản trị viên'))}</span>
                <span class="user-email">${escapeHtml(user.email)}</span>
              </div>
              <span class="role-badge ${currentMeta.badgeClass}">${role}</span>
            </div>

            <button type="button" class="btn-logout" id="btn-logout-top" title="Đăng xuất khỏi hệ thống">
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
          <section class="dashboard-content-view" data-dashboard-view="dashboard" ${currentNavId === 'dashboard' ? '' : 'hidden'}>
            <header class="dashboard-section-heading">
              <span class="dashboard-section-eyebrow">KHÔNG GIAN LÀM VIỆC</span>
              <h2>Bảng điều khiển</h2>
              <p>Tổng quan số liệu thực tế theo quyền truy cập của tài khoản.</p>
            </header>

            <section class="dashboard-metrics-panel" aria-label="Số liệu tổng quan">
              <div class="dashboard-metrics-heading">
                <h3>Số liệu hệ thống</h3>
                <button type="button" class="dashboard-metrics-refresh" id="dashboard-metrics-refresh">Làm mới</button>
              </div>
              <div class="dashboard-metrics-grid" id="dashboard-metrics" aria-live="polite"></div>
              <p class="dashboard-metrics-status" id="dashboard-metrics-status" role="status">Đang tải số liệu từ hệ thống...</p>
            </section>

            <section class="password-change-card glass-panel" aria-labelledby="password-change-title">
              <h3 id="password-change-title">Đổi mật khẩu</h3>
              <p>Nhập mật khẩu hiện tại để xác minh trước khi đặt mật khẩu mới.</p>
              <form id="change-password-form" class="password-change-form">
                <label class="attendance-field">
                  <span>Mật khẩu hiện tại</span>
                  <input class="form-input" type="password" name="currentPassword" autocomplete="current-password" required>
                </label>
                <label class="attendance-field">
                  <span>Mật khẩu mới (ít nhất 8 ký tự)</span>
                  <input class="form-input" type="password" name="newPassword" minlength="8" maxlength="1024" autocomplete="new-password" required>
                </label>
                <label class="attendance-field">
                  <span>Xác nhận mật khẩu mới</span>
                  <input class="form-input" type="password" name="confirmPassword" minlength="8" maxlength="1024" autocomplete="new-password" required>
                </label>
                <div class="attendance-form-actions">
                  <button class="btn-submit" type="submit">Cập nhật mật khẩu</button>
                  <p id="change-password-feedback" class="attendance-feedback" aria-live="polite"></p>
                </div>
              </form>
            </section>

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
                <p class="card-desc">Phiên được tự gia hạn khi bạn đang hoạt động. Đăng xuất sẽ thu hồi phiên này ngay trên máy chủ.</p>

                <div class="token-inspector">
                  <div class="token-field">
                    <span class="field-label">Kiểu lưu trữ:</span>
                    <span class="storage-tag">${localStorage.getItem('dnkn_auth_token') ? 'localStorage (Duy trì)' : 'sessionStorage (Theo phiên)'}</span>
                  </div>
                  <div class="token-field">
                    <span class="field-label">Thời điểm tải bảng điều khiển:</span>
                    <span class="field-val">${new Date().toLocaleString('vi-VN')}</span>
                  </div>
                  <div class="token-field">
                    <span class="field-label">Trạng thái phiên đăng nhập:</span>
                    <div class="token-code-box">
                      <code>${state.token || session.token ? 'Đang hoạt động' : 'Không hoạt động'}</code>
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

            <div class="dash-footer-actions">
              <button type="button" class="btn-secondary" id="btn-switch-account">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                </svg>
                <span>Đăng nhập tài khoản khác (Kiểm thử vai trò khác)</span>
              </button>
            </div>
          </section>

          ${canManageUsers ? `
            <section class="dashboard-content-view user-management-view" data-dashboard-view="user-management" ${currentNavId === 'user-management' ? '' : 'hidden'} aria-labelledby="users-title">
              <header class="dashboard-section-heading">
                <span class="dashboard-section-eyebrow">QUẢN TRỊ HỆ THỐNG · PHÂN QUYỀN NHÂN SỰ</span>
                <h2 id="users-title">Quản lý tài khoản người dùng</h2>
                <p>Cấp quyền truy cập, chỉnh sửa thông tin và quản lý trạng thái tài khoản.</p>
              </header>
              <div class="user-management-notice">
                <span>ⓘ</span><div><strong>Quy trình cấp tài khoản</strong><small>Tài khoản mới ở trạng thái chờ kích hoạt. Hệ thống gửi liên kết kích hoạt qua email; email trùng sẽ bị từ chối.</small></div>
              </div>
              <div id="user-management-mount"></div>
              <details class="bulk-import-disclosure">
                <summary>Nhập danh sách người dùng từ Excel</summary>
                <div id="bulk-import-mount"></div>
              </details>
            </section>
          ` : ''}

          ${['ADMIN', 'TEACHER'].includes(role) ? `
            <section class="dashboard-content-view class-management-view" data-dashboard-view="class-management" hidden aria-labelledby="class-management-title">
              <header class="dashboard-section-heading">
                <span class="dashboard-section-eyebrow">QUẢN LÝ LỚP HỌC</span>
                <h2 id="class-management-title">Bàn giao lớp</h2>
                <p>Theo dõi giảng viên phụ trách và bàn giao lớp khi tài khoản giảng viên bị khóa.</p>
              </header>
              <div id="class-handover-mount"></div>
            </section>
          ` : ''}

          ${canManageEnrollments ? `
            <section class="dashboard-content-view" data-dashboard-view="enrollment-management" hidden aria-labelledby="enrollment-title">
              <header class="dashboard-section-heading">
                <span class="dashboard-section-eyebrow">QUẢN LÝ ĐÀO TẠO · GHI DANH HỌC VIÊN</span>
                <h2 id="enrollment-title">Ghi danh học viên vào lớp</h2>
                <p>Chọn lớp và một hoặc nhiều học viên đang hoạt động. Mỗi kết quả được lưu kèm lịch sử người thực hiện.</p>
              </header>
              <div id="enrollment-management-mount"></div>
            </section>
          ` : ''}

          ${canManageAssignments ? `
            <section class="dashboard-content-view" data-dashboard-view="teaching-assignment" hidden aria-labelledby="teaching-assignment-title">
              <header class="dashboard-section-heading">
                <span class="dashboard-section-eyebrow">QUẢN LÝ ĐÀO TẠO · PHÂN CÔNG GIẢNG DẠY (DNKN-179)</span>
                <h2 id="teaching-assignment-title">Phân công giảng viên và trợ giảng theo từng môn</h2>
                <p>Phân công giảng viên chịu trách nhiệm chuyên môn và trợ giảng hỗ trợ cho lớp theo từng môn học.</p>
              </header>
              <div id="teaching-assignment-mount"></div>
            </section>
          ` : ''}

          ${canManageAttendance ? `
            <section class="dashboard-content-view attendance-view" data-dashboard-view="attendance" hidden aria-labelledby="attendance-title">
              <header class="dashboard-section-heading">
                <span class="dashboard-section-eyebrow">QUẢN LÝ LỚP HỌC · THEO DÕI CHUYÊN CẦN</span>
                <h2 id="attendance-title">Điểm danh sinh viên</h2>
                <p>Ghi nhận tình trạng tham gia buổi học, cập nhật trạng thái và ghi chú cho từng sinh viên.</p>
              </header>
              <div class="attendance-panel dash-card glass-panel">
                <form id="attendance-form" class="attendance-form" data-draft-key="attendance-entry">
                  <div class="attendance-session-card">
                    <label class="attendance-field">
                      <span>Lớp học</span>
                      <select class="form-input" name="className" required>
                        <option value="">Đang tải danh sách lớp...</option>
                      </select>
                    </label>
                    <label class="attendance-field">
                      <span>Ngày điểm danh</span>
                      <input class="form-input" type="date" name="attendanceDate" value="${getLocalToday()}" required>
                    </label>
                    <div class="attendance-session-detail">Buổi học<br><strong>Ghi nhận theo dữ liệu thực tế</strong></div>
                  </div>
                  <div class="attendance-summary-grid" id="attendance-summary-grid" aria-live="polite"></div>
                  <label class="attendance-field">
                    <span>Sinh viên</span>
                    <select class="form-input" name="studentId" required>
                      <option value="">Đang tải danh sách sinh viên...</option>
                    </select>
                    <small id="attendance-student-details" class="attendance-student-details" aria-live="polite"></small>
                  </label>
                  <label class="attendance-field">
                    <span>Trạng thái</span>
                    <select class="form-input" name="status" required>
                      <option value="present">Có mặt</option>
                      <option value="late">Đi muộn</option>
                      <option value="absent">Vắng mặt</option>
                      <option value="excused">Có phép</option>
                    </select>
                  </label>
                  <label class="attendance-field attendance-note-field">
                    <span>Ghi chú (không bắt buộc)</span>
                    <textarea class="form-input" name="note" maxlength="500" rows="3"></textarea>
                  </label>
                  <div class="attendance-form-actions">
                    <button class="btn-submit" type="submit">Lưu điểm danh</button>
                    <p id="attendance-feedback" class="attendance-feedback" aria-live="polite"></p>
                  </div>
                </form>
                <div class="attendance-records">
                  <h3>Danh sách điểm danh gần đây</h3>
                  <p class="card-desc">Dữ liệu thực tế được tải từ hệ thống.</p>
                  <div id="attendance-record-list" aria-live="polite">Đang tải dữ liệu điểm danh...</div>
                </div>
              </div>
            </section>
          ` : ''}

          <section class="dashboard-content-view user-profile-view" data-dashboard-view="user-profile" ${currentNavId === 'user-profile' ? '' : 'hidden'} aria-labelledby="user-profile-title">
            <header class="dashboard-section-heading">
              <span class="dashboard-section-eyebrow">THÔNG TIN CÁ NHÂN &amp; LIÊN LẠC</span>
              <h2 id="user-profile-title">Hồ sơ cá nhân</h2>
              <p>Xem và cập nhật thông tin liên lạc chính xác để trung tâm có thể kết nối khi cần.</p>
            </header>
            <div id="user-profile-mount"></div>
          </section>
        </main>
      </div>
    `;

    const restoredDraftCount = restoreFormDrafts(container);
    if (restoredDraftCount > 0) {
      const mainContent = container.querySelector('.dash-main-content');
      const notice = document.createElement('div');
      notice.className = 'draft-restored-banner';
      notice.setAttribute('role', 'status');
      notice.textContent = 'Đã khôi phục bản nháp biểu mẫu từ phiên làm việc trước.';
      mainContent?.prepend(notice);
    }
    const mainContentArea = container.querySelector('.dash-main-content');
    if (mainContentArea) {
      loadDashboardMetrics();
      container.querySelector('#dashboard-metrics-refresh')?.addEventListener('click', loadDashboardMetrics);
      const navEl = createRoleNavigation(role);
      const navMount = container.querySelector('#role-nav-mount');
      navMount?.append(navEl);

      if (activeViewId) {
        navEl.querySelectorAll('.role-nav-link').forEach(btn => {
          btn.classList.toggle('is-active', btn.dataset.navId === activeViewId);
        });
      }
      if (currentNavId === 'user-profile') {
        const profileMount = container.querySelector('#user-profile-mount');
        if (profileMount && !profileMount.dataset.initialized) {
          renderUserProfilePanel(profileMount);
          profileMount.dataset.initialized = 'true';
        }
      }

      const importDisclosure = container.querySelector('.bulk-import-disclosure');
      importDisclosure?.addEventListener('toggle', () => {
        const importMount = container.querySelector('#bulk-import-mount');
        if (importDisclosure.open && importMount && !importMount.dataset.initialized) {
          renderImportUsersPanel(importMount);
          importMount.dataset.initialized = 'true';
        }
      });
      if (role === 'ADMIN') {
        const usersMount = container.querySelector('#user-management-mount');
        if (usersMount) {
          renderUserManagementPanel(usersMount);
          usersMount.dataset.initialized = 'true';
        }
      }

      // Kết nối điều hướng với màn hình chức năng theo nav-id
      navEl.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-nav-id]');
        if (!btn) return;
        const navId = btn.dataset.navId;

        if (['dashboard', 'attendance', 'user-management', 'class-management', 'enrollment-management', 'teaching-assignment', 'user-profile'].includes(navId)) {
          activeViewId = navId;
          container.querySelectorAll('[data-dashboard-view]').forEach((view) => {
            view.hidden = view.dataset.dashboardView !== navId;
          });
          navEl.querySelectorAll('.role-nav-link').forEach(b => {
            b.classList.toggle('is-active', b.dataset.navId === navId);
          });
          const titles = {
            dashboard: 'Bảng điều khiển',
            attendance: 'Điểm danh',
            'user-management': 'Quản lý người dùng',
            'class-management': 'Bàn giao lớp',
            'enrollment-management': 'Ghi danh học viên',
            'teaching-assignment': 'Phân công giảng dạy',
            'user-profile': 'Hồ sơ cá nhân'
          };
          const breadcrumb = container.querySelector('#dashboard-breadcrumb');
          if (breadcrumb) breadcrumb.textContent = titles[navId];

          if (navId === 'user-profile') {
            const profileMount = container.querySelector('#user-profile-mount');
            if (profileMount && !profileMount.dataset.initialized) {
              renderUserProfilePanel(profileMount);
              profileMount.dataset.initialized = 'true';
            }
          }

          if (navId === 'user-management') {
            const usersMount = container.querySelector('#user-management-mount');
            if (usersMount && !usersMount.dataset.initialized) {
              renderUserManagementPanel(usersMount);
              usersMount.dataset.initialized = 'true';
            }
          }

          if (navId === 'class-management') {
            const classMount = container.querySelector('#class-handover-mount');
            if (classMount && !classMount.dataset.initialized) {
              renderClassHandoverPanel(classMount, role === 'ADMIN', (count) => {
                const navButton = container.querySelector('[data-nav-id="class-management"]');
                if (!navButton) return;
                const oldBadge = navButton.querySelector('.nav-item-count');
                oldBadge?.remove();
                if (count > 0) {
                  const badge = document.createElement('span');
                  badge.className = 'nav-item-count';
                  badge.textContent = String(count);
                  navButton.append(badge);
                }
              });
              classMount.dataset.initialized = 'true';
            }
          }

          if (navId === 'enrollment-management') {
            const enrollmentMount = container.querySelector('#enrollment-management-mount');
            if (enrollmentMount && !enrollmentMount.dataset.initialized) {
              renderEnrollmentPanel(enrollmentMount);
              enrollmentMount.dataset.initialized = 'true';
            }
          }

          if (navId === 'teaching-assignment') {
            const assignmentMount = container.querySelector('#teaching-assignment-mount');
            if (assignmentMount && !assignmentMount.dataset.initialized) {
              renderTeachingAssignmentPanel(assignmentMount);
              assignmentMount.dataset.initialized = 'true';
            }
          }

          return;
        }

        if (navId === 'course-catalog') {
          e.stopPropagation();
          window.location.assign('/courses');
          return;
        }

        if (navId === 'lead-management') {
          e.stopPropagation();
          window.location.assign('/lead-management');
          return;
        }

      });
    }
    bindEvents();
    container.querySelector('#btn-sidebar-password')?.addEventListener('click', () => {
      const dashboardButton = container.querySelector('[data-nav-id="dashboard"]');
      dashboardButton?.click();
      container.querySelector('#password-change-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    container.querySelector('.sidebar-user')?.addEventListener('click', () => {
      const profileButton = container.querySelector('[data-nav-id="user-profile"]');
      profileButton?.click();
    });
    container.querySelector('.user-pill')?.addEventListener('click', () => {
      const profileButton = container.querySelector('[data-nav-id="user-profile"]');
      profileButton?.click();
    });
  }

  function bindEvents() {
    const logoutBtn = container.querySelector('#btn-logout');
    const switchAccountBtn = container.querySelector('#btn-switch-account');
    const attendanceForm = container.querySelector('#attendance-form');
    const changePasswordForm = container.querySelector('#change-password-form');

    if (changePasswordForm) {
      changePasswordForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitButton = changePasswordForm.querySelector('[type="submit"]');
        const feedback = container.querySelector('#change-password-feedback');
        const formData = new FormData(changePasswordForm);
        const currentPassword = formData.get('currentPassword');
        const newPassword = formData.get('newPassword');
        const confirmPassword = formData.get('confirmPassword');

        if (newPassword !== confirmPassword) {
          feedback.textContent = 'Xác nhận mật khẩu mới không khớp.';
          feedback.className = 'attendance-feedback is-error';
          return;
        }

        submitButton.disabled = true;
        feedback.textContent = 'Đang cập nhật mật khẩu...';
        feedback.className = 'attendance-feedback';

        try {
          await changePasswordApi(authState.getState().token, currentPassword, newPassword);
          changePasswordForm.reset();
          feedback.textContent = 'Đổi mật khẩu thành công.';
          feedback.className = 'attendance-feedback is-success';
        } catch (error) {
          feedback.textContent = error.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.';
          feedback.className = 'attendance-feedback is-error';
        } finally {
          submitButton.disabled = false;
        }
      });
    }

    if (attendanceForm) {
      loadAttendanceClasses(attendanceForm);
      loadAttendanceStudents(attendanceForm);
      loadAttendanceRecords();
      attendanceForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitButton = attendanceForm.querySelector('[type="submit"]');
        const feedback = container.querySelector('#attendance-feedback');
        submitButton.disabled = true;
        feedback.textContent = 'Đang lưu điểm danh...';
        feedback.className = 'attendance-feedback';

        try {
          const formData = new FormData(attendanceForm);
          await createAttendanceRecord({
            className: formData.get('className'),
            studentId: formData.get('studentId'),
            attendanceDate: formData.get('attendanceDate'),
            status: formData.get('status'),
            note: formData.get('note')
          });
          attendanceForm.reset();
          attendanceForm.elements.attendanceDate.value = getLocalToday();
          clearFormDraft(attendanceForm);
          feedback.textContent = 'Đã lưu điểm danh.';
          feedback.classList.add('is-success');
          await loadAttendanceRecords();
        } catch (error) {
          feedback.textContent = error.message || 'Không thể lưu điểm danh. Vui lòng thử lại.';
          feedback.classList.add('is-error');
        } finally {
          submitButton.disabled = false;
        }
      });

      attendanceForm.elements.studentId.addEventListener('change', () => {
        const selectedOption = attendanceForm.elements.studentId.selectedOptions[0];
        const details = container.querySelector('#attendance-student-details');
        if (details) details.textContent = selectedOption?.dataset.email || '';
      });
      attendanceForm.elements.className.addEventListener('change', paintAttendanceData);
      attendanceForm.elements.attendanceDate.addEventListener('change', paintAttendanceData);
    }

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

  async function loadAttendanceClasses(form) {
    const classSelect = form.elements.className;
    const feedback = container.querySelector('#attendance-feedback');

    try {
      const classes = await getClasses();
      if (container.querySelector('#attendance-form') !== form) return;

      classSelect.replaceChildren(new Option('Chọn lớp học', ''));
      classes
        .filter(item => item.status === 'active')
        .forEach(item => classSelect.add(new Option(`${item.code} — ${item.name}`, item.name)));
      classSelect.disabled = classSelect.options.length <= 1;
      if (classSelect.disabled && feedback) {
        feedback.textContent = 'Chưa có lớp học đang hoạt động trong hệ thống.';
        feedback.className = 'attendance-feedback is-error';
      }

      restoreFormDrafts(container);
      paintAttendanceData();
    } catch (error) {
      if (container.querySelector('#attendance-form') !== form) return;
      classSelect.replaceChildren(new Option('Không tải được danh sách lớp học', ''));
      classSelect.disabled = true;
      if (feedback) {
        feedback.textContent = error.message || 'Không thể tải danh sách lớp học.';
        feedback.className = 'attendance-feedback is-error';
      }
    }
  }

  async function loadAttendanceStudents(form) {
    const studentSelect = form.elements.studentId;
    const feedback = container.querySelector('#attendance-feedback');

    try {
      const students = await getAttendanceStudents();
      if (container.querySelector('#attendance-form') !== form) return;

      studentSelect.replaceChildren(new Option('Chọn học sinh', ''));
      students.forEach(student => {
        const option = new Option(`${student.name} — ${student.email}`, student.id);
        option.dataset.email = student.email;
        studentSelect.add(option);
      });
      studentSelect.disabled = students.length === 0;
      if (students.length === 0 && feedback) {
        feedback.textContent = 'Chưa có học sinh đang hoạt động trong Quản lý người dùng.';
        feedback.className = 'attendance-feedback is-error';
      }

      restoreFormDrafts(container);
      const selectedOption = studentSelect.selectedOptions[0];
      const details = container.querySelector('#attendance-student-details');
      if (details) details.textContent = selectedOption?.dataset.email || '';
      paintAttendanceData();
    } catch (error) {
      if (container.querySelector('#attendance-form') !== form) return;
      studentSelect.replaceChildren(new Option('Không tải được danh sách học sinh', ''));
      studentSelect.disabled = true;
      if (feedback) {
        feedback.textContent = error.message || 'Không thể tải danh sách học sinh.';
        feedback.className = 'attendance-feedback is-error';
      }
    }
  }

  async function loadAttendanceRecords() {
    const list = container.querySelector('#attendance-record-list');
    if (!list) return;
    const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);

    try {
      attendanceRecords = await getAttendanceRecords();
      if (container.querySelector('#attendance-record-list') !== list) return;
      paintAttendanceData();
    } catch (error) {
      if (container.querySelector('#attendance-record-list') === list) {
        list.textContent = error.message || 'Không thể tải dữ liệu điểm danh.';
      }
    }
  }

  function paintAttendanceData() {
    const list = container.querySelector('#attendance-record-list');
    const form = container.querySelector('#attendance-form');
    if (!list || !form) return;
    const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
    const className = form.elements.className.value.trim().toLocaleLowerCase();
    const attendanceDate = form.elements.attendanceDate.value;
    const records = attendanceRecords.filter((record) =>
      (!className || record.className.toLocaleLowerCase().includes(className))
      && (!attendanceDate || record.attendanceDate === attendanceDate)
    );
    const count = (status) => records.filter(record => record.status === status).length;
    const activeStudents = Math.max(0, form.elements.studentId.options.length - 1);
    const summary = container.querySelector('#attendance-summary-grid');
    if (summary) {
      const stats = [
        ['Sinh viên hoạt động', activeStudents, 'trong hệ thống', 'violet'],
        ['Có mặt', count('present'), 'đã ghi nhận', 'green'],
        ['Vắng mặt', count('absent'), 'chưa có lý do', 'red'],
        ['Đi muộn', count('late'), 'đã ghi nhận', 'orange'],
        ['Có phép', count('excused'), 'đã xác nhận', 'blue']
      ];
      summary.innerHTML = stats.map(([label, value, detail, color]) => `
        <div class="attendance-stat is-${color}">
          <span>${escape(label)}</span><strong>${value}</strong><small>${escape(detail)}</small>
        </div>
      `).join('');
    }
    list.innerHTML = records.length
        ? `<div class="attendance-table-wrap"><table class="attendance-table">
            <thead><tr><th>Ngày</th><th>Lớp</th><th>Học sinh</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead>
            <tbody>${records.map(record => `
              <tr>
                <td>${escape(record.attendanceDate)}</td>
                <td>${escape(record.className)}</td>
                <td>${escape(record.studentName)}<small>${escape(record.studentEmail)}</small></td>
                <td><span class="attendance-status-chip is-${escape(record.status)}">${escape({ present: 'Có mặt', late: 'Đi muộn', absent: 'Vắng mặt', excused: 'Có phép' }[record.status] || record.status)}</span></td>
                <td>${escape(record.note || '—')}</td>
              </tr>
            `).join('')}</tbody>
          </table></div>`
        : '<p class="attendance-empty">Chưa có dữ liệu điểm danh phù hợp với lớp và ngày đã chọn.</p>';
  }

  const unsubscribe = authState.subscribe(() => {
    const state = authState.getState();
    if (state.isAuthenticated) {
      update();
    }
  });

  return unsubscribe;
}

/**
 * DNKN-3: Màn hình hiển thị sau khi điều hướng dựa trên Role (Role-based Navigation)
 * Chứng minh kết quả chuyển hướng, quản lý session/token và vai trò người dùng
 */

import { authState } from '../core/authState.js';
import { getAuthSession } from '../core/storage.js';
import { clearFormDraft, restoreFormDrafts } from '../core/formDrafts.js';
import { createAttendanceRecord, getAttendanceRecords, getAttendanceStudents } from '../core/attendanceService.js';
import { changePasswordApi } from '../core/authService.js';

export function renderRoleDashboard(container) {
  function getLocalToday() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  function update() {
    const state = authState.getState();
    const session = getAuthSession();
    const user = state.user || session.user;
    const role = (state.role || session.role || 'USER').toUpperCase();
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
                  <span class="route-badge">Đường dẫn hiện tại: <strong>${escapeHtml(targetNav.path || currentMeta.route)}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <div class="dash-nav-right">
            <div class="user-pill glass-panel">
              <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(user.fullName)}" class="user-avatar" />
              <div class="user-meta">
                <span class="user-name">${escapeHtml(user.fullName)}</span>
                <span class="user-email">${escapeHtml(user.email)}</span>
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
                  <span class="field-label">Thời điểm đăng nhập:</span>
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

          ${canManageAttendance ? `
            <section class="attendance-panel dash-card glass-panel" aria-labelledby="attendance-title">
              <div class="card-title-row">
                <h3 id="attendance-title">Điểm danh lớp học</h3>
              </div>
              <p class="card-desc">Phiên làm việc và bản nháp biểu mẫu được duy trì khi bạn còn hoạt động.</p>
              <form id="attendance-form" class="attendance-form" data-draft-key="attendance-entry">
                <label class="attendance-field">
                  <span>Tên lớp</span>
                  <input class="form-input" name="className" maxlength="120" required autocomplete="off">
                </label>
                <label class="attendance-field">
                  <span>Học sinh (tên và email từ Quản lý người dùng)</span>
                  <select class="form-input" name="studentId" required>
                    <option value="">Đang tải danh sách học sinh...</option>
                  </select>
                  <small id="attendance-student-details" class="attendance-student-details" aria-live="polite"></small>
                </label>
                <label class="attendance-field">
                  <span>Ngày điểm danh</span>
                  <input class="form-input" type="date" name="attendanceDate" value="${getLocalToday()}" required>
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
                <h4>Điểm danh gần đây</h4>
                <div id="attendance-record-list" aria-live="polite">Đang tải dữ liệu điểm danh...</div>
              </div>
            </section>
          ` : ''}

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

    const restoredDraftCount = restoreFormDrafts(container);
    if (restoredDraftCount > 0) {
      const mainContent = container.querySelector('.dash-main-content');
      const notice = document.createElement('div');
      notice.className = 'draft-restored-banner';
      notice.setAttribute('role', 'status');
      notice.textContent = 'Đã khôi phục bản nháp biểu mẫu từ phiên làm việc trước.';
      mainContent?.prepend(notice);
    }

    bindEvents();
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
      const records = await getAttendanceRecords();
      if (container.querySelector('#attendance-record-list') !== list) return;
      list.innerHTML = records.length
        ? `<div class="attendance-table-wrap"><table class="attendance-table">
            <thead><tr><th>Ngày</th><th>Lớp</th><th>Học sinh</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead>
            <tbody>${records.map(record => `
              <tr>
                <td>${escape(record.attendanceDate)}</td>
                <td>${escape(record.className)}</td>
                <td>${escape(record.studentName)}<small>${escape(record.studentEmail)}</small></td>
                <td>${escape({ present: 'Có mặt', late: 'Đi muộn', absent: 'Vắng mặt', excused: 'Có phép' }[record.status] || record.status)}</td>
                <td>${escape(record.note || '—')}</td>
              </tr>
            `).join('')}</tbody>
          </table></div>`
        : '<p class="attendance-empty">Chưa có dữ liệu điểm danh.</p>';
    } catch (error) {
      if (container.querySelector('#attendance-record-list') === list) {
        list.textContent = error.message || 'Không thể tải dữ liệu điểm danh.';
      }
    }
  }

  const unsubscribe = authState.subscribe(() => {
    const state = authState.getState();
    if (state.isAuthenticated) {
      update();
    }
  });

  return unsubscribe;
}

/**
 * DNKN-14 / DNKN-39: Menu điều hướng và Xử lý trạng thái không có quyền truy cập
 */

import { getSafeAppPath, ROLE_NAVIGATION_MAP } from '../core/navigation.js';
import { renderAppErrorScreen } from './AppErrorScreen.js';

const ALL_NAV_ITEMS = [
  { id: 'user-management', label: 'Quản lý người dùng', icon: '👥', roles: ['ADMIN'] },
  { id: 'attendance', label: 'Điểm danh', icon: '📝', roles: ['ADMIN', 'TEACHER', 'ASSISTANT'] },
  { id: 'class-management', label: 'Bàn giao lớp', icon: '🔄', roles: ['ADMIN', 'TEACHER'] },
  { id: 'dashboard', label: 'Bảng điều khiển', icon: '📊', roles: ['ADMIN', 'TEACHER', 'ASSISTANT', 'STUDENT', 'MANAGER', 'USER'] },
  { id: 'class-list', label: 'Danh sách lớp học', icon: '🏫', roles: ['ADMIN', 'MANAGER', 'TRAINING_STAFF'] },
  { id: 'classroom-management', label: 'Quản lý phòng học', icon: '🏢', roles: ['ADMIN', 'MANAGER'] },
  { id: 'course-catalog', label: 'Danh mục môn học', icon: '📚', roles: ['ADMIN', 'MANAGER'] },
  { id: 'training-programs', label: 'Chương trình đào tạo', icon: '📜', roles: ['ADMIN', 'MANAGER'] },
  { id: 'teaching-assignment', label: 'Phân công giảng dạy', icon: '👨‍🏫', roles: ['ADMIN', 'MANAGER'] },
  { id: 'enrollment-management', label: 'Ghi danh học viên', icon: '🎓', roles: ['ADMIN', 'MANAGER', 'TRAINING_STAFF'] },
  { id: 'system-logs', label: 'Nhật ký hệ thống', icon: '🛡️', roles: ['ADMIN'] },
  { id: 'my-courses', label: 'Lớp học của tôi', icon: '🎓', roles: ['STUDENT'] },
  { id: 'my-tasks', label: 'Nhiệm vụ được giao', icon: '💼', roles: ['USER', 'STUDENT'] },
  { id: 'approval', label: 'Phê duyệt yêu cầu', icon: '📑', roles: ['MANAGER', 'ADMIN'] },
  {
    id: 'training-management',
    label: 'Quản lý đào tạo',
    icon: '📋',
    roles: ['ADMIN', 'MANAGER', 'TRAINING_STAFF'],
    children: [
      { id: 'lead-management', label: 'Quản lý Lead', roles: ['ADMIN', 'MANAGER', 'TRAINING_STAFF'] }
    ]
  },
  { id: 'user-profile', label: 'Hồ sơ cá nhân', icon: '👤', roles: ['ADMIN', 'TEACHER', 'ASSISTANT', 'STUDENT', 'MANAGER', 'TRAINING_STAFF', 'ACCOUNTANT', 'DEPARTMENT_HEAD', 'USER'] },
  { id: 'profile-security', label: 'Đổi mật khẩu & Bảo mật', icon: '🔐', roles: ['ADMIN', 'TEACHER', 'ASSISTANT', 'STUDENT', 'MANAGER', 'USER'] }
];

export function createRoleNavigation(role) {
  const currentRole = (role || 'USER').toUpperCase();
  const authorizedItems = ALL_NAV_ITEMS.filter(item => item.roles.includes(currentRole));
  const requestedView = new URLSearchParams(window.location.search).get('view');
  const activeNavId = requestedView === 'classes'
    ? 'class-list'
    : requestedView === 'classrooms'
      ? 'classroom-management'
      : currentRole === 'ADMIN' ? 'user-management' : 'dashboard';

  const navElement = document.createElement('nav');
  navElement.className = 'role-navigation-bar glass-panel';
  navElement.id = 'role-nav-bar';
  navElement.setAttribute('aria-label', 'Menu chức năng theo quyền');

  navElement.innerHTML = `
    <ul class="role-nav-list">
      ${authorizedItems.map((item, index) => `
        <li class="role-nav-item">
          ${item.children
            ? `<details class="role-nav-group" open>
                <summary class="role-nav-link role-nav-group-toggle" data-nav-group-toggle>
                  <span class="nav-item-icon">${item.icon}</span>
                  <span class="nav-item-label">${item.label}</span>
                  <span class="role-nav-group-indicator" aria-hidden="true">▾</span>
                </summary>
                <ul class="role-nav-sublist">
                  ${item.children.filter(child => child.roles.includes(currentRole)).map(child => `
                    <li>
                      <button type="button" class="role-nav-link role-nav-sublink" data-nav-id="${child.id}">
                        <span class="role-nav-submarker" aria-hidden="true">•</span>
                        <span class="nav-item-label">${child.label}</span>
                      </button>
                    </li>
                  `).join('')}
                </ul>
              </details>`
            : `<button type="button" class="role-nav-link ${item.id === activeNavId ? 'is-active' : ''}" data-nav-id="${item.id}">
                <span class="nav-item-icon">${item.icon}</span>
                <span class="nav-item-label">${item.label}</span>
              </button>`}
        </li>
      `).join('')}
    </ul>
  `;

  // Xử lý chuyển tab & kiểm tra quyền (DNKN-39)
  const buttons = navElement.querySelectorAll('.role-nav-link');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.hasAttribute('data-nav-group-toggle')) return;
      const navId = btn.dataset.navId;
      const targetItem = ALL_NAV_ITEMS.flatMap(item => [item, ...(item.children || [])])
        .find(item => item.id === navId);

      // Nếu cố tình truy cập chức năng không có quyền
      if (!targetItem || !targetItem.roles.includes(currentRole)) {
        showAccessDeniedScreen(targetItem?.label || 'Chức năng này', currentRole);
        return;
      }

      // Nếu là chức năng có trang riêng biệt
      if (navId === 'lead-management') {
        window.location.assign('/lead-management');
        return;
      }
      if (navId === 'course-catalog') {
        window.location.assign('/courses');
        return;
      }

      buttons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      // Ẩn thông báo lỗi nếu chọn lại menu hợp lệ
      const errorBanner = document.querySelector('#access-denied-banner');
      if (errorBanner) errorBanner.remove();
    });
  });

  return navElement;
}

// DNKN-39: Dùng chung màn hình lỗi 403 cho mọi trường hợp thiếu quyền.
export function showAccessDeniedScreen(featureName, role) {
  renderAppErrorScreen(document.querySelector('#app'), {
    type: 'forbidden',
    safePath: getSafeAppPath(true, ROLE_NAVIGATION_MAP[role]),
    featureName,
    role
  });
}
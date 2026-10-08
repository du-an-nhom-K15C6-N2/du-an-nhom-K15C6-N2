/**
 * DNKN-14 / DNKN-39: Menu điều hướng và Xử lý trạng thái không có quyền truy cập
 */

import { getSafeAppPath, ROLE_NAVIGATION_MAP } from '../core/navigation.js';
import { renderAppErrorScreen } from './AppErrorScreen.js';

const ALL_NAV_ITEMS = [
  { id: 'dashboard', label: 'Bảng điều khiển', icon: '📊', roles: ['ADMIN', 'TEACHER', 'ASSISTANT', 'STUDENT', 'MANAGER', 'USER'] },
  { id: 'attendance', label: 'Điểm danh lớp học', icon: '📝', roles: ['ADMIN', 'TEACHER', 'ASSISTANT'] },
  { id: 'class-management', label: 'Quản lý lớp học', icon: '🏫', roles: ['ADMIN', 'TEACHER'] },
  { id: 'user-management', label: 'Quản lý người dùng', icon: '👥', roles: ['ADMIN'] },
  { id: 'system-logs', label: 'Nhật ký hệ thống', icon: '🛡️', roles: ['ADMIN'] },
  { id: 'my-courses', label: 'Lớp học của tôi', icon: '🎓', roles: ['STUDENT'] },
  { id: 'my-tasks', label: 'Nhiệm vụ được giao', icon: '💼', roles: ['USER', 'STUDENT'] },
  { id: 'approval', label: 'Phê duyệt yêu cầu', icon: '📑', roles: ['MANAGER', 'ADMIN'] },
  { id: 'profile-security', label: 'Đổi mật khẩu & Bảo mật', icon: '🔐', roles: ['ADMIN', 'TEACHER', 'ASSISTANT', 'STUDENT', 'MANAGER', 'USER'] }
];

export function createRoleNavigation(role) {
  const currentRole = (role || 'USER').toUpperCase();
  const authorizedItems = ALL_NAV_ITEMS.filter(item => item.roles.includes(currentRole));

  const navElement = document.createElement('nav');
  navElement.className = 'role-navigation-bar glass-panel';
  navElement.id = 'role-nav-bar';
  navElement.setAttribute('aria-label', 'Menu chức năng theo quyền');

  navElement.innerHTML = `
    <ul class="role-nav-list">
      ${authorizedItems.map((item, index) => `
        <li class="role-nav-item">
          <button type="button" class="role-nav-link ${index === 0 ? 'is-active' : ''}" data-nav-id="${item.id}">
            <span class="nav-item-icon">${item.icon}</span>
            <span class="nav-item-label">${item.label}</span>
          </button>
        </li>
      `).join('')}
    </ul>
  `;

  // Xử lý chuyển tab & kiểm tra quyền (DNKN-39)
  const buttons = navElement.querySelectorAll('.role-nav-link');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const navId = btn.dataset.navId;
      const targetItem = ALL_NAV_ITEMS.find(item => item.id === navId);

      // Nếu cố tình truy cập chức năng không có quyền
      if (!targetItem || !targetItem.roles.includes(currentRole)) {
        showAccessDeniedScreen(targetItem?.label || 'Chức năng này', currentRole);
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
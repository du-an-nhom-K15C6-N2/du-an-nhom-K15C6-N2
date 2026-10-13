/**
 * Entry point ứng dụng TTCS1 - Subtask [DNKN-3]
 * Kết nối Form Đăng nhập, State Quản lý, và Điều hướng Phân quyền Vai trò
 */

import './style.css';
import { authState } from './core/authState.js';
import { renderLoginForm } from './components/LoginForm.js';
import { renderRoleDashboard } from './components/RoleDashboard.js';

const appContainer = document.querySelector('#app');

if (!appContainer) {
  throw new Error('Không tìm thấy #app container trong DOM!');
}

let currentUnsubscribe = null;

function renderApp() {
  if (currentUnsubscribe) {
    currentUnsubscribe();
    currentUnsubscribe = null;
  }

  const state = authState.getState();

  if (state.isAuthenticated) {
    currentUnsubscribe = renderRoleDashboard(appContainer);
  } else {
    currentUnsubscribe = renderLoginForm(appContainer);
  }
}

// Lắng nghe sự kiện chuyển trang trong ứng dụng
window.addEventListener('app:navigate', (e) => {
  console.log('Điều hướng ứng dụng:', e.detail);
  renderApp();
});

window.addEventListener('popstate', () => {
  renderApp();
});

// Lắng nghe thay đổi trạng thái xác thực
authState.subscribe((state) => {
  const isCurrentlyInDashboard = Boolean(document.querySelector('.dashboard-wrapper'));
  if (state.isAuthenticated !== isCurrentlyInDashboard) {
    renderApp();
  }
});

// Khởi tạo hiển thị ban đầu
renderApp();

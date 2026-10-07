/**
 * Entry point ứng dụng TTCS1 - Subtask [DNKN-3]
 * Kết nối Form Đăng nhập, State Quản lý, và Điều hướng Phân quyền Vai trò
 */

import './style.css';
import { authState } from './core/authState.js';
import { registerAccessForbiddenHandler } from './core/accessForbidden.js';
import { saveFormDraft } from './core/formDrafts.js';
import {
  getAppRouteError,
  getSafeAppPath
} from './core/navigation.js';
import { renderLoginForm } from './components/LoginForm.js';
import { renderAppErrorScreen } from './components/AppErrorScreen.js';
import { renderRoleDashboard } from './components/RoleDashboard.js';

const appContainer = document.querySelector('#app');

if (!appContainer) {
  throw new Error('Không tìm thấy #app container trong DOM!');
}

let currentUnsubscribe = null;

function persistDraftFromEvent(event) {
  const form = event.target.closest?.('form');
  if (form) saveFormDraft(form);
}

document.addEventListener('input', persistDraftFromEvent, true);
document.addEventListener('change', persistDraftFromEvent, true);

function renderApp() {
  if (currentUnsubscribe) {
    currentUnsubscribe();
    currentUnsubscribe = null;
  }

  const state = authState.getState();
  const routeError = getAppRouteError(
    window.location.pathname,
    state.isAuthenticated,
    state.role
  );

  if (routeError) {
    currentUnsubscribe = renderAppErrorScreen(
      appContainer,
      {
        type: routeError,
        safePath: getSafeAppPath(state.isAuthenticated, state.navigationTarget)
      }
    );
  } else if (state.isAuthenticated) {
    currentUnsubscribe = renderRoleDashboard(appContainer);
  } else {
    currentUnsubscribe = renderLoginForm(appContainer);
  }
}

// Lắng nghe sự kiện chuyển trang trong ứng dụng
window.addEventListener('app:navigate', (e) => {
  console.log('Điều hướng ứng dụng:', e.detail);
  if (document.querySelector('.app-error-page')) {
    renderApp();
    return;
  }
  const isDashboard = Boolean(document.querySelector('.dashboard-wrapper'));
  if (authState.getState().isAuthenticated !== isDashboard) {
    renderApp();
  }
});

window.addEventListener('popstate', () => {
  renderApp();
});

registerAccessForbiddenHandler(appContainer, () => authState.getState());

window.addEventListener('app:resource-not-found', () => {
  const state = authState.getState();
  renderAppErrorScreen(appContainer, {
    type: 'not-found',
    safePath: getSafeAppPath(state.isAuthenticated, state.navigationTarget)
  });
});

// Lắng nghe thay đổi trạng thái xác thực
authState.subscribe((state) => {
  if (document.querySelector('.app-error-page')) {
    if (!getAppRouteError(window.location.pathname, state.isAuthenticated, state.role)) {
      renderApp();
    }
    return;
  }

  const isCurrentlyInDashboard = Boolean(document.querySelector('.dashboard-wrapper'));
  if (state.isAuthenticated !== isCurrentlyInDashboard) {
    renderApp();
  }
});

// Khởi tạo hiển thị ban đầu
renderApp();

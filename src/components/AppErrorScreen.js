import { getSafePreviousPath, navigateTo } from '../core/navigation.js';

const ERROR_CONTENT = {
  'not-found': {
    code: '404',
    eyebrow: 'Không tìm thấy trang',
    title: 'Có vẻ như đường dẫn này không tồn tại',
    description: 'Đường dẫn bạn truy cập có thể đã thay đổi hoặc không chính xác. Hãy quay lại khu vực an toàn hoặc trở về trang chủ nhé.'
  },
  forbidden: {
    code: '403',
    eyebrow: 'Bạn chưa được cấp quyền',
    title: 'Bạn không thể truy cập khu vực này',
    description: 'Tài khoản hiện tại chưa được cấp quyền truy cập. Hãy quay lại màn hình phù hợp với vai trò của bạn hoặc trở về trang chủ.'
  }
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

export function renderAppErrorScreen(container, {
  type = 'not-found',
  safePath = '/login',
  featureName = null,
  role = null
} = {}) {
  const content = ERROR_CONTENT[type];
  if (!content) {
    throw new Error(`Loại màn hình lỗi không được hỗ trợ: ${type}`);
  }

  const extraContext = type === 'forbidden' && featureName
    ? `<p class="app-error-context">Chức năng: <strong>${escapeHtml(featureName)}</strong>${role ? ` · Vai trò: <strong>${escapeHtml(role)}</strong>` : ''}</p>`
    : '';
  const previousPath = type === 'forbidden'
    ? getSafePreviousPath(document.referrer, window.location.origin, role, safePath)
    : null;

  container.innerHTML = `
    <main class="app-error-page" data-error-type="${type}" aria-labelledby="app-error-title">
      <section class="app-error-card glass-panel">
        <div class="app-error-code" aria-hidden="true">${content.code}</div>
        <p class="app-error-eyebrow">${content.eyebrow}</p>
        <h1 id="app-error-title">${content.title}</h1>
        <p class="app-error-description">${content.description}</p>
        ${extraContext}
        <div class="app-error-actions">
          <button type="button" class="btn-app-error-primary" id="btn-safe-screen">
            Quay lại màn hình an toàn
          </button>
          ${type === 'forbidden' ? `
            <button type="button" class="btn-app-error-secondary" id="btn-previous-page">
              Quay lại trang trước
            </button>
          ` : ''}
          <button type="button" class="btn-app-error-secondary" id="btn-home">
            Về trang chủ
          </button>
        </div>
      </section>
    </main>
  `;

  container.querySelector('#btn-safe-screen').addEventListener('click', () => {
    navigateTo(safePath);
  });
  if (previousPath) {
    container.querySelector('#btn-previous-page').addEventListener('click', () => {
      navigateTo(previousPath);
    });
  }
  container.querySelector('#btn-home').addEventListener('click', () => {
    navigateTo('/');
  });

  return () => {};
}

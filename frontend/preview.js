/**
 * Preview Runner cho DNKN-86: Xem & Cập nhật Hồ sơ cá nhân
 */

import { renderUserProfilePanel } from './components/UserProfilePanel.js';
import { saveAuthSession, getAuthSession } from './core/storage.js';
import { authState } from './core/authState.js';

// Danh sách tài khoản demo tương ứng với data/users.json
const DEMO_ACCOUNTS = {
  student: {
    email: 'an.nguyen@edu.vn',
    password: 'Password@123',
    label: 'Học sinh'
  },
  teacher: {
    email: 'mai.tran@edu.vn',
    password: 'Password@123',
    label: 'Giảng viên'
  },
  admin: {
    email: 'hoang@edu.vn',
    password: 'Password@123',
    label: 'Quản trị viên'
  }
};

let currentAccountKey = 'student';

async function loginAndMount(accountKey) {
  const container = document.getElementById('profile-container');
  if (!container) return;

  const creds = DEMO_ACCOUNTS[accountKey];
  if (!creds) return;

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 4rem 1rem; color: #94a3b8; font-size: 0.95rem;">
      <div style="font-size: 2rem; margin-bottom: 0.75rem; animation: spin 1s linear infinite;">⏳</div>
      <div>Đang đăng nhập tài khoản demo (${creds.label})...</div>
    </div>
  `;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: creds.email, password: creds.password })
    });

    const data = await res.json();
    if (!res.ok || !data.token) {
      throw new Error(data.message || 'Đăng nhập thất bại.');
    }

    // Lưu session và cập nhật authState
    saveAuthSession({ token: data.token, user: data.user, rememberMe: true });
    authState.setState({
      token: data.token,
      user: data.user,
      role: data.user.role,
      isAuthenticated: true
    });

    // Render component UserProfilePanel vào container
    renderUserProfilePanel(container);
  } catch (error) {
    console.error('Lỗi khởi tạo hồ sơ:', error);
    container.innerHTML = `
      <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 12px; padding: 1.5rem; color: #fca5a5;">
        <h3 style="margin-top:0; color:#f87171;">⚠️ Không thể kết nối API máy chủ</h3>
        <p style="margin: 0.5rem 0;">${error.message || 'Vui lòng đảm bảo preview-server đang chạy trên port 3086.'}</p>
        <p style="margin: 0; font-size: 0.85rem; color: #fca5a5;">Gợi ý: Mở terminal tại thư mục này và chạy lệnh <code>node preview-server.js</code></p>
      </div>
    `;
  }
}

// Thiết lập chuyển đổi tài khoản
function initAccountSwitcher() {
  const buttons = document.querySelectorAll('.btn-account-pill');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const accountKey = btn.getAttribute('data-account');
      if (!accountKey || accountKey === currentAccountKey) return;

      buttons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      currentAccountKey = accountKey;

      loginAndMount(currentAccountKey);
    });
  });
}

// Khởi chạy khi tài liệu HTML sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  initAccountSwitcher();
  loginAndMount('student');
});

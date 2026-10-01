// ===== Tiện ích dùng chung =====
const TOKEN_KEY = 'dnkn_token';

const ROLE_COLORS = {
  ADMIN: 'role-red',
  GIANG_VIEN: 'role-blue',
  QUAN_LY_DAO_TAO: 'role-violet',
  HOC_VIEN: 'role-green',
};

const NAV_ITEMS = [
  { href: '/index.html', key: 'dashboard', ico: '📊', label: 'Tổng quan' },
  { href: '/users.html', key: 'users', ico: '👥', label: 'Người dùng' },
  { href: '/roles.html', key: 'roles', ico: '🛡️', label: 'Vai trò' },
  { href: '/audit.html', key: 'audit', ico: '🕓', label: 'Lịch sử thao tác' },
];

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setSession(token, user) { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem('dnkn_user', JSON.stringify(user)); }
function clearSession() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem('dnkn_user'); }

async function api(path, options = {}) {
  const res = await fetch('/api' + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}),
    },
    ...options,
  });
  if (res.status === 401) {
    clearSession();
    location.href = '/login.html';
    throw new Error('Phiên đăng nhập hết hạn');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Đã xảy ra lỗi');
  return data;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function parseDate(s) {
  const d = new Date(String(s || '').replace(' ', 'T'));
  return isNaN(d) ? null : d;
}
function fmtDate(s) { const d = parseDate(s); return d ? d.toLocaleDateString('vi-VN') : (s || ''); }
function fmtDateTime(s) {
  const d = parseDate(s);
  return d ? d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : (s || '');
}
function timeAgo(s) {
  const d = parseDate(s);
  if (!d) return s || '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return Math.floor(diff / 60) + ' phút trước';
  if (diff < 86400) return Math.floor(diff / 3600) + ' giờ trước';
  if (diff < 86400 * 30) return Math.floor(diff / 86400) + ' ngày trước';
  return fmtDate(s);
}

function roleColor(code) { return ROLE_COLORS[code] || 'role-slate'; }
function roleBadge(r) { return `<span class="badge ${roleColor(r.code)}">${esc(r.name)}</span>`; }
function roleBadgeRemovable(r) {
  return `<span class="badge role-badge-removable ${roleColor(r.code)}">${esc(r.name)}<button class="x" onclick="revokeRole(${r.id})" title="Thu hồi">×</button></span>`;
}
function actionBadge(action) {
  return action === 'assign'
    ? '<span class="badge action-assign">Gán</span>'
    : '<span class="badge action-revoke">Thu hồi</span>';
}

const AVATAR_COLORS = ['#4f46e5', '#0ea5e9', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777'];
function avatar(name, cls = '') {
  const initials = String(name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  let sum = 0;
  for (const ch of String(name || '')) sum += ch.charCodeAt(0);
  const color = AVATAR_COLORS[sum % AVATAR_COLORS.length];
  return `<span class="avatar ${cls}" style="background:${color}">${esc(initials)}</span>`;
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function openModal(html) {
  let root = document.getElementById('modalRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'modalRoot';
    document.body.appendChild(root);
  }
  root.innerHTML = html;
  root.querySelector('.modal-overlay').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) closeModal();
  });
}
function closeModal() {
  const root = document.getElementById('modalRoot');
  if (root) root.innerHTML = '';
}

// ===== Khung giao diện =====
async function initPage(onReady) {
  if (!getToken()) { location.href = '/login.html'; return; }
  try {
    const data = await api('/auth/me');
    window.me = data.user;
    buildLayout();
    if (data.user.roles.includes('ADMIN')) {
      if (onReady) onReady(data.user);
    } else {
      renderAccessDenied();
    }
  } catch (e) { /* 401 đã chuyển hướng trong api() */ }
}

function buildLayout() {
  const user = window.me;
  const pageKey = document.body.dataset.page || 'dashboard';
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.innerHTML = `
      <div class="brand">
        <div class="logo">🛡️</div>
        <div><h1>DNKN</h1><p>Quản lý phân quyền</p></div>
      </div>
      <nav class="nav">
        <div class="nav-title">Quản trị hệ thống</div>
        ${NAV_ITEMS.map((i) => `<a href="${i.href}" class="${i.key === pageKey ? 'active' : ''}"><span class="ico">${i.ico}</span>${i.label}</a>`).join('')}
      </nav>
      <div class="side-foot">Story DNKN-17 · Nhiều vai trò / người dùng</div>`;
  }

  const topbar = document.getElementById('topbar');
  if (topbar) {
    const roles = (user.roleDetails || []).map((r) => `<span class="badge ${roleColor(r.code)}">${esc(r.name)}</span>`).join('');
    topbar.innerHTML = `
      <h2 id="pageTitle"></h2>
      <div class="user-box">
        <div style="text-align:right">
          <div class="u-name">${esc(user.full_name)}</div>
          <div class="u-roles">${roles}</div>
        </div>
        ${avatar(user.full_name)}
        <button class="btn outline sm" onclick="logout()">Đăng xuất</button>
      </div>`;
  }
}

function setTitle(t) { const el = document.getElementById('pageTitle'); if (el) el.textContent = t; }

function renderAccessDenied() {
  const c = document.getElementById('content');
  if (c) c.innerHTML = `
    <div class="card denied">
      <div class="big">🔒</div>
      <h3>Không có quyền truy cập</h3>
      <p>Tài khoản của bạn không có vai trò Quản trị hệ thống.</p>
      <br /><button class="btn primary" onclick="logout()">Đăng xuất</button>
    </div>`;
}

function logout() { clearSession(); location.href = '/login.html'; }

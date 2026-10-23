import { request } from '../core/authService.js';
import { getAuthSession } from '../core/storage.js';

const ROLE_LABELS = {
  admin: 'Quản trị viên',
  teacher: 'Giảng viên',
  assistant: 'Trợ giảng',
  student: 'Học sinh / Sinh viên',
  manager: 'Quản lý đào tạo',
  accountant: 'Kế toán',
  department_head: 'Trưởng bộ môn',
  training_staff: 'Nhân viên đào tạo'
};

const STATUS_LABELS = {
  active: 'Đang hoạt động',
  locked: 'Đang bị khóa',
  pending: 'Chờ kích hoạt'
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);

export function renderUserManagementPanel(container) {
  const token = getAuthSession().token;
  const state = { page: 1, pageSize: 5, search: '', role: 'all', status: 'all', users: [], pagination: null, loading: false, error: '' };
  let searchTimer = null;

  function render() {
    container.innerHTML = `
      <section class="user-management-panel">
        <div class="user-management-toolbar">
          <div>
            <h3>Danh sách người dùng <span class="user-count" id="user-count">—</span></h3>
            <p>Phân quyền RBAC · Quản lý vai trò và quyền truy cập</p>
          </div>
          <button class="user-primary-button" type="button" data-user-action="create">＋ Thêm tài khoản mới</button>
        </div>
        <div class="user-filter-row">
          <label class="user-search-field">
            <span aria-hidden="true">⌕</span>
            <input type="search" id="user-search" placeholder="Tìm theo họ tên, email hoặc số điện thoại..." value="${escapeHtml(state.search)}">
          </label>
          <label class="user-filter-field">
            <span>Vai trò</span>
            <select id="user-role-filter">
              <option value="all">Tất cả vai trò</option>
              ${Object.entries(ROLE_LABELS).map(([role, label]) => `<option value="${role}" ${state.role === role ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
          </label>
          <label class="user-filter-field">
            <span>Trạng thái</span>
            <select id="user-status-filter">
              <option value="all">Tất cả trạng thái</option>
              ${Object.entries(STATUS_LABELS).map(([status, label]) => `<option value="${status}" ${state.status === status ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="user-table-wrap">
          <table class="user-table">
            <thead><tr><th>STT</th><th>Họ và tên</th><th>Email</th><th>Số điện thoại</th><th>Vai trò</th><th>Trạng thái</th><th>Lý do khóa</th><th>Hành động</th></tr></thead>
            <tbody id="user-table-body"><tr><td colspan="8" class="user-table-message">Đang tải danh sách tài khoản...</td></tr></tbody>
          </table>
        </div>
        <div class="user-table-footer">
          <span id="user-range-label"></span>
          <div class="user-pagination">
            <label><span>Số dòng</span>
              <select id="user-page-size">
                <option value="5" ${state.pageSize === 5 ? 'selected' : ''}>5 / trang</option>
                <option value="10" ${state.pageSize === 10 ? 'selected' : ''}>10 / trang</option>
                <option value="20" ${state.pageSize === 20 ? 'selected' : ''}>20 / trang</option>
              </select>
            </label>
            <button type="button" data-page-step="-1" aria-label="Trang trước">‹</button>
            <span id="user-page-label">1 / 1</span>
            <button type="button" data-page-step="1" aria-label="Trang sau">›</button>
          </div>
        </div>
        <div class="user-panel-feedback" id="user-panel-feedback" role="status" aria-live="polite"></div>
        <div id="user-modal-root"></div>
      </section>
    `;
    bindEvents();
    loadUsers();
  }

  async function loadUsers() {
    state.loading = true;
    state.error = '';
    const body = container.querySelector('#user-table-body');
    if (body) body.innerHTML = '<tr><td colspan="8" class="user-table-message">Đang tải danh sách tài khoản...</td></tr>';
    const params = new URLSearchParams({
      page: String(state.page),
      pageSize: String(state.pageSize),
      search: state.search,
      role: state.role,
      status: state.status
    });

    try {
      const response = await request(`/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      state.users = response.data || [];
      state.pagination = response.pagination || null;
      paintRows();
    } catch (error) {
      state.error = error.message || 'Không thể tải danh sách người dùng.';
      if (body) body.innerHTML = `<tr><td colspan="8" class="user-table-message is-error">${escapeHtml(state.error)}</td></tr>`;
    } finally {
      state.loading = false;
    }
  }

  function paintRows() {
    const body = container.querySelector('#user-table-body');
    const pagination = state.pagination;
    if (!body || !pagination) return;

    body.innerHTML = state.users.length
      ? state.users.map((user, index) => {
        const userRole = (user.roles?.[0] || user.role || '').toLowerCase();
        const locked = user.status === 'locked';
        const serial = pagination.startIndex + index;
        return `<tr>
          <td>${serial}</td>
          <td><span class="user-name-cell"><span class="user-initials">${escapeHtml(user.name?.split(/\s+/).slice(-2).map(part => part[0]).join('').toUpperCase())}</span><strong>${escapeHtml(user.name)}</strong></span></td>
          <td>${escapeHtml(user.email)}</td>
          <td>${escapeHtml(user.phone || '—')}</td>
          <td><span class="user-role-chip">${escapeHtml(user.roleLabel || ROLE_LABELS[userRole] || userRole)}</span></td>
          <td><span class="user-status-chip is-${escapeHtml(user.status)}"><i></i>${escapeHtml(user.statusLabel || STATUS_LABELS[user.status] || user.status)}</span></td>
          <td>${escapeHtml(user.lockReason || '—')}</td>
          <td><div class="user-row-actions">
            <button type="button" title="Sửa thông tin" data-user-action="edit" data-user-id="${escapeHtml(user.id)}">Sửa</button>
            ${user.status === 'pending'
              ? `<button type="button" title="Kích hoạt tài khoản" data-user-action="activate" data-user-id="${escapeHtml(user.id)}">Kích hoạt</button>
                 <button type="button" title="Gửi lại thư kích hoạt" data-user-action="resend" data-user-id="${escapeHtml(user.id)}">Gửi lại</button>`
              : `<button type="button" title="${locked ? 'Mở khóa' : 'Khóa'} tài khoản" data-user-action="${locked ? 'unlock' : 'lock'}" data-user-id="${escapeHtml(user.id)}">${locked ? 'Mở khóa' : 'Khóa'}</button>`}
            <button type="button" class="is-delete" title="Xóa tài khoản" data-user-action="delete" data-user-id="${escapeHtml(user.id)}">Xóa</button>
          </div></td>
        </tr>`;
      }).join('')
      : '<tr><td colspan="8" class="user-table-message">Không tìm thấy tài khoản phù hợp.</td></tr>';

    container.querySelector('#user-count').textContent = pagination.totalRecords;
    container.querySelector('#user-range-label').textContent = pagination.totalRecords
      ? `Hiển thị ${pagination.startIndex}–${pagination.endIndex} trên tổng số ${pagination.totalRecords} tài khoản`
      : 'Chưa có tài khoản phù hợp';
    container.querySelector('#user-page-label').textContent = `${pagination.currentPage} / ${pagination.totalPages}`;
    container.querySelector('[data-page-step="-1"]').disabled = pagination.currentPage <= 1;
    container.querySelector('[data-page-step="1"]').disabled = pagination.currentPage >= pagination.totalPages;
  }

  function showModal(user = null) {
    const isEdit = Boolean(user);
    const role = user?.roles?.[0] || user?.role || 'student';
    container.querySelector('#user-modal-root').innerHTML = `
      <div class="user-modal-backdrop">
        <section class="user-modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
          <header><div><span class="user-modal-eyebrow">QUẢN LÝ TÀI KHOẢN</span><h3 id="user-modal-title">${isEdit ? 'Cập nhật tài khoản' : 'Thêm tài khoản mới'}</h3></div>
            <button type="button" aria-label="Đóng" data-user-action="close-modal">×</button></header>
          <p>${isEdit ? 'Chỉnh sửa thông tin và vai trò người dùng.' : 'Tài khoản mới sẽ nhận liên kết kích hoạt qua email.'}</p>
          <form id="user-edit-form" data-user-id="${escapeHtml(user?.id || '')}">
            <label>Họ và tên<input name="name" required maxlength="120" value="${escapeHtml(user?.name || '')}"></label>
            <label>Email<input name="email" type="email" required maxlength="254" value="${escapeHtml(user?.email || '')}"></label>
            <label>Số điện thoại<input name="phone" maxlength="32" value="${escapeHtml(user?.phone || '')}"></label>
            <label>Vai trò<select name="role">${Object.entries(ROLE_LABELS).map(([value, label]) => `<option value="${value}" ${value === role ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
            <div class="user-modal-feedback" id="user-modal-feedback" role="alert"></div>
            <footer><button type="button" class="user-cancel-button" data-user-action="close-modal">Hủy</button><button type="submit" class="user-primary-button">${isEdit ? 'Lưu thay đổi' : 'Tạo tài khoản'}</button></footer>
          </form>
        </section>
      </div>`;
    container.querySelector('.user-modal-backdrop').addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeModal();
    });
    container.querySelector('#user-edit-form [name="name"]').focus();
  }

  function closeModal() {
    const root = container.querySelector('#user-modal-root');
    if (root) root.innerHTML = '';
  }

  function bindEvents() {
    container.addEventListener('input', (event) => {
      if (event.target.id !== 'user-search') return;
      state.search = event.target.value.trim();
      state.page = 1;
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(loadUsers, 250);
    });
    container.addEventListener('change', (event) => {
      if (event.target.id === 'user-role-filter') state.role = event.target.value;
      if (event.target.id === 'user-status-filter') state.status = event.target.value;
      if (event.target.id === 'user-page-size') state.pageSize = Number(event.target.value);
      if (['user-role-filter', 'user-status-filter', 'user-page-size'].includes(event.target.id)) {
        state.page = 1;
        loadUsers();
      }
    });
    container.addEventListener('click', async (event) => {
      const actionElement = event.target.closest('[data-user-action], [data-page-step]');
      if (!actionElement) return;
      if (actionElement.hasAttribute('data-page-step')) {
        state.page = Math.max(1, state.page + Number(actionElement.dataset.pageStep));
        loadUsers();
        return;
      }
      const { userAction: action, userId } = actionElement.dataset;
      if (action === 'create') return showModal();
      if (action === 'close-modal') return closeModal();
      if (action === 'edit') return showModal(state.users.find(user => user.id === userId));
      if (action === 'delete') {
        const user = state.users.find(item => item.id === userId);
        if (!user || !window.confirm(`Xóa tài khoản ${user.name}? Thao tác này không thể hoàn tác.`)) return;
        await runAction(`/users/${encodeURIComponent(userId)}`, { method: 'DELETE' }, 'Đã xóa tài khoản.');
      }
      if (action === 'activate') {
        await runAction(`/users/${encodeURIComponent(userId)}/activate`, { method: 'PATCH' }, 'Đã kích hoạt tài khoản. Tài khoản hiện đang hoạt động.');
      }
      if (action === 'lock') {
        const reason = window.prompt('Nhập lý do khóa tài khoản:');
        if (reason === null) return;
        if (!reason.trim()) return showFeedback('Vui lòng nhập lý do khóa tài khoản.', true);
        await runAction(`/users/${encodeURIComponent(userId)}/lock`, {
          method: 'PATCH',
          body: JSON.stringify({ reason: reason.trim() })
        }, 'Đã khóa tài khoản.');
      }
      if (action === 'unlock') {
        await runAction(`/users/${encodeURIComponent(userId)}/unlock`, { method: 'PATCH' }, 'Đã mở khóa tài khoản.');
      }
      if (action === 'resend') {
        await runAction(`/users/${encodeURIComponent(userId)}/resend-activation`, { method: 'POST' }, 'Đã gửi lại email kích hoạt.');
      }
    });
    container.addEventListener('submit', async (event) => {
      if (event.target.id !== 'user-edit-form') return;
      event.preventDefault();
      const form = event.target;
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());
      const isEdit = Boolean(form.dataset.userId);
      const submit = form.querySelector('[type="submit"]');
      const feedback = form.querySelector('#user-modal-feedback');
      submit.disabled = true;
      feedback.textContent = 'Đang lưu...';
      try {
        const path = isEdit ? `/users/${encodeURIComponent(form.dataset.userId)}` : '/users';
        const result = await request(path, {
          method: isEdit ? 'PUT' : 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        closeModal();
        showFeedback(result.message || (isEdit ? 'Đã cập nhật thông tin tài khoản.' : 'Đã tạo tài khoản.'));
        await loadUsers();
      } catch (error) {
        feedback.textContent = error.message || 'Không thể lưu tài khoản.';
        submit.disabled = false;
      }
    });
  }

  async function runAction(path, options, successMessage) {
    try {
      await request(path, {
        ...options,
        headers: { Authorization: `Bearer ${token}`, ...options.headers }
      });
      showFeedback(successMessage);
      await loadUsers();
    } catch (error) {
      showFeedback(error.message || 'Không thể thực hiện thao tác.', true);
    }
  }

  function showFeedback(message, isError = false) {
    const feedback = container.querySelector('#user-panel-feedback');
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = `user-panel-feedback${isError ? ' is-error' : ' is-success'}`;
  }

  render();
  return () => {
    window.clearTimeout(searchTimer);
  };
}

let users = [];
let roles = [];
let editingUser = null;
let editingRoles = [];

initPage(async () => {
  setTitle('Người dùng');
  document.getElementById('btnAdd').onclick = () => openUserModal();
  document.getElementById('search').oninput = render;
  document.getElementById('filterRole').onchange = render;
  await Promise.all([loadUsers(), loadRoles()]);
});

async function loadUsers() { users = await api('/users'); render(); }
async function loadRoles() {
  roles = await api('/roles');
  const sel = document.getElementById('filterRole');
  sel.innerHTML = '<option value="">Tất cả vai trò</option>' +
    roles.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
}

function render() {
  const q = (document.getElementById('search').value || '').toLowerCase();
  const roleFilter = document.getElementById('filterRole').value;
  const list = users.filter(
    (u) =>
      (!q || u.username.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)) &&
      (!roleFilter || u.roles.some((r) => r.id == roleFilter))
  );

  document.getElementById('tbody').innerHTML = list.map((u) => `
    <tr>
      <td>
        <div class="user-cell">
          ${avatar(u.full_name)}
          <div><span class="strong">${esc(u.username)}</span><span class="sub-cell">${esc(u.full_name)}</span></div>
        </div>
      </td>
      <td>${esc(u.email || '—')}</td>
      <td>${u.roles.length ? u.roles.map(roleBadge).join(' ') : '<span class="muted">Chưa có vai trò</span>'}</td>
      <td class="muted">${fmtDate(u.created_at)}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn outline sm" onclick="openRoleModal(${u.id})">Vai trò</button>
        <button class="btn ghost sm" onclick="openUserModalById(${u.id})">Sửa</button>
        <button class="btn danger sm" onclick="delUser(${u.id})">Xóa</button>
      </td>
    </tr>`).join('') ||
    '<tr><td colspan="5"><div class="empty"><div class="big">👥</div>Không tìm thấy người dùng</div></td></tr>';
}

// ---------- Thêm / sửa người dùng ----------
function openUserModalById(id) { openUserModal(users.find((u) => u.id === id)); }

function openUserModal(u) {
  const isEdit = !!u;
  openModal(`
    <div class="modal-overlay"><div class="modal">
      <div class="modal-head"><h3>${isEdit ? 'Sửa người dùng' : 'Thêm người dùng'}</h3><button class="modal-close" onclick="closeModal()">×</button></div>
      <div class="modal-body">
        <div class="form-row">
          <div class="field"><label>Tên đăng nhập *</label><input class="input" id="f_username" value="${isEdit ? esc(u.username) : ''}" /></div>
          <div class="field"><label>Mật khẩu ${isEdit ? '(trống = giữ nguyên)' : '*'}</label><input class="input" type="password" id="f_password" /></div>
        </div>
        <div class="field"><label>Họ tên *</label><input class="input" id="f_fullname" value="${isEdit ? esc(u.full_name) : ''}" /></div>
        <div class="field"><label>Email</label><input class="input" type="email" id="f_email" value="${isEdit ? esc(u.email || '') : ''}" /></div>
        ${!isEdit ? `
        <div class="field">
          <label>Vai trò ban đầu</label>
          <select id="f_roles" multiple size="4">${roles.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select>
          <div class="hint">Giữ Ctrl (hoặc Cmd) để chọn nhiều vai trò</div>
        </div>` : ''}
      </div>
      <div class="modal-foot">
        <button class="btn outline" onclick="closeModal()">Hủy</button>
        <button class="btn primary" onclick="saveUser(${isEdit ? u.id : 'null'})">Lưu</button>
      </div>
    </div></div>`);
}

async function saveUser(id) {
  const body = {
    username: document.getElementById('f_username').value.trim(),
    password: document.getElementById('f_password').value,
    full_name: document.getElementById('f_fullname').value.trim(),
    email: document.getElementById('f_email').value.trim(),
  };
  if (!id) {
    const sel = document.getElementById('f_roles');
    body.role_ids = [...sel.selectedOptions].map((o) => Number(o.value));
  }
  try {
    if (id) await api('/users/' + id, { method: 'PUT', body: JSON.stringify(body) });
    else await api('/users', { method: 'POST', body: JSON.stringify(body) });
    closeModal();
    toast(id ? 'Đã cập nhật người dùng' : 'Đã thêm người dùng');
    await Promise.all([loadUsers(), loadRoles()]);
  } catch (e) { toast(e.message, 'error'); }
}

async function delUser(id) {
  if (!confirm('Bạn có chắc muốn xóa người dùng này? Mọi vai trò của họ sẽ bị gỡ bỏ.')) return;
  try {
    await api('/users/' + id, { method: 'DELETE' });
    toast('Đã xóa người dùng');
    await Promise.all([loadUsers(), loadRoles()]);
  } catch (e) { toast(e.message, 'error'); }
}

// ---------- Gán / thu hồi vai trò (DNKN-72, DNKN-73) ----------
async function openRoleModal(userId) {
  const data = await api('/users/' + userId + '/roles');
  editingUser = data.user;
  editingRoles = data.roles;
  renderRoleModal();
}

function renderRoleModal() {
  const available = roles.filter((r) => !editingRoles.some((er) => er.id === r.id));
  const self = editingUser.id === window.me.id;

  openModal(`
    <div class="modal-overlay"><div class="modal">
      <div class="modal-head">
        <h3>Vai trò của ${esc(editingUser.full_name)}</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label>Vai trò hiện tại</label>
          <div id="currentRoles" style="display:flex;flex-wrap:wrap;gap:6px;min-height:36px">
            ${editingRoles.length ? editingRoles.map(roleBadgeRemovable).join('') : '<span class="muted">Chưa có vai trò nào</span>'}
          </div>
          ${self ? '<div class="hint">⚠️ Bạn không thể thu hồi vai trò "Quản trị hệ thống" của chính mình.</div>' : ''}
        </div>
        <div class="field">
          <label>Gán vai trò mới</label>
          ${available.length ? `
            <div style="display:flex;gap:10px">
              <select id="roleSelect" style="flex:1">${available.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select>
              <button class="btn primary" onclick="assignRole()">Gán</button>
            </div>` : '<div class="muted">Người dùng đã có đủ tất cả vai trò.</div>'}
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn outline" onclick="closeModal()">Đóng</button>
      </div>
    </div></div>`);
}

async function assignRole() {
  const roleId = document.getElementById('roleSelect').value;
  try {
    const data = await api('/users/' + editingUser.id + '/roles', {
      method: 'POST', body: JSON.stringify({ role_ids: [Number(roleId)] }),
    });
    editingRoles = data.roles;
    renderRoleModal();               // cập nhật ngay trong modal (DNKN-73)
    await refresh();
    toast(data.message || 'Đã gán vai trò');
  } catch (e) { toast(e.message, 'error'); }
}

async function revokeRole(roleId) {
  const role = editingRoles.find((r) => r.id === roleId);
  if (!confirm(`Thu hồi vai trò "${role ? role.name : ''}" khỏi ${editingUser.full_name}?`)) return;
  try {
    const data = await api('/users/' + editingUser.id + '/roles/' + roleId, { method: 'DELETE' });
    editingRoles = data.roles;
    renderRoleModal();
    await refresh();
    toast(data.message || 'Đã thu hồi vai trò');
  } catch (e) { toast(e.message, 'error'); }
}

async function refresh() { await Promise.all([loadUsers(), loadRoles()]); }

// DNKN-72 (màn hình gán/thu hồi vai trò) + DNKN-73 (phản hồi tức thì)
let me = null;          // người dùng đang đăng nhập
let users = [];         // danh sách người dùng
let allRoles = [];      // tất cả vai trò
let editingUser = null; // người dùng đang chỉnh trong modal
let editingRoles = [];  // vai trò hiện có của người dùng đang chỉnh

init();

async function init() {
  if (!getToken()) { location.href = '/login.html'; return; }
  try {
    await loadMe();
    await Promise.all([loadUsers(), loadRoles()]);
  } catch (e) {
    // 401 đã tự chuyển về trang đăng nhập trong api()
    if (getToken()) toast(e.message, 'error');
  }
}

async function loadMe() {
  const data = await api('/auth/me');
  me = data.user;
  document.getElementById('meName').textContent = me.full_name;
  document.getElementById('meAvatar').textContent = me.full_name.charAt(0).toUpperCase();
  const roles = me.roleDetails || [];
  document.getElementById('meRoles').textContent = roles.length ? roles.map((r) => r.name).join(' · ') : 'Chưa có vai trò';
}

async function loadUsers() {
  users = await api('/users');
  renderTable();
}

async function loadRoles() {
  allRoles = await api('/roles');
}

function renderTable() {
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = users.map((u) => `
    <tr>
      <td class="strong">${esc(u.username)}</td>
      <td>${esc(u.full_name)}</td>
      <td>${esc(u.email || '')}</td>
      <td>${u.roles.length ? u.roles.map(roleBadge).join('') : '<span class="muted">Chưa có vai trò</span>'}</td>
      <td style="text-align:right">
        <button class="btn outline sm" onclick="openRoleModal(${u.id})">Quản lý vai trò</button>
      </td>
    </tr>`).join('');
}

// Mở modal quản lý vai trò của một người dùng
async function openRoleModal(userId) {
  const data = await api('/users/' + userId + '/roles');
  editingUser = data.user;
  editingRoles = data.roles;
  renderModal();
}

function renderModal() {
  const available = allRoles.filter((r) => !editingRoles.some((er) => er.id === r.id));
  const self = editingUser.id === me.id;

  openModal(`
    <div class="modal-overlay"><div class="modal">
      <div class="modal-head">
        <h3>Vai trò của: ${esc(editingUser.full_name)}</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label>Vai trò hiện tại</label>
          <div class="role-list" id="currentRoles">
            ${editingRoles.length ? editingRoles.map(roleBadgeRemovable).join('') : '<span class="muted">Chưa có vai trò nào</span>'}
          </div>
          ${self ? '<div style="font-size:12px;color:var(--muted);margin-top:6px">⚠️ Bạn không thể thu hồi vai trò "Quản trị hệ thống" của chính mình.</div>' : ''}
        </div>
        <div class="field">
          <label>Gán vai trò mới</label>
          ${available.length ? `
            <div class="add-row">
              <select id="roleSelect">${available.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select>
              <button class="btn primary" onclick="assignRole()">Gán</button>
            </div>` : '<div class="muted">Người dùng đã có đủ tất cả vai trò.</div>'}
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn outline" onclick="closeModal()">Đóng</button>
      </div>
    </div></div>`);
}

// Gán vai trò (DNKN-73: cập nhật giao diện ngay)
async function assignRole() {
  const roleId = document.getElementById('roleSelect').value;
  try {
    const data = await api('/users/' + editingUser.id + '/roles', {
      method: 'POST',
      body: JSON.stringify({ role_ids: [Number(roleId)] }),
    });
    editingRoles = data.roles;
    renderModal();       // cập nhật ngay trong modal
    await refresh();     // cập nhật bảng + thanh người dùng
    toast(data.message || 'Đã gán vai trò');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// Thu hồi vai trò (DNKN-73: cập nhật giao diện ngay)
async function revokeRole(roleId) {
  const role = editingRoles.find((r) => r.id === roleId);
  if (!confirm(`Thu hồi vai trò "${role ? role.name : ''}" khỏi ${editingUser.full_name}?`)) return;
  try {
    const data = await api('/users/' + editingUser.id + '/roles/' + roleId, { method: 'DELETE' });
    editingRoles = data.roles;
    renderModal();
    await refresh();
    toast(data.message || 'Đã thu hồi vai trò');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// Làm mới bảng người dùng + thông tin bản thân (hiệu lực ngay, không cần tải lại trang)
async function refresh() {
  await Promise.all([loadUsers(), loadMe()]);
}

function logout() {
  clearSession();
  location.href = '/login.html';
}

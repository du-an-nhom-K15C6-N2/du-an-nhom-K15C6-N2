let roles = [];

initPage(async () => {
  setTitle('Vai trò');
  document.getElementById('btnAdd').onclick = () => openRoleModal();
  await load();
});

async function load() {
  roles = await api('/roles');
  render();
}

function render() {
  document.getElementById('tbody').innerHTML = roles.map((r) => `
    <tr>
      <td><span class="badge ${roleColor(r.code)}">${esc(r.name)}</span></td>
      <td><code style="background:#f1f5f9;padding:2px 9px;border-radius:6px;font-size:12px">${esc(r.code)}</code></td>
      <td>${esc(r.description || '—')}</td>
      <td class="strong">${r.user_count}</td>
      <td>${r.is_system ? '<span class="badge badge-system">Hệ thống</span>' : '<span class="muted">Tùy chỉnh</span>'}</td>
      <td style="text-align:right;white-space:nowrap">
        ${r.is_system
          ? '<span class="muted">—</span>'
          : `<button class="btn ghost sm" onclick="openRoleModalById(${r.id})">Sửa</button>
             <button class="btn danger sm" onclick="delRole(${r.id})">Xóa</button>`}
      </td>
    </tr>`).join('') ||
    '<tr><td colspan="6"><div class="empty"><div class="big">🛡️</div>Chưa có vai trò</div></td></tr>';
}

function openRoleModalById(id) { openRoleModal(roles.find((r) => r.id === id)); }

function openRoleModal(r) {
  const isEdit = !!r;
  openModal(`
    <div class="modal-overlay"><div class="modal">
      <div class="modal-head"><h3>${isEdit ? 'Sửa vai trò' : 'Thêm vai trò'}</h3><button class="modal-close" onclick="closeModal()">×</button></div>
      <div class="modal-body">
        <div class="field">
          <label>Mã vai trò ${isEdit ? '' : '*'}</label>
          <input class="input" id="f_code" value="${isEdit ? esc(r.code) : ''}" ${isEdit ? 'disabled' : ''} placeholder="VD: THU_KY" />
          <div class="hint">Chữ in hoa, số và dấu gạch dưới. Không đổi được sau khi tạo.</div>
        </div>
        <div class="field"><label>Tên vai trò *</label><input class="input" id="f_name" value="${isEdit ? esc(r.name) : ''}" /></div>
        <div class="field"><label>Mô tả</label><textarea class="input" id="f_desc" rows="3">${isEdit ? esc(r.description || '') : ''}</textarea></div>
      </div>
      <div class="modal-foot">
        <button class="btn outline" onclick="closeModal()">Hủy</button>
        <button class="btn primary" onclick="saveRole(${isEdit ? r.id : 'null'})">Lưu</button>
      </div>
    </div></div>`);
}

async function saveRole(id) {
  const body = {
    code: document.getElementById('f_code').value.trim(),
    name: document.getElementById('f_name').value.trim(),
    description: document.getElementById('f_desc').value.trim(),
  };
  try {
    if (id) await api('/roles/' + id, { method: 'PUT', body: JSON.stringify(body) });
    else await api('/roles', { method: 'POST', body: JSON.stringify(body) });
    closeModal();
    toast(id ? 'Đã cập nhật vai trò' : 'Đã thêm vai trò');
    load();
  } catch (e) { toast(e.message, 'error'); }
}

async function delRole(id) {
  const role = roles.find((r) => r.id === id);
  if (!confirm(`Xóa vai trò "${role ? role.name : ''}"?`)) return;
  try {
    await api('/roles/' + id, { method: 'DELETE' });
    toast('Đã xóa vai trò');
    load();
  } catch (e) { toast(e.message, 'error'); }
}

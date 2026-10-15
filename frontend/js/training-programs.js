/**
 * Quản lý danh mục chương trình đào tạo (DNKN-88)
 * Frontend Controller & UI Renderer
 */

const API_BASE = '/api/v1/training-programs';

function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

window.renderTrainingProgramsView = function(module) {
  const breadcrumb = document.querySelector('#page-breadcrumb');
  const pageContent = document.querySelector('#page-content');
  if (breadcrumb) breadcrumb.textContent = 'Chương trình đào tạo';

  pageContent.innerHTML = `
    <div class="tp-container">
      <div class="tp-header">
        <div class="tp-title-area">
          <p class="eyebrow" style="color:#0ea5e9;font-weight:700;font-size:0.75rem;letter-spacing:0.05em;margin-bottom:4px;">PHÂN HỆ ĐÀO TẠO (DNKN-88)</p>
          <h1 style="font-size:1.625rem;font-weight:800;color:#0f172a;margin:0 0 6px 0;">📜 Quản lý danh mục chương trình đào tạo</h1>
          <p style="color:#64748b;font-size:0.875rem;margin:0;">Khai báo và quản lý các chương trình đào tạo để dùng khi mở lớp mới thay vì khai báo lại từ đầu.</p>
        </div>
      </div>

      <div class="tp-stats-row">
        <div class="tp-stat-card">
          <div class="tp-stat-icon is-blue">📚</div>
          <div class="tp-stat-meta">
            <span>Tổng số chương trình</span>
            <strong id="stat-total">...</strong>
          </div>
        </div>
        <div class="tp-stat-card">
          <div class="tp-stat-icon is-green">✅</div>
          <div class="tp-stat-meta">
            <span>Đang hoạt động (ACTIVE)</span>
            <strong id="stat-active">...</strong>
          </div>
        </div>
        <div class="tp-stat-card">
          <div class="tp-stat-icon is-amber">⏸️</div>
          <div class="tp-stat-meta">
            <span>Ngừng áp dụng (INACTIVE)</span>
            <strong id="stat-inactive">...</strong>
          </div>
        </div>
      </div>

      <div class="tp-toolbar">
        <div class="tp-toolbar-left">
          <div class="tp-search-box">
            <span class="tp-search-icon">🔍</span>
            <input type="text" id="tp-search-input" placeholder="Tìm theo mã hoặc tên chương trình..." />
          </div>
          <div class="tp-filter-group">
            <label for="tp-status-select" style="font-size:0.8125rem;font-weight:600;color:#64748b;">Trạng thái:</label>
            <select id="tp-status-select">
              <option value="all">Tất cả trạng thái</option>
              <option value="ACTIVE">Hoạt động (ACTIVE)</option>
              <option value="INACTIVE">Ngừng áp dụng (INACTIVE)</option>
            </select>
          </div>
        </div>
        <button type="button" class="tp-btn-primary" id="btn-create-program">
          <span>➕</span> Thêm mới chương trình
        </button>
      </div>

      <div id="tp-toast-container"></div>

      <div class="tp-table-card">
        <div class="tp-table-wrapper">
          <table class="tp-table">
            <thead>
              <tr>
                <th style="width: 140px;">Mã chương trình</th>
                <th>Tên chương trình & Mô tả</th>
                <th style="width: 110px;">Thời lượng</th>
                <th style="width: 140px;">Học phí chuẩn</th>
                <th style="width: 130px;">Trạng thái</th>
                <th style="width: 120px;">Lớp học</th>
                <th style="width: 180px; text-align: center;">Thao tác</th>
              </tr>
            </thead>
            <tbody id="tp-table-body">
              <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">
                  Đang tải dữ liệu chương trình đào tạo...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <div id="tp-modal-root"></div>
  `;

  let programs = [];

  function showToast(message, type = 'success') {
    const toast = document.querySelector('#tp-toast-container');
    if (!toast) return;
    toast.innerHTML = `
      <div class="tp-alert is-${type}">
        <span class="tp-alert-icon">${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '❌'}</span>
        <div style="flex:1;">${escapeHtml(message)}</div>
      </div>
    `;
    setTimeout(() => {
      if (toast) toast.innerHTML = '';
    }, 4500);
  }

  async function loadData() {
    try {
      const search = document.querySelector('#tp-search-input')?.value?.trim() || '';
      const status = document.querySelector('#tp-status-select')?.value || 'all';
      let url = `${API_BASE}?pageSize=100`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (status !== 'all') url += `&status=${encodeURIComponent(status)}`;

      const res = await fetch(url);
      const data = await res.json();
      programs = data.data || [];

      // Update stats
      const total = programs.length;
      const active = programs.filter(p => p.status === 'ACTIVE').length;
      const inactive = total - active;
      document.querySelector('#stat-total').textContent = total;
      document.querySelector('#stat-active').textContent = active;
      document.querySelector('#stat-inactive').textContent = inactive;

      renderTable(programs);
    } catch (err) {
      console.error(err);
      showToast('Không tải được danh mục chương trình: ' + err.message, 'error');
    }
  }

  function renderTable(list) {
    const tbody = document.querySelector('#tp-table-body');
    if (!tbody) return;

    if (!list.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 3rem; color: #64748b;">
            Không tìm thấy chương trình đào tạo nào phù hợp.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list.map(item => `
      <tr>
        <td><strong class="tp-code-badge">${escapeHtml(item.code)}</strong></td>
        <td>
          <div style="font-weight:600;color:#0f172a;">${escapeHtml(item.name)}</div>
          <small style="color:#64748b;display:block;margin-top:2px;">${escapeHtml(item.description || 'Không có mô tả')}</small>
        </td>
        <td>${escapeHtml(item.duration)} giờ</td>
        <td><span style="font-weight:600;color:#0f172a;">${formatVND(item.standard_tuition)}</span></td>
        <td>
          <span class="tp-badge is-${item.status === 'ACTIVE' ? 'active' : 'inactive'}">
            ${item.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng áp dụng'}
          </span>
        </td>
        <td>
          ${item.classes_count > 0 
            ? `<span title="${item.classes_count} lớp học đang dùng" style="font-size:0.8125rem;padding:2px 8px;border-radius:999px;background:#e0f2fe;color:#0369a1;font-weight:600;">${item.classes_count} lớp</span>` 
            : `<span style="font-size:0.8125rem;color:#94a3b8;">Chưa có</span>`}
        </td>
        <td style="text-align:center;">
          <button class="tp-btn-link btn-edit" data-id="${item.id}" title="Chỉnh sửa">✏️ Sửa</button>
          <button class="tp-btn-link btn-toggle" data-id="${item.id}" title="Đổi trạng thái">
            ${item.status === 'ACTIVE' ? '⏸️ Khóa' : '▶️ Mở'}
          </button>
          <button class="tp-btn-link is-danger btn-delete" data-id="${item.id}" title="Xóa">🗑️ Xóa</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.onclick = () => openEditModal(btn.dataset.id);
    });
    tbody.querySelectorAll('.btn-toggle').forEach(btn => {
      btn.onclick = () => toggleStatus(btn.dataset.id);
    });
    tbody.querySelectorAll('.btn-delete').forEach(btn => {
      btn.onclick = () => openDeleteModal(btn.dataset.id);
    });
  }

  function openEditModal(id = null) {
    const isEdit = Boolean(id);
    const item = isEdit ? programs.find(p => p.id === id) : null;
    const modalRoot = document.querySelector('#tp-modal-root');

    modalRoot.innerHTML = `
      <div class="tp-modal-backdrop">
        <div class="tp-modal">
          <div class="tp-modal-header">
            <h3>${isEdit ? '✏️ Chỉnh sửa chương trình đào tạo' : '➕ Thêm mới chương trình đào tạo'}</h3>
            <button class="tp-modal-close" id="btn-modal-close">&times;</button>
          </div>
          <div class="tp-modal-body">
            <div id="tp-modal-error" style="display:none;" class="tp-alert is-error"></div>
            <form id="tp-form">
              <div class="tp-form-group">
                <label>Mã chương trình * ${isEdit ? '<small style="color:#ef4444;">(Không thể thay đổi sau khi tạo)</small>' : ''}</label>
                <input type="text" id="m-code" value="${escapeHtml(item?.code || '')}" ${isEdit ? 'disabled' : ''} placeholder="VD: PROG-IT-01" required />
              </div>
              <div class="tp-form-group">
                <label>Tên chương trình đào tạo *</label>
                <input type="text" id="m-name" value="${escapeHtml(item?.name || '')}" placeholder="VD: Kỹ thuật Phần mềm Chuyên sâu" required />
              </div>
              <div class="tp-form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="tp-form-group">
                  <label>Thời lượng (giờ) *</label>
                  <input type="number" id="m-duration" min="1" value="${item?.duration || 60}" required />
                </div>
                <div class="tp-form-group">
                  <label>Học phí chuẩn (VNĐ) *</label>
                  <input type="number" id="m-tuition" min="0" step="50000" value="${item?.standard_tuition ?? 10000000}" required />
                </div>
              </div>
              <div class="tp-form-group">
                <label>Trạng thái</label>
                <select id="m-status">
                  <option value="ACTIVE" ${item?.status !== 'INACTIVE' ? 'selected' : ''}>Hoạt động (ACTIVE)</option>
                  <option value="INACTIVE" ${item?.status === 'INACTIVE' ? 'selected' : ''}>Ngừng áp dụng (INACTIVE)</option>
                </select>
              </div>
              <div class="tp-form-group">
                <label>Mô tả chi tiết</label>
                <textarea id="m-desc" rows="3" placeholder="Mô tả nội dung, mục tiêu chuẩn đầu ra...">${escapeHtml(item?.description || '')}</textarea>
              </div>
              <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">
                <button type="button" class="tp-btn-secondary" id="btn-cancel">Hủy bỏ</button>
                <button type="submit" class="tp-btn-primary" id="btn-save">
                  ${isEdit ? 'Lưu thay đổi' : 'Tạo chương trình'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    const close = () => modalRoot.innerHTML = '';
    modalRoot.querySelector('#btn-modal-close').onclick = close;
    modalRoot.querySelector('#btn-cancel').onclick = close;

    modalRoot.querySelector('#tp-form').onsubmit = async (e) => {
      e.preventDefault();
      const errBox = modalRoot.querySelector('#tp-modal-error');
      errBox.style.display = 'none';

      const payload = {
        name: modalRoot.querySelector('#m-name').value.trim(),
        duration: Number(modalRoot.querySelector('#m-duration').value),
        standard_tuition: Number(modalRoot.querySelector('#m-tuition').value),
        status: modalRoot.querySelector('#m-status').value,
        description: modalRoot.querySelector('#m-desc').value.trim()
      };
      if (!isEdit) {
        payload.code = modalRoot.querySelector('#m-code').value.trim();
      }

      try {
        const url = isEdit ? `${API_BASE}/${encodeURIComponent(id)}` : API_BASE;
        const res = await fetch(url, {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (!res.ok) {
          throw new Error(result.message || 'Lưu dữ liệu không thành công.');
        }

        close();
        showToast(isEdit ? 'Cập nhật chương trình thành công!' : 'Tạo mới chương trình đào tạo thành công!');
        loadData();
      } catch (err) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      }
    };
  }

  async function toggleStatus(id) {
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}/status`, {
        method: 'PATCH'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Không thể đổi trạng thái.');
      showToast('Đã đổi trạng thái chương trình thành công!');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function openDeleteModal(id) {
    const item = programs.find(p => p.id === id);
    if (!item) return;

    const modalRoot = document.querySelector('#tp-modal-root');
    const hasClasses = item.classes_count > 0;

    modalRoot.innerHTML = `
      <div class="tp-modal-backdrop">
        <div class="tp-modal" style="max-width: 480px;">
          <div class="tp-modal-header">
            <h3 style="color:#ef4444;">⚠️ Xác nhận xóa chương trình</h3>
            <button class="tp-modal-close" id="btn-modal-close">&times;</button>
          </div>
          <div class="tp-modal-body">
            <p>Bạn đang chọn xóa chương trình: <strong>${escapeHtml(item.name)}</strong> (<code>${escapeHtml(item.code)}</code>)</p>
            ${hasClasses ? `
              <div class="tp-alert is-warning" style="margin: 12px 0;">
                <span class="tp-alert-icon">⚠️</span>
                <div>
                  <strong>Chương trình đang có ${item.classes_count} lớp học liên kết!</strong><br />
                  Theo quy định hệ thống: <em>Chương trình đang có lớp học, không được phép xóa. Hãy chuyển sang trạng thái Ngừng áp dụng.</em>
                </div>
              </div>
            ` : `
              <p style="color:#64748b;">Chương trình này chưa liên kết lớp học nào. Thao tác xóa cứng sẽ xóa vĩnh viễn dữ liệu khỏi hệ thống.</p>
            `}

            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">
              <button type="button" class="tp-btn-secondary" id="btn-cancel">Hủy</button>
              ${hasClasses ? `
                <button type="button" class="tp-btn-primary" id="btn-deactivate" style="background:#f59e0b;">
                  Chuyển sang Ngừng áp dụng
                </button>
              ` : `
                <button type="button" class="tp-btn-danger" id="btn-confirm-delete">
                  Xóa vĩnh viễn
                </button>
              `}
            </div>
          </div>
        </div>
      </div>
    `;

    const close = () => modalRoot.innerHTML = '';
    modalRoot.querySelector('#btn-modal-close').onclick = close;
    modalRoot.querySelector('#btn-cancel').onclick = close;

    if (hasClasses) {
      modalRoot.querySelector('#btn-deactivate').onclick = async () => {
        try {
          const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'INACTIVE' })
          });
          const d = await res.json();
          if (!res.ok) throw new Error(d.message);
          close();
          showToast('Đã chuyển chương trình sang trạng thái Ngừng áp dụng!');
          loadData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    } else {
      modalRoot.querySelector('#btn-confirm-delete').onclick = async () => {
        try {
          const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
            method: 'DELETE'
          });
          const d = await res.json();
          if (!res.ok) throw new Error(d.message);
          close();
          showToast('Đã xóa chương trình đào tạo thành công!');
          loadData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    }
  }

  // Bind toolbar events
  document.querySelector('#tp-search-input').oninput = () => {
    clearTimeout(window.__tpSearchTimer);
    window.__tpSearchTimer = setTimeout(loadData, 300);
  };
  document.querySelector('#tp-status-select').onchange = loadData;
  document.querySelector('#btn-create-program').onclick = () => openEditModal();

  loadData();
};

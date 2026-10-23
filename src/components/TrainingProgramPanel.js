/**
 * TrainingProgramPanel Component
 * Quản lý danh mục chương trình đào tạo (Training Program Management)
 * Tương thích Persona Quản lý đào tạo (manager) và Quản trị viên (admin)
 */

import './TrainingProgramPanel.css';
import {
  getTrainingPrograms,
  getTrainingProgramById,
  createTrainingProgram,
  updateTrainingProgram,
  updateTrainingProgramStatus,
  deleteTrainingProgram
} from '../core/trainingProgramService.js';

export function renderTrainingProgramPanel(container) {
  let state = {
    programs: [],
    pagination: {
      currentPage: 1,
      pageSize: 10,
      totalRecords: 0,
      totalPages: 1
    },
    searchQuery: '',
    statusFilter: 'all',
    isLoading: false,
    errorMessage: '',
    successMessage: ''
  };

  container.innerHTML = `
    <div class="tp-container">
      <!-- 1. Header & Stats -->
      <div class="tp-header">
        <div class="tp-title-area">
          <h2>📜 Quản lý danh mục chương trình đào tạo</h2>
          <p>Khai báo và quản lý các chương trình chuẩn để dùng ngay khi mở lớp học mới thay vì nhập lại từ đầu.</p>
        </div>
      </div>

      <div class="tp-stats-row" id="tp-stats-row">
        <div class="tp-stat-card">
          <div class="tp-stat-icon is-blue">📚</div>
          <div class="tp-stat-meta">
            <span>Tổng số chương trình</span>
            <strong id="stat-total">0</strong>
          </div>
        </div>
        <div class="tp-stat-card">
          <div class="tp-stat-icon is-green">✅</div>
          <div class="tp-stat-meta">
            <span>Đang hoạt động (ACTIVE)</span>
            <strong id="stat-active">0</strong>
          </div>
        </div>
        <div class="tp-stat-card">
          <div class="tp-stat-icon is-amber">⏸️</div>
          <div class="tp-stat-meta">
            <span>Ngừng áp dụng (INACTIVE)</span>
            <strong id="stat-inactive">0</strong>
          </div>
        </div>
      </div>

      <!-- 2. Toolbar -->
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

      <!-- Banner thông báo -->
      <div id="tp-toast-container"></div>

      <!-- 3. Table Card -->
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
                <th style="width: 110px;">Lớp học</th>
                <th style="width: 190px; text-align: center;">Thao tác</th>
              </tr>
            </thead>
            <tbody id="tp-table-body">
              <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">
                  Đang tải danh sách chương trình đào tạo...
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 4. Pagination -->
        <div class="tp-pagination" id="tp-pagination">
          <span id="tp-page-info">Hiển thị 0 / 0 chương trình</span>
          <div class="tp-pagination-controls" id="tp-page-controls"></div>
        </div>
      </div>
    </div>

    <!-- Modal Container -->
    <div id="tp-modal-root"></div>
  `;

  // Bind element references
  const searchInput = container.querySelector('#tp-search-input');
  const statusSelect = container.querySelector('#tp-status-select');
  const btnCreate = container.querySelector('#btn-create-program');
  const tableBody = container.querySelector('#tp-table-body');
  const pageInfo = container.querySelector('#tp-page-info');
  const pageControls = container.querySelector('#tp-page-controls');
  const statTotal = container.querySelector('#stat-total');
  const statActive = container.querySelector('#stat-active');
  const statInactive = container.querySelector('#stat-inactive');
  const toastContainer = container.querySelector('#tp-toast-container');
  const modalRoot = container.querySelector('#tp-modal-root');

  // Formatters
  const formatCurrency = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

  function showToast(message, type = 'success') {
    toastContainer.innerHTML = `
      <div class="tp-alert is-${type}">
        <span class="tp-alert-icon">${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '❌'}</span>
        <div style="flex: 1;">${message}</div>
      </div>
    `;
    setTimeout(() => {
      if (toastContainer.innerHTML.includes(message)) {
        toastContainer.innerHTML = '';
      }
    }, 5000);
  }

  // Load data
  async function loadData() {
    state.isLoading = true;
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2.5rem; color: #64748b;">
          Đang nạp dữ liệu từ máy chủ...
        </td>
      </tr>
    `;

    try {
      const response = await getTrainingPrograms({
        page: state.pagination.currentPage,
        pageSize: state.pagination.pageSize,
        search: state.searchQuery,
        status: state.statusFilter
      });

      state.programs = response?.data || [];
      state.pagination = response?.pagination || state.pagination;

      renderTable();
      renderPagination();
      updateStats();
    } catch (error) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: #dc2626;">
            ❌ ${error.message || 'Không thể tải danh mục chương trình đào tạo.'}
          </td>
        </tr>
      `;
    } finally {
      state.isLoading = false;
    }
  }

  function updateStats() {
    const total = state.pagination.totalRecords || state.programs.length;
    let active = 0;
    let inactive = 0;

    state.programs.forEach(p => {
      if (p.status === 'ACTIVE') active++;
      else inactive++;
    });

    statTotal.textContent = total;
    statActive.textContent = active;
    statInactive.textContent = inactive;
  }

  function renderTable() {
    if (!state.programs.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="tp-empty-state">
              <div class="tp-empty-icon">📭</div>
              <h3>Không tìm thấy chương trình đào tạo nào</h3>
              <p>Thử đổi từ khóa tìm kiếm, bộ lọc hoặc thêm mới chương trình đầu tiên.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = state.programs.map(p => `
      <tr data-program-id="${p.id}">
        <td>
          <span class="tp-code-badge">${escapeHtml(p.code)}</span>
        </td>
        <td>
          <div class="tp-prog-name">${escapeHtml(p.name)}</div>
          ${p.description ? `<div class="tp-prog-desc" title="${escapeHtml(p.description)}">${escapeHtml(p.description)}</div>` : ''}
        </td>
        <td>
          <strong>${p.duration}</strong> <span style="font-size: 0.8125rem; color: #64748b;">giờ</span>
        </td>
        <td>
          <span class="tp-tuition-val">${formatCurrency(p.standard_tuition)}</span>
        </td>
        <td>
          <span class="tp-status-badge is-${p.status.toLowerCase()}">
            ${p.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng áp dụng'}
          </span>
        </td>
        <td>
          ${p.hasClassLinked 
            ? `<span class="tp-linked-tag" title="Chương trình đang liên kết ${p.linkedClassesCount} lớp học">🏫 ${p.linkedClassesCount} lớp</span>`
            : `<span class="tp-unlinked-tag">Chưa có lớp</span>`
          }
        </td>
        <td>
          <div class="tp-actions-cell">
            <button type="button" class="tp-btn-action is-edit" data-action="edit" data-id="${p.id}" title="Chỉnh sửa thông tin">
              ✏️ Sửa
            </button>
            <button type="button" class="tp-btn-action is-toggle" data-action="toggle-status" data-id="${p.id}" title="Đổi trạng thái Active/Inactive">
              ${p.status === 'ACTIVE' ? '⏸️ Tạm ngừng' : '▶️ Kích hoạt'}
            </button>
            <button type="button" class="tp-btn-action is-delete" data-action="delete" data-id="${p.id}" title="Xóa chương trình">
              🗑️ Xóa
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    // Attach row action listeners
    tableBody.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        const program = state.programs.find(p => p.id === id);
        if (!program) return;

        if (action === 'edit') openFormModal(program);
        if (action === 'toggle-status') handleToggleStatus(program);
        if (action === 'delete') openDeleteConfirmModal(program);
      });
    });
  }

  function renderPagination() {
    const { currentPage, totalPages, totalRecords, startIndex, endIndex } = state.pagination;
    pageInfo.textContent = totalRecords > 0 
      ? `Hiển thị từ ${startIndex} đến ${endIndex} trong tổng số ${totalRecords} chương trình`
      : 'Không có dữ liệu';

    if (totalPages <= 1) {
      pageControls.innerHTML = '';
      return;
    }

    let buttonsHtml = `
      <button type="button" class="tp-page-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">
        ‹ Trước
      </button>
    `;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        buttonsHtml += `
          <button type="button" class="tp-page-btn ${i === currentPage ? 'is-active' : ''}" data-page="${i}">
            ${i}
          </button>
        `;
      } else if (i === currentPage - 2 || i === currentPage + 2) {
        buttonsHtml += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
      }
    }

    buttonsHtml += `
      <button type="button" class="tp-page-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">
        Sau ›
      </button>
    `;

    pageControls.innerHTML = buttonsHtml;
    pageControls.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page, 10);
        if (page && page !== state.pagination.currentPage) {
          state.pagination.currentPage = page;
          loadData();
        }
      });
    });
  }

  // --- Modal Form: Thêm mới / Chỉnh sửa ---
  function openFormModal(program = null) {
    const isEdit = Boolean(program);
    modalRoot.innerHTML = `
      <div class="tp-modal-backdrop" id="tp-modal-backdrop">
        <div class="tp-modal-card">
          <div class="tp-modal-header">
            <h3>${isEdit ? '✏️ Chỉnh sửa chương trình đào tạo' : '➕ Thêm mới chương trình đào tạo'}</h3>
            <button type="button" class="tp-modal-close" id="btn-modal-close">✕</button>
          </div>
          <form id="tp-program-form">
            <div class="tp-modal-body">
              <div id="tp-form-alert"></div>

              <!-- Mã chương trình -->
              <div class="tp-form-group">
                <label for="form-code">Mã chương trình <span class="req">*</span></label>
                <input 
                  type="text" 
                  id="form-code" 
                  name="code" 
                  value="${escapeHtml(program?.code || '')}" 
                  placeholder="VD: PROG-IT-01" 
                  ${isEdit ? 'disabled' : 'required'} 
                  autocomplete="off"
                />
                <span class="tp-form-help">
                  ${isEdit 
                    ? '🔒 Mã chương trình là duy nhất và không được phép sửa sau khi tạo.' 
                    : 'Mã định danh duy nhất trong toàn hệ thống, tự động viết hoa.'}
                </span>
                <span class="tp-form-error" id="err-code"></span>
              </div>

              <!-- Tên chương trình -->
              <div class="tp-form-group">
                <label for="form-name">Tên chương trình đào tạo <span class="req">*</span></label>
                <input 
                  type="text" 
                  id="form-name" 
                  name="name" 
                  value="${escapeHtml(program?.name || '')}" 
                  placeholder="VD: Lập trình Web Full-Stack Chuyên nghiệp" 
                  required 
                />
                <span class="tp-form-error" id="err-name"></span>
              </div>

              <!-- Thời lượng & Học phí -->
              <div class="tp-form-row">
                <div class="tp-form-group">
                  <label for="form-duration">Tổng thời lượng (giờ) <span class="req">*</span></label>
                  <input 
                    type="number" 
                    id="form-duration" 
                    name="duration" 
                    value="${program?.duration ?? ''}" 
                    min="1" 
                    step="1" 
                    placeholder="VD: 90" 
                    required 
                  />
                  <span class="tp-form-error" id="err-duration"></span>
                </div>
                <div class="tp-form-group">
                  <label for="form-tuition">Học phí chuẩn (VNĐ) <span class="req">*</span></label>
                  <input 
                    type="number" 
                    id="form-tuition" 
                    name="standard_tuition" 
                    value="${program?.standard_tuition ?? ''}" 
                    min="0" 
                    step="50000" 
                    placeholder="VD: 15000000" 
                    required 
                  />
                  <span class="tp-form-error" id="err-tuition"></span>
                </div>
              </div>

              <!-- Trạng thái -->
              <div class="tp-form-group">
                <label for="form-status">Trạng thái áp dụng <span class="req">*</span></label>
                <select id="form-status" name="status">
                  <option value="ACTIVE" ${program?.status === 'ACTIVE' || !program ? 'selected' : ''}>Hoạt động (ACTIVE) - Sẵn sàng cho mở lớp mới</option>
                  <option value="INACTIVE" ${program?.status === 'INACTIVE' ? 'selected' : ''}>Ngừng áp dụng (INACTIVE) - Tạm dừng mở lớp</option>
                </select>
              </div>

              <!-- Mô tả -->
              <div class="tp-form-group">
                <label for="form-desc">Mô tả nội dung chương trình</label>
                <textarea id="form-desc" name="description" rows="3" placeholder="Nhập mục tiêu đào tạo, lộ trình tổng quan...">${escapeHtml(program?.description || '')}</textarea>
              </div>
            </div>

            <div class="tp-modal-footer">
              <button type="button" class="tp-btn-secondary" id="btn-modal-cancel">Hủy bỏ</button>
              <button type="submit" class="tp-btn-primary" id="btn-modal-submit">
                ${isEdit ? '💾 Lưu thay đổi' : '➕ Tạo chương trình'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    const closeBtn = modalRoot.querySelector('#btn-modal-close');
    const cancelBtn = modalRoot.querySelector('#btn-modal-cancel');
    const form = modalRoot.querySelector('#tp-program-form');
    const submitBtn = modalRoot.querySelector('#btn-modal-submit');
    const formAlert = modalRoot.querySelector('#tp-form-alert');

    const closeModal = () => { modalRoot.innerHTML = ''; };
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      formAlert.innerHTML = '';

      // Reset client errors
      ['code', 'name', 'duration', 'tuition'].forEach(k => {
        const el = modalRoot.querySelector(`#err-${k}`);
        if (el) el.textContent = '';
      });

      const formData = new FormData(form);
      const code = (formData.get('code') || '').trim();
      const name = (formData.get('name') || '').trim();
      const durationVal = formData.get('duration');
      const tuitionVal = formData.get('standard_tuition');
      const status = formData.get('status');
      const description = (formData.get('description') || '').trim();

      // Client validation
      let hasError = false;
      if (!isEdit && !code) {
        modalRoot.querySelector('#err-code').textContent = 'Vui lòng nhập mã chương trình.';
        hasError = true;
      }
      if (!name) {
        modalRoot.querySelector('#err-name').textContent = 'Vui lòng nhập tên chương trình.';
        hasError = true;
      }
      const duration = Number(durationVal);
      if (!durationVal || Number.isNaN(duration) || duration <= 0) {
        modalRoot.querySelector('#err-duration').textContent = 'Thời lượng phải lớn hơn 0.';
        hasError = true;
      }
      const standard_tuition = Number(tuitionVal);
      if (tuitionVal === '' || Number.isNaN(standard_tuition) || standard_tuition < 0) {
        modalRoot.querySelector('#err-tuition').textContent = 'Học phí chuẩn không được âm.';
        hasError = true;
      }

      if (hasError) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang xử lý...';

      try {
        if (isEdit) {
          await updateTrainingProgram(program.id, {
            name,
            duration,
            standard_tuition,
            status,
            description
          });
          showToast(`Đã cập nhật chương trình "${name}" thành công.`);
        } else {
          await createTrainingProgram({
            code,
            name,
            duration,
            standard_tuition,
            status,
            description
          });
          showToast(`Đã thêm mới chương trình "${name}" thành công.`);
        }
        closeModal();
        await loadData();
      } catch (err) {
        formAlert.innerHTML = `
          <div class="tp-alert is-error">
            <span class="tp-alert-icon">❌</span>
            <div>${err.message || 'Thao tác không thành công.'}</div>
          </div>
        `;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isEdit ? '💾 Lưu thay đổi' : '➕ Tạo chương trình';
      }
    });
  }

  // --- Quick Status Toggle ---
  async function handleToggleStatus(program) {
    const nextStatus = program.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const actionLabel = nextStatus === 'ACTIVE' ? 'Kích hoạt' : 'Ngừng áp dụng';

    try {
      await updateTrainingProgramStatus(program.id, nextStatus);
      showToast(`Đã chuyển trạng thái chương trình "${program.name}" sang "${actionLabel}".`);
      await loadData();
    } catch (err) {
      showToast(err.message || 'Không thể đổi trạng thái chương trình.', 'error');
    }
  }

  // --- Modal Xác nhận Xóa & Xử lý Ràng buộc Lớp học ---
  function openDeleteConfirmModal(program) {
    modalRoot.innerHTML = `
      <div class="tp-modal-backdrop" id="tp-modal-backdrop">
        <div class="tp-modal-card" style="max-width: 480px;">
          <div class="tp-modal-header">
            <h3>🗑️ Xác nhận xóa chương trình đào tạo</h3>
            <button type="button" class="tp-modal-close" id="btn-modal-close">✕</button>
          </div>
          <div class="tp-modal-body">
            <div id="tp-delete-alert"></div>
            <p style="margin: 0; color: #334155; line-height: 1.5;">
              Bạn có chắc chắn muốn xóa chương trình đào tạo 
              <strong>"${escapeHtml(program.name)}"</strong> (Mã: <code>${escapeHtml(program.code)}</code>) không?
            </p>
            <div style="font-size: 0.8125rem; color: #64748b; background: #f8fafc; padding: 0.75rem; border-radius: 8px; border: 1px solid #e2e8f0;">
              ℹ️ <strong>Quy tắc nghiệp vụ:</strong> Nếu chương trình này đã từng có lớp học liên kết, hệ thống sẽ từ chối xóa và gợi ý chuyển sang "Ngừng áp dụng".
            </div>
            <div id="tp-delete-action-area"></div>
          </div>
          <div class="tp-modal-footer">
            <button type="button" class="tp-btn-secondary" id="btn-delete-cancel">Hủy bỏ</button>
            <button type="button" class="tp-btn-danger" id="btn-delete-confirm">Xác nhận xóa</button>
          </div>
        </div>
      </div>
    `;

    const closeBtn = modalRoot.querySelector('#btn-modal-close');
    const cancelBtn = modalRoot.querySelector('#btn-delete-cancel');
    const confirmBtn = modalRoot.querySelector('#btn-delete-confirm');
    const deleteAlert = modalRoot.querySelector('#tp-delete-alert');
    const actionArea = modalRoot.querySelector('#tp-delete-action-area');

    const closeModal = () => { modalRoot.innerHTML = ''; };
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Đang kiểm tra...';
      deleteAlert.innerHTML = '';
      actionArea.innerHTML = '';

      try {
        await deleteTrainingProgram(program.id);
        showToast(`Đã xóa vĩnh viễn chương trình "${program.name}" khỏi cơ sở dữ liệu.`);
        closeModal();
        await loadData();
      } catch (err) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Xác nhận xóa';

        // Lỗi do có lớp học liên kết (Quy tắc 2)
        deleteAlert.innerHTML = `
          <div class="tp-alert is-warning">
            <span class="tp-alert-icon">⚠️</span>
            <div><strong>${err.message || 'Không thể xóa chương trình đào tạo.'}</strong></div>
          </div>
        `;

        // Cung cấp nút tiện ích chuyển ngay sang INACTIVE
        actionArea.innerHTML = `
          <div class="tp-warning-action-box">
            <p>💡 Gợi ý giải quyết nhanh: Chuyển chương trình này sang trạng thái <strong>Ngừng áp dụng (INACTIVE)</strong> để đóng nhận lớp mới mà vẫn bảo toàn lịch sử dữ liệu lớp học hiện có.</p>
            <button type="button" class="tp-btn-warning" id="btn-quick-deactivate">
              ⏸️ Chuyển sang "Ngừng áp dụng" ngay
            </button>
          </div>
        `;

        const quickBtn = actionArea.querySelector('#btn-quick-deactivate');
        quickBtn.addEventListener('click', async () => {
          quickBtn.disabled = true;
          quickBtn.textContent = 'Đang cập nhật...';
          try {
            await updateTrainingProgramStatus(program.id, 'INACTIVE');
            showToast(`Đã chuyển trạng thái chương trình "${program.name}" sang "Ngừng áp dụng".`);
            closeModal();
            await loadData();
          } catch (deactivateErr) {
            deleteAlert.innerHTML = `
              <div class="tp-alert is-error">
                <span class="tp-alert-icon">❌</span>
                <div>${deactivateErr.message}</div>
              </div>
            `;
            quickBtn.disabled = false;
          }
        });
      }
    });
  }

  // --- Search & Filter Listeners ---
  let debounceTimeout = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      state.searchQuery = searchInput.value.trim();
      state.pagination.currentPage = 1;
      loadData();
    }, 250);
  });

  statusSelect.addEventListener('change', () => {
    state.statusFilter = statusSelect.value;
    state.pagination.currentPage = 1;
    loadData();
  });

  btnCreate.addEventListener('click', () => {
    openFormModal();
  });

  // Initial load
  loadData();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

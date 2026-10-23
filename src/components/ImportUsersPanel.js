/**
 * [FE] DNKN-16/17: Màn hình nhập người dùng hàng loạt từ Excel
 * Luồng: Tải mẫu → Upload file → Xem trước (preview) → Xác nhận → Báo cáo tổng kết
 */

import { downloadTemplatefile, previewExcelImport, confirmExcelImport } from '../core/importUsersService.js';

// Trạng thái của màn hình
const STATE = {
  IDLE: 'idle',
  PREVIEWING: 'previewing',
  PREVIEWED: 'previewed',
  IMPORTING: 'importing',
  DONE: 'done'
};

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

export function renderImportUsersPanel(container) {
  let state = STATE.IDLE;
  let previewData = null;
  let importResult = null;
  let selectedFile = null;

  function render() {
    container.innerHTML = buildHtml();
    bindEvents();
  }

  function buildHtml() {
    return `
      <section class="import-panel dash-card glass-panel" aria-labelledby="import-panel-title">
        <div class="import-panel-header">
          <div class="card-title-row">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="12" y1="18" x2="12" y2="12"></line>
              <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
            <h3 id="import-panel-title">Nhập người dùng hàng loạt từ Excel</h3>
          </div>
          <p class="card-desc">
            Tải xuống tệp mẫu, điền danh sách người dùng rồi tải lên để xem trước và xác nhận nhập.
          </p>
        </div>

        ${buildStepIndicator()}

        <div class="import-panel-body">
          ${state === STATE.IDLE ? buildIdleSection() : ''}
          ${state === STATE.PREVIEWING ? buildLoadingSection('Đang đọc và kiểm tra dữ liệu...') : ''}
          ${state === STATE.PREVIEWED ? buildPreviewSection() : ''}
          ${state === STATE.IMPORTING ? buildLoadingSection('Đang nhập dữ liệu vào hệ thống...') : ''}
          ${state === STATE.DONE ? buildDoneSection() : ''}
        </div>
      </section>
    `;
  }

  function buildStepIndicator() {
    const steps = [
      { id: STATE.IDLE, label: 'Tải lên tệp' },
      { id: STATE.PREVIEWED, label: 'Xem trước' },
      { id: STATE.DONE, label: 'Kết quả' }
    ];
    const activeMap = {
      [STATE.IDLE]: 0,
      [STATE.PREVIEWING]: 0,
      [STATE.PREVIEWED]: 1,
      [STATE.IMPORTING]: 1,
      [STATE.DONE]: 2
    };
    const activeIndex = activeMap[state];

    return `
      <ol class="import-steps" aria-label="Các bước thực hiện">
        ${steps.map((step, i) => `
          <li class="import-step ${i < activeIndex ? 'is-done' : ''} ${i === activeIndex ? 'is-active' : ''}">
            <span class="step-num">${i < activeIndex ? '✓' : i + 1}</span>
            <span class="step-label">${step.label}</span>
            ${i < steps.length - 1 ? '<span class="step-connector" aria-hidden="true"></span>' : ''}
          </li>
        `).join('')}
      </ol>
    `;
  }

  function buildIdleSection() {
    return `
      <div class="import-idle-section">
        <div class="import-actions-row">
          <button type="button" class="btn-download-template" id="btn-download-template">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Tải tệp mẫu (.xlsx)
          </button>
          <span class="import-hint-text">Điền thông tin vào tệp mẫu rồi tải lên bên dưới</span>
        </div>

        <div class="import-upload-area" id="import-drop-zone" role="region" aria-label="Vùng tải tệp Excel">
          <input
            type="file"
            id="import-file-input"
            accept=".xlsx,.xls"
            class="import-file-input-hidden"
            aria-label="Chọn tệp Excel để nhập"
          >
          <label for="import-file-input" class="import-drop-label">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="import-upload-icon">
              <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path>
              <path d="M12 12v9"></path>
              <path d="m16 16-4-4-4 4"></path>
            </svg>
            <span class="import-drop-main">Kéo thả hoặc <strong>click để chọn tệp</strong></span>
            <span class="import-drop-sub">Chấp nhận: .xlsx, .xls — Tối đa 5 MB</span>
          </label>
          <div class="import-selected-file" id="import-selected-file" style="display:none">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span id="import-filename-text"></span>
            <button type="button" class="import-clear-file" id="import-clear-file" title="Xóa tệp đã chọn">✕</button>
          </div>
        </div>

        <div class="import-submit-row">
          <button type="button" class="btn-submit import-preview-btn" id="btn-preview-import" disabled>
            Kiểm tra và xem trước
          </button>
          <p id="import-error-msg" class="import-error-msg" role="alert" aria-live="polite"></p>
        </div>
      </div>
    `;
  }

  function buildLoadingSection(message) {
    return `
      <div class="import-loading-section">
        <div class="import-spinner" aria-hidden="true"></div>
        <p class="import-loading-text">${escapeHtml(message)}</p>
      </div>
    `;
  }

  function buildPreviewSection() {
    if (!previewData) return '';
    const { validCount, invalidCount, skippedCount, validRows, invalidRows } = previewData;
    const totalData = validCount + invalidCount;

    return `
      <div class="import-preview-section">
        <div class="preview-summary-row">
          <div class="preview-stat is-success">
            <span class="preview-stat-num">${validCount}</span>
            <span class="preview-stat-label">Dòng hợp lệ</span>
          </div>
          <div class="preview-stat is-error">
            <span class="preview-stat-num">${invalidCount}</span>
            <span class="preview-stat-label">Dòng lỗi</span>
          </div>
          <div class="preview-stat is-muted">
            <span class="preview-stat-num">${skippedCount}</span>
            <span class="preview-stat-label">Dòng bỏ qua</span>
          </div>
          <div class="preview-stat is-info">
            <span class="preview-stat-num">${totalData}</span>
            <span class="preview-stat-label">Tổng dữ liệu</span>
          </div>
        </div>

        ${invalidCount > 0 ? `
          <details class="preview-errors-block" open>
            <summary class="preview-errors-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              ${invalidCount} dòng có lỗi (sẽ bị bỏ qua khi import)
            </summary>
            <div class="preview-table-wrap">
              <table class="preview-table" role="table">
                <thead>
                  <tr>
                    <th>Dòng</th>
                    <th>Họ và Tên</th>
                    <th>Email</th>
                    <th>Vai trò</th>
                    <th>Lỗi</th>
                  </tr>
                </thead>
                <tbody>
                  ${invalidRows.map(row => `
                    <tr class="row-error">
                      <td><span class="row-index-badge">#${escapeHtml(row.rowIndex)}</span></td>
                      <td>${escapeHtml(row.name || '—')}</td>
                      <td>${escapeHtml(row.email || '—')}</td>
                      <td>${escapeHtml(row.role || '—')}</td>
                      <td>
                        <ul class="error-list">
                          ${row.errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}
                        </ul>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </details>
        ` : ''}

        ${validCount > 0 ? `
          <details class="preview-valid-block" ${invalidCount === 0 ? 'open' : ''}>
            <summary class="preview-valid-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              ${validCount} dòng hợp lệ sẽ được import
            </summary>
            <div class="preview-table-wrap">
              <table class="preview-table" role="table">
                <thead>
                  <tr>
                    <th>Dòng</th>
                    <th>Họ và Tên</th>
                    <th>Email</th>
                    <th>Số điện thoại</th>
                    <th>Vai trò</th>
                  </tr>
                </thead>
                <tbody>
                  ${validRows.map(row => `
                    <tr class="row-valid">
                      <td><span class="row-index-badge is-valid">#${escapeHtml(row.rowIndex)}</span></td>
                      <td>${escapeHtml(row.name)}</td>
                      <td>${escapeHtml(row.email)}</td>
                      <td>${escapeHtml(row.phone || '—')}</td>
                      <td><span class="role-chip">${escapeHtml(row.roleLabel || row.role)}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </details>
        ` : ''}

        ${validCount === 0 ? `
          <div class="preview-no-valid-warning">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Không có dòng nào hợp lệ để import. Vui lòng sửa lỗi trong tệp và thử lại.
          </div>
        ` : ''}

        <div class="preview-action-row">
          <button type="button" class="btn-secondary" id="btn-back-to-upload">
            ← Tải lên tệp khác
          </button>
          ${validCount > 0 ? `
            <button type="button" class="btn-submit import-confirm-btn" id="btn-confirm-import">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              Xác nhận import ${validCount} tài khoản
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  function buildDoneSection() {
    if (!importResult) return '';
    const { totalSubmitted, successCount, failedCount, failedResults } = importResult;

    return `
      <div class="import-done-section">
        <div class="done-summary-card ${successCount > 0 ? 'is-success' : 'is-warning'}">
          <div class="done-summary-icon">${successCount > 0 ? '🎉' : '⚠️'}</div>
          <div class="done-summary-body">
            <h4 class="done-summary-title">Import hoàn tất</h4>
            <p class="done-summary-desc">
              Đã xử lý <strong>${totalSubmitted}</strong> dòng:
              <strong class="text-success">${successCount} tài khoản được tạo thành công</strong>${failedCount > 0 ? `,
              <strong class="text-error">${failedCount} dòng bị bỏ qua</strong>` : ''}.
            </p>
          </div>
        </div>

        <div class="done-stats-row">
          <div class="done-stat is-success">
            <span class="done-stat-num">${successCount}</span>
            <span class="done-stat-label">Tạo thành công</span>
          </div>
          <div class="done-stat is-error">
            <span class="done-stat-num">${failedCount}</span>
            <span class="done-stat-label">Bị bỏ qua</span>
          </div>
          <div class="done-stat is-info">
            <span class="done-stat-num">${totalSubmitted}</span>
            <span class="done-stat-label">Tổng đã gửi</span>
          </div>
        </div>

        ${failedCount > 0 ? `
          <details class="done-errors-block" open>
            <summary class="preview-errors-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              ${failedCount} dòng không import được
            </summary>
            <div class="preview-table-wrap">
              <table class="preview-table" role="table">
                <thead>
                  <tr>
                    <th>Dòng</th>
                    <th>Họ và Tên</th>
                    <th>Email</th>
                    <th>Lý do lỗi</th>
                  </tr>
                </thead>
                <tbody>
                  ${failedResults.map(row => `
                    <tr class="row-error">
                      <td><span class="row-index-badge">#${escapeHtml(row.rowIndex)}</span></td>
                      <td>${escapeHtml(row.name || '—')}</td>
                      <td>${escapeHtml(row.email || '—')}</td>
                      <td class="error-cell">${escapeHtml(row.error || (row.errors?.join('; ') || 'Lỗi không xác định'))}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </details>
        ` : ''}

        <p class="done-notice">
          Tài khoản mới có trạng thái <strong>Chờ kích hoạt</strong>. Email kích hoạt đã được gửi (nếu hệ thống email được cấu hình).
        </p>

        <div class="preview-action-row">
          <button type="button" class="btn-submit" id="btn-import-again">
            + Nhập thêm từ tệp khác
          </button>
        </div>
      </div>
    `;
  }

  function bindEvents() {
    // Nút tải tệp mẫu
    container.querySelector('#btn-download-template')?.addEventListener('click', async () => {
      const btn = container.querySelector('#btn-download-template');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = 'Đang tải...';
      try {
        await downloadTemplatefile();
      } catch (err) {
        showError(err.message || 'Không thể tải tệp mẫu.');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });

    // Input chọn file
    const fileInput = container.querySelector('#import-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        handleFileSelected(file);
      });
    }

    // Kéo thả file
    const dropZone = container.querySelector('#import-drop-zone');
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('is-dragging');
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('is-dragging');
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('is-dragging');
        const file = e.dataTransfer?.files?.[0];
        handleFileSelected(file);
      });
    }

    // Nút xóa file đã chọn
    container.querySelector('#import-clear-file')?.addEventListener('click', () => {
      selectedFile = null;
      const fileInput = container.querySelector('#import-file-input');
      if (fileInput) fileInput.value = '';
      updateFileDisplay();
    });

    // Nút xem trước
    container.querySelector('#btn-preview-import')?.addEventListener('click', async () => {
      if (!selectedFile) return;
      clearError();
      state = STATE.PREVIEWING;
      render();

      try {
        previewData = await previewExcelImport(selectedFile);
        state = STATE.PREVIEWED;
      } catch (err) {
        state = STATE.IDLE;
        render();
        showError(err.message || 'Không thể đọc tệp. Vui lòng kiểm tra lại định dạng.');
        return;
      }
      render();
    });

    // Nút quay lại upload
    container.querySelector('#btn-back-to-upload')?.addEventListener('click', () => {
      state = STATE.IDLE;
      previewData = null;
      selectedFile = null;
      render();
    });

    // Nút xác nhận import
    container.querySelector('#btn-confirm-import')?.addEventListener('click', async () => {
      if (!previewData?.validRows?.length) return;
      state = STATE.IMPORTING;
      render();

      try {
        importResult = await confirmExcelImport(previewData.validRows);
        state = STATE.DONE;
      } catch (err) {
        state = STATE.PREVIEWED;
        render();
        showError(err.message || 'Import thất bại. Vui lòng thử lại.');
        return;
      }
      render();
    });

    // Nút import thêm
    container.querySelector('#btn-import-again')?.addEventListener('click', () => {
      state = STATE.IDLE;
      previewData = null;
      importResult = null;
      selectedFile = null;
      render();
    });
  }

  function handleFileSelected(file) {
    if (!file) return;

    const isExcel = /\.(xlsx|xls)$/i.test(file.name) ||
      ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'].includes(file.type);

    if (!isExcel) {
      showError('Chỉ chấp nhận tệp Excel (.xlsx hoặc .xls).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError('Tệp vượt quá giới hạn 5 MB.');
      return;
    }

    selectedFile = file;
    clearError();
    updateFileDisplay();
  }

  function updateFileDisplay() {
    const selectedFileEl = container.querySelector('#import-selected-file');
    const filenameText = container.querySelector('#import-filename-text');
    const previewBtn = container.querySelector('#btn-preview-import');

    if (selectedFileEl && filenameText) {
      if (selectedFile) {
        selectedFileEl.style.display = 'flex';
        filenameText.textContent = `${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`;
      } else {
        selectedFileEl.style.display = 'none';
        filenameText.textContent = '';
      }
    }

    if (previewBtn) {
      previewBtn.disabled = !selectedFile;
    }
  }

  function showError(message) {
    const el = container.querySelector('#import-error-msg');
    if (el) {
      el.textContent = message;
      el.classList.add('is-visible');
    }
  }

  function clearError() {
    const el = container.querySelector('#import-error-msg');
    if (el) {
      el.textContent = '';
      el.classList.remove('is-visible');
    }
  }

  render();
}

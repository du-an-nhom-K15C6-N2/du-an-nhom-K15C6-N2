/**
 * import-users.js — Trang nhập người dùng hàng loạt từ Excel (DNKN-16/17)
 *
 * Luồng: Tải mẫu → Upload & Xem trước → Xác nhận Import → Báo cáo tổng kết
 */

(function () {
  'use strict';

  // ============================================================
  // AUTH HELPERS
  // ============================================================
  function getAuthToken() {
    return (
      localStorage.getItem('educlass_access_token') ||
      sessionStorage.getItem('educlass_access_token')
    );
  }

  function getAuthHeaders() {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // ============================================================
  // TOAST NOTIFICATIONS
  // ============================================================
  function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(30px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 320);
    }, duration);
  }

  // ============================================================
  // STATE
  // ============================================================
  let selectedFile = null;
  let previewData = null; // { validRows, invalidRows, skippedRows, ... }
  let activeTab = 'valid';

  // ============================================================
  // ELEMENT REFS
  // ============================================================
  const elDropZone         = document.getElementById('drop-zone');
  const elFileInput        = document.getElementById('file-input');
  const elFileInfo         = document.getElementById('file-info');
  const elFileNameDisplay  = document.getElementById('file-name-display');
  const elFileSizeDisplay  = document.getElementById('file-size-display');
  const elBtnClearFile     = document.getElementById('btn-clear-file');
  const elUploadError      = document.getElementById('upload-error');
  const elBtnPreview       = document.getElementById('btn-preview');
  const elPreviewSpinner   = document.getElementById('preview-spinner');

  const elStepPreview      = document.getElementById('step-preview');
  const elSummaryTotal     = document.getElementById('summary-total');
  const elSummaryValid     = document.getElementById('summary-valid');
  const elSummaryInvalid   = document.getElementById('summary-invalid');
  const elTabValid         = document.getElementById('tab-valid');
  const elTabInvalid       = document.getElementById('tab-invalid');
  const elTabValidCount    = document.getElementById('tab-valid-count');
  const elTabInvalidCount  = document.getElementById('tab-invalid-count');
  const elPreviewTbody     = document.getElementById('preview-tbody');
  const elPreviewEmpty     = document.getElementById('preview-empty');
  const elPreviewWarning   = document.getElementById('preview-warning');
  const elWarnInvalidCount = document.getElementById('warn-invalid-count');
  const elWarnValidCount   = document.getElementById('warn-valid-count');
  const elBtnCancelPreview = document.getElementById('btn-cancel-preview');
  const elBtnConfirmImport = document.getElementById('btn-confirm-import');
  const elBtnConfirmCount  = document.getElementById('btn-confirm-count');
  const elImportSpinner    = document.getElementById('import-spinner');

  const elStepReport       = document.getElementById('step-report');
  const elReportBanner     = document.getElementById('report-banner');
  const elReportIcon       = document.getElementById('report-icon');
  const elReportMessage    = document.getElementById('report-message');
  const elReportTotal      = document.getElementById('report-total');
  const elReportSuccess    = document.getElementById('report-success');
  const elReportFailed     = document.getElementById('report-failed');
  const elReportErrorSection = document.getElementById('report-error-section');
  const elReportErrorTbody  = document.getElementById('report-error-tbody');
  const elBtnImportAgain   = document.getElementById('btn-import-again');

  // ============================================================
  // STEP 1: TẢI FILE MẪU
  // ============================================================
  document.getElementById('btn-download-template').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/users/import/template', {
        headers: getAuthHeaders()
      });
      if (res.status === 401) {
        showToast('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
        setTimeout(() => { window.location.href = '/login.html'; }, 1500);
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || 'Không thể tải tệp mẫu.');
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'mau-nhap-nguoi-dung.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Đã tải tệp mẫu về máy.', 'success');
    } catch (err) {
      showToast(err.message || 'Lỗi khi tải tệp mẫu.', 'error');
    }
  });

  // ============================================================
  // STEP 2: UPLOAD & CHỌN FILE
  // ============================================================

  // Drag & Drop
  elDropZone.addEventListener('dragover', e => {
    e.preventDefault();
    elDropZone.classList.add('drag-over');
  });
  elDropZone.addEventListener('dragleave', () => elDropZone.classList.remove('drag-over'));
  elDropZone.addEventListener('drop', e => {
    e.preventDefault();
    elDropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  });

  // Click drop zone cũng mở dialog file
  elDropZone.addEventListener('click', e => {
    if (e.target !== elFileInput && !e.target.closest('label')) {
      elFileInput.click();
    }
  });
  elDropZone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      elFileInput.click();
    }
  });

  // Input file thay đổi
  elFileInput.addEventListener('change', () => {
    const file = elFileInput.files[0];
    if (file) handleFileSelect(file);
    elFileInput.value = '';
  });

  function handleFileSelect(file) {
    setUploadError('');

    const allowedExts = /\.(xlsx|xls)$/i;
    if (!allowedExts.test(file.name)) {
      setUploadError('Chỉ chấp nhận tệp Excel (.xlsx hoặc .xls).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Tệp vượt quá giới hạn 5 MB. Vui lòng chia nhỏ dữ liệu.');
      return;
    }

    selectedFile = file;
    elFileNameDisplay.textContent = file.name;
    elFileSizeDisplay.textContent = formatFileSize(file.size);
    elFileInfo.classList.remove('hidden');
    elBtnPreview.disabled = false;
  }

  elBtnClearFile.addEventListener('click', clearFile);

  function clearFile() {
    selectedFile = null;
    elFileInfo.classList.add('hidden');
    elFileNameDisplay.textContent = '';
    elFileSizeDisplay.textContent = '';
    elBtnPreview.disabled = true;
    setUploadError('');
    elFileInput.value = '';
  }

  function setUploadError(msg) {
    elUploadError.textContent = msg;
    elUploadError.classList.toggle('hidden', !msg);
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ============================================================
  // XEM TRƯỚC DỮ LIỆU
  // ============================================================
  elBtnPreview.addEventListener('click', async () => {
    if (!selectedFile) return;

    setLoading(elBtnPreview, elPreviewSpinner, true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/users/import/preview', {
        method: 'POST',
        headers: { ...getAuthHeaders() },
        body: formData
      });

      const json = await res.json();

      if (res.status === 401) {
        showToast('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
        setTimeout(() => { window.location.href = '/login.html'; }, 1500);
        return;
      }

      if (res.status === 403) {
        showToast('Bạn không có quyền thực hiện chức năng này.', 'error');
        return;
      }

      if (!res.ok || !json.success) {
        setUploadError(json.message || 'Lỗi khi đọc dữ liệu từ tệp Excel.');
        return;
      }

      previewData = json.data;
      renderPreview(previewData);
      showSection('preview');
    } catch (err) {
      setUploadError('Lỗi kết nối đến máy chủ. Vui lòng thử lại.');
    } finally {
      setLoading(elBtnPreview, elPreviewSpinner, false);
    }
  });

  function renderPreview(data) {
    const { totalRows, validCount, invalidCount, validRows, invalidRows } = data;

    elSummaryTotal.textContent   = totalRows;
    elSummaryValid.textContent   = validCount;
    elSummaryInvalid.textContent = invalidCount;
    elTabValidCount.textContent  = validCount;
    elTabInvalidCount.textContent = invalidCount;

    // Nút xác nhận
    elBtnConfirmImport.disabled = validCount === 0;
    if (elBtnConfirmCount) elBtnConfirmCount.textContent = validCount;

    // Cảnh báo
    if (invalidCount > 0) {
      elPreviewWarning.classList.remove('hidden');
      elWarnInvalidCount.textContent = invalidCount;
      elWarnValidCount.textContent   = validCount;
    } else {
      elPreviewWarning.classList.add('hidden');
    }

    // Mặc định hiển thị tab hợp lệ
    switchTab('valid', validRows, invalidRows);
  }

  // ---- Tab chuyển đổi ----
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      activeTab = tab;
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('tab-active', b.dataset.tab === tab);
        b.setAttribute('aria-selected', String(b.dataset.tab === tab));
      });
      if (previewData) {
        switchTab(tab, previewData.validRows, previewData.invalidRows);
      }
    });
  });

  function switchTab(tab, validRows, invalidRows) {
    const rows = tab === 'valid' ? validRows : invalidRows;
    renderTable(rows, tab === 'valid');
  }

  function renderTable(rows, isValid) {
    elPreviewTbody.innerHTML = '';

    if (!rows || rows.length === 0) {
      elPreviewEmpty.classList.remove('hidden');
      return;
    }
    elPreviewEmpty.classList.add('hidden');

    rows.forEach(row => {
      const tr = document.createElement('tr');
      tr.className = isValid ? 'row-valid' : 'row-invalid';

      tr.innerHTML = `
        <td>${escHtml(String(row.rowIndex))}</td>
        <td>${escHtml(row.name || '—')}</td>
        <td>${escHtml(row.email || '—')}</td>
        <td>${escHtml(row.phone || '—')}</td>
        <td>${escHtml(row.roleLabel || row.role || '—')}</td>
        <td>${renderRowStatus(isValid, row.errors)}</td>
      `;

      elPreviewTbody.appendChild(tr);
    });
  }

  function renderRowStatus(isValid, errors) {
    if (isValid) {
      return '<span class="badge badge-success">✓ Hợp lệ</span>';
    }
    if (!errors || errors.length === 0) {
      return '<span class="badge badge-error">✗ Lỗi</span>';
    }
    const items = errors.map(e => `<li>${escHtml(e)}</li>`).join('');
    return `<ul class="row-error-list">${items}</ul>`;
  }

  // ---- Huỷ preview ----
  elBtnCancelPreview.addEventListener('click', () => {
    previewData = null;
    hideSection('preview');
    clearFile();
  });

  // ============================================================
  // XÁC NHẬN IMPORT
  // ============================================================
  elBtnConfirmImport.addEventListener('click', async () => {
    if (!previewData || previewData.validRows.length === 0) {
      showToast('Không có dòng hợp lệ để nhập.', 'warning');
      return;
    }

    const confirmOk = window.confirm(
      `Bạn sắp nhập ${previewData.validRows.length} tài khoản vào hệ thống.\n` +
      `Các dòng lỗi (${previewData.invalidCount} dòng) sẽ bị bỏ qua.\n\n` +
      `Xác nhận tiếp tục?`
    );
    if (!confirmOk) return;

    setLoading(elBtnConfirmImport, elImportSpinner, true);

    try {
      const payload = { rows: previewData.validRows };

      const res = await fetch('/api/users/import/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();

      if (res.status === 401) {
        showToast('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
        setTimeout(() => { window.location.href = '/login.html'; }, 1500);
        return;
      }

      if (!res.ok || !json.success) {
        showToast(json.message || 'Lỗi khi thực hiện import.', 'error');
        return;
      }

      renderReport(json.data, json.message);
      showSection('report');
    } catch (err) {
      showToast('Lỗi kết nối đến máy chủ. Vui lòng thử lại.', 'error');
    } finally {
      setLoading(elBtnConfirmImport, elImportSpinner, false);
    }
  });

  // ============================================================
  // BÁO CÁO TỔNG KẾT
  // ============================================================
  function renderReport(data, message) {
    const { totalSubmitted, successCount, failedCount, failedResults } = data;

    elReportTotal.textContent   = totalSubmitted;
    elReportSuccess.textContent = successCount;
    elReportFailed.textContent  = failedCount;
    elReportMessage.textContent = message;

    const allSuccess = failedCount === 0;
    elReportBanner.classList.toggle('has-errors', !allSuccess);
    elReportIcon.textContent = allSuccess ? '✅' : '⚠️';

    // Danh sách lỗi
    if (failedResults && failedResults.length > 0) {
      elReportErrorSection.classList.remove('hidden');
      elReportErrorTbody.innerHTML = '';
      failedResults.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escHtml(String(r.rowIndex || ''))}</td>
          <td>${escHtml(r.name || '—')}</td>
          <td>${escHtml(r.email || '—')}</td>
          <td style="color:#f87171">${escHtml(r.error || (Array.isArray(r.errors) ? r.errors.join('; ') : 'Không xác định'))}</td>
        `;
        elReportErrorTbody.appendChild(tr);
      });
    } else {
      elReportErrorSection.classList.add('hidden');
    }

    showToast(
      `Import hoàn tất: ${successCount} thành công, ${failedCount} bị bỏ qua.`,
      allSuccess ? 'success' : 'warning'
    );
  }

  // Nhập thêm
  elBtnImportAgain.addEventListener('click', () => {
    previewData = null;
    selectedFile = null;
    hideSection('report');
    hideSection('preview');
    clearFile();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ============================================================
  // HIỆN / ẨN SECTION
  // ============================================================
  function showSection(name) {
    const el = getSectionEl(name);
    if (el) el.classList.remove('hidden');
    el && el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function hideSection(name) {
    const el = getSectionEl(name);
    if (el) el.classList.add('hidden');
  }

  function getSectionEl(name) {
    return {
      preview: elStepPreview,
      report:  elStepReport
    }[name] || null;
  }

  // ============================================================
  // LOADING STATE
  // ============================================================
  function setLoading(btn, spinner, isLoading) {
    btn.disabled = isLoading;
    spinner.classList.toggle('hidden', !isLoading);
  }

  // ============================================================
  // SECURITY: HTML ESCAPE
  // ============================================================
  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ============================================================
  // KIỂM TRA AUTH KHI TẢI TRANG
  // ============================================================
  (function checkAuth() {
    const token = getAuthToken();
    if (!token) {
      showToast('Vui lòng đăng nhập trước khi sử dụng chức năng này.', 'warning');
      setTimeout(() => { window.location.href = '/login.html'; }, 1800);
    }
  })();

})();

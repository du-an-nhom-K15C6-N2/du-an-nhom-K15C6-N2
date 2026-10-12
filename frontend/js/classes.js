// frontend/js/classes.js
// Quản lý tạo mới lớp học từ chương trình đào tạo (DNKN-204)
// Ràng buộc mã lớp duy nhất (DNKN-176)
// API lấy danh sách và tra cứu lớp học có phân trang (DNKN-206)

const API_BASE = '/api/classes';

let programList = [];
let classList = [];
let codeCheckTimeout = null;

// State phân trang & bộ lọc (DNKN-206)
let currentPage = 1;
let currentLimit = 10;
let paginationState = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false
};

// DOM Elements - Alert Banner
const alertBox = document.getElementById('alertBox');
const alertIcon = document.getElementById('alertIcon');
const alertTitle = document.getElementById('alertTitle');
const alertMessage = document.getElementById('alertMessage');
const alertCloseBtn = document.getElementById('alertCloseBtn');

// DOM Elements - Form tạo lớp
const createClassForm = document.getElementById('createClassForm');
const classCodeInput = document.getElementById('classCode');
const codeCheckStatus = document.getElementById('codeCheckStatus');
const codeFeedbackMessage = document.getElementById('codeFeedbackMessage');
const programSelect = document.getElementById('programSelect');
const classNameInput = document.getElementById('className');
const startDateInput = document.getElementById('startDate');
const maxStudentsInput = document.getElementById('maxStudents');
const submitBtn = document.getElementById('submitBtn');
const btnSpinner = document.getElementById('btnSpinner');

// DOM Elements - Preview Card
const programPreviewEmpty = document.getElementById('programPreviewEmpty');
const programPreviewContent = document.getElementById('programPreviewContent');
const previewProgramCode = document.getElementById('previewProgramCode');
const previewProgramName = document.getElementById('previewProgramName');
const previewProgramDesc = document.getElementById('previewProgramDesc');
const previewProgramDuration = document.getElementById('previewProgramDuration');
const previewProgramCredits = document.getElementById('previewProgramCredits');
const previewSubjectList = document.getElementById('previewSubjectList');

// DOM Elements - Thẻ kết quả sau khi tạo
const createdSuccessSection = document.getElementById('createdSuccessSection');
const resultClassName = document.getElementById('resultClassName');
const resultClassCode = document.getElementById('resultClassCode');
const resultProgramName = document.getElementById('resultProgramName');
const resultStartDate = document.getElementById('resultStartDate');
const resultStudyMode = document.getElementById('resultStudyMode');
const resultMaxStudents = document.getElementById('resultMaxStudents');
const resultSubjectCount = document.getElementById('resultSubjectCount');
const resultSubjectsTableBody = document.getElementById('resultSubjectsTableBody');

// DOM Elements - Bảng & Bộ lọc tra cứu (DNKN-206)
const classesTableBody = document.getElementById('classesTableBody');
const refreshClassesBtn = document.getElementById('refreshClassesBtn');
const totalClassesCount = document.getElementById('totalClassesCount');
const totalProgramsCount = document.getElementById('totalProgramsCount');

const filterSearch = document.getElementById('filterSearch');
const filterClassCode = document.getElementById('filterClassCode');
const filterProgram = document.getElementById('filterProgram');
const filterStatus = document.getElementById('filterStatus');
const filterStartDate = document.getElementById('filterStartDate');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');

// DOM Elements - Phân trang (DNKN-206)
const paginationCurrentRange = document.getElementById('paginationCurrentRange');
const paginationTotal = document.getElementById('paginationTotal');
const paginationLimitSelect = document.getElementById('paginationLimitSelect');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const currentPageIndicator = document.getElementById('currentPageIndicator');
const totalPagesIndicator = document.getElementById('totalPagesIndicator');

// DOM Elements - Modal chi tiết
const subjectsModal = document.getElementById('subjectsModal');
const modalClassName = document.getElementById('modalClassName');
const modalClassSub = document.getElementById('modalClassSub');
const modalSubjectsBody = document.getElementById('modalSubjectsBody');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalOkBtn = document.getElementById('modalOkBtn');

// Helper: Hiển thị thông báo Alert Banner
function showAlert(type, title, message) {
  alertBox.className = `alert-box is-${type}`;
  alertIcon.textContent = type === 'error' ? '🚫' : (type === 'success' ? '✅' : '⚠️');
  alertTitle.textContent = title;
  alertMessage.textContent = message;
  alertBox.hidden = false;
  alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideAlert() {
  alertBox.hidden = true;
}

alertCloseBtn.addEventListener('click', hideAlert);

// Helper: Format ngày DD/MM/YYYY
function formatDate(dateStr) {
  if (!dateStr) return 'Chưa thiết lập';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(d);
  } catch (_) {
    return dateStr;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 1. Tải danh mục chương trình đào tạo
async function loadPrograms() {
  try {
    const res = await fetch(`${API_BASE}/programs`);
    if (!res.ok) throw new Error('Không thể tải danh sách chương trình đào tạo.');
    const result = await res.json();
    programList = result.data || [];

    totalProgramsCount.textContent = programList.length;

    // Đổ vào Select ở Form tạo lớp
    programSelect.innerHTML = '<option value="">-- Chọn chương trình đào tạo --</option>';
    // Đổ vào Select ở Bộ lọc tra cứu (DNKN-206)
    filterProgram.innerHTML = '<option value="">-- Tất cả chương trình --</option>';

    programList.forEach(prog => {
      const opt1 = document.createElement('option');
      opt1.value = prog.id;
      opt1.textContent = `${prog.name} (${prog.code})`;
      programSelect.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = prog.id;
      opt2.textContent = `${prog.name} (${prog.code})`;
      filterProgram.appendChild(opt2);
    });
  } catch (err) {
    showAlert('error', 'Lỗi kết nối', err.message);
  }
}

// 2. Tải danh sách lớp học có phân trang và tra cứu (DNKN-206)
async function loadClasses(page = 1) {
  try {
    currentPage = page;
    currentLimit = parseInt(paginationLimitSelect.value, 10) || 10;

    // Gom các điều kiện lọc
    const params = new URLSearchParams({
      page: currentPage,
      limit: currentLimit
    });

    const searchVal = filterSearch.value.trim();
    if (searchVal) params.append('search', searchVal);

    const codeVal = filterClassCode.value.trim();
    if (codeVal) params.append('classCode', codeVal);

    const programVal = filterProgram.value.trim();
    if (programVal) params.append('programId', programVal);

    const statusVal = filterStatus.value.trim();
    if (statusVal) params.append('status', statusVal);

    const startDateVal = filterStartDate.value.trim();
    if (startDateVal) params.append('startDate', startDateVal);

    const res = await fetch(`${API_BASE}?${params.toString()}`);
    if (!res.ok) throw new Error('Không thể tải danh sách lớp học.');
    const result = await res.json();

    classList = result.data || [];
    paginationState = result.pagination || {
      page: 1,
      limit: currentLimit,
      total: classList.length,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false
    };

    totalClassesCount.textContent = paginationState.total;

    renderClassesTable(classList);
    renderPaginationControls(paginationState);

  } catch (err) {
    classesTableBody.innerHTML = `<tr><td colspan="8" class="text-center" style="color: var(--error);">Lỗi khi tải dữ liệu lớp học: ${err.message}</td></tr>`;
  }
}

// Render bảng danh sách lớp học
function renderClassesTable(items) {
  classesTableBody.innerHTML = '';

  if (!items || items.length === 0) {
    classesTableBody.innerHTML = `<tr><td colspan="8" class="text-center" style="color: var(--text-muted); padding: 2.5rem;">Không tìm thấy lớp học nào phù hợp với điều kiện tra cứu.</td></tr>`;
    return;
  }

  items.forEach(cls => {
    const tr = document.createElement('tr');

    const subjectCount = Array.isArray(cls.subjects) ? cls.subjects.length : 0;
    const modeBadge = cls.studyMode === 'Online' ? '💻 Online' : (cls.studyMode === 'Hybrid' ? '🌐 Hybrid' : '🏫 Offline');

    // Huy hiệu trạng thái vòng đời (DNKN-207)
    let statusBadgeClass = 'planning';
    let statusBadgeIcon = '🟡';
    const statusKey = cls.status || 'planning';
    if (statusKey === 'in_progress' || statusKey === 'active') {
      statusBadgeClass = 'in-progress';
      statusBadgeIcon = '🟢';
    } else if (statusKey === 'completed') {
      statusBadgeClass = 'completed';
      statusBadgeIcon = '🔵';
    } else if (statusKey === 'cancelled') {
      statusBadgeClass = 'cancelled';
      statusBadgeIcon = '🔴';
    }

    // Các nút chuyển đổi trạng thái hợp lệ (DNKN-207)
    const allowed = cls.allowedTransitions || [];
    let transitionButtonsHtml = '';
    if (allowed.includes('in_progress')) {
      transitionButtonsHtml += `<button type="button" class="btn-sm change-status-btn" data-class-id="${cls.id}" data-target-status="in_progress" title="Bắt đầu khóa học" style="background: #ecfdf5; color: #047857; border-color: #a7f3d0;">▶ Vào học</button> `;
    }
    if (allowed.includes('completed')) {
      transitionButtonsHtml += `<button type="button" class="btn-sm change-status-btn" data-class-id="${cls.id}" data-target-status="completed" title="Hoàn thành khóa học" style="background: #eff6ff; color: #1e40af; border-color: #bfdbfe;">✔ Kết thúc</button> `;
    }
    if (allowed.includes('cancelled')) {
      transitionButtonsHtml += `<button type="button" class="btn-sm change-status-btn" data-class-id="${cls.id}" data-target-status="cancelled" title="Huỷ lớp học" style="background: #fef2f2; color: #b91c1c; border-color: #fecaca;">✕ Huỷ</button> `;
    }
    if (allowed.length === 0) {
      transitionButtonsHtml += `<small style="color: var(--text-muted); font-style: italic;">Đã chốt</small>`;
    }

    tr.innerHTML = `
      <td><strong>${escapeHtml(cls.classCode)}</strong></td>
      <td>
        <strong>${escapeHtml(cls.className)}</strong>
        ${cls.teacherName ? `<br><small style="color: var(--text-muted);">GV: ${escapeHtml(cls.teacherName)}</small>` : ''}
      </td>
      <td>${escapeHtml(cls.programName || cls.courseName || '—')}</td>
      <td>${formatDate(cls.startDate)}</td>
      <td>
        <span class="status-badge ${statusBadgeClass}">
          ${statusBadgeIcon} ${escapeHtml(cls.statusLabel || cls.status)}
        </span>
        <br><small style="color: var(--text-muted);">${modeBadge}</small>
      </td>
      <td>${cls.maxStudents || 30} học viên</td>
      <td>
        <span class="badge" style="background: #e0f2fe; color: #0369a1;">${subjectCount} môn học</span>
      </td>
      <td>
        <div style="display: flex; flex-direction: column; gap: 0.35rem;">
          <a href="/class-detail.html?id=${cls.id}" class="btn-sm" style="text-decoration: none; text-align: center; background: #eff6ff; color: #1e40af; border-color: #bfdbfe; font-weight: 700;">
            🔍 Chi tiết & Vòng đời
          </a>
          <button type="button" class="btn-sm view-subjects-btn" data-class-id="${cls.id}">
            📚 Xem môn học
          </button>
          <div style="display: flex; gap: 0.25rem; flex-wrap: wrap;">
            ${transitionButtonsHtml}
          </div>
        </div>
      </td>
    `;

    classesTableBody.appendChild(tr);
  });

  // Gắn sự kiện click xem môn học
  document.querySelectorAll('.view-subjects-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const classId = Number(btn.getAttribute('data-class-id'));
      const cls = classList.find(c => c.id === classId);
      if (cls) openSubjectsModal(cls);
    });
  });

  // Gắn sự kiện click chuyển đổi trạng thái (DNKN-207)
  document.querySelectorAll('.change-status-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const classId = Number(btn.getAttribute('data-class-id'));
      const targetStatus = btn.getAttribute('data-target-status');
      const cls = classList.find(c => c.id === classId);
      if (!cls) return;

      const targetLabel = targetStatus === 'in_progress' ? 'Đang học' : (targetStatus === 'completed' ? 'Kết thúc' : 'Huỷ');
      const ok = confirm(`Bạn có chắc chắn muốn chuyển lớp "${cls.className}" (${cls.classCode}) sang trạng thái "${targetLabel}"?`);
      if (!ok) return;

      try {
        const res = await fetch(`${API_BASE}/${classId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: targetStatus })
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.message || 'Chuyển trạng thái thất bại.');
        }

        showAlert('success', 'Chuyển trạng thái thành công', result.message);
        await loadClasses(currentPage);
      } catch (err) {
        showAlert('error', 'Lỗi chuyển trạng thái', err.message);
      }
    });
  });
}

// Cập nhật thanh điều khiển phân trang (DNKN-206)
function renderPaginationControls(pagination) {
  const { page, limit, total, totalPages, hasNextPage, hasPrevPage } = pagination;

  const startIdx = total === 0 ? 0 : (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, total);

  paginationCurrentRange.textContent = `${startIdx}-${endIdx}`;
  paginationTotal.textContent = total;
  currentPageIndicator.textContent = page;
  totalPagesIndicator.textContent = totalPages;

  prevPageBtn.disabled = !hasPrevPage;
  nextPageBtn.disabled = !hasNextPage;
}

// Sự kiện bấm nút phân trang
prevPageBtn.addEventListener('click', () => {
  if (paginationState.hasPrevPage) {
    loadClasses(currentPage - 1);
  }
});

nextPageBtn.addEventListener('click', () => {
  if (paginationState.hasNextPage) {
    loadClasses(currentPage + 1);
  }
});

paginationLimitSelect.addEventListener('change', () => {
  loadClasses(1);
});

// Sự kiện bộ lọc tra cứu (DNKN-206)
applyFiltersBtn.addEventListener('click', () => {
  loadClasses(1);
});

resetFiltersBtn.addEventListener('click', () => {
  filterSearch.value = '';
  filterClassCode.value = '';
  filterProgram.value = '';
  filterStatus.value = '';
  filterStartDate.value = '';
  loadClasses(1);
});

refreshClassesBtn.addEventListener('click', () => {
  loadClasses(currentPage);
});

// 3. Sự kiện thay đổi Chương trình đào tạo -> Render Xem trước môn học
programSelect.addEventListener('change', () => {
  const selectedId = programSelect.value;
  if (!selectedId) {
    programPreviewEmpty.hidden = false;
    programPreviewContent.hidden = true;
    return;
  }

  const prog = programList.find(p => p.id === selectedId);
  if (!prog) return;

  // Hiển thị thông tin chương trình
  previewProgramCode.textContent = prog.code;
  previewProgramName.textContent = prog.name;
  previewProgramDesc.textContent = prog.description;
  previewProgramDuration.textContent = `${prog.durationMonths} tháng`;
  previewProgramCredits.textContent = `${prog.totalCredits} tín chỉ`;

  // Render danh sách môn học xem trước
  previewSubjectList.innerHTML = '';
  if (Array.isArray(prog.subjects)) {
    prog.subjects.forEach((subj, idx) => {
      const li = document.createElement('li');
      li.className = 'subject-item';
      li.innerHTML = `
        <div class="subject-info">
          <strong>${idx + 1}. ${escapeHtml(subj.name)}</strong>
          <span>Mã môn: ${escapeHtml(subj.code)}</span>
        </div>
        <div class="subject-meta">
          <span><strong>${subj.credits}</strong> tín chỉ</span>
          <span>${subj.sessions} buổi học</span>
        </div>
      `;
      previewSubjectList.appendChild(li);
    });
  }

  programPreviewEmpty.hidden = true;
  programPreviewContent.hidden = false;

  // Tự động gợi ý tên lớp nếu chưa nhập
  if (!classNameInput.value.trim()) {
    classNameInput.value = `Lớp ${prog.name} - Khóa mới`;
  }
});

// 4. Kiểm tra mã lớp realtime khi người dùng nhập (Debounce 400ms)
classCodeInput.addEventListener('input', () => {
  const code = classCodeInput.value.trim();
  clearTimeout(codeCheckTimeout);

  if (!code) {
    codeCheckStatus.className = 'input-feedback-icon';
    codeFeedbackMessage.textContent = '';
    return;
  }

  codeCheckStatus.className = 'input-feedback-icon is-checking';
  codeFeedbackMessage.textContent = '';

  codeCheckTimeout = setTimeout(async () => {
    try {
      const res = await fetch(`${API_BASE}/check/${encodeURIComponent(code)}`);
      if (!res.ok) throw new Error('Không thể kiểm tra mã lớp.');
      const data = await res.json();

      if (data.exists) {
        codeCheckStatus.className = 'input-feedback-icon is-duplicate';
        codeFeedbackMessage.className = 'feedback-msg error';
        codeFeedbackMessage.textContent = `⚠️ Mã lớp "${code}" đã tồn tại trong hệ thống. Vui lòng chọn mã khác!`;
      } else {
        codeCheckStatus.className = 'input-feedback-icon is-valid';
        codeFeedbackMessage.className = 'feedback-msg success';
        codeFeedbackMessage.textContent = `✔ Mã lớp "${code}" hợp lệ và có thể sử dụng.`;
      }
    } catch (_) {
      codeCheckStatus.className = 'input-feedback-icon';
    }
  }, 400);
});

// 5. Xử lý tạo mới lớp học từ chương trình đào tạo (Submit Form)
createClassForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();

  const classCode = classCodeInput.value.trim();
  const className = classNameInput.value.trim();
  const programId = programSelect.value;
  const startDate = startDateInput.value;
  const maxStudents = Number(maxStudentsInput.value) || 30;
  const studyMode = document.querySelector('input[name="studyMode"]:checked')?.value || 'Offline';
  const teacherName = document.getElementById('teacherName').value.trim();
  const room = document.getElementById('room').value.trim();

  // Client Validation
  if (!classCode) {
    showAlert('error', 'Thiếu thông tin', 'Vui lòng nhập Mã lớp học.');
    classCodeInput.focus();
    return;
  }

  if (!programId) {
    showAlert('error', 'Thiếu thông tin', 'Vui lòng chọn Chương trình đào tạo để sao chép danh sách môn học.');
    programSelect.focus();
    return;
  }

  if (!className) {
    showAlert('error', 'Thiếu thông tin', 'Vui lòng nhập Tên lớp học.');
    classNameInput.focus();
    return;
  }

  if (!startDate) {
    showAlert('error', 'Thiếu thông tin', 'Vui lòng chọn Ngày khai giảng dự kiến.');
    startDateInput.focus();
    return;
  }

  // Khởi động spinner
  submitBtn.disabled = true;
  btnSpinner.hidden = false;

  const payload = {
    classCode,
    className,
    programId,
    startDate,
    maxStudents,
    studyMode,
    teacherName,
    room
  };

  try {
    const res = await fetch(`${API_BASE}/open-from-program`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    // XỬ LÝ LỖI TRÙNG MÃ LỚP (DNKN-176)
    if (res.status === 409 || data.error === 'DUPLICATE_CLASS_CODE') {
      showAlert(
        'error',
        'Lỗi trùng mã lớp học (DNKN-176)',
        data.message || `Mã lớp "${classCode}" đã tồn tại trong hệ thống. Vui lòng chọn mã khác.`
      );
      classCodeInput.focus();
      classCodeInput.select();
      codeCheckStatus.className = 'input-feedback-icon is-duplicate';
      codeFeedbackMessage.className = 'feedback-msg error';
      codeFeedbackMessage.textContent = data.message;
      return;
    }

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Tạo lớp học thất bại.');
    }

    // XỬ LÝ TẠO LỚP THÀNH CÔNG VÀ SAO CHÉP MÔN HỌC (DNKN-204)
    showAlert('success', 'Thành công', `Đã tạo lớp học "${data.data.className}" và sao chép đầy đủ môn học từ chương trình đào tạo.`);
    showCreatedResult(data.data);

    // Reset Form
    createClassForm.reset();
    codeCheckStatus.className = 'input-feedback-icon';
    codeFeedbackMessage.textContent = '';
    programPreviewEmpty.hidden = false;
    programPreviewContent.hidden = true;

    // Tải lại danh sách lớp học ở trang 1
    await loadClasses(1);

  } catch (err) {
    showAlert('error', 'Lỗi hệ thống', err.message);
  } finally {
    submitBtn.disabled = false;
    btnSpinner.hidden = true;
  }
});

// Hiển thị Thẻ Kết quả sau khi tạo lớp thành công
function showCreatedResult(newClass) {
  resultClassName.textContent = newClass.className;
  resultClassCode.textContent = newClass.classCode;
  resultProgramName.textContent = newClass.programName || '—';
  resultStartDate.textContent = formatDate(newClass.startDate);
  resultStudyMode.textContent = newClass.studyMode || 'Offline';
  resultMaxStudents.textContent = `${newClass.maxStudents} học viên`;

  const subjects = newClass.subjects || [];
  resultSubjectCount.textContent = `${subjects.length} môn học đã sao chép`;

  resultSubjectsTableBody.innerHTML = '';
  if (subjects.length === 0) {
    resultSubjectsTableBody.innerHTML = `<tr><td colspan="6" class="text-center" style="color: var(--text-muted);">Không có môn học nào được sao chép.</td></tr>`;
  } else {
    subjects.forEach((subj, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${idx + 1}</strong></td>
        <td><strong style="color: var(--primary);">${escapeHtml(subj.subjectCode)}</strong></td>
        <td><strong>${escapeHtml(subj.subjectName)}</strong></td>
        <td>${subj.credits || 3}</td>
        <td>${subj.sessions || 15}</td>
        <td><span class="status-badge active">✓ Đã sao chép từ CT</span></td>
      `;
      resultSubjectsTableBody.appendChild(tr);
    });
  }

  const resultDetailBtn = document.getElementById('resultDetailBtn');
  if (resultDetailBtn && newClass.id) {
    resultDetailBtn.href = `/class-detail.html?id=${newClass.id}`;
  }

  createdSuccessSection.hidden = false;
  createdSuccessSection.scrollIntoView({ behavior: 'smooth' });
}

// Modal xem chi tiết môn học
function openSubjectsModal(cls) {
  modalClassName.textContent = cls.className;
  modalClassSub.textContent = `Mã lớp: ${cls.classCode} | Chương trình: ${cls.programName || cls.courseName || '—'}`;

  modalSubjectsBody.innerHTML = '';
  const subjects = cls.subjects || [];

  if (subjects.length === 0) {
    modalSubjectsBody.innerHTML = `<tr><td colspan="4" class="text-center" style="color: var(--text-muted);">Lớp học này chưa có danh sách môn học.</td></tr>`;
  } else {
    subjects.forEach(subj => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color: var(--primary);">${escapeHtml(subj.subjectCode)}</strong></td>
        <td>${escapeHtml(subj.subjectName)}</td>
        <td>${subj.credits || 3}</td>
        <td>${subj.sessions || 15}</td>
      `;
      modalSubjectsBody.appendChild(tr);
    });
  }

  subjectsModal.showModal();
}

modalCloseBtn.addEventListener('click', () => subjectsModal.close());
modalOkBtn.addEventListener('click', () => subjectsModal.close());

// Khởi chạy khi tải trang
document.addEventListener('DOMContentLoaded', () => {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  startDateInput.value = nextWeek.toISOString().split('T')[0];

  loadPrograms();
  loadClasses(1);
});

// frontend/js/class-detail.js
// Logic màn hình chi tiết và theo dõi trạng thái lớp học (DNKN-208)

const API_BASE = '/api/classes';

let currentClass = null;
let currentClassId = null;
let pendingTargetStatus = null;

// DOM Elements - Alert
const alertBox = document.getElementById('alertBox');
const alertIcon = document.getElementById('alertIcon');
const alertTitle = document.getElementById('alertTitle');
const alertMessage = document.getElementById('alertMessage');
const alertCloseBtn = document.getElementById('alertCloseBtn');

// DOM Elements - Switcher & Breadcrumb
const breadcrumbClassTitle = document.getElementById('breadcrumbClassTitle');
const classSwitcherSelect = document.getElementById('classSwitcherSelect');

// DOM Elements - Hero Card
const heroClassCode = document.getElementById('heroClassCode');
const heroClassName = document.getElementById('heroClassName');
const heroStudyModeTag = document.getElementById('heroStudyModeTag');
const heroProgramDesc = document.getElementById('heroProgramDesc');
const heroStatusPill = document.getElementById('heroStatusPill');
const heroStatusText = document.getElementById('heroStatusText');

const quickStartDate = document.getElementById('quickStartDate');
const quickMaxStudents = document.getElementById('quickMaxStudents');
const quickTeacherName = document.getElementById('quickTeacherName');
const quickRoom = document.getElementById('quickRoom');
const quickSubjectCount = document.getElementById('quickSubjectCount');

// DOM Elements - Lifecycle Stepper
const lifecycleCurrentStateLabel = document.getElementById('lifecycleCurrentStateLabel');
const stepperLineFill = document.getElementById('stepperLineFill');
const stepNodePlanning = document.getElementById('stepNodePlanning');
const stepNodeInProgress = document.getElementById('stepNodeInProgress');
const stepNodeCompleted = document.getElementById('stepNodeCompleted');
const stepNodeCancelled = document.getElementById('stepNodeCancelled');
const stepCirclePlanning = document.getElementById('stepCirclePlanning');
const stepCircleInProgress = document.getElementById('stepCircleInProgress');
const stepCircleCompleted = document.getElementById('stepCircleCompleted');
const stepCircleCancelled = document.getElementById('stepCircleCancelled');

// DOM Elements - Actions
const statusActionsArea = document.getElementById('statusActionsArea');

// DOM Elements - Info Table
const infoClassCode = document.getElementById('infoClassCode');
const infoClassName = document.getElementById('infoClassName');
const infoProgramName = document.getElementById('infoProgramName');
const infoProgramCode = document.getElementById('infoProgramCode');
const infoStartDate = document.getElementById('infoStartDate');
const infoStudyMode = document.getElementById('infoStudyMode');
const infoMaxStudents = document.getElementById('infoMaxStudents');
const infoTeacherName = document.getElementById('infoTeacherName');
const infoRoom = document.getElementById('infoRoom');
const infoSchedule = document.getElementById('infoSchedule');
const infoCreatedAt = document.getElementById('infoCreatedAt');

// DOM Elements - Copied Subjects Table
const copiedSubjectsTableBody = document.getElementById('copiedSubjectsTableBody');
const totalSubjectCount = document.getElementById('totalSubjectCount');
const totalCreditCount = document.getElementById('totalCreditCount');
const totalSessionCount = document.getElementById('totalSessionCount');

// DOM Elements - Modal
const transitionConfirmModal = document.getElementById('transitionConfirmModal');
const transitionConfirmForm = document.getElementById('transitionConfirmForm');
const modalTargetClassName = document.getElementById('modalTargetClassName');
const modalFromTag = document.getElementById('modalFromTag');
const modalToTag = document.getElementById('modalToTag');
const transitionReasonInput = document.getElementById('transitionReasonInput');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');

// Helper Alerts
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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

// 1. Tải danh sách tất cả lớp học để nạp vào thanh Switcher
async function loadClassesSwitcher(selectedId) {
  try {
    const res = await fetch(`${API_BASE}?limit=100`);
    if (!res.ok) return;
    const result = await res.json();
    const classes = result.data || [];

    classSwitcherSelect.innerHTML = '';
    if (classes.length === 0) {
      classSwitcherSelect.innerHTML = '<option value="">(Chưa có lớp học nào)</option>';
      return;
    }

    classes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.classCode} - ${c.className}`;
      if (String(c.id) === String(selectedId) || c.classCode.toLowerCase() === String(selectedId).toLowerCase()) {
        opt.selected = true;
      }
      classSwitcherSelect.appendChild(opt);
    });

    classSwitcherSelect.addEventListener('change', () => {
      const newId = classSwitcherSelect.value;
      if (newId) {
        window.history.pushState(null, '', `/class-detail.html?id=${newId}`);
        loadClassDetail(newId);
      }
    });

    return classes;
  } catch (err) {
    console.error('Lỗi nạp danh sách lớp:', err);
  }
}

// 2. Tải thông tin chi tiết một lớp học theo ID hoặc Mã lớp (DNKN-208)
async function loadClassDetail(identifier) {
  try {
    hideAlert();
    const res = await fetch(`${API_BASE}/${encodeURIComponent(identifier)}`);
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`Không tìm thấy thông tin lớp học với mã hoặc ID "${identifier}".`);
      }
      throw new Error('Lỗi khi tải thông tin lớp học.');
    }

    const result = await res.json();
    currentClass = result.data;
    currentClassId = currentClass.id;

    // Cập nhật giá trị đang chọn trên switcher
    if (classSwitcherSelect.value !== String(currentClassId)) {
      classSwitcherSelect.value = currentClassId;
    }

    renderClassDetail(currentClass);

  } catch (err) {
    showAlert('error', 'Lỗi tải dữ liệu', err.message);
    heroClassName.textContent = 'Không tìm thấy lớp học';
    heroProgramDesc.textContent = err.message;
    copiedSubjectsTableBody.innerHTML = `<tr><td colspan="6" class="text-center" style="color: var(--error);">${err.message}</td></tr>`;
  }
}

// 3. Render toàn bộ dữ liệu chi tiết lên giao diện
function renderClassDetail(cls) {
  const statusKey = cls.canonicalStatus || cls.status || 'planning';
  const statusLabel = cls.statusLabel || 'Chuẩn bị';

  // Breadcrumb & Title
  document.title = `${cls.className} (${cls.classCode}) - Chi tiết & Vòng đời lớp học`;
  breadcrumbClassTitle.textContent = `${cls.className} (${cls.classCode})`;

  // Hero Card
  heroClassCode.textContent = cls.classCode;
  heroClassName.textContent = cls.className;
  heroProgramDesc.textContent = `Chương trình đào tạo: ${cls.programName || cls.courseName || 'Chương trình tiêu chuẩn'}`;
  heroStudyModeTag.textContent = cls.studyMode === 'Online' ? '💻 Trực tuyến (Online)' : (cls.studyMode === 'Hybrid' ? '🌐 Kết hợp (Hybrid)' : '🏫 Trực tiếp (Offline)');

  // Status Pill
  heroStatusPill.className = `hero-status-pill ${statusKey.replace('_', '-')}`;
  heroStatusText.textContent = statusLabel;

  // Quick Meta
  quickStartDate.textContent = formatDate(cls.startDate);
  quickMaxStudents.textContent = `${cls.maxStudents || 30} học viên`;
  quickTeacherName.textContent = cls.teacherName || 'Chưa phân công';
  quickRoom.textContent = cls.room || 'Chưa xếp phòng';

  const subjects = Array.isArray(cls.subjects) ? cls.subjects : [];
  quickSubjectCount.textContent = `${subjects.length} môn`;

  // Info Table
  infoClassCode.textContent = cls.classCode;
  infoClassName.textContent = cls.className;
  infoProgramName.textContent = cls.programName || cls.courseName || '—';
  infoProgramCode.textContent = cls.programId || 'CTDT-STD';
  infoStartDate.textContent = formatDate(cls.startDate);
  infoStudyMode.textContent = cls.studyMode || 'Offline';
  infoMaxStudents.textContent = cls.maxStudents || 30;
  infoTeacherName.textContent = cls.teacherName || 'Chưa phân công';
  infoRoom.textContent = cls.room || 'Chưa xếp phòng';
  infoSchedule.textContent = cls.schedule || 'Thứ 2, 4, 6 (18:30 - 20:30)';
  infoCreatedAt.textContent = formatDate(cls.createdAt);

  // Render Tiến trình vòng đời (Stepper)
  renderLifecycleStepper(statusKey, statusLabel);

  // Render Thanh thao tác chuyển trạng thái
  renderActionButtons(cls);

  // Render Danh sách môn học sao chép từ chương trình
  renderCopiedSubjects(subjects);
}

// 4. Render Tiến trình vòng đời lớp học (Lifecycle Stepper)
function renderLifecycleStepper(statusKey, statusLabel) {
  lifecycleCurrentStateLabel.textContent = `Trạng thái hiện tại: ${statusLabel}`;

  // Reset classes
  [stepNodePlanning, stepNodeInProgress, stepNodeCompleted, stepNodeCancelled].forEach(node => {
    node.className = 'step-node';
  });

  stepCirclePlanning.textContent = '1';
  stepCircleInProgress.textContent = '2';
  stepCircleCompleted.textContent = '3';
  stepCircleCancelled.textContent = '✕';
  stepNodeCancelled.style.opacity = '0.35';

  if (statusKey === 'planning') {
    stepNodePlanning.classList.add('is-active');
    stepperLineFill.style.width = '0%';
    stepperLineFill.style.background = '#f59e0b';
  } else if (statusKey === 'in_progress') {
    stepNodePlanning.classList.add('is-completed');
    stepCirclePlanning.textContent = '✓';
    stepNodeInProgress.classList.add('is-active');
    stepperLineFill.style.width = '50%';
    stepperLineFill.style.background = '#10b981';
  } else if (statusKey === 'completed') {
    stepNodePlanning.classList.add('is-completed');
    stepCirclePlanning.textContent = '✓';
    stepNodeInProgress.classList.add('is-completed');
    stepCircleInProgress.textContent = '✓';
    stepNodeCompleted.classList.add('is-completed');
    stepCircleCompleted.textContent = '✓';
    stepperLineFill.style.width = '100%';
    stepperLineFill.style.background = '#2563eb';
  } else if (statusKey === 'cancelled') {
    stepNodePlanning.classList.add('is-completed');
    stepCirclePlanning.textContent = '✓';
    stepNodeCancelled.style.opacity = '1';
    stepNodeCancelled.classList.add('is-cancelled');
    stepperLineFill.style.width = '100%';
    stepperLineFill.style.background = '#ef4444';
  }
}

// 5. Render các nút hành động chuyển đổi vòng đời hợp lệ (DNKN-207 / DNKN-208)
function renderActionButtons(cls) {
  statusActionsArea.innerHTML = '';
  const allowed = cls.allowedTransitions || [];
  const statusKey = cls.canonicalStatus || cls.status;

  if (allowed.length === 0) {
    const notice = document.createElement('div');
    notice.className = `terminal-state-notice ${statusKey}`;
    notice.innerHTML = statusKey === 'completed'
      ? `<span>🔒 <strong>Lớp học đã hoàn tất (Kết thúc).</strong> Đây là trạng thái kết thúc (Terminal State), không thể chuyển đổi tiếp.</span>`
      : `<span>🚫 <strong>Lớp học đã bị huỷ.</strong> Đây là trạng thái kết thúc (Terminal State), không thể chuyển đổi tiếp.</span>`;
    statusActionsArea.appendChild(notice);
    return;
  }

  // Nút Vào học (in_progress)
  if (allowed.includes('in_progress')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-transition start';
    btn.innerHTML = `<span>▶</span> Bắt đầu khóa học (Vào học)`;
    btn.addEventListener('click', () => openTransitionModal('in_progress', 'Đang học', 'planning', 'Chuẩn bị'));
    statusActionsArea.appendChild(btn);
  }

  // Nút Kết thúc (completed)
  if (allowed.includes('completed')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-transition finish';
    btn.innerHTML = `<span>✔</span> Hoàn thành & Kết thúc lớp`;
    btn.addEventListener('click', () => openTransitionModal('completed', 'Kết thúc', 'in_progress', 'Đang học'));
    statusActionsArea.appendChild(btn);
  }

  // Nút Huỷ lớp (cancelled)
  if (allowed.includes('cancelled')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-transition cancel';
    btn.innerHTML = `<span>✕</span> Huỷ lớp học`;
    btn.addEventListener('click', () => openTransitionModal('cancelled', 'Huỷ', statusKey, cls.statusLabel || statusKey));
    statusActionsArea.appendChild(btn);
  }
}

// 6. Render Danh sách môn học sao chép từ chương trình đào tạo
function renderCopiedSubjects(subjects) {
  copiedSubjectsTableBody.innerHTML = '';

  let totalCredits = 0;
  let totalSessions = 0;

  if (!subjects || subjects.length === 0) {
    copiedSubjectsTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center" style="padding: 2rem; color: var(--text-muted);">
          Lớp học này chưa có danh sách môn học nào được sao chép.
        </td>
      </tr>
    `;
    totalSubjectCount.textContent = '0';
    totalCreditCount.textContent = '0';
    totalSessionCount.textContent = '0';
    return;
  }

  subjects.forEach((subj, idx) => {
    const credits = Number(subj.credits) || 3;
    const sessions = Number(subj.sessions) || 15;
    totalCredits += credits;
    totalSessions += sessions;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 700; color: var(--text-muted);">${idx + 1}</td>
      <td><span class="subject-code-tag">${escapeHtml(subj.subjectCode)}</span></td>
      <td><strong>${escapeHtml(subj.subjectName)}</strong></td>
      <td><strong>${credits}</strong> tín chỉ</td>
      <td>${sessions} buổi học</td>
      <td><span class="copied-badge">✓ Đã sao chép từ CTĐT</span></td>
    `;
    copiedSubjectsTableBody.appendChild(tr);
  });

  totalSubjectCount.textContent = subjects.length;
  totalCreditCount.textContent = totalCredits;
  totalSessionCount.textContent = totalSessions;
}

// 7. Modal xác nhận chuyển trạng thái
function openTransitionModal(toStatus, toLabel, fromStatus, fromLabel) {
  pendingTargetStatus = toStatus;
  modalTargetClassName.textContent = `"${currentClass.className}" (${currentClass.classCode})`;

  modalFromTag.textContent = fromLabel;
  modalFromTag.className = `transition-tag ${fromStatus.replace('_', '-')}`;

  modalToTag.textContent = toLabel;
  modalToTag.className = `transition-tag ${toStatus.replace('_', '-')}`;

  transitionReasonInput.value = '';
  transitionConfirmModal.showModal();
}

modalCloseBtn.addEventListener('click', () => transitionConfirmModal.close());
modalCancelBtn.addEventListener('click', () => transitionConfirmModal.close());

transitionConfirmForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!pendingTargetStatus || !currentClassId) return;

  const reason = transitionReasonInput.value.trim();

  try {
    const res = await fetch(`${API_BASE}/${currentClassId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: pendingTargetStatus,
        reason
      })
    });

    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.message || 'Lỗi khi cập nhật trạng thái lớp học.');
    }

    transitionConfirmModal.close();
    showAlert('success', 'Chuyển trạng thái thành công', result.message);

    // Tải lại dữ liệu chi tiết lớp học
    await loadClassDetail(currentClassId);

  } catch (err) {
    showAlert('error', 'Lỗi chuyển trạng thái', err.message);
  }
});

// Khởi chạy khi tải trang
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const identifier = urlParams.get('id') || urlParams.get('code') || urlParams.get('classCode');

  const classes = await loadClassesSwitcher(identifier);

  if (identifier) {
    await loadClassDetail(identifier);
  } else if (classes && classes.length > 0) {
    // Mặc định nạp lớp học đầu tiên nếu không có tham số
    const firstClassId = classes[0].id;
    window.history.replaceState(null, '', `/class-detail.html?id=${firstClassId}`);
    await loadClassDetail(firstClassId);
  } else {
    showAlert('warning', 'Chưa có lớp học', 'Chưa có lớp học nào trong hệ thống. Vui lòng tạo lớp mới trước.');
  }
});

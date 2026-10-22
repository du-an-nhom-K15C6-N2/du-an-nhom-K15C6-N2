const navigation = document.querySelector('#module-navigation');
const pageContent = document.querySelector('#page-content');
const breadcrumb = document.querySelector('#page-breadcrumb');
const sidebar = document.querySelector('.sidebar');
const defaultDashboard = pageContent.innerHTML;

const moduleDescriptions = {
  programs: 'Quản lý chương trình, ngành học và cấu trúc đào tạo.',
  courses: 'Quản lý danh mục học phần, tín chỉ và đề cương.',
  terms: 'Thiết lập năm học, học kỳ và thời gian đăng ký.',
  classes: 'Tổ chức lớp học và phân công giảng dạy.',
  schedules: 'Quản lý lịch học, ca học, kiểm tra trùng lịch và xác nhận ghi đè.',
  attendance: 'Theo dõi chuyên cần và tình trạng tham gia lớp học.',
  people: 'Quản lý hồ sơ người học, giảng viên và nhân sự.',
  results: 'Theo dõi điểm số và kết quả học tập.',
  reports: 'Tổng hợp số liệu và báo cáo hoạt động đào tạo.',
  settings: 'Cấu hình các tùy chọn chung của hệ thống.'
};

const SHIFT_TIMES_UI = {
  'Ca 1': { start: '07:00', end: '09:15' },
  'Ca 2': { start: '09:30', end: '11:45' },
  'Ca 3': { start: '13:00', end: '15:15' },
  'Ca 4': { start: '15:30', end: '17:45' },
  'Ca 5': { start: '18:00', end: '20:15' }
};

// Quản lý vai trò người dùng (DNKN-257: Quản lý đào tạo có quyền ghi đè)
const userRoleSelect = document.querySelector('#current-role-select');
let currentRole = localStorage.getItem('user_role') || 'training_manager';
if (userRoleSelect) {
  userRoleSelect.value = currentRole;
  userRoleSelect.addEventListener('change', () => {
    currentRole = userRoleSelect.value;
    localStorage.setItem('user_role', currentRole);
    updateSidebarUser();
    // Nếu đang mở dialog thêm/sửa, cập nhật lại trạng thái ghi đè
    const conflictPanel = document.querySelector('#conflict-panel');
    if (conflictPanel && conflictPanel.dataset.hasConflict === 'true') {
      renderConflictBox(window.__lastConflictDetails);
    }
  });
}

function updateSidebarUser() {
  const footer = document.querySelector('.sidebar-footer');
  if (!footer) return;
  const avatar = footer.querySelector('.avatar');
  const strong = footer.querySelector('strong');
  const small = footer.querySelector('small');

  if (currentRole === 'training_manager') {
    if (avatar) avatar.textContent = 'QL';
    if (strong) strong.textContent = 'Quản lý đào tạo';
    if (small) small.textContent = 'Có quyền xác nhận ghi đè';
  } else if (currentRole === 'lecturer') {
    if (avatar) avatar.textContent = 'GV';
    if (strong) strong.textContent = 'Giảng viên';
    if (small) small.textContent = 'Chỉ xem & lên lịch';
  } else {
    if (avatar) avatar.textContent = 'AD';
    if (strong) strong.textContent = 'Quản trị viên';
    if (small) small.textContent = 'Toàn quyền hệ thống';
  }
}
updateSidebarUser();

function formatDate(date) {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function formatDateTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'medium'
  }).format(d);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

// ============================================================================
// DNKN-240 / DNKN-256 / DNKN-257: CHỨC NĂNG QUẢN LÝ LỊCH HỌC
// ============================================================================

let scheduleMasterData = null;
let schedulesCache = [];
let conflictCheckTimer = null;

async function getMasterData() {
  if (scheduleMasterData) return scheduleMasterData;
  const res = await fetch('/api/schedules/master-data');
  const json = await res.json();
  if (json.success) {
    scheduleMasterData = json.data;
  }
  return scheduleMasterData;
}

function renderClassScheduleManagement() {
  breadcrumb.textContent = 'Thời khóa biểu';
  pageContent.innerHTML = `
    <div class="page-heading">
      <div>
        <p class="eyebrow">GIẢNG DẠY · DNKN-240</p>
        <h1>Quản lý Thời khóa biểu & Lịch học</h1>
        <p class="page-subtitle">Sắp xếp ca học, phòng học, tự động kiểm tra trùng lịch và xác nhận ghi đè theo phân quyền.</p>
      </div>
      <span class="date-chip">${formatDate(new Date())}</span>
    </div>

    <!-- Toolbar điều khiển và lọc -->
    <div class="action-toolbar">
      <div class="toolbar-filters">
        <input type="text" id="sched-filter-search" class="search-input" placeholder="Tìm lớp, môn, GV, phòng..." style="width: 220px;">
        <select id="sched-filter-class" class="filter-select">
          <option value="">Tất cả lớp học</option>
        </select>
        <select id="sched-filter-status" class="filter-select">
          <option value="">Tất cả trạng thái</option>
          <option value="scheduled">Đang hoạt động</option>
          <option value="cancelled">Đã hủy</option>
        </select>
      </div>
      <div class="toolbar-actions">
        <button type="button" class="btn btn-secondary" id="btn-view-audit">
          <span aria-hidden="true">📋</span> Lịch sử ghi đè (Audit)
        </button>
        <button type="button" class="btn btn-primary" id="btn-open-create-sched">
          <span aria-hidden="true">+</span> Thêm lịch học mới
        </button>
      </div>
    </div>

    <!-- Thông báo nổi bật -->
    <div id="schedule-alert-box" style="display: none; margin-bottom: 14px;"></div>

    <!-- Bảng danh sách lịch học -->
    <div class="schedule-table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Mã lịch</th>
            <th>Lớp học</th>
            <th>Học phần</th>
            <th>Giảng viên</th>
            <th>Phòng học</th>
            <th>Ngày & Giờ học</th>
            <th>Trạng thái</th>
            <th style="text-align: right;">Thao tác</th>
          </tr>
        </thead>
        <tbody id="schedule-table-body">
          <tr><td colspan="8" class="empty-state">Đang tải danh sách lịch học...</td></tr>
        </tbody>
      </table>
    </div>

    <footer class="page-footer">
      <span>EduManager · Quản lý đào tạo DNKN-240</span>
      <span id="schedule-count-label">Đang tải...</span>
    </footer>
  `;

  // Gắn sự kiện cho toolbar
  document.querySelector('#btn-open-create-sched').addEventListener('click', () => openScheduleModal(null));
  document.querySelector('#btn-view-audit').addEventListener('click', openAuditModal);
  document.querySelector('#sched-filter-search').addEventListener('input', filterAndRenderSchedules);
  document.querySelector('#sched-filter-class').addEventListener('change', filterAndRenderSchedules);
  document.querySelector('#sched-filter-status').addEventListener('change', filterAndRenderSchedules);

  // Khởi tạo form và modal events
  initScheduleFormEvents();

  // Tải dữ liệu ban đầu
  loadAndInitScheduleData();
}

async function loadAndInitScheduleData() {
  try {
    const master = await getMasterData();
    if (master && master.classes) {
      const classFilter = document.querySelector('#sched-filter-class');
      if (classFilter) {
        classFilter.innerHTML = '<option value="">Tất cả lớp học</option>' +
          master.classes.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
      }
    }

    await fetchSchedulesList();
  } catch (error) {
    console.error('Lỗi khi tải dữ liệu lịch học:', error);
  }
}

async function fetchSchedulesList() {
  const tbody = document.querySelector('#schedule-table-body');
  if (!tbody) return;

  try {
    const res = await fetch('/api/schedules');
    const json = await res.json();
    if (json.success) {
      schedulesCache = json.data;
      filterAndRenderSchedules();
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state" style="color: #dc2626;">Lỗi khi tải lịch học: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function filterAndRenderSchedules() {
  const tbody = document.querySelector('#schedule-table-body');
  const countLabel = document.querySelector('#schedule-count-label');
  if (!tbody) return;

  const search = (document.querySelector('#sched-filter-search')?.value || '').toLowerCase().trim();
  const classId = document.querySelector('#sched-filter-class')?.value || '';
  const status = document.querySelector('#sched-filter-status')?.value || '';

  let filtered = schedulesCache.filter(item => {
    if (classId && item.classId !== classId) return false;
    if (status && item.status !== status) return false;
    if (search) {
      const text = `${item.id} ${item.className} ${item.subjectName} ${item.lecturerName} ${item.roomName} ${item.date}`.toLowerCase();
      if (!text.includes(search)) return false;
    }
    return true;
  });

  if (countLabel) {
    countLabel.textContent = `Hiển thị ${filtered.length} trong tổng số ${schedulesCache.length} buổi học`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Không tìm thấy lịch học nào phù hợp.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    let statusBadge = '<span class="badge badge-active">Đang xếp</span>';
    if (item.status === 'cancelled') {
      statusBadge = '<span class="badge badge-cancelled">Đã hủy</span>';
    } else if (item.isOverridden) {
      const tooltip = escapeHtml(`Đã ghi đè bởi ${item.overriddenBy?.name || 'Quản lý'}: ${item.overrideReason || ''}`);
      statusBadge = `<span class="badge badge-override" title="${tooltip}">⚠️ Đã ghi đè</span>`;
    }

    const shiftText = item.shift ? `<span class="badge badge-shift">${escapeHtml(item.shift)}</span>` : '';
    const timeText = `${escapeHtml(item.startTime)} - ${escapeHtml(item.endTime)}`;

    return `
      <tr>
        <td><strong>${escapeHtml(item.id)}</strong></td>
        <td>
          <div style="font-weight: 600;">${escapeHtml(item.className)}</div>
          <small style="color: #64748b;">${escapeHtml(item.classId)}</small>
        </td>
        <td>${escapeHtml(item.subjectName)}</td>
        <td>
          <div>${escapeHtml(item.lecturerName)}</div>
          <small style="color: #64748b;">${escapeHtml(item.lecturerId)}</small>
        </td>
        <td>
          <div>${escapeHtml(item.roomName)}</div>
          <small style="color: #64748b;">${escapeHtml(item.roomId)}</small>
        </td>
        <td>
          <div>${escapeHtml(item.date)}</div>
          <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px;">
            ${shiftText} <small style="color: #475569;">${timeText}</small>
          </div>
        </td>
        <td>${statusBadge}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button type="button" class="btn btn-secondary" style="padding: 4px 8px; font-size: 10px;" onclick="window.editSchedule('${escapeHtml(item.id)}')">Sửa</button>
          ${item.status !== 'cancelled' ? `<button type="button" class="btn btn-danger" style="padding: 4px 8px; font-size: 10px; margin-left: 4px;" onclick="window.cancelSchedule('${escapeHtml(item.id)}')">Hủy</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

window.editSchedule = function(id) {
  const item = schedulesCache.find(s => s.id === id);
  if (item) {
    openScheduleModal(item);
  }
};

window.cancelSchedule = async function(id) {
  if (!confirm(`Bạn có chắc chắn muốn hủy buổi học ${id}?`)) return;
  try {
    const res = await fetch(`/api/schedules/${encodeURIComponent(id)}/cancel`, {
      method: 'PATCH',
      headers: {
        'x-user-role': currentRole
      }
    });
    const json = await res.json();
    if (json.success) {
      showScheduleAlert('Đã hủy buổi học thành công.', 'clean');
      await fetchSchedulesList();
    } else {
      alert(json.message || 'Lỗi khi hủy lịch học.');
    }
  } catch (err) {
    alert(`Lỗi kết nối: ${err.message}`);
  }
};

function showScheduleAlert(msg, type = 'clean') {
  const box = document.querySelector('#schedule-alert-box');
  if (!box) return;
  box.style.display = 'block';
  box.className = `conflict-box is-${type}`;
  box.innerHTML = `<div class="conflict-header">${type === 'clean' ? '✓' : 'ℹ'} ${escapeHtml(msg)}</div>`;
  setTimeout(() => {
    box.style.display = 'none';
  }, 4000);
}

// ============================================================================
// MODAL THÊM / SỬA LỊCH HỌC & CẢNH BÁO XUNG ĐỘT (DNKN-256)
// ============================================================================

function initScheduleFormEvents() {
  const dialog = document.querySelector('#schedule-dialog');
  const closeBtn = document.querySelector('#schedule-dialog-close');
  const cancelBtn = document.querySelector('#schedule-dialog-cancel');
  const form = document.querySelector('#schedule-form');

  if (closeBtn) closeBtn.onclick = () => dialog.close();
  if (cancelBtn) cancelBtn.onclick = () => dialog.close();

  // Tự động điền giờ khi chọn Ca học
  const shiftSelect = document.querySelector('#sched-shift');
  const startTimeInput = document.querySelector('#sched-start-time');
  const endTimeInput = document.querySelector('#sched-end-time');

  if (shiftSelect) {
    shiftSelect.addEventListener('change', () => {
      const shiftVal = shiftSelect.value;
      if (SHIFT_TIMES_UI[shiftVal]) {
        startTimeInput.value = SHIFT_TIMES_UI[shiftVal].start;
        endTimeInput.value = SHIFT_TIMES_UI[shiftVal].end;
      }
      triggerConflictCheck();
    });
  }

  // Lắng nghe thay đổi để kiểm tra xung đột thời gian thực (DNKN-256)
  ['sched-lecturer', 'sched-room', 'sched-date', 'sched-start-time', 'sched-end-time'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', triggerConflictCheck);
      el.addEventListener('input', triggerConflictCheck);
    }
  });

  // Submit form (DNKN-257)
  if (form) {
    form.onsubmit = handleScheduleFormSubmit;
  }
}

async function openScheduleModal(item = null) {
  const master = await getMasterData();
  const dialog = document.querySelector('#schedule-dialog');
  const title = document.querySelector('#dialog-title');
  const form = document.querySelector('#schedule-form');
  const saveBtn = document.querySelector('#schedule-save-btn');

  form.reset();
  document.querySelector('#conflict-panel').innerHTML = '';
  window.__lastConflictDetails = null;

  // Điền dropdown master data
  const classSel = document.querySelector('#sched-class');
  const subSel = document.querySelector('#sched-subject');
  const lecSel = document.querySelector('#sched-lecturer');
  const roomSel = document.querySelector('#sched-room');

  classSel.innerHTML = master.classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  subSel.innerHTML = master.subjects.map(s => `<option value="${s.id}">${s.name} (${s.id})</option>`).join('');
  lecSel.innerHTML = master.lecturers.map(l => `<option value="${l.id}">${l.name} (${l.id})</option>`).join('');
  roomSel.innerHTML = master.rooms.map(r => `<option value="${r.id}">${r.name} (${r.type})</option>`).join('');

  if (item) {
    title.textContent = `Cập nhật lịch học (${item.id})`;
    document.querySelector('#sched-id').value = item.id;
    classSel.value = item.classId;
    subSel.value = item.subjectId;
    lecSel.value = item.lecturerId;
    roomSel.value = item.roomId;
    document.querySelector('#sched-date').value = item.date;
    document.querySelector('#sched-shift').value = item.shift || 'Ca 1';
    document.querySelector('#sched-start-time').value = item.startTime || '07:00';
    document.querySelector('#sched-end-time').value = item.endTime || '09:15';
    document.querySelector('#sched-note').value = item.note || '';
  } else {
    title.textContent = 'Thêm lịch học mới';
    document.querySelector('#sched-id').value = '';
    // Mặc định ngày học là ngày mai
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.querySelector('#sched-date').value = tomorrow.toISOString().slice(0, 10);
    document.querySelector('#sched-shift').value = 'Ca 1';
    document.querySelector('#sched-start-time').value = '07:00';
    document.querySelector('#sched-end-time').value = '09:15';
  }

  saveBtn.disabled = false;
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = 'Lưu lịch học';

  dialog.showModal();

  // Kích hoạt kiểm tra xung đột ban đầu
  triggerConflictCheck();
}

function triggerConflictCheck() {
  clearTimeout(conflictCheckTimer);

  const panel = document.querySelector('#conflict-panel');
  if (!panel) return;

  const candidate = getFormDataForConflict();
  if (!candidate.date || !candidate.startTime || !candidate.endTime) {
    panel.innerHTML = '';
    return;
  }

  // 1. Trạng thái: Đang kiểm tra (checking)
  panel.dataset.hasConflict = 'false';
  panel.innerHTML = `
    <div class="conflict-box is-checking">
      <div class="conflict-header">
        <span class="spinner"></span>
        <span>Đang kiểm tra xung đột giảng viên và phòng học...</span>
      </div>
      <p class="conflict-desc">Hệ thống đang so sánh lịch học với toàn bộ thời khóa biểu hiện có.</p>
    </div>
  `;

  conflictCheckTimer = setTimeout(async () => {
    try {
      const res = await fetch('/api/schedules/check-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidate)
      });
      const json = await res.json();
      if (json.success) {
        window.__lastConflictDetails = json.data;
        renderConflictBox(json.data);
      } else {
        renderConflictError(json.message || 'Lỗi khi kiểm tra xung đột.');
      }
    } catch (err) {
      renderConflictError(`Lỗi kết nối API: ${err.message}`);
    }
  }, 250);
}

function getFormDataForConflict() {
  const form = document.querySelector('#schedule-form');
  if (!form) return {};
  const master = scheduleMasterData || {};

  const classId = form.elements.classId?.value;
  const subjectId = form.elements.subjectId?.value;
  const lecturerId = form.elements.lecturerId?.value;
  const roomId = form.elements.roomId?.value;

  const cls = (master.classes || []).find(c => c.id === classId);
  const sub = (master.subjects || []).find(s => s.id === subjectId);
  const lec = (master.lecturers || []).find(l => l.id === lecturerId);
  const rm = (master.rooms || []).find(r => r.id === roomId);

  return {
    id: form.elements.id?.value || null,
    classId,
    className: cls?.name || classId,
    subjectId,
    subjectName: sub?.name || subjectId,
    lecturerId,
    lecturerName: lec?.name || lecturerId,
    roomId,
    roomName: rm?.name || roomId,
    date: form.elements.date?.value,
    shift: form.elements.shift?.value,
    startTime: form.elements.startTime?.value,
    endTime: form.elements.endTime?.value
  };
}

// DNKN-256: Hiển thị 4 trạng thái cảnh báo xung đột và xử lý chặn lưu / ghi đè (DNKN-257)
function renderConflictBox(conflictData) {
  const panel = document.querySelector('#conflict-panel');
  const saveBtn = document.querySelector('#schedule-save-btn');
  if (!panel || !saveBtn) return;

  if (!conflictData || !conflictData.hasConflict) {
    // 3. Trạng thái: Không có xung đột (clean)
    panel.dataset.hasConflict = 'false';
    panel.innerHTML = `
      <div class="conflict-box is-clean">
        <div class="conflict-header">
          <span style="font-size: 14px;">✓</span>
          <span>Không có xung đột lịch học</span>
        </div>
        <p class="conflict-desc">Giảng viên và phòng học hoàn toàn trống trong khoảng thời gian này. Lịch học hợp lệ và sẵn sàng để lưu.</p>
      </div>
    `;
    saveBtn.disabled = false;
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = 'Lưu lịch học';
    return;
  }

  // 2. Trạng thái: Có xung đột (conflict)
  panel.dataset.hasConflict = 'true';
  const conflicts = conflictData.conflicts || [];
  const isTrainingManagerUser = (currentRole === 'training_manager' || currentRole === 'admin');

  const conflictCardsHtml = conflicts.map(item => {
    const isLecturer = item.type === 'lecturer';
    const s = item.conflictingSchedule || {};
    const badgeClass = isLecturer ? 'conflict-badge lecturer' : 'conflict-badge room';
    const badgeLabel = isLecturer ? 'Trùng giảng viên' : 'Trùng phòng học';

    return `
      <div class="conflict-item-card ${isLecturer ? 'is-lecturer' : 'is-room'}">
        <div class="conflict-item-title">
          <span>${escapeHtml(item.message)}</span>
          <span class="${badgeClass}">${badgeLabel}</span>
        </div>
        <div class="conflict-item-details">
          <span><strong>Mã lịch trùng:</strong> ${escapeHtml(s.id)}</span>
          <span><strong>Lớp:</strong> ${escapeHtml(s.className || s.classId)}</span>
          <span><strong>Môn học:</strong> ${escapeHtml(s.subjectName || s.subjectId)}</span>
          <span><strong>Phòng:</strong> ${escapeHtml(s.roomName || s.roomId)}</span>
          <span><strong>Giảng viên:</strong> ${escapeHtml(s.lecturerName || s.lecturerId)}</span>
          <span><strong>Thời gian:</strong> ${escapeHtml(s.date)} (${escapeHtml(s.shift || `${s.startTime}-${s.endTime}`)})</span>
        </div>
      </div>
    `;
  }).join('');

  // DNKN-257: Khung xác nhận ghi đè
  let overrideHtml = '';
  if (isTrainingManagerUser) {
    overrideHtml = `
      <div class="override-container">
        <div class="override-header">
          <span>🛡️</span>
          <span>Quyền Quản lý đào tạo: Xác nhận ghi đè xung đột</span>
        </div>
        <label class="override-checkbox-label">
          <input type="checkbox" id="override-confirm-checkbox">
          <span>Tôi xác nhận ghi đè các xung đột nêu trên để lưu lịch học này.</span>
        </label>
        <div id="override-reason-wrap" style="display: none; margin-top: 8px;">
          <label for="override-reason-text" class="form-label" style="margin-bottom: 4px;">
            Lý do ghi đè (bắt buộc)<span class="req">*</span>:
          </label>
          <textarea id="override-reason-text" class="override-textarea" placeholder="Ví dụ: Được phê duyệt dồn lớp học lý thuyết chung tại hội trường lớn..."></textarea>
        </div>
      </div>
    `;
  } else {
    overrideHtml = `
      <div class="override-container">
        <div class="override-forbidden-notice">
          ⛔ Bạn đang đăng nhập với vai trò Giảng viên (không có quyền ghi đè). Theo quy định, chỉ người có quyền <strong>Quản lý đào tạo</strong> mới được phép xác nhận ghi đè lịch học bị trùng. Nút lưu bị chặn.
        </div>
      </div>
    `;
  }

  panel.innerHTML = `
    <div class="conflict-box is-conflict">
      <div class="conflict-header">
        <span style="font-size: 14px;">⚠️</span>
        <span>Phát hiện ${conflictData.conflictCount} xung đột lịch học! (Mặc định bị chặn lưu)</span>
      </div>
      <p class="conflict-desc">Thời gian hoặc phòng học của buổi học này đang trùng lặp với lịch học khác đã được xếp trước đó.</p>
      <div class="conflict-items">
        ${conflictCardsHtml}
      </div>
      ${overrideHtml}
    </div>
  `;

  // Mặc định: Chặn lưu khi có xung đột
  saveBtn.disabled = true;
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = 'Bị chặn do xung đột';

  if (isTrainingManagerUser) {
    const chk = document.querySelector('#override-confirm-checkbox');
    const reasonWrap = document.querySelector('#override-reason-wrap');
    const reasonText = document.querySelector('#override-reason-text');

    if (chk) {
      chk.addEventListener('change', () => {
        if (chk.checked) {
          reasonWrap.style.display = 'block';
          validateOverrideButton();
        } else {
          reasonWrap.style.display = 'none';
          saveBtn.disabled = true;
          saveBtn.className = 'btn btn-primary';
          saveBtn.textContent = 'Bị chặn do xung đột';
        }
      });
    }

    if (reasonText) {
      reasonText.addEventListener('input', validateOverrideButton);
    }

    function validateOverrideButton() {
      const isChecked = chk && chk.checked;
      const hasReason = reasonText && reasonText.value.trim().length > 0;

      if (isChecked && hasReason) {
        saveBtn.disabled = false;
        saveBtn.className = 'btn btn-override';
        saveBtn.textContent = 'Xác nhận ghi đè & Lưu lịch';
      } else {
        saveBtn.disabled = true;
        saveBtn.className = 'btn btn-override';
        saveBtn.textContent = isChecked ? 'Vui lòng nhập lý do ghi đè' : 'Bị chặn do xung đột';
      }
    }
  }
}

// 4. Trạng thái: Lỗi kiểm tra (error)
function renderConflictError(msg) {
  const panel = document.querySelector('#conflict-panel');
  const saveBtn = document.querySelector('#schedule-save-btn');
  if (!panel || !saveBtn) return;

  panel.dataset.hasConflict = 'false';
  panel.innerHTML = `
    <div class="conflict-box is-error">
      <div class="conflict-header">
        <span>✕</span>
        <span>Không thể hoàn tất kiểm tra xung đột</span>
      </div>
      <p class="conflict-desc">${escapeHtml(msg)}</p>
    </div>
  `;
}

// Xử lý gửi form lưu lịch (DNKN-257)
async function handleScheduleFormSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const saveBtn = document.querySelector('#schedule-save-btn');
  const dialog = document.querySelector('#schedule-dialog');
  const master = scheduleMasterData || {};

  const id = form.elements.id?.value || null;
  const classId = form.elements.classId?.value;
  const subjectId = form.elements.subjectId?.value;
  const lecturerId = form.elements.lecturerId?.value;
  const roomId = form.elements.roomId?.value;

  const cls = (master.classes || []).find(c => c.id === classId);
  const sub = (master.subjects || []).find(s => s.id === subjectId);
  const lec = (master.lecturers || []).find(l => l.id === lecturerId);
  const rm = (master.rooms || []).find(r => r.id === roomId);

  const payload = {
    classId,
    className: cls?.name || classId,
    subjectId,
    subjectName: sub?.name || subjectId,
    lecturerId,
    lecturerName: lec?.name || lecturerId,
    roomId,
    roomName: rm?.name || roomId,
    date: form.elements.date?.value,
    shift: form.elements.shift?.value,
    startTime: form.elements.startTime?.value,
    endTime: form.elements.endTime?.value,
    note: form.elements.note?.value || ''
  };

  const chk = document.querySelector('#override-confirm-checkbox');
  const reasonText = document.querySelector('#override-reason-text');
  if (chk && chk.checked) {
    payload.confirmOverride = true;
    payload.overrideReason = (reasonText?.value || '').trim();
  }

  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="spinner"></span> Đang lưu lịch...';

  try {
    const url = id ? `/api/schedules/${encodeURIComponent(id)}` : '/api/schedules';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': currentRole,
        'x-user-name': encodeURIComponent(currentRole === 'training_manager' ? 'Nguyễn Quản Lý Đào Tạo' : 'Nguyễn Giảng Viên')
      },
      body: JSON.stringify(payload)
    });

    const json = await res.json();

    if (!res.ok) {
      if (res.status === 409) {
        // Backend từ chối lưu do xung đột
        renderConflictBox(json.conflictDetails);
        alert(json.message || 'Phát hiện xung đột lịch học. Cần Quản lý đào tạo xác nhận ghi đè.');
        return;
      }

      if (res.status === 403) {
        alert(`Bị từ chối (403): ${json.message}`);
        return;
      }

      throw new Error(json.message || `Lỗi máy chủ (${res.status})`);
    }

    dialog.close();
    showScheduleAlert(json.message || 'Lưu lịch học thành công!', 'clean');
    await fetchSchedulesList();

  } catch (err) {
    alert(`Lỗi khi lưu lịch: ${err.message}`);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Lưu lịch học';
  }
}

// ============================================================================
// MODAL XEM AUDIT LOGS GHI ĐÈ LỊCH (DNKN-257)
// ============================================================================

async function openAuditModal() {
  const dialog = document.querySelector('#audit-dialog');
  const wrap = document.querySelector('#audit-table-wrap');
  const closeBtn = document.querySelector('#audit-dialog-close');
  const doneBtn = document.querySelector('#audit-dialog-done');

  if (closeBtn) closeBtn.onclick = () => dialog.close();
  if (doneBtn) doneBtn.onclick = () => dialog.close();

  wrap.innerHTML = '<div class="empty-state">Đang tải lịch sử ghi đè...</div>';
  dialog.showModal();

  try {
    const res = await fetch('/api/schedules/audit-logs');
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data) || json.data.length === 0) {
      wrap.innerHTML = '<div class="empty-state">Chưa có bản ghi ghi đè nào trong hệ thống.</div>';
      return;
    }

    wrap.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Thời điểm</th>
            <th>Người duyệt ghi đè</th>
            <th>Mã lịch</th>
            <th>Thao tác</th>
            <th>Lý do ghi đè</th>
            <th>Số xung đột ghi đè</th>
          </tr>
        </thead>
        <tbody>
          ${json.data.map(log => `
            <tr>
              <td><small>${escapeHtml(formatDateTime(log.timestamp))}</small></td>
              <td>
                <strong>${escapeHtml(log.actorName)}</strong>
                <div><span class="badge badge-override">${escapeHtml(log.actorRole)}</span></div>
              </td>
              <td><strong>${escapeHtml(log.scheduleId)}</strong></td>
              <td><span class="badge badge-active">${escapeHtml(log.action)}</span></td>
              <td><em>${escapeHtml(log.overrideReason || '—')}</em></td>
              <td>
                <span class="badge badge-shift">${log.conflictsOverridden ? log.conflictsOverridden.length : 0} xung đột</span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state" style="color: #dc2626;">Lỗi tải audit logs: ${escapeHtml(err.message)}</div>`;
  }
}

// ============================================================================
// HỆ THỐNG PHÂN HỆ VÀ NAVIGATION
// ============================================================================

function renderModule(module) {
  if (module.id === 'schedules') {
    renderClassScheduleManagement();
    return;
  }

  const name = escapeHtml(module.name);
  const description = escapeHtml(moduleDescriptions[module.id] || 'Phân hệ quản lý đào tạo.');
  const fields = ['Mã định danh', 'Tên', 'Trạng thái', 'Ngày cập nhật'];

  breadcrumb.textContent = module.name;
  pageContent.innerHTML = `
    <div class="page-heading">
      <div><p class="eyebrow">${escapeHtml(module.group.toUpperCase())}</p><h1>${name}</h1><p class="page-subtitle">${description}</p></div>
      <span class="date-chip">${formatDate(new Date())}</span>
    </div>
    <div class="module-view">
      <section class="panel">
        <div class="panel-heading"><div><p class="eyebrow">KHUNG PHÂN HỆ</p><h2>Thông tin quản lý</h2></div><span class="status-pill">${escapeHtml(module.status)}</span></div>
        <p class="module-summary">${description} Màn hình này là khung ban đầu để phát triển nghiệp vụ và kết nối dữ liệu.</p>
        <ul class="module-fields">${fields.map(field => `<li>${field}</li>`).join('')}</ul>
      </section>
      <section class="panel">
        <div class="panel-heading"><div><p class="eyebrow">DỮ LIỆU</p><h2>Danh sách ${name.toLowerCase()}</h2></div></div>
        <div class="empty-state">Chưa có dữ liệu. Cần kết nối cơ sở dữ liệu và xây dựng API cho phân hệ này.</div>
      </section>
    </div>
    <footer class="page-footer"><span>EduManager · Khung phân hệ</span><span>Dữ liệu chưa được lưu</span></footer>`;
}

function activateModule(module) {
  navigation.querySelectorAll('[data-module-id]').forEach(button => {
    button.classList.toggle('is-active', button.dataset.moduleId === module.id);
  });
  renderModule(module);
  sidebar.classList.remove('is-open');
}

function renderNavigation(modules) {
  const groups = new Map();
  modules.forEach(module => {
    if (!groups.has(module.group)) groups.set(module.group, []);
    groups.get(module.group).push(module);
  });

  const sections = [...groups].map(([group, items]) => `
    <p class="sidebar-label">${escapeHtml(group.toUpperCase())}</p>
    ${items.map(module => `
      <button class="nav-link" type="button" data-module-id="${escapeHtml(module.id)}">
        <span aria-hidden="true">${module.id === 'schedules' ? '📅' : (module.id === 'people' ? '♙' : '▦')}</span>${escapeHtml(module.name)}
      </button>`).join('')}`).join('');

  navigation.insertAdjacentHTML('beforeend', sections);
  navigation.querySelectorAll('[data-module-id]').forEach(button => {
    button.addEventListener('click', () => {
      const module = modules.find(item => item.id === button.dataset.moduleId);
      if (module) activateModule(module);
    });
  });
}

async function loadModules() {
  const status = document.querySelector('#api-status');
  const statusDetail = document.querySelector('#api-status-detail');

  try {
    const response = await fetch('/api/modules');
    if (!response.ok) throw new Error(`API trả về HTTP ${response.status}`);
    const result = await response.json();
    if (!result.success || !Array.isArray(result.data)) throw new Error('Dữ liệu phân hệ không đúng định dạng.');
    renderNavigation(result.data);
    status.textContent = 'Đang hoạt động';
    status.className = 'status-pill is-online';
    statusDetail.innerHTML = '<i class="status-dot"></i> Đã kết nối';
  } catch (error) {
    status.textContent = 'Không khả dụng';
    status.className = 'status-pill is-error';
    statusDetail.textContent = error.message || 'Không thể kết nối API.';
    const message = document.createElement('p');
    message.className = 'notice-box';
    message.setAttribute('role', 'alert');
    message.textContent = 'Không tải được danh sách phân hệ từ máy chủ. Hãy kiểm tra backend rồi tải lại trang.';
    navigation.append(message);
  }
}

const today = new Date();
document.querySelector('#today-label').textContent = formatDate(today);
document.querySelector('#date-chip').textContent = formatDate(today);
document.querySelector('#year-label').textContent = today.getFullYear();

navigation.querySelector('[data-module-id="dashboard"]').addEventListener('click', () => {
  navigation.querySelectorAll('[data-module-id]').forEach(button => {
    button.classList.toggle('is-active', button.dataset.moduleId === 'dashboard');
  });
  breadcrumb.textContent = 'Tổng quan';
  pageContent.innerHTML = defaultDashboard;
  document.querySelector('#date-chip').textContent = formatDate(new Date());
  sidebar.classList.remove('is-open');
});

document.querySelector('#sidebar-toggle').addEventListener('click', () => {
  sidebar.classList.toggle('is-open');
});

loadModules();

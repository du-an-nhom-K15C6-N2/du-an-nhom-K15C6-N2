import { getClassList } from '../core/classListService.js';
import './ClassListPanel.css';

const FILTER_KEYS = ['status', 'programId', 'teacherId', 'startDate', 'endDate'];
const STATUS_LABELS = {
  active: 'Đang hoạt động',
  planned: 'Sắp khai giảng',
  paused: 'Tạm dừng',
  completed: 'Đã kết thúc',
  cancelled: 'Đã hủy'
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function readFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(FILTER_KEYS.map(key => [key, params.get(key) || '']));
}

function writeFiltersToUrl(filters) {
  const url = new URL(window.location.href);
  url.searchParams.set('view', 'classes');
  FILTER_KEYS.forEach(key => {
    if (filters[key]) url.searchParams.set(key, filters[key]);
    else url.searchParams.delete(key);
  });
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function formatDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '—';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('vi-VN').format(new Date(year, month - 1, day));
}

export function renderClassListPanel(container) {
  let filters = readFiltersFromUrl();
  let latestRequest = 0;

  container.innerHTML = `
    <section class="class-list-panel" aria-label="Danh sách lớp học">
      <div class="class-list-toolbar">
        <div>
          <h3>Tổng quan lớp học</h3>
          <p>Theo dõi sĩ số và tiến độ buổi học của các lớp trong thời gian đã chọn.</p>
        </div>
        <button type="button" class="class-list-refresh" data-class-list-refresh>↻ Làm mới</button>
      </div>

      <div class="class-list-metrics" id="class-list-metrics" aria-live="polite">
        <article><span>Lớp phù hợp</span><strong>—</strong></article>
        <article><span>Học viên hiện tại</span><strong>—</strong></article>
        <article><span>Tổng sức chứa</span><strong>—</strong></article>
      </div>

      <form class="class-list-filters" aria-label="Bộ lọc danh sách lớp">
        <label>
          <span>Trạng thái</span>
          <select name="status" class="form-input">
            <option value="">Tất cả trạng thái</option>
            ${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
          </select>
        </label>
        <label>
          <span>Chương trình</span>
          <select name="programId" class="form-input"><option value="">Tất cả chương trình</option></select>
        </label>
        <label>
          <span>Giảng viên</span>
          <select name="teacherId" class="form-input"><option value="">Tất cả giảng viên</option></select>
        </label>
        <label>
          <span>Từ ngày</span>
          <input class="form-input" type="date" name="startDate" aria-label="Ngày bắt đầu">
        </label>
        <label>
          <span>Đến ngày</span>
          <input class="form-input" type="date" name="endDate" aria-label="Ngày kết thúc">
        </label>
        <button class="class-list-reset" type="reset">Xóa bộ lọc</button>
      </form>

      <div class="class-list-state" data-class-list-loading role="status" aria-live="polite">Đang tải danh sách lớp...</div>
      <div class="class-list-state is-error" data-class-list-error role="alert" hidden></div>
      <div class="class-list-state" data-class-list-empty hidden>
        <strong>Không tìm thấy lớp học phù hợp</strong>
        <span>Thử điều chỉnh trạng thái, chương trình, giảng viên hoặc khoảng thời gian.</span>
      </div>

      <div class="class-list-table-wrap" data-class-list-table-wrap hidden>
        <table class="class-list-table">
          <thead>
            <tr>
              <th>Lớp học</th>
              <th>Chương trình</th>
              <th>Giảng viên</th>
              <th>Trạng thái</th>
              <th>Thời gian</th>
              <th>Sĩ số</th>
              <th>Tiến độ buổi học</th>
            </tr>
          </thead>
          <tbody data-class-list-rows></tbody>
        </table>
      </div>
    </section>
  `;

  const form = container.querySelector('.class-list-filters');
  const loading = container.querySelector('[data-class-list-loading]');
  const errorState = container.querySelector('[data-class-list-error]');
  const emptyState = container.querySelector('[data-class-list-empty]');
  const tableWrap = container.querySelector('[data-class-list-table-wrap]');
  const rows = container.querySelector('[data-class-list-rows]');
  const metrics = container.querySelector('#class-list-metrics');

  function updateFilterOptions(options) {
    const programSelect = form.elements.programId;
    const teacherSelect = form.elements.teacherId;
    const statusSelect = form.elements.status;
    programSelect.innerHTML = '<option value="">Tất cả chương trình</option>'
      + options.programs.map(program => `<option value="${escapeHtml(program.id)}">${escapeHtml(program.name)}</option>`).join('');
    teacherSelect.innerHTML = '<option value="">Tất cả giảng viên</option>'
      + options.teachers.map(teacher => `<option value="${escapeHtml(teacher.id)}">${escapeHtml(teacher.name)}</option>`).join('');
    if (![...statusSelect.options].some(option => option.value === filters.status)) filters.status = '';
    if (![...programSelect.options].some(option => option.value === filters.programId)) filters.programId = '';
    if (![...teacherSelect.options].some(option => option.value === filters.teacherId)) filters.teacherId = '';
    FILTER_KEYS.forEach(key => { form.elements[key].value = filters[key] || ''; });
    writeFiltersToUrl(filters);
  }

  function renderMetrics(summary) {
    const number = value => new Intl.NumberFormat('vi-VN').format(value || 0);
    metrics.innerHTML = `
      <article><span>Lớp phù hợp</span><strong>${number(summary.totalClasses)}</strong></article>
      <article><span>Học viên hiện tại</span><strong>${number(summary.currentStudents)}</strong></article>
      <article><span>Tổng sức chứa</span><strong>${number(summary.maxStudents)}</strong></article>
    `;
  }

  function renderRows(classes) {
    rows.innerHTML = classes.map(item => {
      const occupancy = item.maxStudents
        ? Math.min(100, Math.round((item.currentStudents / item.maxStudents) * 100))
        : 0;
      const statusLabel = STATUS_LABELS[item.status] || item.status || 'Không xác định';
      const progressLabel = item.totalLessons
        ? `${item.completedLessons}/${item.totalLessons} buổi`
        : 'Chưa có lịch buổi học';
      return `
        <tr>
          <td>
            <strong>${escapeHtml(item.code)}</strong><span>${escapeHtml(item.name)}</span>
            <small>${escapeHtml(item.roomName || item.room || 'Chưa xếp phòng')} · ${escapeHtml(item.schedule || 'Chưa xếp lịch')}</small>
            ${item.roomWarning
              ? `<small class="class-room-warning" role="alert">${escapeHtml(item.roomWarning)}</small>`
              : item.roomType === 'physical'
                ? `<small class="class-room-capacity">Phòng ${escapeHtml(item.roomName)} · ${item.roomCapacity} chỗ</small>`
                : item.roomType === 'online'
                  ? `<small class="class-room-capacity">Phòng trực tuyến: ${escapeHtml(item.roomName)}</small>`
                  : ''}
          </td>
          <td>${escapeHtml(item.trainingProgramName)}</td>
          <td>${escapeHtml(item.teacherName)}</td>
          <td><span class="class-status-badge is-${escapeHtml(item.status)}">${escapeHtml(statusLabel)}</span></td>
          <td>${formatDate(item.startDate)}<span class="class-date-separator">—</span>${formatDate(item.endDate)}</td>
          <td>
            <strong class="class-list-count">${new Intl.NumberFormat('vi-VN').format(item.currentStudents)}<span>/${new Intl.NumberFormat('vi-VN').format(item.maxStudents)}</span></strong>
            <div class="class-list-meter" role="progressbar" aria-label="Tỷ lệ sĩ số lớp ${escapeHtml(item.code)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${occupancy}"><span style="width:${occupancy}%"></span></div>
          </td>
          <td>
            <div class="class-lesson-progress">
              <strong>${escapeHtml(progressLabel)}</strong>
              <span>${item.lessonProgressPercent}%</span>
            </div>
            <div class="class-list-meter is-lessons" role="progressbar" aria-label="Tiến độ buổi học lớp ${escapeHtml(item.code)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${item.lessonProgressPercent}"><span style="width:${item.lessonProgressPercent}%"></span></div>
          </td>
        </tr>
      `;
    }).join('');
  }

  async function loadClasses() {
    const requestId = ++latestRequest;
    loading.hidden = false;
    errorState.hidden = true;
    emptyState.hidden = true;
    tableWrap.hidden = true;

    try {
      const result = await getClassList(filters);
      if (requestId !== latestRequest || !container.isConnected) return;
      updateFilterOptions(result.filterOptions);
      renderMetrics(result.summary);
      renderRows(result.data);
      loading.hidden = true;
      emptyState.hidden = result.data.length > 0;
      tableWrap.hidden = result.data.length === 0;
    } catch (error) {
      if (requestId !== latestRequest || !container.isConnected) return;
      loading.hidden = true;
      errorState.replaceChildren();
      const message = document.createElement('span');
      message.textContent = error.message || 'Không thể tải danh sách lớp học.';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Thử lại';
      retry.addEventListener('click', loadClasses, { once: true });
      errorState.append(message, retry);
      errorState.hidden = false;
    }
  }

  form.addEventListener('change', () => {
    filters = Object.fromEntries(FILTER_KEYS.map(key => [key, form.elements[key].value]));
    writeFiltersToUrl(filters);
    loadClasses();
  });

  form.addEventListener('reset', event => {
    event.preventDefault();
    filters = Object.fromEntries(FILTER_KEYS.map(key => [key, '']));
    form.reset();
    writeFiltersToUrl(filters);
    loadClasses();
  });

  container.querySelector('[data-class-list-refresh]').addEventListener('click', loadClasses);
  loadClasses();
}

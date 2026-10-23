import { getTimetable, getSessionDetail } from '../core/timetableService.js';
import './TimetablePanel.css';

const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

export function renderTimetablePanel(container) {
  let state = {
    view: 'week', // 'week' hoặc 'month'
    date: getTodayString(),
    classId: '',
    teacherId: '',
    room: '',
    loading: false,
    error: null,
    data: null,
    selectedSession: null
  };

  function getTodayString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  // Tải dữ liệu từ API
  async function loadData() {
    state.loading = true;
    state.error = null;
    render();

    try {
      const result = await getTimetable({
        view: state.view,
        date: state.date,
        classId: state.classId,
        teacherId: state.teacherId,
        room: state.room
      });
      state.data = result;
    } catch (err) {
      console.error('Lỗi khi tải thời khóa biểu:', err);
      state.error = err.message || 'Không thể tải dữ liệu thời khoá biểu.';
    } finally {
      state.loading = false;
      render();
    }
  }

  // Chuyển đổi tuần / tháng trước hoặc sau
  function navigateDate(direction) {
    const cur = new Date(state.date);
    if (state.view === 'week') {
      cur.setDate(cur.getDate() + (direction * 7));
    } else {
      cur.setMonth(cur.getMonth() + direction);
    }
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    state.date = `${y}-${m}-${d}`;
    loadData();
  }

  function goToday() {
    state.date = getTodayString();
    loadData();
  }

  function setView(newView) {
    if (state.view === newView) return;
    state.view = newView;
    loadData();
  }

  // Xem chi tiết buổi học khi click
  async function openSessionModal(sessionId) {
    try {
      const session = await getSessionDetail(sessionId);
      state.selectedSession = session;
      renderModal();
    } catch (err) {
      alert('Không thể tải chi tiết buổi học: ' + err.message);
    }
  }

  function closeModal() {
    state.selectedSession = null;
    const modalEl = container.querySelector('#session-detail-modal-overlay');
    if (modalEl) modalEl.remove();
  }

  // Render modal chi tiết
  function renderModal() {
    const s = state.selectedSession;
    if (!s) return;

    let existingModal = container.querySelector('#session-detail-modal-overlay');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'session-detail-modal-overlay';
    modal.className = 'session-modal-overlay';
    modal.innerHTML = `
      <div class="session-modal-card">
        <header class="session-modal-header">
          <h3>Chi Tiết Buổi Học</h3>
          <button type="button" class="modal-close-btn" aria-label="Đóng">&times;</button>
        </header>

        <div class="session-modal-body">
          ${s.hasConflict ? `
            <div class="conflict-alert-box">
              <strong>⚠️ Phát hiện xung đột lịch:</strong>
              <ul style="margin: 0.5rem 0 0 1.25rem; padding: 0;">
                ${s.conflicts.map(c => `<li>${c.message}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <div class="detail-row">
            <span class="detail-label">Lớp học:</span>
            <span class="detail-value text-primary">${s.className} (${s.classCode})</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">Môn học / Khóa học:</span>
            <span class="detail-value">${s.courseName || s.className}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">Giảng viên:</span>
            <span class="detail-value">${s.teacherName || 'Chưa phân công'}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">Phòng học:</span>
            <span class="detail-value">${s.room || 'Chưa xếp phòng'}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">Ngày học:</span>
            <span class="detail-value">${formatDateDisplay(s.date)}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">Khung giờ:</span>
            <span class="detail-value">${s.startTime} – ${s.endTime} (${s.shift || 'Ca học'})</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">Sĩ số học viên:</span>
            <span class="detail-value">${s.totalStudents || 30} học viên</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">Trạng thái:</span>
            <span class="detail-value">
              ${s.status === 'completed' ? '✅ Đã hoàn thành' : s.status === 'in_progress' ? '🔄 Đang diễn ra' : '📅 Đã lên lịch'}
            </span>
          </div>

          ${s.note ? `
            <div class="detail-row" style="flex-direction: column; gap: 4px;">
              <span class="detail-label">Ghi chú buổi học:</span>
              <p style="margin: 0; font-size: 0.85rem; color: #475569; background: #f8fafc; padding: 8px; border-radius: 6px;">
                ${s.note}
              </p>
            </div>
          ` : ''}
        </div>

        <footer class="session-modal-footer">
          <button type="button" class="btn-close-modal">Đóng</button>
        </footer>
      </div>
    `;

    modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
    modal.querySelector('.btn-close-modal').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    container.appendChild(modal);
  }

  // Render lưới Tuần (Week view)
  function renderWeekGrid(data) {
    if (!data) return '';
    const { range, sessions, shifts } = data;
    const start = new Date(range.startDate);

    // Chuẩn bị 7 ngày
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      weekDays.push({
        name: DAY_NAMES[i],
        dateStr,
        display: `${d.getDate()}/${d.getMonth() + 1}`,
        isToday: dateStr === getTodayString()
      });
    }

    return `
      <div class="timetable-week-container">
        <table class="timetable-week-table">
          <thead>
            <tr>
              <th class="shift-col-header">Ca / Giờ</th>
              ${weekDays.map(day => `
                <th class="${day.isToday ? 'day-header-today' : ''}">
                  <span class="day-header-title">${day.name}</span>
                  <span class="day-header-date">${day.display}</span>
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${shifts.map(shift => `
              <tr>
                <td class="shift-col-header">
                  <strong>${shift.name}</strong>
                  <span class="shift-time">${shift.startTime}–${shift.endTime}</span>
                </td>
                ${weekDays.map(day => {
                  // Lấy các buổi học rơi vào ngày và ca học này
                  const cellSessions = sessions.filter(s =>
                    s.date === day.dateStr &&
                    (s.startTime < shift.endTime && s.endTime > shift.startTime)
                  );

                  return `
                    <td>
                      ${cellSessions.length > 0 ? `
                        ${cellSessions.map(s => `
                          <div class="session-card ${s.hasConflict ? 'has-conflict' : ''}"
                               data-session-id="${s.id}"
                               title="${s.hasConflict ? '⚠️ Trùng lịch! Bấm để xem chi tiết' : 'Bấm để xem chi tiết buổi học'}">
                            <div class="session-card-header">
                              <span class="session-code">${s.classCode || s.className}</span>
                              <span class="session-room">P.${s.room}</span>
                            </div>
                            <div class="session-name">${s.className}</div>
                            <div class="session-teacher">
                              <small>👨‍🏫 ${s.teacherName}</small>
                            </div>
                            ${s.hasConflict ? `
                              <div class="conflict-badge">
                                ⚠️ Trùng lịch (${s.conflicts.length})
                              </div>
                            ` : ''}
                          </div>
                        `).join('')}
                      ` : `
                        <div class="gap-slot-hint">
                          + Trống
                        </div>
                      `}
                    </td>
                  `;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Render lưới Tháng (Month view)
  function renderMonthGrid(data) {
    if (!data) return '';
    const { range, sessions } = data;
    const year = range.year;
    const month = range.month;

    // Ngày đầu tiên của tháng và số ngày
    const firstDayDate = new Date(year, month - 1, 1);
    const lastDayDate = new Date(year, month, 0);
    const totalDays = lastDayDate.getDate();

    // Thứ trong tuần của ngày 1 (Thứ 2=1 ... CN=0)
    let startDayOfWeek = firstDayDate.getDay();
    let padDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const cells = [];

    // Các ô trống của tháng trước
    for (let i = 0; i < padDays; i++) {
      cells.push(`<div class="month-day-cell is-other-month"></div>`);
    }

    // Các ngày trong tháng
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const daySessions = sessions.filter(s => s.date === dateStr);
      const isToday = (dateStr === getTodayString());
      const hasConflict = daySessions.some(s => s.hasConflict);

      cells.push(`
        <div class="month-day-cell ${isToday ? 'is-today' : ''} ${hasConflict ? 'has-conflict' : ''}">
          <div class="day-number">${d} ${isToday ? '(Hôm nay)' : ''}</div>
          <div class="month-day-sessions">
            ${daySessions.slice(0, 3).map(s => `
              <div class="month-session-pill ${s.hasConflict ? 'has-conflict' : ''}"
                   data-session-id="${s.id}"
                   title="${s.className} - P.${s.room}">
                ${s.startTime} ${s.classCode} ${s.hasConflict ? '⚠️' : ''}
              </div>
            `).join('')}
            ${daySessions.length > 3 ? `
              <div class="month-more-link">+${daySessions.length - 3} lớp nữa</div>
            ` : ''}
          </div>
        </div>
      `);
    }

    return `
      <div class="timetable-month-container">
        <div class="month-grid-header">
          ${DAY_NAMES.map(name => `<div class="month-day-col">${name}</div>`).join('')}
        </div>
        <div class="month-grid-days">
          ${cells.join('')}
        </div>
      </div>
    `;
  }

  // Render toàn bộ component
  function render() {
    const data = state.data;
    const filterOptions = data?.filters || { classes: [], teachers: [], rooms: [] };

    // Format tiêu đề khoảng thời gian
    let rangeLabel = 'Đang tải...';
    if (data?.range) {
      if (state.view === 'week') {
        rangeLabel = `${formatDateDisplay(data.range.startDate)} – ${formatDateDisplay(data.range.endDate)}`;
      } else {
        rangeLabel = `Tháng ${data.range.month} / ${data.range.year}`;
      }
    }

    container.innerHTML = `
      <div class="timetable-panel">
        <!-- Header & Toolbar -->
        <header class="timetable-header">
          <div class="timetable-title-group">
            <h2>📅 Thời Khoá Biểu Đào Tạo</h2>
            <p class="timetable-subtitle">Xem lịch học, phát hiện khoảng trống và kiểm tra điểm chồng chéo khi xếp lịch.</p>
          </div>

          <!-- Chuyển đổi Tuần / Tháng -->
          <div class="timetable-view-toggle" role="group" aria-label="Chế độ xem">
            <button type="button" class="toggle-btn ${state.view === 'week' ? 'is-active' : ''}" data-view-btn="week">
              Lịch theo Tuần
            </button>
            <button type="button" class="toggle-btn ${state.view === 'month' ? 'is-active' : ''}" data-view-btn="month">
              Lịch theo Tháng
            </button>
          </div>

          <!-- Điều hướng thời gian -->
          <div class="timetable-navigator">
            <button type="button" class="nav-arrow-btn" id="btn-prev-period" title="Lùi lại">◀</button>
            <button type="button" class="nav-today-btn" id="btn-today">Hôm nay</button>
            <button type="button" class="nav-arrow-btn" id="btn-next-period" title="Tiếp theo">▶</button>
            <span class="nav-date-label">${rangeLabel}</span>
          </div>
        </header>

        <!-- Thanh bộ lọc -->
        <div class="timetable-filter-bar">
          <div class="filter-group">
            <label for="filter-class">Lớp học:</label>
            <select id="filter-class" class="filter-select">
              <option value="">-- Tất cả lớp --</option>
              ${filterOptions.classes.map(c => `
                <option value="${c.id}" ${state.classId === c.id ? 'selected' : ''}>
                  ${c.code} - ${c.name}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="filter-group">
            <label for="filter-teacher">Giảng viên:</label>
            <select id="filter-teacher" class="filter-select">
              <option value="">-- Tất cả giảng viên --</option>
              ${filterOptions.teachers.map(t => `
                <option value="${t.id}" ${state.teacherId === t.id ? 'selected' : ''}>
                  ${t.name}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="filter-group">
            <label for="filter-room">Phòng học:</label>
            <select id="filter-room" class="filter-select">
              <option value="">-- Tất cả phòng --</option>
              ${filterOptions.rooms.map(r => `
                <option value="${r}" ${state.room === r ? 'selected' : ''}>
                  Phòng ${r}
                </option>
              `).join('')}
            </select>
          </div>

          <button type="button" class="btn-reset-filters" id="btn-reset-filters">
            ↺ Đặt lại bộ lọc
          </button>
        </div>

        <!-- Cảnh báo Xung đột & Khoảng trống -->
        ${data ? `
          <div class="timetable-alerts">
            ${data.stats.totalConflicts > 0 ? `
              <div class="alert-conflict-banner">
                <strong>⚠️ Phát hiện ${data.stats.totalConflicts} điểm chồng chéo khi xếp lịch!</strong>
                <span>Vui lòng kiểm tra các ô lịch viền đỏ để đổi phòng hoặc điều chỉnh ca học cho giảng viên.</span>
              </div>
            ` : `
              <div class="alert-gaps-banner" style="background: #f0fdf4; border-color: #bbf7d0; color: #15803d;">
                <strong>✅ Không có điểm chồng chéo nào trong kỳ xem này.</strong>
              </div>
            `}

            ${state.view === 'week' && data.stats.totalGaps > 0 ? `
              <div class="alert-gaps-banner">
                <span>💡 Có <strong>${data.stats.totalGaps} khoảng trống</strong> (slot ca học khả dụng) trong tuần này để có thể xếp lịch lớp mới.</span>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Nội dung chính: Lưới Tuần / Tháng -->
        ${state.loading ? `
          <div style="text-align: center; padding: 3rem; background: #ffffff; border-radius: 12px;">
            <p>Đang tải dữ liệu thời khoá biểu...</p>
          </div>
        ` : state.error ? `
          <div style="padding: 2rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; color: #991b1b; text-align: center;">
            <p><strong>Lỗi:</strong> ${state.error}</p>
            <button type="button" class="btn-today" id="btn-retry-load">Thử lại</button>
          </div>
        ` : state.view === 'week' ? renderWeekGrid(data) : renderMonthGrid(data)}
      </div>
    `;

    // Gắn sự kiện sau khi render HTML
    bindEvents();
  }

  function bindEvents() {
    // 1. Chuyển đổi Tuần / Tháng
    container.querySelectorAll('[data-view-btn]').forEach(btn => {
      btn.addEventListener('click', () => setView(btn.dataset.viewBtn));
    });

    // 2. Điều hướng ngày
    container.querySelector('#btn-prev-period')?.addEventListener('click', () => navigateDate(-1));
    container.querySelector('#btn-next-period')?.addEventListener('click', () => navigateDate(1));
    container.querySelector('#btn-today')?.addEventListener('click', goToday);
    container.querySelector('#btn-retry-load')?.addEventListener('click', loadData);

    // 3. Bộ lọc
    container.querySelector('#filter-class')?.addEventListener('change', (e) => {
      state.classId = e.target.value;
      loadData();
    });
    container.querySelector('#filter-teacher')?.addEventListener('change', (e) => {
      state.teacherId = e.target.value;
      loadData();
    });
    container.querySelector('#filter-room')?.addEventListener('change', (e) => {
      state.room = e.target.value;
      loadData();
    });
    container.querySelector('#btn-reset-filters')?.addEventListener('click', () => {
      state.classId = '';
      state.teacherId = '';
      state.room = '';
      loadData();
    });

    // 4. Click vào buổi học để mở modal chi tiết
    container.querySelectorAll('[data-session-id]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.sessionId;
        if (id) openSessionModal(id);
      });
    });
  }

  // Khởi chạy tải dữ liệu lần đầu
  loadData();
}

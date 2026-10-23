import { request } from '../core/authService.js';
import { getAuthSession } from '../core/storage.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);

export function renderClassHandoverPanel(container, canHandover, onCountChange = () => {}) {
  const token = getAuthSession().token;
  let classes = [];
  let teachers = [];

  container.innerHTML = `
    <section class="class-handover-panel">
      <div class="class-handover-summary" id="class-handover-summary">Đang tải danh sách lớp...</div>
      <div class="class-handover-table-wrap">
        <table class="class-handover-table">
          <thead><tr><th>Lớp học</th><th>Lịch học</th><th>Phòng học</th><th>Giảng viên phụ trách</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody id="class-handover-body"><tr><td colspan="6">Đang tải...</td></tr></tbody>
        </table>
      </div>
      <p class="class-handover-feedback" id="class-handover-feedback" role="status" aria-live="polite"></p>
    </section>
  `;

  container.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-handover-id]');
    if (!button) return;
    const select = [...container.querySelectorAll('[data-teacher-for]')]
      .find(element => element.dataset.teacherFor === button.dataset.handoverId);
    if (!select?.value) {
      setFeedback('Hãy chọn giảng viên đang hoạt động để nhận bàn giao.', true);
      return;
    }

    button.disabled = true;
    try {
      const result = await request(`/classes/${encodeURIComponent(button.dataset.handoverId)}/handover`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ teacherId: select.value })
      });
      setFeedback(result.message || 'Đã bàn giao lớp học.');
      await loadClasses();
    } catch (error) {
      setFeedback(error.message || 'Không thể bàn giao lớp học.', true);
    } finally {
      button.disabled = false;
    }
  });

  function setFeedback(message, isError = false) {
    const feedback = container.querySelector('#class-handover-feedback');
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = `class-handover-feedback${isError ? ' is-error' : ' is-success'}`;
  }

  async function loadClasses() {
    const tbody = container.querySelector('#class-handover-body');
    const summary = container.querySelector('#class-handover-summary');
    try {
      const response = await request('/classes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      classes = response.data || [];
      if (canHandover) {
        const alerts = await request('/classes/handover-alerts', {
          headers: { Authorization: `Bearer ${token}` }
        });
        teachers = alerts.availableTeachers || [];
      }
      const needsHandover = classes.filter(item => item.needsHandover).length;
      onCountChange(needsHandover);
      summary.innerHTML = `
        <div><span>Tổng số lớp</span><strong>${classes.length}</strong></div>
        <div class="is-alert"><span>Cần bàn giao</span><strong>${needsHandover}</strong></div>
      `;
      tbody.innerHTML = classes.length
        ? classes.map(item => `
          <tr>
            <td><strong>${escapeHtml(item.code)}</strong><small>${escapeHtml(item.name)}</small></td>
            <td>${escapeHtml(item.schedule || '—')}</td>
            <td>${escapeHtml(item.room || '—')}</td>
            <td>${escapeHtml(item.teacherName)}<small>${escapeHtml(item.teacherEmail || '')}</small></td>
            <td><span class="class-handover-status ${item.needsHandover ? 'is-alert' : 'is-ok'}">${item.needsHandover ? 'Cần bàn giao' : 'Đang phụ trách'}</span></td>
            <td>${item.needsHandover && canHandover
              ? `<div class="class-handover-actions">
                  <select data-teacher-for="${escapeHtml(item.id)}" aria-label="Chọn giảng viên nhận bàn giao">
                    <option value="">Chọn giảng viên</option>
                    ${teachers.map(teacher => `<option value="${escapeHtml(teacher.id)}">${escapeHtml(teacher.name)}</option>`).join('')}
                  </select>
                  <button type="button" data-handover-id="${escapeHtml(item.id)}">Bàn giao</button>
                </div>`
              : '—'}</td>
          </tr>
        `).join('')
        : '<tr><td colspan="6">Chưa có lớp học trong hệ thống.</td></tr>';
    } catch (error) {
      summary.textContent = error.message || 'Không thể tải danh sách lớp học.';
      tbody.innerHTML = '<tr><td colspan="6">Vui lòng thử tải lại hoặc kiểm tra quyền truy cập.</td></tr>';
    }
  }

  loadClasses();
}

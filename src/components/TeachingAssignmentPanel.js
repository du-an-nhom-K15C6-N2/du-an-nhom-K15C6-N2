/**
 * DNKN-179: Component Giao diện phân công giảng viên và trợ giảng theo từng môn
 * Dành cho Quản lý đào tạo (Manager) và Quản trị viên (Admin)
 */

import {
  getAssignmentOptions,
  getAssignmentsByClass,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getAssignmentHistory
} from '../core/teachingAssignmentService.js';
import './TeachingAssignmentPanel.css';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

export function renderTeachingAssignmentPanel(container) {
  container.innerHTML = `
    <div class="assignment-panel" aria-labelledby="assignment-title">
      <!-- Header điều khiển & chọn lớp -->
      <section class="assignment-header-card">
        <div class="assignment-filter-row">
          <div class="assignment-select-group">
            <label for="assignment-class-select">Lớp học cần phân công</label>
            <select id="assignment-class-select">
              <option value="">Đang tải danh sách lớp học...</option>
            </select>
          </div>
          <div class="assignment-stats-summary" id="assignment-stats-summary" style="display: none;">
            <div class="assignment-stat-pill">
              <span>Tổng số môn</span>
              <strong id="stat-total-courses">0</strong>
            </div>
            <div class="assignment-stat-pill">
              <span>Đã phân công</span>
              <strong id="stat-assigned-courses" style="color: #4ade80;">0</strong>
            </div>
            <div class="assignment-stat-pill">
              <span>Chưa phân công</span>
              <strong id="stat-unassigned-courses" style="color: #f87171;">0</strong>
            </div>
          </div>
        </div>
      </section>

      <!-- Tabs chuyển đổi giữa Bảng phân công và Lịch sử -->
      <div class="assignment-tabs">
        <button type="button" class="assignment-tab-btn is-active" data-tab="matrix">Bảng phân công theo môn</button>
        <button type="button" class="assignment-tab-btn" data-tab="history">Lịch sử phân công &amp; bàn giao</button>
      </div>

      <!-- Tab 1: Ma trận phân công theo môn trong lớp -->
      <section class="assignment-table-card" id="assignment-matrix-view">
        <table class="assignment-table" aria-label="Bảng phân công giảng viên và trợ giảng">
          <thead>
            <tr>
              <th style="width: 28%;">Môn học</th>
              <th style="width: 28%;">Giảng viên chính</th>
              <th style="width: 24%;">Trợ giảng</th>
              <th style="width: 10%;">Trạng thái</th>
              <th style="width: 10%; text-align: right;">Thao tác</th>
            </tr>
          </thead>
          <tbody id="assignment-table-body">
            <tr>
              <td colspan="5" style="text-align: center; color: #94a3b8; padding: 2rem;">
                Vui lòng chọn một lớp học để xem và phân công môn học.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Tab 2: Lịch sử phân công & bàn giao -->
      <section class="assignment-table-card" id="assignment-history-view" style="display: none;">
        <div class="assignment-history-list" id="assignment-history-list">
          <p style="color: #94a3b8; text-align: center;">Đang tải lịch sử phân công...</p>
        </div>
      </section>

      <!-- Modal Phân công / Bàn giao -->
      <div class="assignment-modal-backdrop" id="assignment-modal" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="assignment-modal-card">
          <div class="assignment-modal-header">
            <h3 id="modal-title">Phân công giảng viên &amp; trợ giảng</h3>
            <button type="button" class="assignment-modal-close" id="btn-close-modal" aria-label="Đóng">&times;</button>
          </div>
          <form id="assignment-form">
            <div class="assignment-modal-body">
              <input type="hidden" id="modal-assignment-id" />
              <input type="hidden" id="modal-course-id" />

              <div class="assignment-modal-form-group">
                <label>Lớp học</label>
                <input type="text" id="modal-class-display" readonly disabled style="opacity: 0.8;" />
              </div>

              <div class="assignment-modal-form-group">
                <label>Môn học</label>
                <input type="text" id="modal-course-display" readonly disabled style="opacity: 0.8;" />
              </div>

              <div class="assignment-modal-form-group">
                <label for="modal-teacher-select">Giảng viên chính <span style="color: #f87171;">*</span></label>
                <select id="modal-teacher-select" required>
                  <option value="">-- Chọn giảng viên chính chịu trách nhiệm chuyên môn --</option>
                </select>
                <small style="color: #94a3b8; font-size: 0.75rem;">Mỗi môn bắt buộc phải có một giảng viên chính đang hoạt động.</small>
              </div>

              <div class="assignment-modal-form-group">
                <label>Trợ giảng (Tùy chọn)</label>
                <div class="assignment-assistant-checkboxes" id="modal-assistants-list">
                  <span style="color: #64748b; font-size: 0.8rem;">Đang tải danh sách trợ giảng...</span>
                </div>
                <small style="color: #94a3b8; font-size: 0.75rem;">Trợ giảng không được trùng với giảng viên chính của môn này.</small>
              </div>

              <div class="assignment-modal-form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                <div>
                  <label for="modal-term">Học kỳ</label>
                  <input type="text" id="modal-term" value="Học kỳ 1 - 2026" />
                </div>
                <div>
                  <label for="modal-year">Niên khóa</label>
                  <input type="text" id="modal-year" value="2026-2027" />
                </div>
              </div>

              <div class="assignment-modal-form-group">
                <label for="modal-note">Ghi chú / Lý do bàn giao</label>
                <textarea id="modal-note" rows="2" placeholder="Nhập ghi chú chuyên môn hoặc lý do phân công/bàn giao..."></textarea>
              </div>

              <div class="assignment-modal-feedback" id="modal-feedback" role="alert"></div>
            </div>

            <div class="assignment-modal-footer">
              <button type="button" class="btn-assign-action btn-assign-secondary" id="btn-cancel-modal">Hủy</button>
              <button type="submit" class="btn-assign-action btn-assign-primary" id="btn-submit-modal">Xác nhận phân công</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  // DOM Elements
  const classSelect = container.querySelector('#assignment-class-select');
  const statsSummary = container.querySelector('#assignment-stats-summary');
  const statTotal = container.querySelector('#stat-total-courses');
  const statAssigned = container.querySelector('#stat-assigned-courses');
  const statUnassigned = container.querySelector('#stat-unassigned-courses');

  const tabButtons = container.querySelectorAll('.assignment-tab-btn');
  const matrixView = container.querySelector('#assignment-matrix-view');
  const historyView = container.querySelector('#assignment-history-view');
  const tableBody = container.querySelector('#assignment-table-body');
  const historyList = container.querySelector('#assignment-history-list');

  const modal = container.querySelector('#assignment-modal');
  const modalTitle = container.querySelector('#modal-title');
  const form = container.querySelector('#assignment-form');
  const modalAssignmentId = container.querySelector('#modal-assignment-id');
  const modalCourseId = container.querySelector('#modal-course-id');
  const modalClassDisplay = container.querySelector('#modal-class-display');
  const modalCourseDisplay = container.querySelector('#modal-course-display');
  const modalTeacherSelect = container.querySelector('#modal-teacher-select');
  const modalAssistantsList = container.querySelector('#modal-assistants-list');
  const modalTerm = container.querySelector('#modal-term');
  const modalYear = container.querySelector('#modal-year');
  const modalNote = container.querySelector('#modal-note');
  const modalFeedback = container.querySelector('#modal-feedback');
  const btnSubmitModal = container.querySelector('#btn-submit-modal');
  const btnCloseModal = container.querySelector('#btn-close-modal');
  const btnCancelModal = container.querySelector('#btn-cancel-modal');

  // Internal state
  let optionsData = { classes: [], courses: [], teachers: [], assistants: [] };
  let currentClassId = '';
  let currentClassData = null;
  let activeTab = 'matrix';

  // 1. Initialize options
  async function loadOptions() {
    try {
      optionsData = await getAssignmentOptions();

      classSelect.replaceChildren();
      if (optionsData.classes.length === 0) {
        classSelect.add(new Option('Không có lớp học nào đang hoạt động', ''));
        return;
      }

      classSelect.add(new Option('-- Chọn lớp học để phân công môn --', ''));
      optionsData.classes.forEach(c => {
        const option = new Option(`${c.code} — ${c.name} (${c.room || 'Phòng học'})`, c.id);
        classSelect.add(option);
      });

      // Populate teachers select in modal
      modalTeacherSelect.replaceChildren();
      modalTeacherSelect.add(new Option('-- Chọn giảng viên chính chịu trách nhiệm chuyên môn --', ''));
      optionsData.teachers.forEach(t => {
        const opt = new Option(`${t.name} (${t.email})`, t.id);
        modalTeacherSelect.add(opt);
      });

      // Populate assistant checkboxes in modal
      renderAssistantCheckboxes();

      // Auto-select first class if available
      if (optionsData.classes.length > 0) {
        classSelect.value = optionsData.classes[0].id;
        handleClassChange();
      }
    } catch (error) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: #f87171; padding: 2rem;">
            Lỗi khi tải dữ liệu: ${escapeHtml(error.message)}
          </td>
        </tr>
      `;
    }
  }

  function renderAssistantCheckboxes(selectedIds = []) {
    modalAssistantsList.replaceChildren();
    if (optionsData.assistants.length === 0) {
      modalAssistantsList.innerHTML = '<span style="color: #64748b; font-size: 0.8rem;">Không có trợ giảng nào đang hoạt động.</span>';
      return;
    }

    const currentSelectedTeacher = modalTeacherSelect.value;

    optionsData.assistants.forEach(a => {
      const isTeacher = currentSelectedTeacher && String(a.id) === String(currentSelectedTeacher);
      const isChecked = selectedIds.includes(String(a.id));

      const label = document.createElement('label');
      label.className = 'assignment-assistant-item';
      if (isTeacher) {
        label.style.opacity = '0.4';
        label.style.cursor = 'not-allowed';
      }

      label.innerHTML = `
        <input type="checkbox" value="${escapeHtml(a.id)}" ${isChecked ? 'checked' : ''} ${isTeacher ? 'disabled' : ''} />
        <span>${escapeHtml(a.name)} (${escapeHtml(a.email)}) ${isTeacher ? '<em style="color:#f87171;">(Đang là GV chính)</em>' : ''}</span>
      `;

      modalAssistantsList.appendChild(label);
    });
  }

  // Handle teacher change to update assistant list (avoid conflict)
  modalTeacherSelect.addEventListener('change', () => {
    const selectedAssists = Array.from(modalAssistantsList.querySelectorAll('input[type="checkbox"]:checked'))
      .map(cb => cb.value)
      .filter(id => String(id) !== String(modalTeacherSelect.value));
    renderAssistantCheckboxes(selectedAssists);
  });

  // 2. Class Change handler
  async function handleClassChange() {
    currentClassId = classSelect.value;
    if (!currentClassId) {
      statsSummary.style.display = 'none';
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: #94a3b8; padding: 2rem;">
            Vui lòng chọn một lớp học để xem và phân công môn học.
          </td>
        </tr>
      `;
      return;
    }

    currentClassData = optionsData.classes.find(c => String(c.id) === String(currentClassId));
    await loadClassMatrix();
  }

  classSelect.addEventListener('change', handleClassChange);

  // 3. Load Matrix for Class
  async function loadClassMatrix() {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: #94a3b8; padding: 2rem;">
          Đang tải danh sách phân công môn học...
        </td>
      </tr>
    `;

    try {
      const result = await getAssignmentsByClass(currentClassId);
      const matrix = result.matrix || [];
      const summary = result.summary || { totalCourses: 0, assignedCourses: 0, unassignedCourses: 0 };

      // Update stats
      statsSummary.style.display = 'flex';
      statTotal.textContent = String(summary.totalCourses);
      statAssigned.textContent = String(summary.assignedCourses);
      statUnassigned.textContent = String(summary.unassignedCourses);

      if (matrix.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; color: #94a3b8; padding: 2rem;">
              Chưa có môn học nào trong danh mục đào tạo của lớp.
            </td>
          </tr>
        `;
        return;
      }

      tableBody.replaceChildren();
      matrix.forEach(item => {
        const tr = document.createElement('tr');
        const asg = item.assignment;

        // Course Info cell
        const courseCell = `
          <div class="assignment-course-meta">
            <span class="assignment-course-code">${escapeHtml(item.courseCode)}</span>
            <span class="assignment-course-name">${escapeHtml(item.courseName)}</span>
            <span class="assignment-course-details">${item.sessionCount} buổi · Trọng số ${item.weight}</span>
          </div>
        `;

        // Teacher cell
        const teacherCell = asg ? `
          <div class="assignment-person-cell">
            <div class="assignment-person-avatar">
              ${escapeHtml(asg.primaryTeacherName.split(/\s+/).slice(-2).map(p => p[0]).join('').toUpperCase())}
            </div>
            <div class="assignment-person-info">
              <span class="assignment-person-name">${escapeHtml(asg.primaryTeacherName)}</span>
              <span class="assignment-person-email">${escapeHtml(asg.primaryTeacherEmail)}</span>
            </div>
          </div>
        ` : `
          <span class="assignment-person-empty">Chưa có người chịu trách nhiệm</span>
        `;

        // Assistant cell
        let assistantCell = '';
        if (asg && asg.assistants && asg.assistants.length > 0) {
          assistantCell = `
            <div class="assignment-person-cell">
              <div class="assignment-person-avatar" style="border-color: rgba(168, 85, 247, 0.4); color: #c084fc;">
                TA
              </div>
              <div class="assignment-person-info">
                <span class="assignment-person-name">${escapeHtml(asg.assistants.map(a => a.name).join(', '))}</span>
                <span class="assignment-person-email">${escapeHtml(asg.assistants[0].email || '')}</span>
              </div>
            </div>
          `;
        } else {
          assistantCell = `<span class="assignment-person-empty">Chưa có trợ giảng</span>`;
        }

        // Status badge cell
        let badgeClass = 'is-unassigned';
        let badgeText = 'Chưa phân công';
        if (asg) {
          if (asg.hasAssistant) {
            badgeClass = 'is-fully-assigned';
            badgeText = 'Đã phân công';
          } else {
            badgeClass = 'is-no-assistant';
            badgeText = 'Chưa có TA';
          }
        }
        const statusCell = `<span class="assignment-status-badge ${badgeClass}">${badgeText}</span>`;

        // Action cell
        let actionsCell = '';
        if (asg) {
          actionsCell = `
            <div class="assignment-actions-cell" style="justify-content: flex-end;">
              <button type="button" class="btn-assign-action btn-assign-secondary btn-edit-asg" data-course-id="${escapeHtml(item.courseId)}" data-assignment-id="${escapeHtml(asg.id)}" title="Bàn giao hoặc chỉnh sửa phân công">
                Bàn giao
              </button>
              <button type="button" class="btn-assign-action btn-assign-danger btn-delete-asg" data-assignment-id="${escapeHtml(asg.id)}" data-course-name="${escapeHtml(item.courseName)}" title="Hủy phân công">
                Hủy
              </button>
            </div>
          `;
        } else {
          actionsCell = `
            <div class="assignment-actions-cell" style="justify-content: flex-end;">
              <button type="button" class="btn-assign-action btn-assign-primary btn-create-asg" data-course-id="${escapeHtml(item.courseId)}" data-course-name="${escapeHtml(item.courseName)}">
                + Phân công
              </button>
            </div>
          `;
        }

        tr.innerHTML = `
          <td>${courseCell}</td>
          <td>${teacherCell}</td>
          <td>${assistantCell}</td>
          <td>${statusCell}</td>
          <td>${actionsCell}</td>
        `;

        tableBody.appendChild(tr);
      });

      attachTableEventListeners(matrix);
    } catch (error) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: #f87171; padding: 2rem;">
            Lỗi khi tải bảng phân công: ${escapeHtml(error.message)}
          </td>
        </tr>
      `;
    }
  }

  // 4. Attach Table Event Listeners
  function attachTableEventListeners(matrix) {
    // Create assignment button
    tableBody.querySelectorAll('.btn-create-asg').forEach(btn => {
      btn.addEventListener('click', () => {
        const courseId = btn.dataset.courseId;
        const course = matrix.find(m => String(m.courseId) === String(courseId));
        openModalForCreate(course);
      });
    });

    // Edit/Reassign button
    tableBody.querySelectorAll('.btn-edit-asg').forEach(btn => {
      btn.addEventListener('click', () => {
        const assignmentId = btn.dataset.assignmentId;
        const item = matrix.find(m => m.assignment && String(m.assignment.id) === String(assignmentId));
        if (item && item.assignment) {
          openModalForEdit(item.assignment, item);
        }
      });
    });

    // Delete assignment button
    tableBody.querySelectorAll('.btn-delete-asg').forEach(btn => {
      btn.addEventListener('click', async () => {
        const assignmentId = btn.dataset.assignmentId;
        const courseName = btn.dataset.courseName;

        const confirmed = window.confirm(`Bạn có chắc chắn muốn hủy phân công môn "${courseName}" của lớp này không? Thao tác này sẽ lưu vào lịch sử kiểm toán.`);
        if (!confirmed) return;

        try {
          await deleteAssignment(assignmentId);
          await loadClassMatrix();
          if (activeTab === 'history') loadHistory();
        } catch (error) {
          alert(`Không thể hủy phân công: ${error.message}`);
        }
      });
    });
  }

  // 5. Modal Operations
  function openModalForCreate(course) {
    modalTitle.textContent = `Phân công môn: ${course?.courseName || 'Môn học'}`;
    modalAssignmentId.value = '';
    modalCourseId.value = course?.courseId || '';
    modalClassDisplay.value = `${currentClassData?.code} — ${currentClassData?.name}`;
    modalCourseDisplay.value = `${course?.courseCode} — ${course?.courseName}`;

    modalTeacherSelect.value = '';
    renderAssistantCheckboxes([]);
    modalTerm.value = 'Học kỳ 1 - 2026';
    modalYear.value = '2026-2027';
    modalNote.value = '';

    modalFeedback.className = 'assignment-modal-feedback';
    modalFeedback.textContent = '';
    btnSubmitModal.disabled = false;
    btnSubmitModal.textContent = 'Xác nhận phân công';

    modal.style.display = 'flex';
  }

  function openModalForEdit(assignment, item) {
    modalTitle.textContent = `Bàn giao / Chỉnh sửa môn: ${assignment.courseName}`;
    modalAssignmentId.value = assignment.id;
    modalCourseId.value = assignment.courseId;
    modalClassDisplay.value = `${assignment.classCode} — ${assignment.className}`;
    modalCourseDisplay.value = `${assignment.courseCode} — ${assignment.courseName}`;

    modalTeacherSelect.value = assignment.primaryTeacherId || '';
    renderAssistantCheckboxes(assignment.assistantIds || []);
    modalTerm.value = assignment.term || 'Học kỳ 1 - 2026';
    modalYear.value = assignment.academicYear || '2026-2027';
    modalNote.value = assignment.note || '';

    modalFeedback.className = 'assignment-modal-feedback';
    modalFeedback.textContent = '';
    btnSubmitModal.disabled = false;
    btnSubmitModal.textContent = 'Lưu thay đổi & Bàn giao';

    modal.style.display = 'flex';
  }

  function closeModal() {
    modal.style.display = 'none';
  }

  btnCloseModal.addEventListener('click', closeModal);
  btnCancelModal.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // 6. Submit Form
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const assignmentId = modalAssignmentId.value;
    const courseId = modalCourseId.value;
    const teacherId = modalTeacherSelect.value;
    const selectedAssistants = Array.from(modalAssistantsList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);

    // Frontend validation
    if (!teacherId) {
      modalFeedback.className = 'assignment-modal-feedback is-error';
      modalFeedback.textContent = 'Vui lòng chọn giảng viên chính chịu trách nhiệm chuyên môn.';
      return;
    }

    if (selectedAssistants.includes(teacherId)) {
      modalFeedback.className = 'assignment-modal-feedback is-error';
      modalFeedback.textContent = 'Giảng viên chính không thể đồng thời là trợ giảng của cùng một môn.';
      return;
    }

    btnSubmitModal.disabled = true;
    btnSubmitModal.textContent = 'Đang xử lý...';
    modalFeedback.className = 'assignment-modal-feedback';
    modalFeedback.textContent = '';

    try {
      if (assignmentId) {
        // Update / Reassign
        await updateAssignment(assignmentId, {
          primaryTeacherId: teacherId,
          assistantIds: selectedAssistants,
          term: modalTerm.value,
          academicYear: modalYear.value,
          note: modalNote.value,
          reason: modalNote.value || 'Thay đổi phân công chuyên môn'
        });
      } else {
        // Create new assignment
        await createAssignment({
          classId: currentClassId,
          courseId,
          primaryTeacherId: teacherId,
          assistantIds: selectedAssistants,
          term: modalTerm.value,
          academicYear: modalYear.value,
          note: modalNote.value
        });
      }

      modalFeedback.className = 'assignment-modal-feedback is-success';
      modalFeedback.textContent = 'Lưu phân công giảng dạy thành công!';

      setTimeout(async () => {
        closeModal();
        await loadClassMatrix();
        if (activeTab === 'history') loadHistory();
      }, 700);

    } catch (error) {
      modalFeedback.className = 'assignment-modal-feedback is-error';
      modalFeedback.textContent = error.message || 'Lỗi khi lưu phân công.';
      btnSubmitModal.disabled = false;
      btnSubmitModal.textContent = assignmentId ? 'Lưu thay đổi & Bàn giao' : 'Xác nhận phân công';
    }
  });

  // 7. Tabs switching & History view
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      activeTab = btn.dataset.tab;
      if (activeTab === 'matrix') {
        matrixView.style.display = 'block';
        historyView.style.display = 'none';
      } else {
        matrixView.style.display = 'none';
        historyView.style.display = 'block';
        loadHistory();
      }
    });
  });

  async function loadHistory() {
    historyList.innerHTML = '<p style="color: #94a3b8; text-align: center;">Đang tải lịch sử phân công...</p>';

    try {
      const history = await getAssignmentHistory({ classId: currentClassId || undefined });
      if (history.length === 0) {
        historyList.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 2rem;">Chưa có lịch sử thay đổi phân công nào.</p>';
        return;
      }

      historyList.replaceChildren();
      history.forEach(h => {
        const item = document.createElement('div');
        item.className = 'assignment-history-item';

        let iconClass = 'is-create';
        let iconSymbol = '➕';
        let actionLabel = 'Phân công mới';

        if (h.action === 'REASSIGN') {
          iconClass = 'is-reassign';
          iconSymbol = '🔄';
          actionLabel = 'Bàn giao giảng viên';
        } else if (h.action === 'UPDATE') {
          iconClass = 'is-update';
          iconSymbol = '✏️';
          actionLabel = 'Cập nhật phân công';
        } else if (h.action === 'DELETE') {
          iconClass = 'is-delete';
          iconSymbol = '🗑️';
          actionLabel = 'Hủy phân công';
        }

        let changeDetail = '';
        if (h.previousPrimaryTeacherName && h.newPrimaryTeacherName) {
          changeDetail = `Chuyển từ <strong>${escapeHtml(h.previousPrimaryTeacherName)}</strong> sang <strong>${escapeHtml(h.newPrimaryTeacherName)}</strong>`;
        } else if (h.newPrimaryTeacherName) {
          changeDetail = `Giảng viên phụ trách: <strong>${escapeHtml(h.newPrimaryTeacherName)}</strong>`;
        } else if (h.previousPrimaryTeacherName) {
          changeDetail = `Giảng viên trước đó: <strong>${escapeHtml(h.previousPrimaryTeacherName)}</strong>`;
        }

        item.innerHTML = `
          <div class="assignment-history-icon ${iconClass}">${iconSymbol}</div>
          <div class="assignment-history-content">
            <strong>${actionLabel} — Môn ${escapeHtml(h.courseName || h.courseId)} (${escapeHtml(h.classCode || h.className || '')})</strong>
            <p>${changeDetail} ${h.note ? `— <em>"${escapeHtml(h.note)}"</em>` : ''}</p>
            <span class="assignment-history-time">Thực hiện bởi ${escapeHtml(h.performedByName || 'Hệ thống')} • ${new Date(h.performedAt).toLocaleString('vi-VN')}</span>
          </div>
        `;

        historyList.appendChild(item);
      });
    } catch (error) {
      historyList.innerHTML = `<p style="color: #f87171; text-align: center;">Lỗi tải lịch sử: ${escapeHtml(error.message)}</p>`;
    }
  }

  // Initial load
  loadOptions();
}

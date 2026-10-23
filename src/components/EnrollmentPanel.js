import {
  getEnrollmentHistory,
  getEnrollmentOptions,
  submitEnrollment
} from '../core/enrollmentService.js';
import './EnrollmentPanel.css';

function makeElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function renderEnrollmentPanel(container) {
  container.innerHTML = `
    <section class="enrollment-panel" aria-labelledby="enrollment-panel-title">
      <form class="enrollment-panel__form">
        <label class="enrollment-panel__field" for="enrollment-class">
          <span>Lớp học đích</span>
          <select id="enrollment-class" name="classId" required disabled>
            <option value="">Đang tải danh sách lớp...</option>
          </select>
          <small class="enrollment-panel__capacity" id="enrollment-capacity" aria-live="polite"></small>
        </label>

        <fieldset class="enrollment-panel__students">
          <legend>Danh sách học viên đang hoạt động</legend>
          <label class="enrollment-panel__select-all">
            <input id="enrollment-select-all" type="checkbox" disabled>
            <span>Chọn tất cả</span>
          </label>
          <ul id="enrollment-student-list">
            <li class="enrollment-panel__empty">Đang tải danh sách học viên...</li>
          </ul>
        </fieldset>

        <p class="enrollment-panel__feedback" id="enrollment-feedback" role="status" aria-live="polite"></p>
        <button class="btn-submit enrollment-panel__submit" type="submit" disabled>Ghi danh học viên đã chọn</button>
      </form>

      <section class="enrollment-panel__results" id="enrollment-results" aria-live="polite"></section>
      <section class="enrollment-panel__history" aria-labelledby="enrollment-history-title">
        <h3 id="enrollment-history-title">Lịch sử ghi danh gần đây</h3>
        <div id="enrollment-history-list" role="status">Đang tải lịch sử ghi danh...</div>
      </section>
    </section>
  `;

  const form = container.querySelector('.enrollment-panel__form');
  const classSelect = container.querySelector('#enrollment-class');
  const capacity = container.querySelector('#enrollment-capacity');
  const studentList = container.querySelector('#enrollment-student-list');
  const selectAll = container.querySelector('#enrollment-select-all');
  const submitButton = container.querySelector('.enrollment-panel__submit');
  const feedback = container.querySelector('#enrollment-feedback');
  const results = container.querySelector('#enrollment-results');
  const historyList = container.querySelector('#enrollment-history-list');
  let students = [];
  let classes = [];
  let selectedIds = new Set();
  let isSubmitting = false;

  function setFeedback(message, state = '') {
    feedback.textContent = message;
    feedback.className = `enrollment-panel__feedback${state ? ` is-${state}` : ''}`;
  }

  function updateSubmitState() {
    const selectedClass = classes.find(item => String(item.id) === classSelect.value);
    const capacity = getRemainingSeats(selectedClass);
    submitButton.disabled = isSubmitting
      || !classSelect.value
      || selectedIds.size === 0
      || (capacity !== null && selectedIds.size > capacity);
    submitButton.textContent = isSubmitting
      ? 'Đang ghi danh...'
      : `Ghi danh ${selectedIds.size || 'học viên đã chọn'}${selectedIds.size ? ' học viên' : ''}`;
  }

  function clearFeedbackAndResults() {
    setFeedback('');
    results.replaceChildren();
  }

  function renderClasses() {
    classSelect.replaceChildren(new Option('Chọn lớp học', ''));
    classes.forEach(classItem => {
      const option = new Option(`${classItem.code} — ${classItem.name}`, String(classItem.id));
      classSelect.add(option);
    });
    classSelect.disabled = classes.length === 0;
    if (classes.length === 0) {
      classSelect.replaceChildren(new Option('Không có lớp đang hoạt động', ''));
    }
    updateCapacity();
  }

  function updateCapacity() {
    const selectedClass = classes.find(item => String(item.id) === classSelect.value);
    if (!selectedClass) {
      capacity.textContent = '';
      capacity.className = 'enrollment-panel__capacity';
      updateSubmitState();
      return;
    }
    const remaining = getRemainingSeats(selectedClass);
    const roomDetails = selectedClass.roomType === 'physical'
      ? `Phòng ${selectedClass.roomName || ''}: ${selectedClass.roomCapacity} chỗ`
      : selectedClass.roomType === 'online'
        ? `Phòng trực tuyến: ${selectedClass.roomName}`
        : 'Chưa liên kết phòng học';
    capacity.textContent = `${selectedClass.roomWarning ? `Cảnh báo: ${selectedClass.roomWarning} ` : ''}Đã ghi danh ${selectedClass.enrolledCount}/${selectedClass.maxStudents}; ${roomDetails}${remaining === null ? '' : ` · còn ${remaining} chỗ`}.`;
    capacity.className = `enrollment-panel__capacity${selectedClass.roomWarning ? ' is-warning' : ''}${remaining === 0 ? ' is-full' : ''}`;
    updateSubmitState();
  }

  function getRemainingSeats(classItem) {
    if (!classItem) return null;
    let remaining = Math.max(0, classItem.maxStudents - classItem.enrolledCount);
    if (classItem.roomType === 'physical' && Number.isSafeInteger(classItem.roomCapacity)) {
      remaining = Math.min(remaining, Math.max(0, classItem.roomCapacity - classItem.enrolledCount));
    }
    return remaining;
  }

  function renderStudents() {
    studentList.replaceChildren();
    if (students.length === 0) {
      studentList.append(makeElement('li', 'enrollment-panel__empty', 'Không có học viên đang hoạt động.'));
      selectAll.disabled = true;
      return;
    }

    students.forEach(student => {
      const item = makeElement('li');
      const label = makeElement('label', 'enrollment-panel__student');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = String(student.id);
      checkbox.dataset.studentId = String(student.id);
      checkbox.checked = selectedIds.has(String(student.id));
      checkbox.disabled = isSubmitting;
      const info = makeElement('span', 'enrollment-panel__student-info');
      info.append(makeElement('span', '', student.name));
      if (student.email) info.append(makeElement('small', '', student.email));
      label.append(checkbox, info);
      item.append(label);
      studentList.append(item);
    });
    selectAll.disabled = isSubmitting;
    selectAll.checked = students.length > 0
      && students.every(student => selectedIds.has(String(student.id)));
  }

  function renderResults(responseData) {
    results.replaceChildren();
    const succeeded = responseData.results.filter(item => item.success);
    const failed = responseData.results.filter(item => !item.success);
    const summary = makeElement(
      'div',
      'enrollment-panel__summary',
      `Thành công ${responseData.summary?.succeeded ?? succeeded.length}/${responseData.summary?.requested ?? responseData.results.length} học viên${failed.length ? `; từ chối ${failed.length} học viên` : ''}.`
    );
    summary.setAttribute('role', 'status');
    results.append(summary);

    const nameById = new Map(students.map(student => [String(student.id), student.name]));
    [
      { title: `Ghi danh thành công (${succeeded.length})`, items: succeeded, success: true },
      { title: `Bị từ chối (${failed.length})`, items: failed, success: false }
    ].filter(group => group.items.length > 0).forEach(group => {
      const section = makeElement('section', 'enrollment-panel__result-group');
      section.append(makeElement('h3', '', group.title));
      const list = makeElement('ul');
      group.items.forEach(item => {
        const row = makeElement('li');
        row.append(makeElement('span', '', nameById.get(String(item.studentId)) || `ID ${item.studentId}`));
        const message = `${item.message || (group.success ? 'Ghi danh thành công.' : 'Không thể ghi danh học viên.')}${!group.success && item.code ? ` (${item.code})` : ''}`;
        row.append(makeElement(
          'span',
          `enrollment-panel__result-message${group.success ? ' is-success' : ' is-error'}`,
          message
        ));
        list.append(row);
      });
      section.append(list);
      results.append(section);
    });
  }

  function renderHistory(entries) {
    historyList.replaceChildren();
    historyList.className = '';
    if (entries.length === 0) {
      historyList.append(makeElement('p', 'enrollment-panel__empty', 'Chưa có ghi nhận nào.'));
      return;
    }
    const classNames = new Map(classes.map(item => [String(item.id), `${item.code} — ${item.name}`]));
    const studentNames = new Map(students.map(item => [String(item.id), item.name]));
    const list = makeElement('ul');
    entries.forEach(entry => {
      const row = makeElement('li');
      const classLabel = classNames.get(String(entry.classId)) || `Lớp ${entry.classId}`;
      const studentLabel = studentNames.get(String(entry.studentId)) || `Học viên ${entry.studentId}`;
      row.append(makeElement('span', '', `${studentLabel} · ${classLabel}`));
      const enrolledAt = new Date(entry.enrolledAt);
      const dateLabel = Number.isNaN(enrolledAt.valueOf())
        ? 'Thời gian không hợp lệ'
        : enrolledAt.toLocaleString('vi-VN');
      row.append(makeElement('small', '', `${dateLabel} · Người ghi danh: ${entry.createdBy}`));
      list.append(row);
    });
    historyList.append(list);
  }

  async function refreshHistory() {
    historyList.textContent = 'Đang tải lịch sử ghi danh...';
    try {
      renderHistory(await getEnrollmentHistory());
    } catch (error) {
      historyList.textContent = error.message || 'Không thể tải lịch sử ghi danh.';
      historyList.className = 'enrollment-panel__history-error';
    }
  }

  selectAll.addEventListener('change', () => {
    selectedIds = selectAll.checked
      ? new Set(students.map(student => String(student.id)))
      : new Set();
    renderStudents();
    clearFeedbackAndResults();
    updateSubmitState();
  });

  studentList.addEventListener('change', event => {
    const checkbox = event.target.closest('input[data-student-id]');
    if (!checkbox) return;
    if (checkbox.checked) selectedIds.add(checkbox.dataset.studentId);
    else selectedIds.delete(checkbox.dataset.studentId);
    selectAll.checked = students.length > 0
      && students.every(student => selectedIds.has(String(student.id)));
    clearFeedbackAndResults();
    updateSubmitState();
  });

  classSelect.addEventListener('change', () => {
    updateCapacity();
    clearFeedbackAndResults();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (isSubmitting || !classSelect.value || selectedIds.size === 0) return;

    isSubmitting = true;
    setFeedback('');
    results.replaceChildren();
    renderStudents();
    updateSubmitState();
    try {
      const selectedClass = classes.find(item => String(item.id) === classSelect.value);
      const responseData = await submitEnrollment(
        selectedClass.id,
        students
          .filter(student => selectedIds.has(String(student.id)))
          .map(student => student.id)
      );
      renderResults(responseData);
      const partialFailure = responseData.results.some(item => !item.success);
      setFeedback(
        partialFailure ? 'Một số học viên chưa được ghi danh. Hãy kiểm tra kết quả bên dưới.' : 'Đã ghi danh học viên thành công.',
        partialFailure ? 'error' : 'success'
      );
      try {
        const options = await getEnrollmentOptions();
        classes = options.classes;
        students = options.students;
        renderClasses();
        renderStudents();
      } catch (error) {
        setFeedback(
          `Đã ghi danh nhưng không thể làm mới danh sách: ${error.message || 'lỗi tải dữ liệu.'}`,
          'error'
        );
      }
      await refreshHistory();
    } catch (error) {
      setFeedback(error.message || 'Đã xảy ra lỗi khi gửi yêu cầu ghi danh.', 'error');
    } finally {
      isSubmitting = false;
      renderStudents();
      updateSubmitState();
    }
  });

  (async () => {
    try {
      const options = await getEnrollmentOptions();
      classes = options.classes;
      students = options.students;
      renderClasses();
      renderStudents();
      updateSubmitState();
      await refreshHistory();
    } catch (error) {
      classSelect.replaceChildren(new Option('Không thể tải lớp học', ''));
      classSelect.disabled = true;
      studentList.replaceChildren(makeElement('li', 'enrollment-panel__empty', 'Không thể tải danh sách học viên.'));
      setFeedback(error.message || 'Không thể tải dữ liệu ghi danh.', 'error');
    }
  })();
}

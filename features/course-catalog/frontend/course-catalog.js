'use strict';

(() => {
  const PAGE_SIZE = 10;
  const ACCESS_TOKEN_KEY = 'educlass_access_token';
  const state = { page: 1, query: '', totalPages: 0 };
  const elements = {
    rows: document.querySelector('#course-rows'),
    summary: document.querySelector('#list-summary'),
    notice: document.querySelector('#notice'),
    pageLabel: document.querySelector('#page-label'),
    previousPage: document.querySelector('#previous-page'),
    nextPage: document.querySelector('#next-page'),
    searchForm: document.querySelector('#search-form'),
    searchQuery: document.querySelector('#search-query'),
    dialog: document.querySelector('#course-dialog'),
    form: document.querySelector('#course-form'),
    formError: document.querySelector('#form-error'),
    dialogTitle: document.querySelector('#dialog-title'),
    courseId: document.querySelector('#course-id'),
    courseCode: document.querySelector('#course-code'),
    courseName: document.querySelector('#course-name'),
    sessionCount: document.querySelector('#session-count'),
    weight: document.querySelector('#course-weight'),
    programIds: document.querySelector('#program-ids'),
    outcomesDescription: document.querySelector('#outcomes-description'),
    saveButton: document.querySelector('#save-course')
  };

  function getAuthHeaders() {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
      || sessionStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) {
      throw new Error('Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.');
    }
    return { Authorization: `Bearer ${token}` };
  }

  async function request(url, options = {}) {
    const headers = { ...getAuthHeaders(), ...options.headers };
    if (options.body) headers['Content-Type'] = 'application/json';

    const response = await fetch(url, { ...options, headers });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Không thể hoàn tất yêu cầu.');
    }
    return result;
  }

  function showNotice(message, isError = false) {
    elements.notice.textContent = message;
    elements.notice.classList.toggle('notice--error', isError);
  }

  function makeCell(value) {
    const cell = document.createElement('td');
    cell.textContent = value;
    return cell;
  }

  function renderCourses(courses) {
    elements.rows.replaceChildren();
    if (courses.length === 0) {
      const row = document.createElement('tr');
      const cell = makeCell('Không tìm thấy môn học phù hợp.');
      cell.colSpan = 7;
      row.append(cell);
      elements.rows.append(row);
      return;
    }

    for (const course of courses) {
      const row = document.createElement('tr');
      row.append(
        makeCell(course.code),
        makeCell(course.name),
        makeCell(String(course.sessionCount)),
        makeCell(String(course.weight)),
        makeCell(Array.isArray(course.programIds) && course.programIds.length
          ? course.programIds.join(', ')
          : 'Chưa gán'),
        makeCell(String(course.classCount))
      );

      const actionCell = document.createElement('td');
      const actions = document.createElement('div');
      actions.className = 'course-actions';

      const editButton = document.createElement('button');
      editButton.className = 'button button--secondary';
      editButton.type = 'button';
      editButton.textContent = 'Sửa';
      editButton.addEventListener('click', () => openEditor(course));
      actions.append(editButton);

      const deleteButton = document.createElement('button');
      deleteButton.className = 'button button--secondary button--danger';
      deleteButton.type = 'button';
      deleteButton.textContent = course.classCount ? 'Đang có lớp' : 'Xoá';
      deleteButton.disabled = course.classCount > 0;
      deleteButton.title = course.classCount
        ? 'Không thể xoá môn học đang được lớp sử dụng.'
        : 'Xoá môn học';
      deleteButton.addEventListener('click', () => removeCourse(course));
      actions.append(deleteButton);
      actionCell.append(actions);
      row.append(actionCell);
      elements.rows.append(row);
    }
  }

  async function loadCourses() {
    showNotice('');
    elements.rows.setAttribute('aria-busy', 'true');
    try {
      const params = new URLSearchParams({
        page: String(state.page),
        pageSize: String(PAGE_SIZE)
      });
      if (state.query) params.set('q', state.query);
      const result = await request(`/api/courses?${params.toString()}`);
      const { items, pagination } = result.data;
      renderCourses(items);
      state.totalPages = pagination.totalPages;
      elements.summary.textContent = `Tổng cộng ${pagination.total} môn học`;
      elements.pageLabel.textContent = pagination.totalPages
        ? `Trang ${pagination.page} / ${pagination.totalPages}`
        : 'Chưa có dữ liệu';
      elements.previousPage.disabled = pagination.page <= 1;
      elements.nextPage.disabled = pagination.page >= pagination.totalPages;
    } catch (error) {
      showNotice(error.message, true);
      elements.rows.replaceChildren();
      elements.summary.textContent = '';
      elements.pageLabel.textContent = '';
      elements.previousPage.disabled = true;
      elements.nextPage.disabled = true;
    } finally {
      elements.rows.removeAttribute('aria-busy');
    }
  }

  function openEditor(course = null) {
    elements.form.reset();
    elements.formError.textContent = '';
    elements.courseId.value = course ? course.id : '';
    elements.dialogTitle.textContent = course ? 'Chỉnh sửa môn học' : 'Thêm môn học';
    elements.saveButton.textContent = course ? 'Lưu thay đổi' : 'Lưu môn học';
    if (course) {
      elements.courseCode.value = course.code;
      elements.courseName.value = course.name;
      elements.sessionCount.value = course.sessionCount;
      elements.weight.value = course.weight;
      elements.programIds.value = (course.programIds || []).join(', ');
      elements.outcomesDescription.value = course.outcomesDescription;
    }
    elements.dialog.showModal();
    elements.courseCode.focus();
  }

  async function saveCourse(event) {
    event.preventDefault();
    elements.formError.textContent = '';
    elements.saveButton.disabled = true;

    const id = elements.courseId.value;
    const payload = {
      code: elements.courseCode.value.trim(),
      name: elements.courseName.value.trim(),
      sessionCount: Number(elements.sessionCount.value),
      weight: Number(elements.weight.value),
      programIds: elements.programIds.value.split(',').map(value => value.trim()).filter(Boolean),
      outcomesDescription: elements.outcomesDescription.value.trim()
    };

    try {
      await request(id ? `/api/courses/${encodeURIComponent(id)}` : '/api/courses', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });
      elements.dialog.close();
      showNotice(id ? 'Đã cập nhật môn học.' : 'Đã tạo môn học.');
      await loadCourses();
    } catch (error) {
      elements.formError.textContent = error.message;
    } finally {
      elements.saveButton.disabled = false;
    }
  }

  async function removeCourse(course) {
    if (!window.confirm(`Xoá môn học "${course.name}"?`)) return;
    try {
      await request(`/api/courses/${encodeURIComponent(course.id)}`, { method: 'DELETE' });
      showNotice('Đã xoá môn học.');
      await loadCourses();
    } catch (error) {
      showNotice(error.message, true);
    }
  }

  document.querySelector('#create-course').addEventListener('click', () => openEditor());
  document.querySelector('#close-dialog').addEventListener('click', () => elements.dialog.close());
  document.querySelector('#cancel-dialog').addEventListener('click', () => elements.dialog.close());
  elements.form.addEventListener('submit', saveCourse);
  elements.searchForm.addEventListener('submit', event => {
    event.preventDefault();
    state.query = elements.searchQuery.value.trim();
    state.page = 1;
    loadCourses();
  });
  elements.previousPage.addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      loadCourses();
    }
  });
  elements.nextPage.addEventListener('click', () => {
    if (state.page < state.totalPages) {
      state.page += 1;
      loadCourses();
    }
  });

  loadCourses();
})();

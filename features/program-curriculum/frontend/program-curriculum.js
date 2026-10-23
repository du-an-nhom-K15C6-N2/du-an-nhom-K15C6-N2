'use strict';

(() => {
  const API_ROOT = '/api/program-curricula';
  const COURSE_API = '/api/courses';
  const tokenKey = 'educlass_access_token';
  const programForm = document.querySelector('#program-form');
  const programInput = document.querySelector('#program-id');
  const addCourseForm = document.querySelector('#add-course-form');
  const availableCourses = document.querySelector('#available-courses');
  const courseList = document.querySelector('#course-list');
  const emptyState = document.querySelector('#empty-state');
  const listSummary = document.querySelector('#list-summary');
  const notice = document.querySelector('#notice');
  let programId = '';
  let catalog = [];
  let curriculum = [];
  let draggedCourseId = '';

  async function request(url, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    const token = localStorage.getItem(tokenKey);
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(url, { ...options, headers });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(result && result.message ? result.message : `Yêu cầu thất bại (${response.status}).`);
    }
    return result.data;
  }

  function showNotice(message, kind = 'success') {
    notice.textContent = message;
    notice.dataset.kind = kind;
  }

  function escapePath(value) {
    return encodeURIComponent(value);
  }

  async function loadCatalog() {
    const firstPage = await request(`${COURSE_API}?page=1&pageSize=100`);
    const pages = await Promise.all(
      Array.from({ length: Math.max(0, firstPage.pagination.totalPages - 1) }, (_, index) => (
        request(`${COURSE_API}?page=${index + 2}&pageSize=100`)
      ))
    );
    catalog = [...(firstPage.items || []), ...pages.flatMap(page => page.items || [])];
  }

  async function loadCurriculum() {
    const data = await request(`${API_ROOT}/${escapePath(programId)}/courses`);
    curriculum = data.courses;
    render();
  }

  function renderAvailableCourses() {
    const attached = new Set(curriculum.map(item => item.courseId));
    availableCourses.replaceChildren(new Option('Chọn môn học', ''));
    for (const course of catalog.filter(item => !attached.has(item.id))) {
      availableCourses.add(new Option(`${course.code} — ${course.name}`, course.id));
    }
    addCourseForm.hidden = !programId || availableCourses.options.length === 1;
  }

  function createCourseCard(entry, index) {
    const item = document.createElement('li');
    item.className = 'course-card';
    item.dataset.courseId = entry.courseId;
    item.draggable = true;

    const top = document.createElement('div');
    top.className = 'course-card__top';
    const titleWrap = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = entry.course ? entry.course.name : 'Môn học không xác định';
    const code = document.createElement('span');
    code.className = 'course-card__code';
    code.textContent = entry.course ? entry.course.code : entry.courseId;
    titleWrap.append(title, code);
    const order = document.createElement('span');
    order.className = 'course-card__order';
    order.textContent = `Môn ${entry.order}`;
    top.append(titleWrap, order);

    const prerequisite = document.createElement('div');
    prerequisite.className = 'prerequisite-control';
    const label = document.createElement('label');
    label.textContent = 'Môn tiên quyết (chọn một hoặc nhiều môn đứng trước)';
    const select = document.createElement('select');
    select.multiple = true;
    select.dataset.action = 'prerequisites';
    select.setAttribute('aria-label', `Môn tiên quyết của ${title.textContent}`);
    for (const previous of curriculum.slice(0, index)) {
      const option = new Option(
        `${previous.course ? previous.course.code : previous.courseId} — ${previous.course ? previous.course.name : ''}`,
        previous.courseId
      );
      option.selected = entry.prerequisiteIds.includes(previous.courseId);
      select.add(option);
    }
    prerequisite.append(label, select);

    const actions = document.createElement('div');
    actions.className = 'course-card__actions';
    const savePrerequisites = document.createElement('button');
    savePrerequisites.className = 'button button--secondary';
    savePrerequisites.type = 'button';
    savePrerequisites.dataset.action = 'save-prerequisites';
    savePrerequisites.textContent = 'Lưu môn tiên quyết';
    const remove = document.createElement('button');
    remove.className = 'button button--danger';
    remove.type = 'button';
    remove.dataset.action = 'remove';
    remove.textContent = 'Gỡ môn';
    const controls = document.createElement('div');
    controls.className = 'order-controls';
    for (const [action, text, disabled] of [
      ['up', 'Lên', index === 0],
      ['down', 'Xuống', index === curriculum.length - 1]
    ]) {
      const button = document.createElement('button');
      button.className = 'button button--secondary';
      button.type = 'button';
      button.dataset.action = action;
      button.disabled = disabled;
      button.textContent = text;
      controls.append(button);
    }
    actions.append(savePrerequisites, remove, controls);
    item.append(top, prerequisite, actions);
    return item;
  }

  function render() {
    courseList.replaceChildren(...curriculum.map(createCourseCard));
    emptyState.hidden = curriculum.length > 0 || !programId;
    if (!programId) emptyState.hidden = true;
    listSummary.textContent = programId
      ? `${programId} · ${curriculum.length} môn học`
      : 'Nhập mã chương trình để bắt đầu.';
    renderAvailableCourses();
  }

  async function saveOrder(courseIds) {
    await request(`${API_ROOT}/${escapePath(programId)}/courses/order`, {
      method: 'PUT',
      body: JSON.stringify({ courseIds })
    });
    await loadCurriculum();
    showNotice('Đã lưu thứ tự môn học.');
  }

  programForm.addEventListener('submit', async event => {
    event.preventDefault();
    programId = programInput.value.trim();
    if (!programId) return;
    showNotice('');
    try {
      await Promise.all([loadCatalog(), loadCurriculum()]);
      render();
      showNotice('Đã tải chương trình.');
    } catch (error) {
      curriculum = [];
      render();
      showNotice(error.message, 'error');
    }
  });

  addCourseForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!programId || !availableCourses.value) return;
    try {
      await request(`${API_ROOT}/${escapePath(programId)}/courses`, {
        method: 'POST',
        body: JSON.stringify({ courseId: availableCourses.value })
      });
      await loadCurriculum();
      showNotice('Đã gắn môn học vào chương trình.');
    } catch (error) {
      showNotice(error.message, 'error');
    }
  });

  courseList.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const row = button.closest('[data-course-id]');
    const index = curriculum.findIndex(item => item.courseId === row.dataset.courseId);
    try {
      if (button.dataset.action === 'remove') {
        await request(`${API_ROOT}/${escapePath(programId)}/courses/${escapePath(row.dataset.courseId)}`, {
          method: 'DELETE'
        });
        await loadCurriculum();
        showNotice('Đã gỡ môn học khỏi chương trình.');
      } else if (button.dataset.action === 'save-prerequisites') {
        const select = row.querySelector('select[data-action="prerequisites"]');
        const prerequisiteIds = [...select.selectedOptions].map(option => option.value);
        await request(
          `${API_ROOT}/${escapePath(programId)}/courses/${escapePath(row.dataset.courseId)}/prerequisites`,
          { method: 'PUT', body: JSON.stringify({ prerequisiteIds }) }
        );
        await loadCurriculum();
        showNotice('Đã lưu môn tiên quyết.');
      } else if (button.dataset.action === 'up' || button.dataset.action === 'down') {
        const targetIndex = button.dataset.action === 'up' ? index - 1 : index + 1;
        const reordered = curriculum.map(item => item.courseId);
        [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
        await saveOrder(reordered);
      }
    } catch (error) {
      showNotice(error.message, 'error');
      if (button.dataset.action === 'up' || button.dataset.action === 'down') {
        await loadCurriculum().catch(loadError => showNotice(loadError.message, 'error'));
      }
    }
  });

  courseList.addEventListener('dragstart', event => {
    const row = event.target.closest('[data-course-id]');
    if (!row) return;
    draggedCourseId = row.dataset.courseId;
    row.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedCourseId);
  });

  courseList.addEventListener('dragover', event => {
    const row = event.target.closest('[data-course-id]');
    if (!row || row.dataset.courseId === draggedCourseId) return;
    event.preventDefault();
    row.classList.add('is-drop-target');
  });

  courseList.addEventListener('dragleave', event => {
    const row = event.target.closest('[data-course-id]');
    if (row) row.classList.remove('is-drop-target');
  });

  courseList.addEventListener('drop', async event => {
    const row = event.target.closest('[data-course-id]');
    if (!row || !draggedCourseId || row.dataset.courseId === draggedCourseId) return;
    event.preventDefault();
    const fromIndex = curriculum.findIndex(item => item.courseId === draggedCourseId);
    const toIndex = curriculum.findIndex(item => item.courseId === row.dataset.courseId);
    const reordered = curriculum.map(item => item.courseId);
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    try {
      await saveOrder(reordered);
    } catch (error) {
      showNotice(error.message, 'error');
      await loadCurriculum().catch(loadError => showNotice(loadError.message, 'error'));
    }
  });

  courseList.addEventListener('dragend', () => {
    draggedCourseId = '';
    for (const row of courseList.querySelectorAll('.is-dragging, .is-drop-target')) {
      row.classList.remove('is-dragging', 'is-drop-target');
    }
  });
})();

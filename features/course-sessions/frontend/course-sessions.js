'use strict';

(() => {
  const API_ROOT = '/api/course-sessions';
  const COURSE_API = '/api/courses';
  const tokenKey = 'educlass_access_token';
  const courseForm = document.querySelector('#course-form');
  const courseSelect = document.querySelector('#course-id');
  const workspace = document.querySelector('#workspace');
  const courseName = document.querySelector('#course-name');
  const courseSummary = document.querySelector('#course-summary');
  const cloneForm = document.querySelector('#clone-form');
  const sourceSelect = document.querySelector('#source-course');
  const sessionForm = document.querySelector('#session-form');
  const sessionNumber = document.querySelector('#session-number');
  const topicInput = document.querySelector('#session-topic');
  const objectivesInput = document.querySelector('#session-objectives');
  const saveButton = document.querySelector('#save-session');
  const cancelEdit = document.querySelector('#cancel-edit');
  const sessionList = document.querySelector('#session-list');
  const sessionCount = document.querySelector('#session-count');
  const emptyState = document.querySelector('#empty-state');
  const notice = document.querySelector('#notice');
  let catalog = [];
  let currentCourse = null;
  let sessions = [];
  let editingNumber = null;

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
    courseSelect.replaceChildren(new Option('Chọn môn học', ''));
    for (const course of catalog) {
      courseSelect.add(new Option(`${course.code} — ${course.name}`, course.id));
    }
  }

  function renderSources() {
    sourceSelect.replaceChildren(new Option('Chọn môn nguồn', ''));
    for (const course of catalog.filter(item => item.id !== currentCourse.id)) {
      sourceSelect.add(new Option(`${course.code} — ${course.name}`, course.id));
    }
  }

  function resetEditor() {
    editingNumber = null;
    sessionForm.reset();
    sessionNumber.max = String(currentCourse.sessionCount);
    saveButton.textContent = 'Thêm buổi học';
    cancelEdit.hidden = true;
    document.querySelector('#editor-heading').textContent = 'Thêm buổi học';
    sessionNumber.disabled = false;
  }

  function startEditing(session) {
    editingNumber = session.number;
    sessionNumber.value = String(session.number);
    sessionNumber.max = String(currentCourse.sessionCount);
    sessionNumber.disabled = false;
    topicInput.value = session.topic;
    objectivesInput.value = session.objectives;
    saveButton.textContent = 'Lưu thay đổi';
    cancelEdit.hidden = false;
    document.querySelector('#editor-heading').textContent = `Sửa buổi ${session.number}`;
    topicInput.focus();
  }

  function createSessionCard(session) {
    const item = document.createElement('li');
    item.className = 'session-card';

    const top = document.createElement('div');
    top.className = 'session-card__top';
    const title = document.createElement('h3');
    title.textContent = session.topic;
    const number = document.createElement('span');
    number.className = 'session-card__number';
    number.textContent = `Buổi ${session.number}`;
    top.append(title, number);

    const objectives = document.createElement('p');
    objectives.className = 'session-card__objectives';
    objectives.textContent = session.objectives;

    const actions = document.createElement('div');
    actions.className = 'session-card__actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'button button--secondary';
    edit.textContent = 'Sửa';
    edit.addEventListener('click', () => startEditing(session));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button button--danger';
    remove.textContent = 'Xoá';
    remove.addEventListener('click', () => removeSession(session.number));
    actions.append(edit, remove);
    item.append(top, objectives, actions);
    return item;
  }

  function render() {
    if (!currentCourse) return;
    workspace.hidden = false;
    courseName.textContent = `${currentCourse.code} — ${currentCourse.name}`;
    courseSummary.textContent = `Tối đa ${currentCourse.sessionCount} buổi học theo danh mục môn.`;
    sessionCount.textContent = `Đã khai báo ${sessions.length}/${currentCourse.sessionCount} buổi`;
    sessionList.replaceChildren(...sessions.map(createSessionCard));
    emptyState.hidden = sessions.length !== 0;
    const atLimit = sessions.length >= currentCourse.sessionCount;
    if (editingNumber === null) saveButton.disabled = atLimit;
    renderSources();
  }

  async function loadSessions(courseId) {
    const data = await request(`${API_ROOT}/${escapePath(courseId)}/sessions`);
    currentCourse = catalog.find(item => item.id === courseId);
    sessions = data.sessions;
    resetEditor();
    render();
  }

  async function removeSession(number) {
    if (!window.confirm(`Xoá nội dung buổi ${number}?`)) return;
    try {
      const data = await request(
        `${API_ROOT}/${escapePath(currentCourse.id)}/sessions/${number}`,
        { method: 'DELETE' }
      );
      sessions = data.sessions;
      resetEditor();
      render();
      showNotice(`Đã xoá buổi ${number}.`);
    } catch (error) {
      showNotice(error.message, 'error');
    }
  }

  courseForm.addEventListener('submit', async event => {
    event.preventDefault();
    const courseId = courseSelect.value;
    if (!courseId) return;
    showNotice('');
    try {
      await loadSessions(courseId);
      showNotice('Đã tải danh sách buổi học.');
    } catch (error) {
      currentCourse = null;
      workspace.hidden = true;
      showNotice(error.message, 'error');
    }
  });

  sessionForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!currentCourse) return;
    const payload = {
      number: Number(sessionNumber.value),
      topic: topicInput.value.trim(),
      objectives: objectivesInput.value.trim()
    };
    const wasEditing = editingNumber !== null;
    try {
      const path = `${API_ROOT}/${escapePath(currentCourse.id)}/sessions`;
      const data = !wasEditing
        ? await request(path, { method: 'POST', body: JSON.stringify(payload) })
        : await request(`${path}/${editingNumber}`, { method: 'PUT', body: JSON.stringify(payload) });
      sessions = data.sessions;
      resetEditor();
      render();
      showNotice(wasEditing ? 'Đã cập nhật buổi học.' : 'Đã thêm buổi học.');
    } catch (error) {
      showNotice(error.message, 'error');
    }
  });

  cancelEdit.addEventListener('click', resetEditor);

  cloneForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!currentCourse || !sourceSelect.value) return;
    if (
      sessions.length > 0
      && !window.confirm('Danh sách hiện tại của môn đích sẽ bị thay thế. Bạn có muốn tiếp tục?')
    ) return;
    try {
      const data = await request(
        `${API_ROOT}/${escapePath(currentCourse.id)}/sessions/clone`,
        {
          method: 'POST',
          body: JSON.stringify({ sourceCourseId: sourceSelect.value })
        }
      );
      sessions = data.sessions;
      resetEditor();
      render();
      showNotice('Đã nhân bản danh sách buổi học từ môn nguồn.');
    } catch (error) {
      showNotice(error.message, 'error');
    }
  });

  loadCatalog().catch(error => {
    courseSelect.replaceChildren(new Option('Không tải được danh mục môn học', ''));
    showNotice(error.message, 'error');
  });
})();

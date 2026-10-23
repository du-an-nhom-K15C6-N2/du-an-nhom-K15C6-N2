import { getClassrooms, saveClassroom, assignClassroom } from '../core/classroomService.js';
import { getClassList } from '../core/classListService.js';
import './ClassroomPanel.css';

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function renderClassroomPanel(container) {
  container.innerHTML = `
    <section class="classroom-panel" aria-label="Quản lý phòng học">
      <form class="classroom-form" id="classroom-form">
        <h3 id="classroom-form-title">Khai báo phòng học</h3>
        <input type="hidden" name="roomId">
        <label>Tên phòng<input name="name" maxlength="120" required></label>
        <label>Loại phòng
          <select name="type" required>
            <option value="physical">Phòng vật lý</option>
            <option value="online">Phòng trực tuyến</option>
          </select>
        </label>
        <label data-room-field="capacity">Sức chứa (học viên)
          <input name="capacity" type="number" min="1" step="1" required>
        </label>
        <label data-room-field="meetingUrl" hidden>Liên kết trực tuyến
          <input name="meetingUrl" type="url" placeholder="https://..." maxlength="2048">
        </label>
        <div class="classroom-form__actions">
          <button type="submit" class="btn-submit">Lưu phòng</button>
          <button type="button" class="btn-secondary" data-action="reset" hidden>Hủy chỉnh sửa</button>
        </div>
        <p class="classroom-feedback" id="classroom-feedback" role="status" aria-live="polite"></p>
      </form>

      <section class="classroom-rooms" aria-labelledby="classroom-list-title">
        <h3 id="classroom-list-title">Danh sách phòng học</h3>
        <div id="classroom-list" role="status">Đang tải phòng học...</div>
      </section>

      <form class="classroom-assignment" id="classroom-assignment">
        <h3>Phân công phòng cho lớp</h3>
        <label>Lớp học
          <select name="classId" required><option value="">Đang tải lớp học...</option></select>
        </label>
        <label>Phòng học
          <select name="roomId"><option value="">Chưa phân công phòng</option></select>
        </label>
        <p class="classroom-capacity-check" id="classroom-capacity-check" role="status" aria-live="polite"></p>
        <button type="submit" class="btn-submit">Lưu phân công</button>
        <p class="classroom-feedback" id="classroom-assignment-feedback" role="status" aria-live="polite"></p>
      </form>
    </section>
  `;

  const roomForm = container.querySelector('#classroom-form');
  const assignmentForm = container.querySelector('#classroom-assignment');
  const roomType = roomForm.elements.type;
  const capacityField = roomForm.querySelector('[data-room-field="capacity"]');
  const meetingUrlField = roomForm.querySelector('[data-room-field="meetingUrl"]');
  const feedback = container.querySelector('#classroom-feedback');
  const list = container.querySelector('#classroom-list');
  const classSelect = assignmentForm.elements.classId;
  const roomSelect = assignmentForm.elements.roomId;
  const capacityCheck = container.querySelector('#classroom-capacity-check');
  const assignmentFeedback = container.querySelector('#classroom-assignment-feedback');
  const resetButton = roomForm.querySelector('[data-action="reset"]');
  let rooms = [];
  let classes = [];

  function showRoomFields() {
    const online = roomType.value === 'online';
    capacityField.hidden = online;
    capacityField.querySelector('input').required = !online;
    meetingUrlField.hidden = !online;
    meetingUrlField.querySelector('input').required = online;
  }

  function renderRooms() {
    list.replaceChildren();
    if (!rooms.length) {
      list.append(makeElement('p', 'classroom-empty', 'Chưa khai báo phòng học.'));
    }
    const roomList = makeElement('ul', 'classroom-list');
    rooms.forEach(room => {
      const item = makeElement('li', 'classroom-card');
      const details = makeElement('div');
      details.append(makeElement('strong', '', room.name));
      details.append(makeElement(
        'span',
        'classroom-card__meta',
        room.type === 'physical' ? `Phòng vật lý · ${room.capacity} chỗ` : 'Phòng trực tuyến'
      ));
      if (room.meetingUrl) {
        const link = makeElement('a', 'classroom-card__link', room.meetingUrl);
        link.href = room.meetingUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        details.append(link);
      }
      const edit = makeElement('button', 'btn-secondary', 'Chỉnh sửa');
      edit.type = 'button';
      edit.addEventListener('click', () => {
        roomForm.elements.roomId.value = room.id;
        roomForm.elements.name.value = room.name;
        roomType.value = room.type;
        roomForm.elements.capacity.value = room.capacity ?? '';
        roomForm.elements.meetingUrl.value = room.meetingUrl || '';
        container.querySelector('#classroom-form-title').textContent = `Cập nhật phòng: ${room.name}`;
        resetButton.hidden = false;
        showRoomFields();
        roomForm.elements.name.focus();
      });
      item.append(details, edit);
      roomList.append(item);
    });
    if (rooms.length) list.append(roomList);
    roomSelect.replaceChildren(new Option('Chưa phân công phòng', ''));
    rooms.forEach(room => roomSelect.add(new Option(
      room.type === 'physical' ? `${room.name} · ${room.capacity} chỗ` : `${room.name} · Trực tuyến`,
      room.id
    )));
    updateCapacityCheck();
  }

  function renderClasses() {
    classSelect.replaceChildren(new Option('Chọn lớp học', ''));
    classes.forEach(item => classSelect.add(new Option(`${item.code} — ${item.name}`, item.id)));
    updateCapacityCheck();
  }

  function updateCapacityCheck() {
    const selectedClass = classes.find(item => String(item.id) === classSelect.value);
    const selectedRoom = rooms.find(item => String(item.id) === roomSelect.value);
    if (!selectedClass) {
      capacityCheck.textContent = '';
      capacityCheck.className = 'classroom-capacity-check';
      return;
    }
    if (!selectedRoom) {
      capacityCheck.textContent = 'Cảnh báo: lớp chưa được phân công phòng.';
      capacityCheck.className = 'classroom-capacity-check is-warning';
      return;
    }
    const size = Math.max(selectedClass.maxStudents || 0, selectedClass.currentStudents || 0);
    if (selectedRoom.type === 'physical' && size > selectedRoom.capacity) {
      capacityCheck.textContent = `Vượt sức chứa: lớp cần ${size} chỗ nhưng phòng chỉ có ${selectedRoom.capacity} chỗ.`;
      capacityCheck.className = 'classroom-capacity-check is-error';
      return;
    }
    capacityCheck.textContent = selectedRoom.type === 'physical'
      ? `Phù hợp: tối đa ${selectedClass.maxStudents} học viên / ${selectedRoom.capacity} chỗ.`
      : `Phòng trực tuyến: ${selectedRoom.name}.`;
    capacityCheck.className = 'classroom-capacity-check is-success';
  }

  roomType.addEventListener('change', showRoomFields);
  classSelect.addEventListener('change', () => {
    const selectedClass = classes.find(item => String(item.id) === classSelect.value);
    roomSelect.value = selectedClass?.roomId || '';
    updateCapacityCheck();
    assignmentFeedback.textContent = selectedClass?.roomWarning || '';
  });
  roomSelect.addEventListener('change', updateCapacityCheck);
  resetButton.addEventListener('click', () => {
    roomForm.reset();
    roomForm.elements.roomId.value = '';
    resetButton.hidden = true;
    container.querySelector('#classroom-form-title').textContent = 'Khai báo phòng học';
    feedback.textContent = '';
    showRoomFields();
  });

  roomForm.addEventListener('submit', async event => {
    event.preventDefault();
    feedback.textContent = '';
    const id = roomForm.elements.roomId.value;
    const payload = {
      name: roomForm.elements.name.value.trim(),
      type: roomType.value,
      capacity: roomType.value === 'physical' ? Number(roomForm.elements.capacity.value) : null,
      meetingUrl: roomType.value === 'online' ? roomForm.elements.meetingUrl.value.trim() : null
    };
    try {
      await saveClassroom(payload, id);
      feedback.textContent = id ? 'Đã cập nhật phòng học.' : 'Đã khai báo phòng học.';
      feedback.className = 'classroom-feedback is-success';
      roomForm.reset();
      roomForm.elements.roomId.value = '';
      resetButton.hidden = true;
      container.querySelector('#classroom-form-title').textContent = 'Khai báo phòng học';
      showRoomFields();
      await refresh();
    } catch (error) {
      feedback.textContent = error.message || 'Không thể lưu phòng học.';
      feedback.className = 'classroom-feedback is-error';
    }
  });

  assignmentForm.addEventListener('submit', async event => {
    event.preventDefault();
    assignmentFeedback.textContent = '';
    const selectedClass = classes.find(item => String(item.id) === classSelect.value);
    const selectedRoom = rooms.find(item => String(item.id) === roomSelect.value);
    if (!selectedClass) {
      assignmentFeedback.textContent = 'Vui lòng chọn lớp học.';
      assignmentFeedback.className = 'classroom-feedback is-error';
      return;
    }
    if (selectedRoom?.type === 'physical'
      && Math.max(selectedClass.maxStudents || 0, selectedClass.currentStudents || 0) > selectedRoom.capacity) {
      assignmentFeedback.textContent = `Không thể phân công: lớp cần tối đa ${selectedClass.maxStudents} chỗ nhưng phòng chỉ có ${selectedRoom.capacity} chỗ.`;
      assignmentFeedback.className = 'classroom-feedback is-error';
      return;
    }
    try {
      await assignClassroom(selectedClass.id, roomSelect.value);
      assignmentFeedback.textContent = 'Đã cập nhật phòng cho lớp.';
      assignmentFeedback.className = 'classroom-feedback is-success';
      await refresh();
      classSelect.value = String(selectedClass.id);
      roomSelect.value = selectedRoom?.id || '';
      updateCapacityCheck();
    } catch (error) {
      assignmentFeedback.textContent = error.message || 'Không thể phân công phòng.';
      assignmentFeedback.className = 'classroom-feedback is-error';
    }
  });

  async function refresh() {
    const [roomData, classResponse] = await Promise.all([getClassrooms(), getClassList()]);
    rooms = roomData;
    classes = classResponse.data;
    renderRooms();
    renderClasses();
  }

  showRoomFields();
  refresh().catch(error => {
    list.textContent = error.message || 'Không thể tải dữ liệu phòng học.';
    list.className = 'classroom-feedback is-error';
  });
}

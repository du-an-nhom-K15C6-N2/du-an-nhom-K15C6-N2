// DNKN-175: Giao diện quản lý hồ sơ học viên

import './StudentProfilePanel.css';
import { request } from '../../../src/core/authService.js';
import { getAuthSession } from '../../../src/core/storage.js';

const escapeHtml = value =>
    String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);

function fixClassName(className, classCode) {
    const names = {
        'K15-CNTT01': 'Lập trình Web',
        'K15-CNTT02': 'Cơ sở dữ liệu'
    };

    return names[classCode] || className || 'Chưa có';
}


export function renderStudentProfilePanel(container) {
    let students = [];
    let selectedStudent = null;

    container.innerHTML = `
    <section class="student-profile-panel">
      <h2>Quản lý hồ sơ học viên</h2>
      <p>DNKN-175 — Danh sách và hồ sơ học viên</p>

      <input
        id="student-search"
        type="search"
        placeholder="Tìm kiếm học viên..."
      />

      <div id="student-list">Đang tải học viên...</div>
      <div id="student-details"></div>
    </section>
  `;

    const list = container.querySelector('#student-list');
    const details = container.querySelector('#student-details');
    const search = container.querySelector('#student-search');

    function renderList(keyword = '') {
        const filtered = students.filter(student =>
            `${student.id} ${student.name} ${student.email} ${student.phone}`
                .toLowerCase()
                .includes(keyword.toLowerCase())
        );

        list.innerHTML = filtered.length
            ? filtered.map(student => `
          <div class="student-item">
            <strong>${escapeHtml(student.name)}</strong>
            <span>${escapeHtml(student.email)}</span>
            <button type="button"
              data-student-id="${escapeHtml(student.id)}">
              Xem hồ sơ
            </button>
          </div>
        `).join('')
            : '<p>Không tìm thấy học viên phù hợp.</p>';
    }

    async function loadStudents() {
        try {
            const token = getAuthSession().token;

            const result = await request('/student-profiles', {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            students = result.data || [];
            renderList();
        } catch (error) {
            list.textContent =
                error.message || 'Không thể tải danh sách học viên.';
        }
    }

    async function showStudentProfile(studentId) {
        try {
            details.textContent = 'Đang tải hồ sơ...';

            const token = getAuthSession().token;

            const result = await request(
                `/student-profiles/${encodeURIComponent(studentId)}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            selectedStudent = result.data;

            const student = selectedStudent.student;
            const classes = selectedStudent.classes || [];
            const history = selectedStudent.history || [];
            const attendance = selectedStudent.attendance || [];
            const grades = selectedStudent.grades || [];

            const activeClasses = classes.filter(item =>
                item.classInfo?.status === 'active'
            );

            const classListHtml = activeClasses.length
                ? activeClasses.map(item => {
                    const cls = item.classInfo || {};

                    return `
        <div class="student-class-card">
          <p><strong>Mã lớp:</strong>
            ${escapeHtml(cls.code || item.classId)}
          </p>

          <p><strong>Tên lớp:</strong>
            ${escapeHtml(fixClassName(cls.name, cls.code))}
          </p>

          <p><strong>Thời gian:</strong>
            ${escapeHtml(cls.startDate || 'Chưa có')}
            —
            ${escapeHtml(cls.endDate || 'Chưa có')}
          </p>

          <p><strong>Tiến độ lớp:</strong>
            ${escapeHtml(cls.completedLessons ?? 0)}
            /
            ${escapeHtml(cls.totalLessons ?? 0)} buổi
          </p>
        </div>
      `;
                }).join('')
                : '<p>Chưa có lớp đang học.</p>';

            const historyListHtml = history.length
                ? history.map(item => {
                    const cls = classes.find(
                        record => String(record.classId) === String(item.classId)
                    )?.classInfo;

                    return `
        <div class="student-class-card">
          <p><strong>Mã lớp:</strong>
            ${escapeHtml(cls?.code || item.classId)}
          </p>

          <p><strong>Tên lớp:</strong>
            ${escapeHtml(fixClassName(cls?.name, cls?.code))}
          </p>

          <p><strong>Ngày ghi danh:</strong>
            ${escapeHtml(item.enrolledAt || 'Chưa có')}
          </p>

          <p><strong>Trạng thái:</strong> Đã ghi danh</p>
        </div>
      `;
                }).join('')
                : '<p>Chưa có lịch sử ghi danh.</p>';

            // DNKN-175: Hiển thị điểm danh
            const attendanceHtml = attendance.length
                ? attendance.map(item => `
      <div class="student-class-card">
        <p><strong>Lớp:</strong>
          ${escapeHtml(item.className || 'Chưa có')}
        </p>
        <p><strong>Ngày điểm danh:</strong>
          ${escapeHtml(item.attendanceDate || 'Chưa có')}
        </p>
        <p><strong>Trạng thái:</strong>
          ${escapeHtml({
                    present: 'Có mặt',
                    absent: 'Vắng mặt',
                    late: 'Đi muộn',
                    excused: 'Vắng có phép'
                }[item.status] || item.status || 'Chưa có')}
        </p>
      </div>
    `).join('')
                : '<p>Chưa có dữ liệu điểm danh.</p>';

            // DNKN-175: Hiển thị kết quả học tập
            const gradesHtml = grades.length
                ? grades.map(item => `
      <div class="student-class-card">
        <p><strong>Lớp:</strong>
          ${escapeHtml(item.className || 'Chưa có')}
        </p>
        <p><strong>Môn học:</strong>
          ${escapeHtml(item.subject || 'Chưa có')}
        </p>
        <p><strong>Học kỳ:</strong>
          ${escapeHtml(item.term || 'Chưa có')}
        </p>
        <p><strong>Điểm:</strong>
          ${escapeHtml(item.score ?? 'Chưa có')}
          /
          ${escapeHtml(item.maxScore ?? 10)}
        </p>
      </div>
    `).join('')
                : '<p>Chưa có dữ liệu điểm số.</p>';

            details.innerHTML = `
        <h3>Thông tin học viên</h3>
        <p><strong>Họ tên:</strong> ${escapeHtml(student.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(student.email)}</p>
        <p><strong>Số điện thoại:</strong> ${escapeHtml(student.phone || 'Chưa có')}</p>

        <button type="button" id="btn-edit-student">
  ✏️ Chỉnh sửa hồ sơ
</button>
      
         <h3>Lớp đang học</h3>
         ${classListHtml}

         <h3>Lịch sử ghi danh</h3>
         ${historyListHtml}
         <h3>Quá trình điểm danh</h3>
         ${attendanceHtml}

         <h3>Kết quả học tập</h3>
         ${gradesHtml}
      `;
        } catch (error) {
            details.textContent =
                error.message || 'Không thể tải hồ sơ học viên.';
        }
    }


    // DNKN-175: Mở form chỉnh sửa hồ sơ học viên
    details.addEventListener('click', (event) => {
        const editButton = event.target.closest('#btn-edit-student');

        if (!editButton || !selectedStudent) return;

        const student = selectedStudent.student;

        details.innerHTML = `
    <h3>Chỉnh sửa hồ sơ học viên</h3>

    <form id="student-edit-form">
      <label for="student-edit-name">Họ và tên</label>
      <input
        id="student-edit-name"
        name="name"
        type="text"
        value="${escapeHtml(student.name)}"
        required
        minlength="2"
        maxlength="120"
      >

      <label for="student-edit-email">Email (chỉ xem)</label>
      <input
        id="student-edit-email"
        type="email"
        value="${escapeHtml(student.email)}"
        disabled
      >

      <label for="student-edit-phone">Số điện thoại</label>
      <input
        id="student-edit-phone"
        name="phone"
        type="tel"
        value="${escapeHtml(student.phone || '')}"
        maxlength="32"
      >

      <label for="student-edit-dob">Ngày sinh</label>
      <input
        id="student-edit-dob"
        name="dateOfBirth"
        type="date"
        value="${escapeHtml(student.dateOfBirth || student.dob || '')}"
      >

      <label for="student-edit-address">Địa chỉ</label>
      <textarea
        id="student-edit-address"
        name="address"
        maxlength="255"
        rows="3"
      >${escapeHtml(student.address || '')}</textarea>

      <label for="student-edit-level">Trình độ đầu vào</label>
<input
  id="student-edit-level"
  name="entryLevel"
  type="text"
  maxlength="100"
  value="${escapeHtml(selectedStudent.extra?.entryLevel || '')}"
  placeholder="Nhập trình độ đầu vào"
/>

<label for="student-edit-notes">Ghi chú học viên</label>
<textarea
  id="student-edit-notes"
  name="notes"
  maxlength="1000"
  rows="4"
  placeholder="Nhập ghi chú về học viên"
>${escapeHtml(selectedStudent.extra?.notes || '')}</textarea>

      <div class="student-edit-actions">
        <button type="button" id="btn-cancel-student">
          Hủy
        </button>

        <button type="submit" id="btn-save-student">
          Lưu thay đổi
        </button>
      </div>

      <p id="student-edit-feedback" role="status"></p>
    </form>
  `;
    });
    // DNKN-175: Hủy chỉnh sửa
    details.addEventListener('click', async (event) => {
        if (!event.target.closest('#btn-cancel-student')) return;

        if (selectedStudent?.student?.id) {
            await showStudentProfile(selectedStudent.student.id);
        }
    });

    // DNKN-175: Lưu thông tin học viên
    details.addEventListener('submit', async (event) => {
        if (event.target.id !== 'student-edit-form') return;

        event.preventDefault();

        const form = event.target;
        const saveButton = form.querySelector('#btn-save-student');
        const feedback = form.querySelector('#student-edit-feedback');

        const formData = new FormData(form);

        const payload = {
            name: String(formData.get('name') || '').trim(),
            phone: String(formData.get('phone') || '').trim(),
            dateOfBirth: String(formData.get('dateOfBirth') || ''),
            address: String(formData.get('address') || '').trim()
        };

        const extraPayload = {
            entryLevel: String(formData.get('entryLevel') || '').trim(),
            notes: String(formData.get('notes') || '').trim()
        };

        if (payload.name.length < 2 || payload.name.length > 120) {
            feedback.textContent = 'Họ tên phải có từ 2 đến 120 ký tự.';
            return;
        }

        const studentId = selectedStudent?.student?.id;

        if (!studentId) {
            feedback.textContent = 'Không xác định được học viên.';
            return;
        }

        saveButton.disabled = true;
        feedback.textContent = 'Đang lưu...';

        try {
            const token = getAuthSession().token;

            await request(
                `/student-profiles/${encodeURIComponent(studentId)}`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                }
            );

            await request(
                `/student-profiles/${encodeURIComponent(studentId)}/extra`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(extraPayload)
                }
            );

            await loadStudents();
            await showStudentProfile(studentId);

        } catch (error) {
            feedback.textContent =
                error.message || 'Không thể cập nhật hồ sơ học viên.';
            saveButton.disabled = false;
        }
    });

    search.addEventListener('input', () => {
        renderList(search.value.trim());
    });

    list.addEventListener('click', event => {
        const button = event.target.closest('[data-student-id]');

        if (button) {
            showStudentProfile(button.dataset.studentId);
        }
    });

    loadStudents();
}
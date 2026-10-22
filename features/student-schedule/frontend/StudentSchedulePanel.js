
import './StudentSchedulePanel.css';
import { getAuthSession } from '../../../src/core/storage.js';

// DNKN-243: Giao diện lịch học cá nhân
export function renderStudentSchedulePanel(container) {
    container.replaceChildren();

    const root = document.createElement('section');
    root.className = 'student-schedule-panel';

    root.innerHTML = `
    <div class="student-schedule-header">
      <div>
        <h2>Lịch học cá nhân</h2>
        <p>Xem buổi học kế tiếp và lịch học trong tuần.</p>
      </div>
      <button type="button" class="schedule-refresh">
        Tải lại lịch
      </button>
    </div>
    <div class="schedule-status" role="status" aria-live="polite"></div>
    <div class="schedule-content" hidden>
      <h3>Buổi học kế tiếp</h3>
      <div class="schedule-next"></div>
      <h3>Lịch học trong tuần</h3>
      <div class="schedule-week"></div>
    </div>
  `;

    container.append(root);

    const status = root.querySelector('.schedule-status');
    const content = root.querySelector('.schedule-content');
    const nextBox = root.querySelector('.schedule-next');
    const weekBox = root.querySelector('.schedule-week');
    const refreshButton = root.querySelector('.schedule-refresh');

    function formatDate(value) {
        if (!value) return '';
        const date = new Date(`${value}T12:00:00`);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleDateString('vi-VN', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    function fixVietnameseText(value) {
        const text = String(value || '');

        // Ưu tiên mã lớp để sửa các tên đã xác định
        const corrections = {
            'Láºp trÃ¬nh Web': 'Lập trình Web',
            'Láºp trÃ¬nh Web': 'Lập trình Web',
            'CÆ¡ sá»Ÿ dá»¯ liá»‡u': 'Cơ sở dữ liệu'
        };

        return corrections[text] || text;
    }

    function createSessionCard(item) {
        const card = document.createElement('article');
        card.className = 'schedule-session-card';

        const title = document.createElement('strong');
        const classNames = {
            'K15-CNTT01': 'Lập trình Web',
            'K15-CNTT02': 'Cơ sở dữ liệu'
        };

        title.textContent =
            classNames[item.classCode] ||
            fixVietnameseText(item.className || 'Buổi học');

        const information = document.createElement('p');
        information.textContent =
            `${formatDate(item.date)} | ${item.startTime || '--:--'} - ${item.endTime || '--:--'}`;

        const details = document.createElement('p');
        details.textContent =
            `Lớp: ${item.classCode || 'Chưa rõ'} | Phòng: ${item.room || 'Chưa cập nhật'}`;

        card.append(title, information, details);
        return card;
    }

    async function loadSchedule() {
        status.textContent = 'Đang tải lịch học...';
        status.className = 'schedule-status';
        content.hidden = true;
        refreshButton.disabled = true;

        try {
            const session = getAuthSession();
            const token = session?.token
                || localStorage.getItem('dnkn_auth_token')
                || sessionStorage.getItem('dnkn_auth_token');

            if (!token) {
                throw new Error('Bạn cần đăng nhập để xem lịch học.');
            }

            const response = await fetch('/api/student-schedule/me', {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json'
                }
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || 'Không thể tải lịch học.'
                );
            }

            const data = result.data || {};
            const weeklySessions = Array.isArray(data.weeklySessions)
                ? data.weeklySessions
                : [];

            nextBox.replaceChildren();
            weekBox.replaceChildren();

            if (data.nextSession) {
                nextBox.append(createSessionCard(data.nextSession));
            } else {
                const emptyNext = document.createElement('p');
                emptyNext.textContent = 'Hiện chưa có buổi học kế tiếp.';
                nextBox.append(emptyNext);
            }

            if (weeklySessions.length === 0) {
                const emptyWeek = document.createElement('p');
                emptyWeek.className = 'schedule-empty';
                emptyWeek.textContent =
                    'Bạn không có buổi học nào trong tuần này.';
                weekBox.append(emptyWeek);
            } else {
                const sortedSessions = [...weeklySessions].sort(
                    (a, b) => String(a.startAt).localeCompare(String(b.startAt))
                );

                sortedSessions.forEach(item => {
                    weekBox.append(createSessionCard(item));
                });
            }

            status.textContent = 'Đã tải lịch học thành công.';
            status.className = 'schedule-status is-success';
            content.hidden = false;

        } catch (error) {
            status.textContent =
                error.message || 'Đã xảy ra lỗi khi tải lịch học.';
            status.className = 'schedule-status is-error';
            content.hidden = true;
        } finally {
            refreshButton.disabled = false;
        }
    }

    refreshButton.addEventListener('click', loadSchedule);
    loadSchedule();
}

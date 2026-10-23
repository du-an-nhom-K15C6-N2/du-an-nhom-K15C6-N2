import { request } from './authService.js';
import { getAuthSession } from './storage.js';

function authHeaders() {
  const token = getAuthSession().token;
  if (!token) {
    const error = new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    error.code = 'SESSION_EXPIRED';
    window.dispatchEvent(new CustomEvent('auth:session-expired'));
    throw error;
  }
  return { Authorization: `Bearer ${token}` };
}

/**
 * Lấy dữ liệu thời khóa biểu theo chế độ tuần/tháng và các bộ lọc
 */
export async function getTimetable(params = {}) {
  const query = new URLSearchParams();
  if (params.view) query.set('view', params.view);
  if (params.date) query.set('date', params.date);
  if (params.classId) query.set('classId', params.classId);
  if (params.teacherId) query.set('teacherId', params.teacherId);
  if (params.room) query.set('room', params.room);

  const url = `/timetable?${query.toString()}`;
  const response = await request(url, { headers: authHeaders() });

  if (!response?.success || !response.data) {
    throw new Error(response?.message || 'Không thể tải dữ liệu thời khoá biểu.');
  }

  return response.data;
}

/**
 * Lấy chi tiết buổi học khi bấm vào ô lịch
 */
export async function getSessionDetail(id) {
  if (!id) throw new Error('Mã buổi học không hợp lệ.');

  const response = await request(`/timetable/sessions/${encodeURIComponent(id)}`, {
    headers: authHeaders()
  });

  if (!response?.success || !response.data) {
    throw new Error(response?.message || 'Không thể tải chi tiết buổi học.');
  }

  return response.data;
}

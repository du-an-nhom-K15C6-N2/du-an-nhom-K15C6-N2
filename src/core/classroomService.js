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

export async function getClassrooms() {
  const response = await request('/classrooms', { headers: authHeaders() });
  if (!response?.success || !Array.isArray(response.data)) {
    throw new Error('Máy chủ trả về danh sách phòng học không hợp lệ.');
  }
  return response.data;
}

export async function saveClassroom(room, id = '') {
  const response = await request(id ? `/classrooms/${encodeURIComponent(id)}` : '/classrooms', {
    method: id ? 'PUT' : 'POST',
    headers: authHeaders(),
    body: JSON.stringify(room)
  });
  if (!response?.success || !response.data?.id) {
    throw new Error(response?.message || 'Không thể lưu phòng học.');
  }
  return response.data;
}

export async function assignClassroom(classId, roomId) {
  const response = await request(`/classes/${encodeURIComponent(classId)}/room`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ roomId: roomId || null })
  });
  if (!response?.success || !response.data?.id) {
    throw new Error(response?.message || 'Không thể phân công phòng cho lớp.');
  }
  return response.data;
}

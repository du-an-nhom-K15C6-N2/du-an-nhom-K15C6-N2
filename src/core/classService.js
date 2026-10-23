import { request } from './authService.js';
import { getAuthSession } from './storage.js';

export async function getClasses() {
  const token = getAuthSession().token;
  if (!token) {
    const error = new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    error.code = 'SESSION_EXPIRED';
    window.dispatchEvent(new CustomEvent('auth:session-expired'));
    throw error;
  }

  const response = await request('/classes', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response?.success || !Array.isArray(response.data)) {
    throw new Error('Máy chủ trả về danh sách lớp học không hợp lệ.');
  }
  return response.data;
}

import { request } from './authService.js';
import { getAuthSession } from './storage.js';

export async function getDashboardSummary() {
  const token = getAuthSession().token;
  if (!token) {
    const error = new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    error.code = 'SESSION_EXPIRED';
    window.dispatchEvent(new CustomEvent('auth:session-expired'));
    throw error;
  }

  const response = await request('/dashboard/summary', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response?.success || !response.data) {
    throw new Error('Máy chủ trả về dữ liệu tổng quan không hợp lệ.');
  }
  return response.data;
}

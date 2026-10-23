import { request } from './authService.js';
import { getAuthSession } from './storage.js';

const FILTER_KEYS = ['status', 'programId', 'teacherId', 'startDate', 'endDate'];

export async function getClassList(filters = {}) {
  const token = getAuthSession().token;
  if (!token) {
    const error = new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    error.code = 'SESSION_EXPIRED';
    window.dispatchEvent(new CustomEvent('auth:session-expired'));
    throw error;
  }

  const params = new URLSearchParams();
  FILTER_KEYS.forEach(key => {
    if (filters[key]) params.set(key, filters[key]);
  });
  const query = params.toString();
  const response = await request(`/classes${query ? `?${query}` : ''}`, {
    headers: { Authorization: ['Bearer', token].join(' ') }
  });

  if (
    !response?.success
    || !Array.isArray(response.data)
    || !response.filterOptions
    || !Array.isArray(response.filterOptions.programs)
    || !Array.isArray(response.filterOptions.teachers)
  ) {
    throw new Error('Máy chủ trả về dữ liệu danh sách lớp học không hợp lệ.');
  }
  return response;
}

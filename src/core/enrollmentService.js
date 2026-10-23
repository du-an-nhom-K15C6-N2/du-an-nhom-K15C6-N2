import { request } from './authService.js';
import { getAuthSession } from './storage.js';

function getToken() {
  const token = getAuthSession().token;
  if (!token) {
    const error = new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    error.code = 'SESSION_EXPIRED';
    window.dispatchEvent(new CustomEvent('auth:session-expired'));
    throw error;
  }
  return token;
}

function authHeaders() {
  return { Authorization: ['Bearer', getToken()].join(' ') };
}

export async function getEnrollmentOptions() {
  const response = await request('/enrollments/options', {
    headers: authHeaders()
  });
  if (
    !response?.success
    || !Array.isArray(response.data?.classes)
    || !Array.isArray(response.data?.students)
  ) {
    throw new Error('Máy chủ trả về dữ liệu ghi danh không hợp lệ.');
  }
  return response.data;
}

export async function submitEnrollment(classId, studentIds) {
  const response = await request('/enrollments/bulk', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ classId, studentIds })
  });
  if (!response?.success || !Array.isArray(response.data?.results)) {
    throw new Error('Máy chủ trả về kết quả ghi danh không hợp lệ.');
  }
  return response.data;
}

export async function getEnrollmentHistory() {
  const response = await request('/enrollments/history', {
    headers: authHeaders()
  });
  if (!response?.success || !Array.isArray(response.data)) {
    throw new Error('Máy chủ trả về lịch sử ghi danh không hợp lệ.');
  }
  return response.data;
}

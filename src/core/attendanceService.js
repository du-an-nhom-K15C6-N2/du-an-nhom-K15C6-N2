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

export async function getAttendanceRecords() {
  const data = await request('/attendance', {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  return data.data;
}

export async function getAttendanceStudents() {
  const data = await request('/attendance/students', {
    headers: { Authorization: ['Bearer', getToken()].join(' ') }
  });
  return data.data;
}

export async function createAttendanceRecord(record) {
  const data = await request('/attendance', {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(record)
  });
  return data.data;
}

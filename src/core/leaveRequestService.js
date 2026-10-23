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

export async function getMyLeaveRequests() {
  const res = await request('/leave-requests/my-requests', {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  return res.data;
}

export async function createLeaveRequest(data) {
  const res = await request('/leave-requests', {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(data)
  });
  return res;
}

export async function cancelLeaveRequest(id) {
  const res = await request(`/leave-requests/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  return res;
}

export async function getAllLeaveRequests(params = {}) {
  const query = new URLSearchParams();
  if (params.classId) query.set('classId', params.classId);
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);

  const res = await request(`/leave-requests${query.toString() ? `?${query.toString()}` : ''}`, {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  return res.data;
}

export async function reviewLeaveRequest(id, { status, reviewNote }) {
  const res = await request(`/leave-requests/${id}/review`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ status, reviewNote })
  });
  return res;
}

export async function getLeaveOptions(classId = '') {
  const query = classId ? `?classId=${encodeURIComponent(classId)}` : '';
  const res = await request(`/leave-requests/options${query}`, {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  return res.data;
}

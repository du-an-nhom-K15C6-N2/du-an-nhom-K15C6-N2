/**
 * DNKN-179: Service kết nối API phân công giảng viên và trợ giảng theo từng môn
 */

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
  return {
    Authorization: `Bearer ${getToken()}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Lấy danh sách tài khoản theo vai trò (DNKN-179)
 */
export async function getUsersByRole(role, status = 'active') {
  const query = new URLSearchParams({ status }).toString();
  const response = await request(`/users/by-role/${encodeURIComponent(role)}?${query}`, {
    headers: authHeaders()
  });
  if (!response?.success || !Array.isArray(response.data)) {
    throw new Error(`Không thể lấy danh sách người dùng vai trò '${role}'.`);
  }
  return response.data;
}

/**
 * Lấy các tùy chọn cho màn hình phân công (Lớp, Môn, Giảng viên, Trợ giảng)
 */
export async function getAssignmentOptions() {
  const response = await request('/assignments/options', {
    headers: authHeaders()
  });
  if (!response?.success || !response.data) {
    throw new Error('Không thể tải dữ liệu tùy chọn phân công từ máy chủ.');
  }
  return response.data;
}

/**
 * Lấy ma trận môn học và phân công của một lớp
 */
export async function getAssignmentsByClass(classId) {
  const response = await request(`/assignments/classes/${encodeURIComponent(classId)}`, {
    headers: authHeaders()
  });
  if (!response?.success || !response.data) {
    throw new Error(`Không thể tải bảng phân công của lớp '${classId}'.`);
  }
  return response.data;
}

/**
 * Lấy toàn bộ danh sách phân công
 */
export async function getAssignments(params = {}) {
  const query = new URLSearchParams();
  if (params.classId) query.set('classId', params.classId);
  if (params.courseId) query.set('courseId', params.courseId);
  if (params.primaryTeacherId) query.set('primaryTeacherId', params.primaryTeacherId);
  if (params.status) query.set('status', params.status);

  const url = `/assignments${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await request(url, {
    headers: authHeaders()
  });
  if (!response?.success || !Array.isArray(response.data)) {
    throw new Error('Không thể tải danh sách phân công.');
  }
  return response.data;
}

/**
 * Tạo phân công mới cho môn trong lớp
 */
export async function createAssignment(payload) {
  const response = await request('/assignments', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  if (!response?.success) {
    const error = new Error(response?.message || 'Phân công giảng dạy thất bại.');
    error.code = response?.code || 'ASSIGNMENT_FAILED';
    throw error;
  }
  return response;
}

/**
 * Cập nhật / Bàn giao phân công môn học
 */
export async function updateAssignment(id, payload) {
  const response = await request(`/assignments/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  if (!response?.success) {
    const error = new Error(response?.message || 'Cập nhật phân công thất bại.');
    error.code = response?.code || 'UPDATE_FAILED';
    throw error;
  }
  return response;
}

/**
 * Hủy phân công môn học trong lớp
 */
export async function deleteAssignment(id) {
  const response = await request(`/assignments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  if (!response?.success) {
    const error = new Error(response?.message || 'Hủy phân công thất bại.');
    error.code = response?.code || 'DELETE_FAILED';
    throw error;
  }
  return response;
}

/**
 * Lấy lịch sử phân công và bàn giao
 */
export async function getAssignmentHistory(params = {}) {
  const query = new URLSearchParams();
  if (params.classId) query.set('classId', params.classId);
  if (params.courseId) query.set('courseId', params.courseId);
  if (params.assignmentId) query.set('assignmentId', params.assignmentId);
  if (params.limit) query.set('limit', String(params.limit));

  const url = `/assignments/history${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await request(url, {
    headers: authHeaders()
  });
  if (!response?.success || !Array.isArray(response.data)) {
    throw new Error('Không thể tải lịch sử phân công.');
  }
  return response.data;
}

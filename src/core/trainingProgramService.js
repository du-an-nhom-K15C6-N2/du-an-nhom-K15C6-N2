/**
 * Frontend Service Client for Training Programs Management
 * Tương tác với backend APIs /api/v1/training-programs
 */

import { request } from './authService.js';
import { getAuthSession } from './storage.js';

function getAuthHeader() {
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
 * Lấy danh sách chương trình đào tạo
 */
export async function getTrainingPrograms({ page = 1, pageSize = 20, search = '', status = 'all', activeOnly = false } = {}) {
  const params = new URLSearchParams();
  if (page) params.set('page', page);
  if (pageSize) params.set('pageSize', pageSize);
  if (search) params.set('search', search);
  if (status && status !== 'all') params.set('status', status);
  if (activeOnly) params.set('activeOnly', 'true');

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await request(`/v1/training-programs${query}`, {
    headers: getAuthHeader()
  });

  return response;
}

/**
 * Lấy chi tiết 1 chương trình đào tạo
 */
export async function getTrainingProgramById(id) {
  const response = await request(`/v1/training-programs/${encodeURIComponent(id)}`, {
    headers: getAuthHeader()
  });
  return response?.data;
}

/**
 * Tạo mới chương trình đào tạo
 */
export async function createTrainingProgram(data) {
  const response = await request('/v1/training-programs', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(data)
  });
  return response?.data;
}

/**
 * Cập nhật thông tin chương trình đào tạo
 */
export async function updateTrainingProgram(id, data) {
  const response = await request(`/v1/training-programs/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAuthHeader(),
    body: JSON.stringify(data)
  });
  return response?.data;
}

/**
 * Cập nhật trạng thái (ACTIVE <-> INACTIVE)
 */
export async function updateTrainingProgramStatus(id, status = null) {
  const response = await request(`/v1/training-programs/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: getAuthHeader(),
    body: JSON.stringify(status ? { status } : {})
  });
  return response?.data;
}

/**
 * Xóa chương trình đào tạo
 */
export async function deleteTrainingProgram(id) {
  const response = await request(`/v1/training-programs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeader()
  });
  return response;
}

/**
 * Lấy danh sách chương trình đang ACTIVE để mở lớp mới
 */
export async function getActiveTrainingPrograms() {
  const response = await request('/v1/training-programs/active-options', {
    headers: getAuthHeader()
  });
  return response?.data || [];
}

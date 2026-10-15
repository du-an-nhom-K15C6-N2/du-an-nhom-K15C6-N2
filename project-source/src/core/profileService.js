/**
 * Service giao tiếp API và xử lý nghiệp vụ Hồ sơ cá nhân phía Client
 */

import { request } from './authService.js';
import { validateVietnamesePhone, validateProfileForm } from './validation.js';

/**
 * [FE] Gọi API lấy thông tin hồ sơ cá nhân hiện tại
 * @param {string} token
 * @returns {Promise<any>}
 */
export async function getProfileApi(token) {
  const data = await request('/profile', {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  return data?.data || data?.user;
}

/**
 * [FE] Gọi API cập nhật thông tin hồ sơ cá nhân
 * @param {string} token
 * @param {{ name: string, phone: string, dateOfBirth?: string, address?: string }} profileData
 * @returns {Promise<any>}
 */
export async function updateProfileApi(token, profileData) {
  const data = await request('/profile', {
    method: 'PUT',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(profileData)
  });
  return data?.data || data?.user;
}

/**
 * Định dạng ngày YYYY-MM-DD sang định dạng hiển thị tiếng Việt DD/MM/YYYY
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDisplayDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '-';
  const trimmed = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const [year, month, day] = trimmed.split('-');
  return `${day}/${month}/${year}`;
}

export { validateVietnamesePhone, validateProfileForm };

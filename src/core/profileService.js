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
// DNKN87: Gửi ảnh đại diện lên Backend
export async function uploadAvatarApi(token, file) {
  if (!file || !['image/jpeg', 'image/png'].includes(file.type)) {
    throw new Error('Vui lòng chọn ảnh JPG hoặc PNG.');
  }

  if (file.size > 2 * 1024 * 1024) {
    throw new Error('Ảnh không được vượt quá 2 MB.');
  }

  const formData = new FormData();
  formData.append('avatar', file);

  const data = await request('/profile/avatar', {
    method: 'POST',
    headers: token
      ? { Authorization: `Bearer ${token}` }
      : {},
    body: formData
  });

  return data.data;
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

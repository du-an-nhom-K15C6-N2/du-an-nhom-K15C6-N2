/**
 * Service gọi API nhập người dùng hàng loạt từ Excel (DNKN-16/17)
 * Kết nối Frontend với các endpoint BE:
 *   GET  /api/users/import/template  - Tải file mẫu
 *   POST /api/users/import/preview   - Xem trước + validate từng dòng
 *   POST /api/users/import/confirm   - Thực hiện import chính thức
 */

import { getAuthSession } from './storage.js';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

function getAuthHeaders() {
  const session = getAuthSession();
  const token = session?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Tải tệp Excel mẫu về máy người dùng
 */
export async function downloadTemplatefile() {
  const response = await fetch(`${API_BASE_URL}/users/import/template`, {
    headers: { ...getAuthHeaders() }
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || `Không thể tải tệp mẫu (HTTP ${response.status}).`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'mau-nhap-nguoi-dung.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Gửi tệp Excel lên server, nhận kết quả xem trước + danh sách lỗi từng dòng
 * @param {File} file - Tệp Excel được chọn
 * @returns {Promise<{totalRows, validCount, invalidCount, skippedCount, validRows, invalidRows, skippedRows}>}
 */
export async function previewExcelImport(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/users/import/preview`, {
    method: 'POST',
    headers: { ...getAuthHeaders() },
    body: formData
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || `Xem trước thất bại (HTTP ${response.status}).`);
  }

  return data.data;
}

/**
 * Xác nhận import danh sách các dòng hợp lệ
 * @param {Array} validRows - Mảng dòng hợp lệ từ bước preview
 * @returns {Promise<{totalSubmitted, successCount, failedCount, successResults, failedResults}>}
 */
export async function confirmExcelImport(validRows) {
  const response = await fetch(`${API_BASE_URL}/users/import/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ rows: validRows })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || `Import thất bại (HTTP ${response.status}).`);
  }

  return data.data;
}

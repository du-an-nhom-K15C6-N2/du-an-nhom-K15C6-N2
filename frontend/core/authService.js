/**
 * Client API Request helper cho Standalone Preview Module DNKN-86
 */

const API_BASE_URL = '/api';

export async function request(path, options = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.message || `Yêu cầu thất bại (HTTP ${response.status}).`);
    error.code = data?.code;
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function loginApi({ email, password }) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

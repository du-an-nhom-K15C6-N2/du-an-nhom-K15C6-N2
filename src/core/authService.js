const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

export async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const isLoginRequest = path === '/auth/login';
    const isExpiredSession = response.status === 401
      && !isLoginRequest
      && path !== '/auth/logout';
    const error = new Error(
      isLoginRequest && response.status === 401
        ? data?.message || 'Email hoặc mật khẩu không đúng'
        : data?.message || `Yêu cầu thất bại (HTTP ${response.status}).`
    );
    error.code = isExpiredSession ? 'SESSION_EXPIRED' : data?.code;
    const retryAfterSeconds = Number(data?.retryAfterSeconds || response.headers.get('Retry-After'));
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      error.retryAfterSeconds = retryAfterSeconds;
    }
    if (isExpiredSession) {
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    }
    throw error;
  }

  return data;
}

export async function loginApi({ email, password }) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  if (!data?.token || !data?.user || !data?.user?.role) {
    throw new Error('Máy chủ trả về dữ liệu đăng nhập không hợp lệ.');
  }

  return {
    success: true,
    token: data.token,
    user: data.user,
    role: data.user.role
  };
}

export async function getCurrentUser(token) {
  const data = await request('/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data.user;
}

export async function changePasswordApi(token, currentPassword, newPassword) {
  return request('/auth/change-password', {
    method: 'PATCH',
    headers: { Authorization: ['Bearer', token].join(' ') },
    body: JSON.stringify({ currentPassword, newPassword })
  });
}

export async function refreshSessionApi(token) {
  const data = await request('/auth/refresh', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!data?.token) {
    throw new Error('Máy chủ không trả về phiên đăng nhập được gia hạn hợp lệ.');
  }

  return data.token;
}

export async function logoutApi(token) {
  return request('/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
}

(async function activateAccount() {
  const message = document.getElementById('activation-message');
  const loginLink = document.getElementById('activation-login-link');
  const token = new URLSearchParams(window.location.search).get('token');

  if (!token) {
    message.textContent = 'Liên kết kích hoạt không hợp lệ hoặc đã hết hạn.';
    return;
  }

  try {
    const response = await fetch('/api/users/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Không thể kích hoạt tài khoản.');
    message.textContent = result.message;
    loginLink.hidden = false;
  } catch (error) {
    message.textContent = error.message || 'Không thể kết nối đến máy chủ.';
  }
}());

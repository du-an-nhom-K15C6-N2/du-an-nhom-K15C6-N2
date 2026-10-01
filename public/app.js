const requestView = document.querySelector('#request-view');
const resetView = document.querySelector('#reset-view');
const resultView = document.querySelector('#result-view');
const requestForm = document.querySelector('#request-form');
const resetForm = document.querySelector('#reset-form');
const requestStatus = document.querySelector('#request-status');
const resetStatus = document.querySelector('#reset-status');
const workspace = document.querySelector('.workspace');
const resetToken = new URLSearchParams(window.location.hash.slice(1)).get('token')
  || new URLSearchParams(window.location.search).get('token');

if (resetToken) {
  window.history.replaceState(null, '', window.location.pathname);
  workspace.setAttribute('aria-labelledby', 'form-title-reset');
  resetView.hidden = false;
} else {
  requestView.hidden = false;
}

function showResult(title, message) {
  requestView.hidden = true;
  resetView.hidden = true;
  resultView.hidden = false;
  workspace.setAttribute('aria-labelledby', 'result-title');
  document.querySelector('#result-title').textContent = title;
  document.querySelector('#result-message').textContent = message;
}

function setFormBusy(form, busy) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
}

requestForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  requestStatus.textContent = '';
  requestStatus.removeAttribute('data-error');
  if (!requestForm.reportValidity()) return;

  setFormBusy(requestForm, true);
  const buttonLabel = requestForm.querySelector('.primary-button span:first-child');
  buttonLabel.textContent = 'Đang gửi...';

  try {
    const response = await fetch('/api/password-reset-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: requestForm.email.value }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Không thể gửi yêu cầu lúc này.');
    showResult('Kiểm tra hộp thư', result.message);
  } catch (error) {
    requestStatus.textContent = error.message || 'Không thể kết nối. Vui lòng thử lại.';
    requestStatus.dataset.error = 'true';
  } finally {
    setFormBusy(requestForm, false);
    buttonLabel.textContent = 'Gửi liên kết đặt lại';
  }
});

resetForm.querySelector('[data-toggle="password"]').addEventListener('click', (event) => {
  const password = resetForm.password;
  const visible = password.type === 'password';
  password.type = visible ? 'text' : 'password';
  resetForm.querySelector('#password-confirm').type = visible ? 'text' : 'password';
  event.currentTarget.textContent = visible ? 'Ẩn' : 'Hiện';
  event.currentTarget.setAttribute('aria-label', `${visible ? 'Ẩn' : 'Hiện'} mật khẩu`);
});

resetForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  resetStatus.textContent = '';
  resetStatus.removeAttribute('data-error');

  const password = resetForm.password.value;
  const confirmation = resetForm.querySelector('#password-confirm').value;
  if (!resetForm.reportValidity()) return;
  if (password !== confirmation) {
    resetStatus.textContent = 'Hai mật khẩu chưa khớp.';
    resetStatus.dataset.error = 'true';
    resetForm.querySelector('#password-confirm').focus();
    return;
  }
  if (!resetToken) {
    resetStatus.textContent = 'Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.';
    resetStatus.dataset.error = 'true';
    return;
  }

  setFormBusy(resetForm, true);
  const buttonLabel = resetForm.querySelector('.primary-button span:first-child');
  buttonLabel.textContent = 'Đang cập nhật...';

  try {
    const response = await fetch('/api/password-resets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, password }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Không thể cập nhật mật khẩu lúc này.');
    showResult('Mật khẩu đã đổi', result.message);
  } catch (error) {
    resetStatus.textContent = error.message || 'Không thể kết nối. Vui lòng thử lại.';
    resetStatus.dataset.error = 'true';
  } finally {
    setFormBusy(resetForm, false);
    buttonLabel.textContent = 'Cập nhật mật khẩu';
  }
});
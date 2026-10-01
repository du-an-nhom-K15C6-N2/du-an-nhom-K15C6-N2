document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errBox = document.getElementById('loginErr');
  errBox.style.display = 'none';

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    setSession(data.token, data.user);
    location.href = '/index.html';
  } catch (err) {
    errBox.textContent = err.message;
    errBox.style.display = 'block';
  }
});

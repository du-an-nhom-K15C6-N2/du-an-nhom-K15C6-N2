/* =========================================================
   Trang đăng nhập: hoạt ảnh nền, floating label, chuyển tiếp
   ========================================================= */
const REMEMBER_KEY = 'dnkn_remember_user';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (id) => document.getElementById(id);
const form = $('loginForm');
const errBox = $('loginErr');
const errMsg = $('loginErrMsg');
const btn = $('btnLogin');
const usernameEl = $('username');
const passwordEl = $('password');

/* ---------- 1. Nền hạt sáng chuyển động (constellation) ---------- */
(function stars() {
  const cv = $('stars');
  if (!cv || reduceMotion) return;
  const ctx = cv.getContext('2d');
  let w, h, dots = [], raf, running = true;

  function resize() {
    const r = cv.parentElement.getBoundingClientRect();
    w = cv.width = r.width;
    h = cv.height = r.height;
    const count = Math.min(70, Math.round((w * h) / 16000));
    dots = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
      r: Math.random() * 1.6 + 0.7,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      d.x += d.vx; d.y += d.vy;
      if (d.x < 0 || d.x > w) d.vx *= -1;
      if (d.y < 0 || d.y > h) d.vy *= -1;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(199,210,254,.75)';
      ctx.fill();
    }
    // nối các điểm gần nhau
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const dx = dots[i].x - dots[j].x, dy = dots[i].y - dots[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist < 118) {
          ctx.beginPath();
          ctx.moveTo(dots[i].x, dots[i].y);
          ctx.lineTo(dots[j].x, dots[j].y);
          ctx.strokeStyle = `rgba(129,140,248,${(1 - dist / 118) * 0.32})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }
    if (running) raf = requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener('resize', resize);
  // tạm dừng khi chuyển tab để tiết kiệm pin
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) draw(); else cancelAnimationFrame(raf);
  });
})();

/* ---------- 2. Hiện / ẩn mật khẩu ---------- */
$('pwToggle').addEventListener('click', () => {
  const showing = passwordEl.type === 'text';
  passwordEl.type = showing ? 'password' : 'text';
  $('eyeOn').style.display = showing ? '' : 'none';
  $('eyeOff').style.display = showing ? 'none' : '';
  $('pwToggle').setAttribute('aria-label', showing ? 'Hiện mật khẩu' : 'Ẩn mật khẩu');
  passwordEl.focus();
});

/* ---------- 3. Cảnh báo Caps Lock ---------- */
function capsCheck(e) {
  if (typeof e.getModifierState !== 'function') return;
  $('capsWarn').classList.toggle('show', e.getModifierState('CapsLock'));
}
passwordEl.addEventListener('keyup', capsCheck);
passwordEl.addEventListener('keydown', capsCheck);
passwordEl.addEventListener('blur', () => $('capsWarn').classList.remove('show'));

/* ---------- 4. Điền nhanh tài khoản dùng thử ---------- */
document.querySelectorAll('.chip[data-u]').forEach((chip) => {
  chip.addEventListener('click', () => {
    usernameEl.value = chip.dataset.u;
    passwordEl.value = chip.dataset.p;
    hideError();
    passwordEl.focus();
  });
});

/* ---------- 5. Ghi nhớ đăng nhập ---------- */
(function restoreRemember() {
  const saved = localStorage.getItem(REMEMBER_KEY);
  if (saved) {
    usernameEl.value = saved;
    $('remember').checked = true;
    passwordEl.focus();
  } else {
    usernameEl.focus();
  }
})();

$('forgot').addEventListener('click', (e) => {
  e.preventDefault();
  toast('Vui lòng liên hệ quản trị hệ thống để cấp lại mật khẩu.', 'error');
});

/* ---------- 6. Gửi form ---------- */
function showError(msg) {
  errMsg.textContent = msg;
  errBox.classList.remove('show');
  void errBox.offsetWidth; // reset hoạt ảnh rung
  errBox.classList.add('show');
}
function hideError() { errBox.classList.remove('show'); }

function setLoading(on) {
  btn.classList.toggle('loading', on);
  btn.disabled = on;
}

let submitting = false;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (submitting) return;

  const username = usernameEl.value.trim();
  const password = passwordEl.value;
  hideError();

  if (!username) { showError('Vui lòng nhập tên đăng nhập.'); usernameEl.focus(); return; }
  if (!password) { showError('Vui lòng nhập mật khẩu.'); passwordEl.focus(); return; }

  submitting = true;
  setLoading(true);

  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      skipAuthRedirect: true,
    });

    setSession(data.token, data.user);

    if ($('remember').checked) localStorage.setItem(REMEMBER_KEY, username);
    else localStorage.removeItem(REMEMBER_KEY);

    // màn hình chuyển tiếp rồi mới vào bảng điều khiển
    const name = (data.user && (data.user.full_name || data.user.username)) || username;
    $('successMsg').textContent = `Xin chào, ${name}!`;
    $('loginSuccess').classList.add('show');
    setTimeout(() => { location.href = '/index.html'; }, reduceMotion ? 150 : 1250);
  } catch (err) {
    setLoading(false);
    submitting = false;
    showError(err.message || 'Đăng nhập không thành công.');
    passwordEl.select();
  }
});

/* xóa thông báo lỗi khi người dùng nhập lại */
[usernameEl, passwordEl].forEach((el) => el.addEventListener('input', hideError));

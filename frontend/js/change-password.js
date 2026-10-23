const form = document.getElementById('changePasswordForm');
const message = document.getElementById('message');


form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const currentPassword =
        document.getElementById('currentPassword').value;

    const newPassword =
        document.getElementById('newPassword').value;

    const confirmPassword =
        document.getElementById('confirmPassword').value;

    message.textContent = '';

    if (newPassword !== confirmPassword) {
        message.textContent = 'Mật khẩu xác nhận không khớp.';
        return;
    }

    const tokenKey = Array.from(
        { length: localStorage.length },
        (_, i) => localStorage.key(i)
    ).find(key => key && key.includes('dkn_auth_token'));

    const token = localStorage.getItem(localStorage.key(7));


    if (!token) {
        message.textContent = 'Bạn chưa đăng nhập.';
        return;
    }

    try {
        const response = await fetch('/api/auth/change-password', {
            method: 'PATCH',

            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },

            body: JSON.stringify({
                currentPassword,
                newPassword
            })
        });

        const data = await response.json();

        message.textContent =
            data.message || 'Không thể xử lý yêu cầu.';

        if (response.ok) {
            form.reset();
        }

    } catch (error) {
        console.error(error);

        message.textContent =
            'Không thể kết nối đến máy chủ.';
    }
});
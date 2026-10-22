'use strict';

(() => {
  const form = document.querySelector('#consultation-form');
  const formMessage = document.querySelector('#form-message');
  const submitButton = document.querySelector('#submit-button');
  const thankYou = document.querySelector('#thank-you');

  function setFieldError(field, message) {
    const errorElement = document.querySelector(`#${field}-error`);
    if (errorElement) errorElement.textContent = message;
    const input = form.elements.namedItem(field);
    if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function validateForm() {
    const name = form.elements.namedItem('name').value.trim();
    const phone = form.elements.namedItem('phone').value.trim();
    const email = form.elements.namedItem('email').value.trim();
    let valid = true;

    setFieldError('name', '');
    setFieldError('phone', '');
    setFieldError('email', '');
    formMessage.textContent = '';

    if (name.length < 2 || name.length > 100) {
      setFieldError('name', 'Vui lòng nhập họ và tên từ 2 đến 100 ký tự.');
      valid = false;
    }
    if (!/^(?:0\d{9}|\+?84\d{9}|0084\d{9})$/u.test(phone.replace(/[\s().-]/gu, ''))) {
      setFieldError('phone', 'Vui lòng nhập số điện thoại Việt Nam hợp lệ.');
      valid = false;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email)) {
      setFieldError('email', 'Vui lòng nhập địa chỉ email hợp lệ.');
      valid = false;
    }
    if (!form.elements.namedItem('consent').checked) {
      formMessage.textContent = 'Vui lòng đồng ý để trung tâm liên hệ tư vấn.';
      valid = false;
    }
    return valid;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!validateForm()) return;

    submitButton.disabled = true;
    submitButton.textContent = 'Đang gửi...';
    formMessage.textContent = '';

    const formData = new FormData(form);
    const payload = {
      ...Object.fromEntries(formData.entries()),
      consent: form.elements.namedItem('consent').checked
    };
    try {
      const response = await fetch('/api/consultation-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result && result.message
          ? result.message
          : `Không thể gửi đăng ký (${response.status}). Vui lòng thử lại.`);
      }
      form.hidden = true;
      thankYou.hidden = false;
      thankYou.focus();
    } catch (error) {
      formMessage.textContent = error.message || 'Không thể gửi đăng ký. Vui lòng thử lại.';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Đăng ký tư vấn';
    }
  });
})();

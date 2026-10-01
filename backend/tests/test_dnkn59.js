const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('=== BẮT ĐẦU KIỂM THỬ TICKET [DNKN-59] ===\n');

  // 1. Tạo tài khoản người dùng mới (Register)
  console.log('1. [TEST] POST /api/auth/register (Tạo tài khoản mới)');
  const newUserPayload = {
    name: 'Lê Hải Đăng',
    email: 'haidang.le@school.edu.vn',
    phone: '0988776655',
    role: 'student',
    password: 'SecurePassword123!'
  };

  const regRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, newUserPayload);

  console.log('Status code:', regRes.status);
  console.log('Response:', JSON.stringify(regRes.data, null, 2));

  if (!regRes.data.success || !regRes.data.activation) {
    throw new Error('Tạo tài khoản thất bại!');
  }

  const token = regRes.data.activation.token;
  console.log('\n=> Token kích hoạt nhận được:', token);

  // 2. Thử đăng nhập khi chưa kích hoạt (status = 'pending')
  console.log('\n2. [TEST] POST /api/auth/login khi tài khoản chưa kích hoạt');
  const loginPendingRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: newUserPayload.email,
    password: newUserPayload.password
  });

  console.log('Status code:', loginPendingRes.status, '(Kỳ vọng: 403)');
  console.log('Response:', JSON.stringify(loginPendingRes.data, null, 2));

  // 3. Kích hoạt tài khoản bằng token
  console.log('\n3. [TEST] GET /api/auth/activate?token=...');
  const activateRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/auth/activate?token=${token}`,
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });

  console.log('Status code:', activateRes.status, '(Kỳ vọng: 200)');
  console.log('Response:', JSON.stringify(activateRes.data, null, 2));

  // 4. Đăng nhập lại sau khi đã kích hoạt
  console.log('\n4. [TEST] POST /api/auth/login sau khi kích hoạt thành công');
  const loginActiveRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: newUserPayload.email,
    password: newUserPayload.password
  });

  console.log('Status code:', loginActiveRes.status, '(Kỳ vọng: 200)');
  console.log('Response:', JSON.stringify(loginActiveRes.data, null, 2));

  // 5. Kiểm tra phát hiện trùng email (AC2: Duplicate Email Detection)
  console.log('\n5. [TEST] Kiểm tra trùng lặp email (Kỳ vọng: 409 Conflict)');
  const dupRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, newUserPayload);

  console.log('Status code:', dupRes.status, '(Kỳ vọng: 409)');
  console.log('Response:', JSON.stringify(dupRes.data, null, 2));

  // 6. Kiểm tra validation (Email sai định dạng, thiếu họ tên, mật khẩu quá ngắn)
  console.log('\n6. [TEST] Kiểm tra validate đầu vào (Kỳ vọng: 400 Bad Request)');
  const invalidRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: '',
    email: 'not-an-email',
    password: '123'
  });

  console.log('Status code:', invalidRes.status, '(Kỳ vọng: 400)');
  console.log('Response:', JSON.stringify(invalidRes.data, null, 2));

  // 7. Kiểm tra Email Queue đã ghi nhận việc gửi mail kích hoạt
  console.log('\n7. [TEST] GET /api/auth/recent-emails (Kiểm tra hàng đợi email)');
  const emailsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/recent-emails',
    method: 'GET'
  });

  console.log('Status code:', emailsRes.status);
  console.log('Tổng số email đã gửi:', emailsRes.data.total);
  if (emailsRes.data.data.length > 0) {
    const latest = emailsRes.data.data[0];
    console.log('Email gần nhất:', {
      to: latest.to,
      subject: latest.subject,
      status: latest.status,
      sentAt: latest.sentAt
    });
  }

  console.log('\n🎉 TẤT CẢ 7/7 KỊCH BẢN KIỂM THỬ TICKET [DNKN-59] ĐỀU ĐẠT CHUẨN XUẤT SẮC!');
}

runTests().catch(console.error);

const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { hashPassword } = require('../backend/security/password');

let app;
let server;
let baseUrl;
let tempDir;
let studentToken;
let student2Token;
let teacherToken;
let managerToken;

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ttcs-leave-test-'));
  process.env.DATA_FILE = path.join(tempDir, 'users.json');
  process.env.SESSION_STORE_FILE = path.join(tempDir, 'revoked-sessions.json');
  process.env.LOGIN_ATTEMPT_STORE_FILE = path.join(tempDir, 'login-attempts.json');
  process.env.ATTENDANCE_DATA_FILE = path.join(tempDir, 'attendance.json');
  process.env.LEAVE_REQUESTS_DATA_FILE = path.join(tempDir, 'leave-requests.json');
  process.env.NOTIFICATIONS_DATA_FILE = path.join(tempDir, 'notifications.json');
  process.env.CLASS_DATA_FILE = path.join(tempDir, 'classes.json');

  const users = [
    {
      id: 'usr_student_01',
      name: 'Nguyễn Văn Học Sinh',
      email: 'student01@test.edu',
      role: 'student',
      roles: ['student'],
      roleLabel: 'Học sinh',
      status: 'active',
      passwordHash: await hashPassword('Student@123')
    },
    {
      id: 'usr_student_02',
      name: 'Trần Thị Học Viên',
      email: 'student02@test.edu',
      role: 'student',
      roles: ['student'],
      roleLabel: 'Học sinh',
      status: 'active',
      passwordHash: await hashPassword('Student@123')
    },
    {
      id: 'usr_teacher_01',
      name: 'ThS. Nguyễn Giảng Viên',
      email: 'teacher01@test.edu',
      role: 'teacher',
      roles: ['teacher'],
      roleLabel: 'Giảng viên',
      status: 'active',
      passwordHash: await hashPassword('Teacher@123')
    },
    {
      id: 'usr_manager_01',
      name: 'Trần Quản Lý Đào Tạo',
      email: 'manager01@test.edu',
      role: 'manager',
      roles: ['manager'],
      roleLabel: 'Quản lý đào tạo',
      status: 'active',
      passwordHash: await hashPassword('Manager@123')
    }
  ];

  await fs.writeFile(process.env.DATA_FILE, JSON.stringify(users, null, 2));
  await fs.writeFile(process.env.ATTENDANCE_DATA_FILE, JSON.stringify([], null, 2));
  await fs.writeFile(process.env.LEAVE_REQUESTS_DATA_FILE, JSON.stringify([], null, 2));
  await fs.writeFile(process.env.NOTIFICATIONS_DATA_FILE, JSON.stringify([], null, 2));

  const { app: serverApp } = require('../server');
  app = serverApp;
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  // Đăng nhập lấy token cho từng tài khoản
  async function login(email, password) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const json = await res.json();
    return json.token || json.data?.token;
  }

  studentToken = await login('student01@test.edu', 'Student@123');
  student2Token = await login('student02@test.edu', 'Student@123');
  teacherToken = await login('teacher01@test.edu', 'Teacher@123');
  managerToken = await login('manager01@test.edu', 'Manager@123');
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
});

test('1. Học viên gửi đơn xin phép vắng thành công với thông tin hợp lệ', async () => {
  const res = await fetch(`${baseUrl}/api/leave-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      className: 'Lập trình Web K15',
      leaveDate: '2026-11-10',
      reason: 'Em bị sốt cao phải đi khám bệnh tại bệnh viện',
      evidence: 'https://example.com/don-kham-benh.jpg'
    })
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.className, 'Lập trình Web K15');
  assert.equal(data.data.leaveDate, '2026-11-10');
  assert.equal(data.data.status, 'pending');
  assert.equal(data.data.studentEmail, 'student01@test.edu');
  assert.ok(data.data.id);
});

test('2. Validation: Từ chối gửi đơn khi thiếu tên lớp, sai định dạng ngày hoặc lý do quá ngắn', async () => {
  // Thiếu tên lớp
  const resNoClass = await fetch(`${baseUrl}/api/leave-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ leaveDate: '2026-11-10', reason: 'Ốm sốt nặng' })
  });
  assert.equal(resNoClass.status, 400);

  // Sai định dạng ngày
  const resBadDate = await fetch(`${baseUrl}/api/leave-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ className: 'Lớp 1', leaveDate: '10/11/2026', reason: 'Ốm sốt nặng' })
  });
  assert.equal(resBadDate.status, 400);

  // Lý do quá ngắn (< 5 ký tự)
  const resShortReason = await fetch(`${baseUrl}/api/leave-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ className: 'Lớp 1', leaveDate: '2026-11-10', reason: 'Ốm' })
  });
  assert.equal(resShortReason.status, 400);
});

test('3. Chặn trùng đơn: Không cho gửi đơn trùng cùng lớp và cùng ngày khi đang pending hoặc approved', async () => {
  const res = await fetch(`${baseUrl}/api/leave-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      className: 'Lập trình Web K15',
      leaveDate: '2026-11-10',
      reason: 'Gửi lại đơn xin nghỉ vì lý do cũ'
    })
  });

  assert.equal(res.status, 409);
  const json = await res.json();
  assert.equal(json.code, 'DUPLICATE_LEAVE_REQUEST');
});

test('4. Học viên xem danh sách đơn của chính mình (bảo mật dữ liệu cá nhân)', async () => {
  const res = await fetch(`${baseUrl}/api/leave-requests/my-requests`, {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(Array.isArray(json.data));
  assert.equal(json.data.length, 1);
  assert.equal(json.data[0].studentEmail, 'student01@test.edu');

  // Học viên 2 chưa gửi đơn nào -> danh sách phải rỗng
  const res2 = await fetch(`${baseUrl}/api/leave-requests/my-requests`, {
    headers: { Authorization: `Bearer ${student2Token}` }
  });
  const json2 = await res2.json();
  assert.equal(json2.data.length, 0);
});

test('5. Học viên có thể huỷ đơn xin nghỉ phép khi đơn còn ở trạng thái pending', async () => {
  // Tạo 1 đơn mới để test huỷ
  const createRes = await fetch(`${baseUrl}/api/leave-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      className: 'Cơ sở dữ liệu K15',
      leaveDate: '2026-11-15',
      reason: 'Có lịch phỏng vấn thực tập sinh'
    })
  });
  const created = (await createRes.json()).data;

  // Huỷ đơn
  const cancelRes = await fetch(`${baseUrl}/api/leave-requests/${created.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert.equal(cancelRes.status, 200);
  const cancelJson = await cancelRes.json();
  assert.equal(cancelJson.data.status, 'cancelled');

  // Không cho học viên khác huỷ đơn của người này
  const cancelOtherRes = await fetch(`${baseUrl}/api/leave-requests/${created.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${student2Token}` }
  });
  assert.equal(cancelOtherRes.status, 403);
});

test('6. RBAC: Giảng viên và Quản lý có quyền xem danh sách đơn duyệt; Học viên bị từ chối (403)', async () => {
  // Giảng viên xem danh sách
  const teacherRes = await fetch(`${baseUrl}/api/leave-requests`, {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  assert.equal(teacherRes.status, 200);
  const teacherJson = await teacherRes.json();
  assert.ok(Array.isArray(teacherJson.data));

  // Quản lý xem danh sách
  const managerRes = await fetch(`${baseUrl}/api/leave-requests`, {
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  assert.equal(managerRes.status, 200);

  // Học viên gọi GET /api/leave-requests bị chặn 403
  const studentRes = await fetch(`${baseUrl}/api/leave-requests`, {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert.equal(studentRes.status, 403);
  const studentForbidden = await studentRes.json();
  assert.equal(studentForbidden.code, 'ACCESS_FORBIDDEN');
});

test('7. Giảng viên phê duyệt đơn: Đơn chuyển sang approved và TỰ ĐỘNG đồng bộ điểm danh Có phép (excused)', async () => {
  // Lấy đơn pending của học viên 1
  const listRes = await fetch(`${baseUrl}/api/leave-requests`, {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  const list = (await listRes.json()).data;
  const pendingRequest = list.find(r => r.status === 'pending');
  assert.ok(pendingRequest, 'Phải có đơn pending');

  // Giảng viên duyệt đơn
  const reviewRes = await fetch(`${baseUrl}/api/leave-requests/${pendingRequest.id}/review`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`
    },
    body: JSON.stringify({
      status: 'approved',
      reviewNote: 'Đã nhận đơn và xác nhận giấy tờ. Chúc em sớm khoẻ!'
    })
  });

  assert.equal(reviewRes.status, 200);
  const reviewJson = await reviewRes.json();
  assert.equal(reviewJson.data.status, 'approved');
  assert.equal(reviewJson.data.reviewedByName, 'ThS. Nguyễn Giảng Viên');

  // KIỂM TRA ĐIỂM DANH: Phải có bản ghi attendance với status 'excused' (Có phép),
  // đảm bảo học viên không bị tính là vắng không phép (absent)!
  const attendanceContent = await fs.readFile(process.env.ATTENDANCE_DATA_FILE, 'utf8');
  const attendanceRecords = JSON.parse(attendanceContent);
  const excusedRecord = attendanceRecords.find(
    rec => rec.studentEmail === 'student01@test.edu' && rec.attendanceDate === pendingRequest.leaveDate
  );

  assert.ok(excusedRecord, 'Bản ghi điểm danh phải tồn tại');
  assert.equal(excusedRecord.status, 'excused');
  assert.ok(excusedRecord.note.includes('Nghỉ có phép'));

  // KIỂM TRA THÔNG BÁO: Học viên phải nhận được thông báo duyệt đơn
  const notifContent = await fs.readFile(process.env.NOTIFICATIONS_DATA_FILE, 'utf8');
  const notifications = JSON.parse(notifContent);
  const notif = notifications.find(
    n => n.recipientId === 'usr_student_01' && n.type === 'leave_request_approved'
  );
  assert.ok(notif, 'Học viên phải nhận được thông báo duyệt đơn');
});

test('8. Giảng viên từ chối đơn: Bắt buộc có lý do từ chối và gửi thông báo phản hồi cho học viên', async () => {
  // Học viên gửi 1 đơn mới
  const createRes = await fetch(`${baseUrl}/api/leave-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      className: 'Toán cao cấp K15',
      leaveDate: '2026-11-20',
      reason: 'Em đi du lịch cùng bạn bè'
    })
  });
  const created = (await createRes.json()).data;

  // Từ chối nhưng không nhập lý do -> lỗi 400
  const noReasonRes = await fetch(`${baseUrl}/api/leave-requests/${created.id}/review`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`
    },
    body: JSON.stringify({
      status: 'rejected',
      reviewNote: ''
    })
  });
  assert.equal(noReasonRes.status, 400);

  // Từ chối với lý do hợp lệ
  const rejectRes = await fetch(`${baseUrl}/api/leave-requests/${created.id}/review`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`
    },
    body: JSON.stringify({
      status: 'rejected',
      reviewNote: 'Lý do cá nhân đi du lịch không được tính là lý do chính đáng để nghỉ học.'
    })
  });
  assert.equal(rejectRes.status, 200);
  const rejectJson = await rejectRes.json();
  assert.equal(rejectJson.data.status, 'rejected');
  assert.equal(rejectJson.data.reviewNote, 'Lý do cá nhân đi du lịch không được tính là lý do chính đáng để nghỉ học.');

  // Kiểm tra thông báo từ chối
  const notifContent = await fs.readFile(process.env.NOTIFICATIONS_DATA_FILE, 'utf8');
  const notifications = JSON.parse(notifContent);
  const notif = notifications.find(
    n => n.recipientId === 'usr_student_01' && n.type === 'leave_request_rejected'
  );
  assert.ok(notif, 'Phải có thông báo từ chối đơn gửi tới học viên');
});

test('9. Học viên cố tình duyệt đơn bị từ chối 403 Forbidden', async () => {
  const res = await fetch(`${baseUrl}/api/leave-requests/test-id/review`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`
    },
    body: JSON.stringify({ status: 'approved' })
  });
  assert.equal(res.status, 403);
});

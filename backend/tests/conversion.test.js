/**
 * [QA] Kiểm thử luồng chuyển lead thành hồ sơ học viên, sinh mã, tạo tài khoản và khóa chỉnh sửa
 * Đáp ứng đầy đủ các subtask của Story DNKN-174
 */

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

let baseUrl;
let server;
let tempDir;

async function api(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  let data;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }
  return { response, data };
}

function jsonRequest(body, method = 'POST') {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'l2s-test-'));

  const leadsFile = path.join(tempDir, 'leads.json');
  const studentsFile = path.join(tempDir, 'students.json');
  const usersFile = path.join(tempDir, 'users.json');
  const sentEmailsFile = path.join(tempDir, 'sent-emails.json');

  process.env.LEADS_DATA_FILE = leadsFile;
  process.env.STUDENTS_DATA_FILE = studentsFile;
  process.env.USERS_DATA_FILE = usersFile;
  process.env.SENT_EMAILS_DATA_FILE = sentEmailsFile;

  // Dữ liệu ban đầu
  const initialLeads = [
    {
      id: 'lead_test_01',
      fullName: 'Phạm Minh Đức',
      phone: '0982345678',
      email: 'duc.pm@gmail.com',
      major: 'Kỹ thuật Phần mềm (CNTT)',
      course: 'Kỹ thuật Phần mềm K15',
      address: 'Số 15 Cầu Giấy, Hà Nội',
      dob: '2005-08-14',
      tuitionFee: 18500000,
      source: 'Hotline Tuyển sinh',
      status: 'closed_won',
      statusLabel: 'Đã chốt',
      isLocked: false
    },
    {
      id: 'lead_test_02',
      fullName: 'Hoàng Thu Trang',
      phone: '0918765432',
      email: 'trang.ht@gmail.com',
      major: 'Khoa học Dữ liệu & AI',
      course: 'Khoa học Dữ liệu K15',
      address: 'Số 88 Giải Phóng, Hà Nội',
      status: 'closed_won',
      statusLabel: 'Đã chốt',
      isLocked: false
    },
    {
      id: 'lead_test_contacted',
      fullName: 'Vũ Tuấn Kiệt',
      phone: '0976543210',
      email: 'kiet.vt@gmail.com',
      major: 'An toàn Thông tin',
      status: 'contacted',
      statusLabel: 'Đang tư vấn',
      isLocked: false
    },
    {
      id: 'lead_test_enrolled',
      fullName: 'Trần Bảo Nam',
      phone: '0934567891',
      email: 'nam.tb@gmail.com',
      status: 'enrolled',
      statusLabel: 'Đã nhập học',
      studentCode: 'HV20260001',
      isLocked: true
    }
  ];

  const initialStudents = [
    {
      id: 'stu_HV20260001',
      studentCode: 'HV20260001',
      leadId: 'lead_test_enrolled',
      fullName: 'Trần Bảo Nam',
      email: 'nam.tb@gmail.com'
    }
  ];

  const initialUsers = [
    {
      id: 'usr_stu_HV20260001',
      studentCode: 'HV20260001',
      email: 'nam.tb@gmail.com',
      role: 'student',
      status: 'active'
    }
  ];

  await fs.writeFile(leadsFile, JSON.stringify(initialLeads, null, 2), 'utf8');
  await fs.writeFile(studentsFile, JSON.stringify(initialStudents, null, 2), 'utf8');
  await fs.writeFile(usersFile, JSON.stringify(initialUsers, null, 2), 'utf8');
  await fs.writeFile(sentEmailsFile, JSON.stringify([], null, 2), 'utf8');

  const app = require('../server');
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
  delete process.env.LEADS_DATA_FILE;
  delete process.env.STUDENTS_DATA_FILE;
  delete process.env.USERS_DATA_FILE;
  delete process.env.SENT_EMAILS_DATA_FILE;
});

// ====================================================================
// NHÓM 1: CHUYỂN ĐỔI LEAD ĐÃ CHỐT SANG HỌC VIÊN & SAO CHÉP DỮ LIỆU
// ====================================================================

test('[BE/QA] POST /api/leads/:id/convert chuyển đổi thành công lead đã chốt sang học viên không cần nhập lại', async () => {
  const result = await api('/api/leads/lead_test_01/convert', { method: 'POST' });

  assert.equal(result.response.status, 201);
  assert.equal(result.data.success, true);
  assert.match(result.data.message, /chuyển đổi thành công/i);

  const student = result.data.data.student;
  // Kiểm tra toàn bộ dữ liệu lead được chuyển nguyên vẹn sang học viên
  assert.equal(student.fullName, 'Phạm Minh Đức');
  assert.equal(student.phone, '0982345678');
  assert.equal(student.email, 'duc.pm@gmail.com');
  assert.equal(student.major, 'Kỹ thuật Phần mềm (CNTT)');
  assert.equal(student.course, 'Kỹ thuật Phần mềm K15');
  assert.equal(student.address, 'Số 15 Cầu Giấy, Hà Nội');
  assert.equal(student.dob, '2005-08-14');
  assert.equal(student.tuitionFee, 18500000);
  assert.equal(student.source, 'Hotline Tuyển sinh');
  assert.equal(student.status, 'enrolled');
});

// ====================================================================
// NHÓM 2: SINH MÃ HỌC VIÊN TỰ ĐỘNG
// ====================================================================

test('[BE/QA] Sinh mã học viên tự động: duy nhất, tăng tuần tự và đúng định dạng HV{YYYY}{XXXX}', async () => {
  // Lần chuyển đổi đầu tiên (lead_test_01) đã sinh mã tiếp theo sau HV20260001 -> phải là HV20260002
  const checkLead1 = await api('/api/leads/lead_test_01');
  assert.equal(checkLead1.data.data.studentCode, 'HV20260002');

  // Chuyển đổi tiếp lead thứ 2 (lead_test_02) -> mã phải tăng tuần tự lên HV20260003
  const result2 = await api('/api/leads/lead_test_02/convert', { method: 'POST' });
  assert.equal(result2.response.status, 201);
  assert.equal(result2.data.data.studentCode, 'HV20260003');

  // Xác thực định dạng mã học viên
  assert.match(result2.data.data.studentCode, /^HV\d{4}\d{4}$/);
});

// ====================================================================
// NHÓM 3: TẠO TÀI KHOẢN ĐĂNG NHẬP CHO HỌC VIÊN
// ====================================================================

test('[BE/QA] Tạo tài khoản người dùng cho học viên: gắn đúng vai trò student và trạng thái active', async () => {
  const result = await api('/api/leads/lead_test_01');
  const studentCode = result.data.data.studentCode;

  const usersContent = await fs.readFile(process.env.USERS_DATA_FILE, 'utf8');
  const users = JSON.parse(usersContent);

  const account = users.find(u => u.studentCode === studentCode);
  assert.ok(account, 'Tài khoản người dùng chưa được tạo trong cơ sở dữ liệu!');
  assert.equal(account.email, 'duc.pm@gmail.com');
  assert.equal(account.role, 'student');
  assert.equal(account.roleLabel, 'Học sinh');
  assert.equal(account.status, 'active');
  assert.ok(account.initialPassword, 'Tài khoản phải được cấp mật khẩu ban đầu!');
});

// ====================================================================
// NHÓM 4: GỬI EMAIL THÔNG BÁO TÀI KHOẢN HỌC VIÊN
// ====================================================================

test('[BE/QA] Gửi email thông báo tài khoản học viên và đường dẫn đăng nhập ngay sau khi chuyển đổi', async () => {
  const emailLogContent = await fs.readFile(process.env.SENT_EMAILS_DATA_FILE, 'utf8');
  const emails = JSON.parse(emailLogContent);

  const emailRecord = emails.find(e => e.to === 'duc.pm@gmail.com');
  assert.ok(emailRecord, 'Email thông báo chưa được gửi đến học viên!');
  assert.equal(emailRecord.studentCode, 'HV20260002');
  assert.match(emailRecord.subject, /thông tin tài khoản/i);
  assert.ok(emailRecord.temporaryPassword, 'Email phải chứa mật khẩu tạm thời!');
  assert.match(emailRecord.contentHtml, /login\.html/);
});

// ====================================================================
// NHÓM 5: CẬP NHẬT TRẠNG THÁI 'ĐÃ NHẬP HỌC' VÀ KHÓA CHỈNH SỬA
// ====================================================================

test('[BE/QA] Lead sau khi chuyển đổi cập nhật sang trạng thái Đã nhập học (enrolled) và khóa chỉnh sửa (isLocked = true)', async () => {
  const leadRes = await api('/api/leads/lead_test_01');
  const lead = leadRes.data.data;

  assert.equal(lead.status, 'enrolled');
  assert.equal(lead.statusLabel, 'Đã nhập học');
  assert.equal(lead.isLocked, true);
  assert.ok(lead.convertedAt, 'Phải lưu thời điểm chuyển đổi!');
  assert.ok(lead.studentId, 'Phải liên kết studentId!');
});

test('[BE/QA] PUT /api/leads/:id từ chối mọi yêu cầu chỉnh sửa lead đã nhập học với mã lỗi LEAD_LOCKED (HTTP 403)', async () => {
  const tryUpdate = await api('/api/leads/lead_test_01', jsonRequest({
    fullName: 'Phạm Minh Đức (Đã Sửa)',
    phone: '0999999999'
  }, 'PUT'));

  assert.equal(tryUpdate.response.status, 403);
  assert.equal(tryUpdate.data.success, false);
  assert.equal(tryUpdate.data.code, 'LEAD_LOCKED');
  assert.match(tryUpdate.data.message, /bị khóa/i);

  // Đảm bảo dữ liệu trong DB không bị thay đổi
  const leadVerify = await api('/api/leads/lead_test_01');
  assert.equal(leadVerify.data.data.fullName, 'Phạm Minh Đức');
});

// ====================================================================
// NHÓM 6: RÀNG BUỘC NGHIỆP VỤ VÀ XỬ LÝ LỖI
// ====================================================================

test('[BE/QA] Từ chối chuyển đổi lead chưa chốt (trạng thái đang tư vấn/mới tiếp nhận) với mã lỗi 400', async () => {
  const result = await api('/api/leads/lead_test_contacted/convert', { method: 'POST' });

  assert.equal(result.response.status, 400);
  assert.equal(result.data.success, false);
  assert.equal(result.data.code, 'INVALID_LEAD_STATUS');
  assert.match(result.data.message, /Đã chốt/i);
});

test('[BE/QA] Từ chối chuyển đổi lead đã nhập học trước đó (ngăn chặn chuyển đổi lặp lại) với mã 400', async () => {
  const result = await api('/api/leads/lead_test_enrolled/convert', { method: 'POST' });

  assert.equal(result.response.status, 400);
  assert.equal(result.data.success, false);
  assert.equal(result.data.code, 'LEAD_ALREADY_ENROLLED');
});

test('[BE/QA] Từ chối chuyển đổi khi không tìm thấy lead (HTTP 404)', async () => {
  const result = await api('/api/leads/lead_non_exist/convert', { method: 'POST' });

  assert.equal(result.response.status, 404);
  assert.equal(result.data.code, 'LEAD_NOT_FOUND');
});

test('[BE/QA] GET /api/students trả về danh sách học viên đầy đủ và chính xác', async () => {
  const result = await api('/api/students');

  assert.equal(result.response.status, 200);
  assert.equal(result.data.success, true);
  assert.ok(result.data.count >= 3);
  const student = result.data.data.find(s => s.studentCode === 'HV20260002');
  assert.ok(student);
  assert.equal(student.fullName, 'Phạm Minh Đức');
});

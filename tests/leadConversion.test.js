const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, beforeEach, describe, it } = require('node:test');
const express = require('express');

// Thiết lập thư mục dữ liệu tạm cho test
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-lead-conversion-'));
const testLeadsFile = path.join(temporaryDirectory, 'consultation-leads.json');
const testUsersFile = path.join(temporaryDirectory, 'users.json');
const testStudentsFile = path.join(temporaryDirectory, 'students.json');

process.env.CONSULTATION_LEADS_DATA_FILE = testLeadsFile;
process.env.DATA_FILE = testUsersFile;
process.env.STUDENTS_DATA_FILE = testStudentsFile;
process.env.NODE_ENV = 'test';

const { LeadModel, LeadError } = require('../backend/models/leadModel');
const { StudentModel, StudentError } = require('../backend/models/studentModel');
const UserModel = require('../backend/models/userModel');
const { createLeadRouter } = require('../backend/routes/leadRoutes');
const { createStudentRouter } = require('../backend/routes/studentRoutes');

function createApp(role = 'manager') {
  const app = express();
  app.use(express.json());
  const authMiddleware = (req, res, next) => {
    req.user = { id: 'test-admissions-staff', name: 'Tư vấn viên Nguyễn Tuyết', role, roles: [role], status: 'active' };
    next();
  };
  app.use('/api/leads', createLeadRouter({ authenticate: authMiddleware }));
  app.use('/api/students', createStudentRouter({ authenticate: authMiddleware }));
  return app;
}

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('listening', resolve);
  });
  try {
    return await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  }
}

describe('[QA] Kiểm thử luồng chuyển lead thành hồ sơ học viên, sinh mã, tạo tài khoản và khóa chỉnh sửa', () => {
  beforeEach(() => {
    // Khởi tạo file leads mẫu
    fs.writeFileSync(testLeadsFile, JSON.stringify([
      {
        id: 'lead-001',
        name: 'Nguyễn Văn An',
        phone: '0901234567',
        email: 'nguyenvanan@gmail.com',
        source: 'Website',
        programOfInterest: 'Khóa học Lập trình Web Fullstack',
        status: 'Chốt',
        note: 'Đã nộp học phí đợt 1',
        createdAt: '2026-02-01T08:00:00.000Z',
        updatedAt: '2026-02-01T08:00:00.000Z',
        statusHistory: [
          {
            id: 1,
            leadId: 'lead-001',
            fromStatus: 'Đang tư vấn',
            toStatus: 'Chốt',
            changedAt: '2026-02-01T08:00:00.000Z',
            changedBy: 'Tư vấn viên'
          }
        ]
      },
      {
        id: 'lead-002',
        name: 'Trần Thị Bích',
        phone: '0912345678',
        email: null,
        source: 'Facebook',
        programOfInterest: 'Tiếng Anh giao tiếp',
        status: 'Chốt',
        note: 'Chưa có email trong lead',
        createdAt: '2026-02-02T08:00:00.000Z',
        updatedAt: '2026-02-02T08:00:00.000Z',
        statusHistory: []
      },
      {
        id: 'lead-003',
        name: 'Lê Hoàng Nam',
        phone: '0987654321',
        email: 'nam.le@gmail.com',
        source: 'Hotline',
        programOfInterest: 'Data Science Cơ bản',
        status: 'Đang tư vấn', // Chưa chốt
        note: 'Khách đang cân nhắc',
        createdAt: '2026-02-03T08:00:00.000Z',
        updatedAt: '2026-02-03T08:00:00.000Z',
        statusHistory: []
      }
    ], null, 2));

    // Khởi tạo file users rỗng
    fs.writeFileSync(testUsersFile, JSON.stringify([]));

    // Khởi tạo file students rỗng
    fs.writeFileSync(testStudentsFile, JSON.stringify([]));
  });

  after(() => {
    delete process.env.CONSULTATION_LEADS_DATA_FILE;
    delete process.env.DATA_FILE;
    delete process.env.STUDENTS_DATA_FILE;
    try {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    } catch (_) {}
  });

  it('1. [BE] Sinh mã học viên tự động: Đúng định dạng HVYYYYXXXX, duy nhất và tuần tự tăng dần', () => {
    const year = new Date().getFullYear();
    const code1 = StudentModel.generateStudentCode();
    assert.match(code1, new RegExp(`^HV${year}\\d{4}$`));
    assert.equal(code1, `HV${year}0001`);

    // Giả lập lưu học viên với code1
    fs.writeFileSync(testStudentsFile, JSON.stringify([
      { id: 'stu_1', studentCode: code1 }
    ]));

    // Sinh tiếp mã thứ hai
    const code2 = StudentModel.generateStudentCode();
    assert.equal(code2, `HV${year}0002`);

    // Giả lập thêm mã thứ hai
    fs.writeFileSync(testStudentsFile, JSON.stringify([
      { id: 'stu_1', studentCode: code1 },
      { id: 'stu_2', studentCode: code2 }
    ]));

    // Sinh tiếp mã thứ ba
    const code3 = StudentModel.generateStudentCode();
    assert.equal(code3, `HV${year}0003`);
  });

  it('2. [BE] Chuyển lead đã chốt sang hồ sơ học viên: Kế thừa dữ liệu và sinh hồ sơ mới', async () => {
    const result = await StudentModel.convertFromLead('lead-001', {}, 'Tư vấn viên Nguyễn Tuyết');

    // Kiểm tra hồ sơ học viên
    assert.ok(result.student);
    assert.equal(result.student.leadId, 'lead-001');
    assert.equal(result.student.fullName, 'Nguyễn Văn An');
    assert.equal(result.student.phone, '0901234567');
    assert.equal(result.student.email, 'nguyenvanan@gmail.com');
    assert.equal(result.student.course, 'Khóa học Lập trình Web Fullstack');
    assert.equal(result.student.status, 'enrolled');
    assert.equal(result.student.statusLabel, 'Đang học');
    assert.match(result.student.studentCode, /^HV\d{8}$/);
    assert.ok(result.student.userId);

    // Kiểm tra file lưu trữ students.json
    const students = StudentModel.list().items;
    assert.equal(students.length, 1);
    assert.equal(students[0].studentCode, result.student.studentCode);
    assert.equal(students[0].leadId, 'lead-001');
  });

  it('3. [BE] Tạo tài khoản đăng nhập cho học viên và gửi email kích hoạt', async () => {
    const result = await StudentModel.convertFromLead('lead-001', {}, 'Tư vấn viên Nguyễn Tuyết');

    // Kiểm tra tài khoản user được tạo trong hệ thống
    const user = UserModel.findByEmail('nguyenvanan@gmail.com');
    assert.ok(user, 'Tài khoản người dùng phải được tạo trong cơ sở dữ liệu');
    assert.equal(user.name, 'Nguyễn Văn An');
    assert.equal(user.phone, '0901234567');
    assert.equal(user.role, 'student', 'Vai trò chính phải là student');
    assert.deepEqual(user.roles, ['student'], 'Vai trò độc quyền student');
    assert.equal(user.studentCode, result.student.studentCode, 'User phải được gắn mã học viên');
    assert.equal(user.status, 'pending', 'Tài khoản ở trạng thái chờ kích hoạt');
    assert.ok(user.passwordHash, 'Mật khẩu phải được băm bảo mật');
    assert.ok(user.activationTokenHash, 'Phải có token kích hoạt');

    // Kiểm tra thông tin trả về có chứa đường dẫn kích hoạt và mật khẩu tạm
    assert.ok(result.activationUrl);
    assert.ok(result.temporaryPassword);
    assert.ok(result.activationUrl.includes('activate-account.html?token='));

    // Kiểm tra kích hoạt tài khoản bằng token
    const token = result.activationUrl.split('token=')[1];
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const activatedUser = UserModel.activateByToken(tokenHash);
    assert.ok(activatedUser, 'Tài khoản phải kích hoạt thành công');
    assert.equal(activatedUser.status, 'active', 'Trạng thái sau kích hoạt phải là active');
  });

  it('4. [BE] Cập nhật trạng thái lead sang "Đã nhập học" và khóa chỉnh sửa', async () => {
    const result = await StudentModel.convertFromLead('lead-001', {}, 'Tư vấn viên Nguyễn Tuyết');
    const studentCode = result.student.studentCode;

    // Kiểm tra trạng thái lead sau chuyển đổi
    const leadAfter = LeadModel.findById('lead-001');
    assert.equal(leadAfter.status, 'Đã nhập học', 'Lead phải đổi sang trạng thái Đã nhập học');
    assert.equal(leadAfter.isLocked, true, 'Lead phải được đánh dấu đã khóa (isLocked = true)');
    assert.equal(leadAfter.studentCode, studentCode, 'Lead phải lưu mã học viên vừa sinh');
    assert.ok(leadAfter.studentId, 'Lead phải lưu ID hồ sơ học viên');
    assert.ok(leadAfter.enrolledAt, 'Phải ghi nhận thời điểm nhập học');

    // Kiểm tra lịch sử chuyển đổi trạng thái
    const history = LeadModel.getLeadHistory('lead-001');
    assert.equal(history[0].toStatus, 'Đã nhập học');
    assert.equal(history[0].fromStatus, 'Chốt');
    assert.equal(history[0].changedBy, 'Tư vấn viên Nguyễn Tuyết');
    assert.ok(history[0].reason.includes(studentCode));

    // KHÓA 1: Không cho phép sửa dữ liệu lead (LeadModel.update)
    assert.throws(
      () => LeadModel.update('lead-001', { name: 'Tên thay đổi' }),
      err => err instanceof LeadError && err.status === 403 && err.code === 'LEAD_LOCKED'
    );

    // KHÓA 2: Không cho phép đổi trạng thái lead (LeadModel.updateStatus)
    assert.throws(
      () => LeadModel.updateStatus('lead-001', { status: 'Từ chối', reason: 'Học phí' }),
      err => err instanceof LeadError && err.status === 403 && err.code === 'LEAD_LOCKED'
    );

    // KHÓA 3: Không cho phép xóa lead (LeadModel.delete)
    assert.throws(
      () => LeadModel.delete('lead-001'),
      err => err instanceof LeadError && err.status === 403 && err.code === 'LEAD_LOCKED'
    );

    // KHÓA 4: Không cho phép thêm nhật ký chăm sóc (LeadModel.addCareLog)
    assert.throws(
      () => LeadModel.addCareLog('lead-001', { type: 'Gọi điện', content: 'Chăm sóc thêm' }),
      err => err instanceof LeadError && err.status === 403 && err.code === 'LEAD_LOCKED'
    );

    // KHÓA 5: Không cho phép đặt lịch nhắc gọi lại (LeadModel.setReminder)
    assert.throws(
      () => LeadModel.setReminder('lead-001', { reminderAt: new Date(Date.now() + 86400000).toISOString() }),
      err => err instanceof LeadError && err.status === 403 && err.code === 'LEAD_LOCKED'
    );
  });

  it('5. [BE] Xử lý lead chưa có email: Cho phép bổ sung email khi gọi API chuyển đổi', async () => {
    // lead-002 chưa có email ban đầu
    const lead = LeadModel.findById('lead-002');
    assert.equal(lead.email, null);

    // Nếu không cung cấp email khi chuyển đổi -> Báo lỗi 400 MISSING_EMAIL
    await assert.rejects(
      async () => StudentModel.convertFromLead('lead-002', {}),
      err => err.status === 400 && err.code === 'MISSING_EMAIL'
    );

    // Bổ sung email khi chuyển đổi -> Thành công
    const result = await StudentModel.convertFromLead('lead-002', {
      email: 'bich.tran@edu.vn',
      course: 'Tiếng Anh giao tiếp Quốc tế'
    });

    assert.ok(result.student);
    assert.equal(result.student.email, 'bich.tran@edu.vn');
    assert.equal(result.student.course, 'Tiếng Anh giao tiếp Quốc tế');
    assert.equal(result.user.email, 'bich.tran@edu.vn');

    const user = UserModel.findByEmail('bich.tran@edu.vn');
    assert.ok(user);
    assert.equal(user.role, 'student');
  });

  it('6. [Ràng buộc] Từ chối chuyển đổi lead chưa ở trạng thái "Chốt" hoặc đã "Đã nhập học"', async () => {
    // lead-003 đang ở trạng thái 'Đang tư vấn' -> Bị từ chối
    await assert.rejects(
      async () => StudentModel.convertFromLead('lead-003', {}),
      err => err.status === 400 && err.code === 'LEAD_NOT_CLOSED'
    );

    // Chuyển lead-001 thành công lần đầu
    await StudentModel.convertFromLead('lead-001', {});

    // Chuyển đổi lại lần 2 -> Bị từ chối 409 LEAD_ALREADY_ENROLLED
    await assert.rejects(
      async () => StudentModel.convertFromLead('lead-001', {}),
      err => err.status === 409 && err.code === 'LEAD_ALREADY_ENROLLED'
    );
  });

  it('7. [API REST] Endpoint POST /api/leads/:id/convert-to-student và GET /api/students', async () => {
    const app = createApp('manager');
    await withServer(app, async baseUrl => {
      // Gọi API chuyển đổi lead-001
      const res = await fetch(`${baseUrl}/api/leads/lead-001/convert-to-student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: 'Học viên đã đóng học phí đầy đủ'
        })
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(body.data.student);
      assert.match(body.data.student.studentCode, /^HV\d{8}$/);
      assert.equal(body.data.student.fullName, 'Nguyễn Văn An');

      // Kiểm tra API lấy danh sách học viên
      const listRes = await fetch(`${baseUrl}/api/students`);
      assert.equal(listRes.status, 200);
      const listBody = await listRes.json();
      assert.equal(listBody.items.length, 1);
      assert.equal(listBody.items[0].studentCode, body.data.student.studentCode);

      // Kiểm tra API lấy chi tiết học viên theo studentCode
      const detailRes = await fetch(`${baseUrl}/api/students/${body.data.student.studentCode}`);
      assert.equal(detailRes.status, 200);
      const detailBody = await detailRes.json();
      assert.equal(detailBody.data.fullName, 'Nguyễn Văn An');

      // Kiểm tra API GET /api/leads/lead-001/student
      const leadStuRes = await fetch(`${baseUrl}/api/leads/lead-001/student`);
      assert.equal(leadStuRes.status, 200);
      const leadStuBody = await leadStuRes.json();
      assert.equal(leadStuBody.data.studentCode, body.data.student.studentCode);

      // Thử cập nhật lead qua API PUT /api/leads/lead-001 -> Phải bị chặn 403
      const editRes = await fetch(`${baseUrl}/api/leads/lead-001`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Tên mới' })
      });
      assert.equal(editRes.status, 403);
      const editBody = await editRes.json();
      assert.equal(editBody.code, 'LEAD_LOCKED');
    });
  });

  it('8. [RBAC] Học viên không được phép gọi API chuyển đổi lead (403 ACCESS_FORBIDDEN)', async () => {
    const app = createApp('student');
    await withServer(app, async baseUrl => {
      const res = await fetch(`${baseUrl}/api/leads/lead-001/convert-to-student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.code, 'ACCESS_FORBIDDEN');
    });
  });
});

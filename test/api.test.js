const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../backend/server');

let server;
let baseUrl;

before(async () => {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

test('1. GET /api/health - kiểm tra trạng thái hoạt động của hệ thống', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.status, 'OK');
  assert.equal(data.service, 'training-management-api');
  assert.ok(data.timestamp);
});

test('2. GET /api/modules - kiểm tra danh sách các phân hệ đào tạo', async () => {
  const res = await fetch(`${baseUrl}/api/modules`);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(Array.isArray(data.data));
  assert.equal(data.data.length, 10);
  assert.ok(data.data.some(m => m.id === 'programs'));
});

test('3. GET /api/students - lấy danh sách tất cả học viên', async () => {
  const res = await fetch(`${baseUrl}/api/students`);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(Array.isArray(data.data));
  assert.ok(data.data.length >= 2);

  const first = data.data[0];
  assert.ok(first.studentCode);
  assert.ok(first.fullName);
  assert.ok(first.phone);
  assert.ok(Array.isArray(first.currentClasses));
  assert.ok(Array.isArray(first.classHistory));
});

test('4. GET /api/students?search=... - tìm kiếm học viên theo mã, tên và số điện thoại', async () => {
  // Tìm theo mã
  const resByCode = await fetch(`${baseUrl}/api/students?search=HV001`);
  const dataCode = await resByCode.json();
  assert.equal(resByCode.status, 200);
  assert.ok(dataCode.data.some(s => s.studentCode === 'HV001'));

  // Tìm theo tên
  const resByName = await fetch(`${baseUrl}/api/students?search=Binh`);
  const dataName = await resByName.json();
  assert.equal(resByName.status, 200);
  assert.ok(dataName.data.some(s => s.fullName.includes('Binh')));

  // Tìm kiếm không tồn tại
  const resEmpty = await fetch(`${baseUrl}/api/students?search=KhongTonTai9999`);
  const dataEmpty = await resEmpty.json();
  assert.equal(resEmpty.status, 200);
  assert.equal(dataEmpty.data.length, 0);
});

test('5. GET /api/students/:id - xem chi tiết học viên theo ID', async () => {
  const res = await fetch(`${baseUrl}/api/students/1`);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.id, 1);
  assert.ok(data.data.studentCode);
  assert.ok(data.data.currentClasses);
});

test('6. GET /api/students/:id - trả về 404 khi học viên không tồn tại', async () => {
  const res = await fetch(`${baseUrl}/api/students/999999`);
  assert.equal(res.status, 404);

  const data = await res.json();
  assert.equal(data.success, false);
});

test('7. GET /api/students/:id/history - xem lịch sử và quá trình học của học viên', async () => {
  const res = await fetch(`${baseUrl}/api/students/1/history`);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(Array.isArray(data.data.currentClasses));
  assert.ok(Array.isArray(data.data.classHistory));
});

test('8. PUT /api/students/:id - cập nhật thông tin học viên thành công', async () => {
  const updatePayload = {
    fullName: 'Nguyen Van An Cap Nhat',
    phone: '0912345678',
    entryLevel: 'Nang cao',
    notes: 'Ghi chu kiem thu'
  };

  const res = await fetch(`${baseUrl}/api/students/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatePayload)
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.fullName, updatePayload.fullName);
  assert.equal(data.data.entryLevel, updatePayload.entryLevel);
});

test('9. PUT /api/students/:id - validation kiểm tra số điện thoại không hợp lệ', async () => {
  const invalidPayload = {
    fullName: 'Nguyen Van An',
    phone: '12345', // Sai định dạng (phải là 10 số bắt đầu bằng 0)
    entryLevel: 'Co ban',
    notes: ''
  };

  const res = await fetch(`${baseUrl}/api/students/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invalidPayload)
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
});

test('10. PUT /api/students/:id - validation kiểm tra tên rỗng', async () => {
  const invalidPayload = {
    fullName: '   ',
    phone: '0912345678',
    entryLevel: 'Co ban',
    notes: ''
  };

  const res = await fetch(`${baseUrl}/api/students/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invalidPayload)
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
});

test('11. Frontend static files - trang index.html và students.html', async () => {
  const resIndex = await fetch(`${baseUrl}/index.html`);
  assert.equal(resIndex.status, 200);
  const textIndex = await resIndex.text();
  assert.ok(textIndex.includes('EduManager'));

  const resStudents = await fetch(`${baseUrl}/students.html`);
  assert.equal(resStudents.status, 200);
  const textStudents = await resStudents.text();
  assert.ok(textStudents.includes('Quản lý hồ sơ học viên'));
});

test('12. 404 Route - xử lý đường dẫn không tồn tại', async () => {
  const res = await fetch(`${baseUrl}/api/duong-dan-khong-ton-tai`);
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.equal(data.success, false);
});

// ==========================================
// [BE] DNKN-176: Kiểm tra mã lớp duy nhất và trả lỗi rõ ràng khi trùng
// ==========================================

test('13. GET /api/classes - lấy danh sách các lớp học', async () => {
  const res = await fetch(`${baseUrl}/api/classes`);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(Array.isArray(data.data));
  assert.ok(data.data.length >= 3);
});

test('14. POST /api/classes - tạo mới lớp học thành công với mã lớp duy nhất', async () => {
  const uniqueCode = `TEST-CLASS-${Date.now()}`;
  const newClassPayload = {
    classCode: uniqueCode,
    className: 'Lớp Kiểm thử Tự động',
    courseName: 'Kiểm thử phần mềm',
    teacherName: 'ThS. Nguyễn Kiểm Thử',
    schedule: 'Thứ 3, 5 (19:00 - 21:00)',
    room: 'Lab 02',
    maxStudents: 35
  };

  const res = await fetch(`${baseUrl}/api/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newClassPayload)
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.classCode, uniqueCode);
  assert.equal(data.data.className, newClassPayload.className);
  assert.equal(data.message, 'Tạo lớp học mới thành công.');
});

test('15. POST /api/classes - [DNKN-176] Bắt lỗi và thông báo rõ ràng khi mã lớp bị trùng', async () => {
  // Lớp ENG-A1 đã có trong database mẫu
  const duplicatePayload = {
    classCode: 'ENG-A1',
    className: 'Lớp Tiếng Anh Trùng Mã',
    teacherName: 'Giảng viên X'
  };

  const res = await fetch(`${baseUrl}/api/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(duplicatePayload)
  });

  // Kiểm tra mã lỗi trả về là 409 Conflict
  assert.equal(res.status, 409);

  const data = await res.json();
  // Kiểm tra kết quả thất bại và có thông báo lỗi rõ ràng
  assert.equal(data.success, false);
  assert.equal(data.error, 'DUPLICATE_CLASS_CODE');
  assert.equal(data.field, 'classCode');
  assert.ok(data.message.includes('Mã lớp "ENG-A1" đã tồn tại trong hệ thống'));
  assert.ok(data.existingClass);
  assert.equal(data.existingClass.classCode, 'ENG-A1');
});

test('16. POST /api/classes - [DNKN-176] Bắt lỗi trùng mã lớp không phân biệt chữ hoa thường', async () => {
  // Thử tạo mã lớp viết thường 'eng-a1' (đã có 'ENG-A1')
  const lowercaseDuplicatePayload = {
    classCode: 'eng-a1',
    className: 'Lớp Tiếng Anh Viết Thường'
  };

  const res = await fetch(`${baseUrl}/api/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lowercaseDuplicatePayload)
  });

  assert.equal(res.status, 409);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.error, 'DUPLICATE_CLASS_CODE');
  assert.ok(data.message.includes('đã tồn tại trong hệ thống'));
});

test('17. POST /api/classes - validation khi mã lớp bị trống hoặc chỉ có khoảng trắng', async () => {
  const emptyCodePayload = {
    classCode: '   ',
    className: 'Lớp Không Mã'
  };

  const res = await fetch(`${baseUrl}/api/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(emptyCodePayload)
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.error, 'MISSING_CLASS_CODE');
  assert.equal(data.message, 'Mã lớp không được để trống.');
});

test('18. POST /api/classes - validation khi tên lớp bị trống', async () => {
  const emptyNamePayload = {
    classCode: 'NEW-CLASS-CODE',
    className: '   '
  };

  const res = await fetch(`${baseUrl}/api/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(emptyNamePayload)
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.error, 'MISSING_CLASS_NAME');
  assert.equal(data.message, 'Tên lớp học không được để trống.');
});

test('19. GET /api/classes/check/:code - kiểm tra nhanh mã lớp tồn tại theo thời gian thực cho FE', async () => {
  // Kiểm tra mã đã có
  const resExist = await fetch(`${baseUrl}/api/classes/check/ENG-A1`);
  assert.equal(resExist.status, 200);
  const dataExist = await resExist.json();
  assert.equal(dataExist.exists, true);

  // Kiểm tra mã chưa có
  const resAvailable = await fetch(`${baseUrl}/api/classes/check/CHUA-CO-MA-NAY-999`);
  assert.equal(resAvailable.status, 200);
  const dataAvailable = await resAvailable.json();
  assert.equal(dataAvailable.exists, false);
});

test('20. GET /api/classes/:id - xem chi tiết lớp học theo ID', async () => {
  const res = await fetch(`${baseUrl}/api/classes/1`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.id, 1);
  assert.ok(data.data.classCode);
  assert.ok(data.data.className);
});

// ==========================================
// [FE] DNKN-204: Tạo mới lớp học từ chương trình đào tạo & sao chép môn học
// ==========================================

test('21. GET /api/classes/programs - lấy danh sách chương trình đào tạo kèm môn học', async () => {
  const res = await fetch(`${baseUrl}/api/classes/programs`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(Array.isArray(data.data));
  assert.ok(data.data.length >= 4);

  const progWeb = data.data.find(p => p.id === 'PROG-WEB');
  assert.ok(progWeb);
  assert.ok(Array.isArray(progWeb.subjects));
  assert.equal(progWeb.subjects.length, 5);
});

test('22. POST /api/classes từ chương trình - sao chép danh sách môn học thành công', async () => {
  const classCode = `PROG-CLASS-${Date.now()}`;
  const payload = {
    classCode,
    className: 'Lớp Web Kỹ sư K15',
    programId: 'PROG-WEB',
    startDate: '2026-11-01',
    maxStudents: 30,
    studyMode: 'Offline',
    teacherName: 'ThS. Nguyễn Văn A',
    room: 'Lab 03'
  };

  const res = await fetch(`${baseUrl}/api/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.classCode, classCode);
  assert.equal(data.data.programId, 'PROG-WEB');
  assert.equal(data.data.programName, 'Kỹ thuật Phần mềm (Web Fullstack)');
  assert.ok(Array.isArray(data.data.subjects));
  assert.equal(data.data.subjects.length, 5);
  assert.equal(data.data.subjects[0].subjectCode, 'WEB101');
});

// ==========================================
// [BE] DNKN-205: API mở lớp mới từ chương trình đào tạo và sao chép danh sách môn học
// ==========================================

test('23. POST /api/classes/open-from-program - mở lớp mới nhận đủ 5 tham số chính và tự động sao chép môn học', async () => {
  const classCode = `OPEN-PROG-${Date.now()}`;
  // 5 tham số theo đúng mô tả: mã lớp, mã chương trình, ngày khai giảng dự kiến, sĩ số tối đa, hình thức học
  const payload = {
    classCode,
    programId: 'PROG-AI',
    startDate: '2026-12-01',
    maxStudents: 25,
    studyMode: 'Hybrid'
  };

  const res = await fetch(`${baseUrl}/api/classes/open-from-program`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.classCode, classCode);
  assert.equal(data.data.programId, 'PROG-AI');
  assert.equal(data.data.maxStudents, 25);
  assert.equal(data.data.studyMode, 'Hybrid');
  // Kiểm tra tên lớp tự sinh hợp lý
  assert.ok(data.data.className.includes('Khoa học Dữ liệu & Trí tuệ Nhân tạo'));
  // Kiểm tra đã tự động sao chép toàn bộ môn học của chương trình
  assert.ok(Array.isArray(data.data.subjects));
  assert.equal(data.data.subjects.length, 5);
  assert.equal(data.data.subjects[0].subjectCode, 'AI101');
  assert.equal(data.data.subjects[1].subjectCode, 'AI102');
});

test('24. POST /api/classes - hỗ trợ tham số tiếng Việt (maLop, maChuongTrinh, ngayKhaiGiang, siSoToiDa, hinhThucHoc)', async () => {
  const maLop = `VN-PARAM-${Date.now()}`;
  const payload = {
    maLop,
    maChuongTrinh: 'PROG-ENG',
    ngayKhaiGiang: '2026-11-20',
    siSoToiDa: 20,
    hinhThucHoc: 'Online'
  };

  const res = await fetch(`${baseUrl}/api/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.classCode, maLop);
  assert.equal(data.data.programId, 'PROG-ENG');
  assert.equal(data.data.studyMode, 'Online');
  assert.equal(data.data.maxStudents, 20);
  assert.equal(data.data.subjects.length, 4);
  assert.equal(data.data.subjects[0].subjectCode, 'ENG101');
});

test('25. POST /api/classes/open-from-program - báo lỗi 404 khi mã chương trình đào tạo không tồn tại', async () => {
  const payload = {
    classCode: `ERR-PROG-${Date.now()}`,
    programId: 'CHUONG-TRINH-KHONG-TON-TAI-999',
    startDate: '2026-11-01',
    maxStudents: 30,
    studyMode: 'Offline'
  };

  const res = await fetch(`${baseUrl}/api/classes/open-from-program`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  assert.equal(res.status, 404);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.error, 'PROGRAM_NOT_FOUND');
  assert.ok(data.message.includes('Không tìm thấy chương trình đào tạo'));
});

test('26. POST /api/classes/open-from-program - kiểm tra bắt lỗi trùng mã lớp', async () => {
  const duplicatePayload = {
    classCode: 'ENG-A1', // Mã đã có sẵn
    programId: 'PROG-ENG',
    startDate: '2026-11-01',
    maxStudents: 30,
    studyMode: 'Offline'
  };

  const res = await fetch(`${baseUrl}/api/classes/open-from-program`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(duplicatePayload)
  });

  assert.equal(res.status, 409);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.error, 'DUPLICATE_CLASS_CODE');
  assert.ok(data.message.includes('Mã lớp "ENG-A1" đã tồn tại trong hệ thống'));
});

// ==========================================
// [BE] DNKN-206: API lấy danh sách và tra cứu lớp học có phân trang
// ==========================================

test('27. GET /api/classes - phân trang dữ liệu (page & limit)', async () => {
  const res = await fetch(`${baseUrl}/api/classes?page=1&limit=2`);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(Array.isArray(data.data));
  assert.equal(data.data.length, 2); // đúng limit = 2
  assert.ok(data.pagination);
  assert.equal(data.pagination.page, 1);
  assert.equal(data.pagination.limit, 2);
  assert.ok(data.pagination.total >= 4);
  assert.ok(data.pagination.totalPages >= 2);
  assert.equal(data.pagination.hasNextPage, true);
  assert.equal(data.pagination.hasPrevPage, false);
});

test('28. GET /api/classes - tra cứu theo mã lớp (classCode / maLop)', async () => {
  const res = await fetch(`${baseUrl}/api/classes?classCode=ENG-A1`);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.data.length >= 1);
  assert.ok(data.data.every(c => c.classCode.toLowerCase().includes('eng-a1')));
});

test('29. GET /api/classes - tra cứu theo chương trình đào tạo (programId)', async () => {
  const res = await fetch(`${baseUrl}/api/classes?programId=PROG-AI`);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.data.length >= 1);
  assert.ok(data.data.every(c => c.programId === 'PROG-AI' || c.programName.includes('Trí tuệ Nhân tạo')));
});

test('30. GET /api/classes - tra cứu theo trạng thái lớp học (status)', async () => {
  const res = await fetch(`${baseUrl}/api/classes?status=active`);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.data.length >= 1);
  assert.ok(data.data.every(c => c.status === 'active'));
});

test('31. GET /api/classes - tra cứu theo thời gian khai giảng (fromStartDate / toStartDate)', async () => {
  const res = await fetch(`${baseUrl}/api/classes?fromStartDate=2026-01-01`);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.pagination);
  assert.ok(data.pagination.total >= 0);
});

test('32. GET /api/classes - kết hợp nhiều tiêu chí tra cứu đồng thời', async () => {
  const res = await fetch(`${baseUrl}/api/classes?status=active&studyMode=Offline&page=1&limit=5`);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.pagination);
  assert.equal(data.pagination.page, 1);
  assert.ok(data.data.every(c => c.status === 'active' && c.studyMode.toLowerCase() === 'offline'));
});

// ==========================================
// [BE] DNKN-207: Xây dựng quản lý vòng đời lớp học: Chuẩn bị, Đang học, Kết thúc, Huỷ
// ==========================================

test('33. GET /api/classes/lifecycle-rules - lấy danh mục trạng thái và ma trận chuyển đổi hợp lệ', async () => {
  const res = await fetch(`${baseUrl}/api/classes/lifecycle-rules`);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.statuses);
  assert.equal(data.statuses.PLANNING, 'planning');
  assert.equal(data.statuses.IN_PROGRESS, 'in_progress');
  assert.equal(data.statuses.COMPLETED, 'completed');
  assert.equal(data.statuses.CANCELLED, 'cancelled');

  assert.ok(data.validTransitions);
  assert.deepEqual(data.validTransitions.planning, ['in_progress', 'cancelled']);
  assert.deepEqual(data.validTransitions.in_progress, ['completed', 'cancelled']);
  assert.deepEqual(data.validTransitions.completed, []);
  assert.deepEqual(data.validTransitions.cancelled, []);
});

test('34. PATCH /api/classes/:id/status - chuyển đổi hợp lệ: Chuẩn bị -> Đang học', async () => {
  // 1. Tạo một lớp mới ở trạng thái mặc định (planning)
  const code = `LIFE-PLAN-${Date.now()}`;
  const createRes = await fetch(`${baseUrl}/api/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      classCode: code,
      className: 'Lớp Vòng Đời Test 1',
      programId: 'PROG-WEB',
      status: 'planning'
    })
  });
  const created = await createRes.json();
  const classId = created.data.id;
  assert.equal(created.data.status, 'planning');

  // 2. Chuyển sang in_progress (Đang học)
  const patchRes = await fetch(`${baseUrl}/api/classes/${classId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'in_progress',
      reason: 'Lớp bắt đầu khai giảng buổi đầu tiên'
    })
  });

  assert.equal(patchRes.status, 200);
  const data = await patchRes.json();
  assert.equal(data.success, true);
  assert.equal(data.data.status, 'in_progress');
  assert.equal(data.data.statusLabel, 'Đang học');
  assert.equal(data.transition.from, 'planning');
  assert.equal(data.transition.to, 'in_progress');
});

test('35. PATCH /api/classes/:id/status - chuyển đổi hợp lệ: Đang học -> Kết thúc', async () => {
  // 1. Tạo lớp và chuyển sang in_progress
  const code = `LIFE-FINISH-${Date.now()}`;
  const createRes = await fetch(`${baseUrl}/api/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      classCode: code,
      className: 'Lớp Vòng Đời Test 2',
      status: 'in_progress'
    })
  });
  const created = await createRes.json();
  const classId = created.data.id;

  // 2. Chuyển sang completed (Kết thúc)
  const patchRes = await fetch(`${baseUrl}/api/classes/${classId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'completed',
      reason: 'Đã hoàn thành toàn bộ chương trình và thi tốt nghiệp'
    })
  });

  assert.equal(patchRes.status, 200);
  const data = await patchRes.json();
  assert.equal(data.success, true);
  assert.equal(data.data.status, 'completed');
  assert.equal(data.data.statusLabel, 'Kết thúc');
});

test('36. PATCH /api/classes/:id/status - chuyển đổi hợp lệ: Chuẩn bị -> Huỷ', async () => {
  const code = `LIFE-CANCEL-${Date.now()}`;
  const createRes = await fetch(`${baseUrl}/api/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      classCode: code,
      className: 'Lớp Vòng Đời Test 3',
      status: 'planning'
    })
  });
  const created = await createRes.json();
  const classId = created.data.id;

  // Chuyển sang cancelled (Huỷ)
  const patchRes = await fetch(`${baseUrl}/api/classes/${classId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'cancelled',
      reason: 'Không đủ số lượng học viên tối thiểu'
    })
  });

  assert.equal(patchRes.status, 200);
  const data = await patchRes.json();
  assert.equal(data.success, true);
  assert.equal(data.data.status, 'cancelled');
  assert.equal(data.data.statusLabel, 'Huỷ');
});

test('37. PATCH /api/classes/:id/status - CHẶN chuyển đổi không hợp lệ: Chuẩn bị -> Kết thúc', async () => {
  const code = `ERR-JUMP-${Date.now()}`;
  const createRes = await fetch(`${baseUrl}/api/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      classCode: code,
      className: 'Lớp Test Nhảy Cóc',
      status: 'planning'
    })
  });
  const created = await createRes.json();
  const classId = created.data.id;

  // Cố tình chuyển từ planning thẳng sang completed
  const patchRes = await fetch(`${baseUrl}/api/classes/${classId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'completed' })
  });

  assert.equal(patchRes.status, 400);
  const data = await patchRes.json();
  assert.equal(data.success, false);
  assert.equal(data.error, 'INVALID_STATE_TRANSITION');
  assert.equal(data.currentStatus, 'planning');
  assert.equal(data.targetStatus, 'completed');
  assert.ok(data.message.includes('Không thể chuyển trạng thái lớp học từ "Chuẩn bị" sang "Kết thúc"'));
});

test('38. PATCH /api/classes/:id/status - CHẶN chuyển đổi từ lớp đã Kết thúc (completed là trạng thái cuối)', async () => {
  // 1. Tạo lớp và chuyển sang completed
  const code = `ERR-COMP-${Date.now()}`;
  const createRes = await fetch(`${baseUrl}/api/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classCode: code, status: 'in_progress' })
  });
  const created = await createRes.json();
  const classId = created.data.id;

  await fetch(`${baseUrl}/api/classes/${classId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'completed' })
  });

  // 2. Cố tình chuyển ngược từ completed về in_progress hoặc planning
  const invalidRes = await fetch(`${baseUrl}/api/classes/${classId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in_progress' })
  });

  assert.equal(invalidRes.status, 400);
  const data = await invalidRes.json();
  assert.equal(data.success, false);
  assert.equal(data.error, 'INVALID_STATE_TRANSITION');
  assert.ok(data.message.includes('Không thể chuyển trạng thái'));
});

test('39. PATCH /api/classes/:id/status - CHẶN chuyển đổi từ lớp đã Huỷ (cancelled là trạng thái cuối)', async () => {
  const code = `ERR-CANC-${Date.now()}`;
  const createRes = await fetch(`${baseUrl}/api/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classCode: code, status: 'planning' })
  });
  const created = await createRes.json();
  const classId = created.data.id;

  await fetch(`${baseUrl}/api/classes/${classId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'cancelled' })
  });

  // Cố tình chuyển từ cancelled sang in_progress
  const invalidRes = await fetch(`${baseUrl}/api/classes/${classId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in_progress' })
  });

  assert.equal(invalidRes.status, 400);
  const data = await invalidRes.json();
  assert.equal(data.success, false);
  assert.equal(data.error, 'INVALID_STATE_TRANSITION');
});

test('40. PATCH /api/classes/:id/status - CHẶN khi truyền giá trị trạng thái không hợp lệ', async () => {
  const res = await fetch(`${baseUrl}/api/classes/1/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'trang_thai_khong_hop_le_xyz' })
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.error, 'INVALID_STATUS_VALUE');
  assert.ok(data.message.includes('không hợp lệ'));
});

// ==========================================
// [FE] DNKN-208: Màn hình chi tiết và theo dõi trạng thái lớp học
// ==========================================

test('41. [FE] DNKN-208: Frontend static files - màn hình class-detail.html và CSS/JS liên quan', async () => {
  const resDetail = await fetch(`${baseUrl}/class-detail.html`);
  assert.equal(resDetail.status, 200);
  const textDetail = await resDetail.text();
  assert.ok(textDetail.includes('Chi tiết và Theo dõi Trạng thái Lớp học'));
  assert.ok(textDetail.includes('DNKN-208'));
  assert.ok(textDetail.includes('Lifecycle Tracker'));
  assert.ok(textDetail.includes('class-detail.css'));
  assert.ok(textDetail.includes('class-detail.js'));

  const resCss = await fetch(`${baseUrl}/css/class-detail.css`);
  assert.equal(resCss.status, 200);

  const resJs = await fetch(`${baseUrl}/js/class-detail.js`);
  assert.equal(resJs.status, 200);
});

test('42. [FE] DNKN-208: GET /api/classes/:id hỗ trợ tra cứu chi tiết bằng ID và Mã lớp, trả về đầy đủ môn sao chép và ma trận chuyển đổi', async () => {
  // Tạo lớp mới từ chương trình Web
  const testCode = `DETAIL-${Date.now()}`;
  const createRes = await fetch(`${baseUrl}/api/classes/open-from-program`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      classCode: testCode,
      programId: 'PROG-WEB',
      startDate: '2026-11-01',
      maxStudents: 28,
      studyMode: 'Hybrid'
    })
  });

  const created = await createRes.json();
  assert.equal(created.success, true);
  const classId = created.data.id;

  // 1. Tra cứu theo ID số
  const resById = await fetch(`${baseUrl}/api/classes/${classId}`);
  assert.equal(resById.status, 200);
  const dataById = await resById.json();
  assert.equal(dataById.success, true);
  assert.equal(dataById.data.classCode, testCode);
  assert.equal(dataById.data.canonicalStatus, 'planning');
  assert.equal(dataById.data.statusLabel, 'Chuẩn bị');
  assert.deepEqual(dataById.data.allowedTransitions, ['in_progress', 'cancelled']);
  assert.ok(Array.isArray(dataById.data.subjects));
  assert.equal(dataById.data.subjects.length, 5); // PROG-WEB có 5 môn học

  // 2. Tra cứu theo Mã lớp (classCode)
  const resByCode = await fetch(`${baseUrl}/api/classes/${testCode}`);
  assert.equal(resByCode.status, 200);
  const dataByCode = await resByCode.json();
  assert.equal(dataByCode.success, true);
  assert.equal(dataByCode.data.id, classId);
  assert.equal(dataByCode.data.classCode, testCode);
  assert.equal(dataByCode.data.subjects.length, 5);
});

test('43. [FE] DNKN-208: Tích hợp trọn vẹn luồng xem chi tiết và chuyển đổi vòng đời lớp học', async () => {
  const code = `FLOW-${Date.now()}`;
  const createRes = await fetch(`${baseUrl}/api/classes/open-from-program`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      classCode: code,
      programId: 'PROG-ENG',
      startDate: '2026-11-15'
    })
  });
  const created = await createRes.json();
  const classId = created.data.id;

  // Bước 1: Trạng thái ban đầu: Chuẩn bị
  let checkRes = await fetch(`${baseUrl}/api/classes/${classId}`);
  let checkData = await checkRes.json();
  assert.equal(checkData.data.canonicalStatus, 'planning');
  assert.deepEqual(checkData.data.allowedTransitions, ['in_progress', 'cancelled']);

  // Bước 2: Chuyển sang Vào học (in_progress)
  const patchRes = await fetch(`${baseUrl}/api/classes/${classId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'in_progress',
      reason: 'Đã hoàn tất thủ tục và bắt đầu học kỳ'
    })
  });
  assert.equal(patchRes.status, 200);

  // Bước 3: Đọc lại chi tiết lớp sau khi chuyển đổi: Thấy allowedTransitions mới
  checkRes = await fetch(`${baseUrl}/api/classes/${classId}`);
  checkData = await checkRes.json();
  assert.equal(checkData.data.canonicalStatus, 'in_progress');
  assert.equal(checkData.data.statusLabel, 'Đang học');
  assert.deepEqual(checkData.data.allowedTransitions, ['completed', 'cancelled']);
});







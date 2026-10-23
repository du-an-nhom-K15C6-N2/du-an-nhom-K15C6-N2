'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, describe, beforeEach, afterEach } = require('node:test');

const TeachingAssignmentModel = require('../backend/models/teachingAssignmentModel');
const { TeachingAssignmentValidationService, AssignmentValidationError } = require('../backend/services/teachingAssignmentValidationService');
const TeachingAssignmentController = require('../backend/controllers/teachingAssignmentController');
const { hasPermission } = require('../backend/config/rolePermissions');
const UserModel = require('../backend/models/userModel');

// Mock data fixtures
function createMockUserModel() {
  const users = [
    { id: 'usr_mgr', name: 'Quản Lý Đào Tạo', email: 'manager@edu.vn', role: 'manager', roles: ['manager'], status: 'active' },
    { id: 'usr_t1', name: 'ThS. Nguyễn Văn A', email: 'teacherA@edu.vn', role: 'teacher', roles: ['teacher'], status: 'active' },
    { id: 'usr_t2', name: 'TS. Trần Thị B', email: 'teacherB@edu.vn', role: 'teacher', roles: ['teacher'], status: 'active' },
    { id: 'usr_t_locked', name: 'ThS. Khóa Tài Khoản', email: 'locked_t@edu.vn', role: 'teacher', roles: ['teacher'], status: 'locked', lockReason: 'Vi phạm quy chế' },
    { id: 'usr_t_pending', name: 'ThS. Chờ Kích Hoạt', email: 'pending_t@edu.vn', role: 'teacher', roles: ['teacher'], status: 'pending' },
    { id: 'usr_ta1', name: 'Trợ Giảng C', email: 'taC@edu.vn', role: 'assistant', roles: ['assistant'], status: 'active' },
    { id: 'usr_ta2', name: 'Trợ Giảng D', email: 'taD@edu.vn', role: 'assistant', roles: ['assistant'], status: 'active' },
    { id: 'usr_ta_locked', name: 'Trợ Giảng Khóa', email: 'ta_locked@edu.vn', role: 'assistant', roles: ['assistant'], status: 'locked', lockReason: 'Tạm ngưng công tác' },
    { id: 'usr_stu1', name: 'Sinh Viên E', email: 'studentE@edu.vn', role: 'student', roles: ['student'], status: 'active' }
  ];

  return {
    users,
    findById(id) {
      return users.find(u => String(u.id) === String(id)) || null;
    },
    getRoles(user) {
      return user.roles || [user.role];
    },
    findActiveTeachers() {
      return users.filter(u => this.getRoles(u).includes('teacher') && u.status === 'active');
    },
    findActiveAssistants() {
      return users.filter(u => this.getRoles(u).includes('assistant') && u.status === 'active');
    },
    findActiveByRole(role) {
      return users.filter(u => this.getRoles(u).includes(role) && u.status === 'active');
    },
    findByRole(role, { status = 'all' } = {}) {
      let filtered = users.filter(u => this.getRoles(u).includes(role));
      if (status && status !== 'all') {
        filtered = filtered.filter(u => u.status === status);
      }
      return filtered;
    }
  };
}

function createMockClassModel() {
  const classes = [
    { id: 'cls_001', code: 'K15-CNTT01', name: 'Lập trình Web', status: 'active', room: 'A101', schedule: 'Thứ 2 • 07:30–09:30' },
    { id: 'cls_002', code: 'K15-CNTT02', name: 'Cơ sở dữ liệu', status: 'active', room: 'A203', schedule: 'Thứ 3 • 07:30–09:30' },
    { id: 'cls_inactive', code: 'K15-CNTT99', name: 'Lớp Đã Đóng', status: 'closed', room: 'B999', schedule: 'N/A' }
  ];

  return {
    classes,
    list() {
      return classes;
    }
  };
}

function createMockCourses() {
  return [
    { id: 'crs_web101', code: 'WEB101', name: 'Lập trình Web', sessionCount: 15, weight: 3 },
    { id: 'crs_db201', code: 'DB201', name: 'Cơ sở dữ liệu', sessionCount: 15, weight: 3 },
    { id: 'crs_dsa102', code: 'DSA102', name: 'Cấu trúc dữ liệu & Giải thuật', sessionCount: 15, weight: 3 }
  ];
}

function createMockResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

describe('DNKN-179: Phân công giảng viên và trợ giảng cho lớp theo từng môn', () => {
  let tempDir;
  let testDataFile;
  let model;
  let mockUsers;
  let mockClasses;
  let validationService;
  let controller;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnkn179-test-'));
    testDataFile = path.join(tempDir, 'teaching-assignments.json');

    // Create empty store
    fs.writeFileSync(testDataFile, JSON.stringify({ assignments: [], history: [] }), 'utf8');

    model = new TeachingAssignmentModel(testDataFile);
    model.getCoursesCatalog = () => createMockCourses();

    mockUsers = createMockUserModel();
    mockClasses = createMockClassModel();

    validationService = new TeachingAssignmentValidationService({
      userModel: mockUsers,
      classModel: mockClasses,
      assignmentModel: model
    });

    controller = new TeachingAssignmentController({
      model,
      validationService
    });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------
  // Test 1: Bổ sung truy vấn danh sách tài khoản theo vai trò
  // -------------------------------------------------------------
  test('1. Bổ sung truy vấn danh sách tài khoản theo vai trò cho màn hình phân công', () => {
    // UserModel phương thức truy vấn
    const activeTeachers = mockUsers.findActiveTeachers();
    assert.equal(activeTeachers.length, 2);
    assert.ok(activeTeachers.every(t => t.role === 'teacher' && t.status === 'active'));

    const activeAssistants = mockUsers.findActiveAssistants();
    assert.equal(activeAssistants.length, 2);
    assert.ok(activeAssistants.every(a => a.role === 'assistant' && a.status === 'active'));

    // Truy vấn tất cả trợ giảng bao gồm cả locked
    const allAssistants = mockUsers.findByRole('assistant', { status: 'all' });
    assert.equal(allAssistants.length, 3);

    // UserModel thực tế trong hệ thống
    const realTeachers = UserModel.findActiveTeachers();
    assert.ok(Array.isArray(realTeachers));
    assert.ok(realTeachers.length > 0);
    assert.ok(realTeachers.every(t => t.roles.includes('teacher') && t.status === 'active'));

    const realAssistants = UserModel.findActiveAssistants();
    assert.ok(Array.isArray(realAssistants));
    assert.ok(realAssistants.length > 0);
    assert.ok(realAssistants.every(a => a.roles.includes('assistant') && a.status === 'active'));
  });

  // -------------------------------------------------------------
  // Test 2: Options API cho màn hình phân công
  // -------------------------------------------------------------
  test('2. API GET /api/assignments/options trả về danh sách lớp, môn, giảng viên và trợ giảng hợp lệ', async () => {
    const req = {};
    const res = createMockResponse();

    await controller.getOptions(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.classes));
    assert.ok(Array.isArray(res.body.data.courses));
    assert.ok(Array.isArray(res.body.data.teachers));
    assert.ok(Array.isArray(res.body.data.assistants));

    // Giảng viên & trợ giảng trong options phải đang hoạt động
    assert.ok(res.body.data.teachers.every(t => t.status === 'active'));
    assert.ok(res.body.data.assistants.every(a => a.status === 'active'));
  });

  // -------------------------------------------------------------
  // Test 3: Phân công giảng viên chính và trợ giảng thành công
  // -------------------------------------------------------------
  test('3. Phân công giảng viên chính và trợ giảng thành công cho môn trong lớp', async () => {
    const req = {
      body: {
        classId: 'cls_001',
        courseId: 'crs_web101',
        primaryTeacherId: 'usr_t1',
        assistantIds: ['usr_ta1'],
        term: 'Học kỳ 1 - 2026',
        academicYear: '2026-2027',
        note: 'Phân công môn Lập trình Web'
      },
      user: { id: 'usr_mgr', name: 'Quản Lý Đào Tạo' }
    };
    const res = createMockResponse();

    await controller.create(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.classId, 'cls_001');
    assert.equal(res.body.data.courseId, 'crs_web101');
    assert.equal(res.body.data.primaryTeacherId, 'usr_t1');
    assert.deepEqual(res.body.data.assistantIds, ['usr_ta1']);
    assert.equal(res.body.data.assignedByName, 'Quản Lý Đào Tạo');

    // Kiểm tra dữ liệu được lưu trong store
    const stored = model.readStore();
    assert.equal(stored.assignments.length, 1);
    assert.equal(stored.history.length, 1);
    assert.equal(stored.history[0].action, 'CREATE');
    assert.equal(stored.history[0].newPrimaryTeacherId, 'usr_t1');
  });

  // -------------------------------------------------------------
  // Test 4: Ràng buộc nghiệp vụ - Bắt buộc có giảng viên chính
  // -------------------------------------------------------------
  test('4. Ràng buộc: Bắt buộc phải có giảng viên chính chịu trách nhiệm chuyên môn', () => {
    assert.throws(() => {
      validationService.validatePrimaryTeacher('');
    }, (error) => {
      assert.equal(error.code, 'PRIMARY_TEACHER_REQUIRED');
      assert.equal(error.statusCode, 400);
      return true;
    });

    assert.throws(() => {
      validationService.validatePrimaryTeacher(null);
    }, (error) => {
      assert.equal(error.code, 'PRIMARY_TEACHER_REQUIRED');
      return true;
    });
  });

  // -------------------------------------------------------------
  // Test 5: Ràng buộc nghiệp vụ - Giảng viên phải có vai trò teacher
  // -------------------------------------------------------------
  test('5. Ràng buộc: Tài khoản giảng viên chính phải có vai trò teacher', () => {
    assert.throws(() => {
      validationService.validatePrimaryTeacher('usr_stu1'); // Học sinh
    }, (error) => {
      assert.equal(error.code, 'INVALID_TEACHER_ROLE');
      assert.equal(error.statusCode, 400);
      return true;
    });
  });

  // -------------------------------------------------------------
  // Test 6: Ràng buộc nghiệp vụ - Không phân công giảng viên bị khóa hoặc pending
  // -------------------------------------------------------------
  test('6. Ràng buộc: Không thể phân công giảng viên đang bị khóa hoặc chờ kích hoạt', () => {
    assert.throws(() => {
      validationService.validatePrimaryTeacher('usr_t_locked');
    }, (error) => {
      assert.equal(error.code, 'TEACHER_LOCKED');
      assert.equal(error.statusCode, 400);
      return true;
    });

    assert.throws(() => {
      validationService.validatePrimaryTeacher('usr_t_pending');
    }, (error) => {
      assert.equal(error.code, 'TEACHER_PENDING');
      assert.equal(error.statusCode, 400);
      return true;
    });
  });

  // -------------------------------------------------------------
  // Test 7: Ràng buộc nghiệp vụ - Trợ giảng phải có vai trò assistant và active
  // -------------------------------------------------------------
  test('7. Ràng buộc: Trợ giảng phải có vai trò assistant và đang hoạt động', () => {
    // Không phải trợ giảng
    assert.throws(() => {
      validationService.validateAssistants(['usr_stu1'], 'usr_t1');
    }, (error) => {
      assert.equal(error.code, 'INVALID_ASSISTANT_ROLE');
      return true;
    });

    // Trợ giảng bị khóa
    assert.throws(() => {
      validationService.validateAssistants(['usr_ta_locked'], 'usr_t1');
    }, (error) => {
      assert.equal(error.code, 'ASSISTANT_LOCKED');
      return true;
    });
  });

  // -------------------------------------------------------------
  // Test 8: Ràng buộc nghiệp vụ - Trợ giảng không được trùng với giảng viên chính
  // -------------------------------------------------------------
  test('8. Ràng buộc: Trợ giảng không được trùng với giảng viên chính của cùng môn', () => {
    assert.throws(() => {
      validationService.validateAssistants(['usr_t1'], 'usr_t1');
    }, (error) => {
      assert.equal(error.code, 'TEACHER_ASSISTANT_CONFLICT');
      assert.equal(error.statusCode, 400);
      return true;
    });
  });

  // -------------------------------------------------------------
  // Test 9: Ràng buộc nghiệp vụ - Lớp học và môn học phải hợp lệ
  // -------------------------------------------------------------
  test('9. Ràng buộc: Lớp học và môn học phải tồn tại và đang hoạt động', () => {
    // Lớp không tồn tại
    assert.throws(() => {
      validationService.validateClass('cls_not_found');
    }, (error) => {
      assert.equal(error.code, 'CLASS_NOT_FOUND');
      assert.equal(error.statusCode, 404);
      return true;
    });

    // Lớp đã đóng / không hoạt động
    assert.throws(() => {
      validationService.validateClass('cls_inactive');
    }, (error) => {
      assert.equal(error.code, 'CLASS_INACTIVE');
      assert.equal(error.statusCode, 400);
      return true;
    });

    // Môn không tồn tại
    assert.throws(() => {
      validationService.validateCourse('crs_missing');
    }, (error) => {
      assert.equal(error.code, 'COURSE_NOT_FOUND');
      assert.equal(error.statusCode, 404);
      return true;
    });
  });

  // -------------------------------------------------------------
  // Test 10: Ràng buộc nghiệp vụ - Không cho phép tạo trùng phân công môn trong lớp
  // -------------------------------------------------------------
  test('10. Ràng buộc: Không cho phép tạo trùng phân công môn học trong cùng lớp', async () => {
    const payload = {
      classId: 'cls_001',
      courseId: 'crs_web101',
      primaryTeacherId: 'usr_t1',
      assistantIds: ['usr_ta1']
    };

    // Tạo lần 1 thành công
    const res1 = createMockResponse();
    await controller.create({ body: payload, user: { id: 'usr_mgr', name: 'Quản lý' } }, res1);
    assert.equal(res1.statusCode, 201);

    // Tạo lần 2 cùng classId và courseId -> Bị từ chối HTTP 409 DUPLICATE_ASSIGNMENT
    const res2 = createMockResponse();
    await controller.create({ body: payload, user: { id: 'usr_mgr', name: 'Quản lý' } }, res2);
    assert.equal(res2.statusCode, 409);
    assert.equal(res2.body.code, 'DUPLICATE_ASSIGNMENT');
  });

  // -------------------------------------------------------------
  // Test 11: Cập nhật / Bàn giao phân công môn học & Audit History
  // -------------------------------------------------------------
  test('11. Cập nhật phân công và ghi nhận lịch sử thay đổi (Audit History)', async () => {
    // 1. Tạo phân công ban đầu
    const created = model.create({
      classId: 'cls_001',
      courseId: 'crs_web101',
      primaryTeacherId: 'usr_t1',
      assistantIds: ['usr_ta1']
    }, { id: 'usr_mgr', name: 'Quản lý Đào tạo' });

    // 2. Bàn giao sang giảng viên khác và đổi trợ giảng
    const updateReq = {
      params: { id: created.id },
      body: {
        primaryTeacherId: 'usr_t2',
        assistantIds: ['usr_ta2'],
        reason: 'Bàn giao chuyên môn do phân công lại lịch dạy'
      },
      user: { id: 'usr_mgr', name: 'Quản lý Đào tạo' }
    };
    const updateRes = createMockResponse();

    await controller.update(updateReq, updateRes);

    assert.equal(updateRes.statusCode, 200);
    assert.equal(updateRes.body.success, true);
    assert.equal(updateRes.body.data.primaryTeacherId, 'usr_t2');
    assert.deepEqual(updateRes.body.data.assistantIds, ['usr_ta2']);

    // Kiểm tra lịch sử
    const history = model.listHistory({ assignmentId: created.id });
    assert.equal(history.length, 2);
    assert.equal(history[0].action, 'REASSIGN');
    assert.equal(history[0].previousPrimaryTeacherId, 'usr_t1');
    assert.equal(history[0].newPrimaryTeacherId, 'usr_t2');
    assert.equal(history[0].performedByName, 'Quản lý Đào tạo');
  });

  // -------------------------------------------------------------
  // Test 12: Hủy phân công môn học trong lớp
  // -------------------------------------------------------------
  test('12. Hủy phân công môn học và ghi nhận lịch sử DELETE', async () => {
    const created = model.create({
      classId: 'cls_001',
      courseId: 'crs_web101',
      primaryTeacherId: 'usr_t1',
      assistantIds: ['usr_ta1']
    }, { id: 'usr_mgr', name: 'Quản lý' });

    const deleteReq = {
      params: { id: created.id },
      user: { id: 'usr_mgr', name: 'Quản lý' }
    };
    const deleteRes = createMockResponse();

    await controller.remove(deleteReq, deleteRes);

    assert.equal(deleteRes.statusCode, 200);
    assert.equal(deleteRes.body.success, true);
    assert.equal(model.findById(created.id), null);

    // Lịch sử ghi nhận thao tác xóa
    const history = model.listHistory();
    const deleteEntry = history.find(h => h.action === 'DELETE');
    assert.ok(deleteEntry);
    assert.equal(deleteEntry.previousPrimaryTeacherId, 'usr_t1');
  });

  // -------------------------------------------------------------
  // Test 13: Ma trận phân công theo lớp (Matrix & Coverage)
  // -------------------------------------------------------------
  test('13. API GET /api/assignments/classes/:classId trả về ma trận môn học đã và chưa phân công', async () => {
    // Phân công 1 môn
    model.create({
      classId: 'cls_001',
      courseId: 'crs_web101',
      primaryTeacherId: 'usr_t1',
      assistantIds: ['usr_ta1']
    });

    const req = { params: { classId: 'cls_001' } };
    const res = createMockResponse();

    await controller.getByClass(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.summary.assignedCourses, 1);
    assert.equal(res.body.data.summary.unassignedCourses, 2);

    const matrix = res.body.data.matrix;
    assert.equal(matrix.length, 3);
    const webCourse = matrix.find(m => m.courseId === 'crs_web101');
    assert.equal(webCourse.isAssigned, true);
    assert.equal(webCourse.status, 'FULLY_ASSIGNED');

    const dbCourse = matrix.find(m => m.courseId === 'crs_db201');
    assert.equal(dbCourse.isAssigned, false);
    assert.equal(dbCourse.status, 'UNASSIGNED');
  });

  // -------------------------------------------------------------
  // Test 14: Phân quyền RBAC (classes.manage)
  // -------------------------------------------------------------
  test('14. Phân quyền RBAC: Quản lý đào tạo và Admin có quyền classes.manage, Học sinh và Giảng viên bị từ chối', () => {
    // Admin có quyền classes.manage
    assert.equal(hasPermission({ role: 'admin' }, 'classes.manage'), true);

    // Quản lý đào tạo (manager) có quyền classes.manage
    assert.equal(hasPermission({ role: 'manager' }, 'classes.manage'), true);

    // Giảng viên (teacher) KHÔNG có quyền classes.manage
    assert.equal(hasPermission({ role: 'teacher' }, 'classes.manage'), false);

    // Trợ giảng (assistant) KHÔNG có quyền classes.manage
    assert.equal(hasPermission({ role: 'assistant' }, 'classes.manage'), false);

    // Học sinh (student) KHÔNG có quyền classes.manage
    assert.equal(hasPermission({ role: 'student' }, 'classes.manage'), false);
  });

  // -------------------------------------------------------------
  // Test 15: Lưu trữ tệp nguyên tử (Atomic write resilience)
  // -------------------------------------------------------------
  test('15. Cơ chế lưu trữ nguyên tử đảm bảo dữ liệu toàn vẹn', () => {
    for (let i = 1; i <= 5; i++) {
      model.create({
        classId: 'cls_001',
        courseId: `crs_temp_${i}`,
        primaryTeacherId: 'usr_t1',
        assistantIds: []
      }, { id: 'usr_mgr', name: 'Tester' });
    }

    const reloaded = new TeachingAssignmentModel(testDataFile);
    assert.equal(reloaded.readStore().assignments.length, 5);
    assert.equal(reloaded.readStore().history.length, 5);
  });
});

const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { hashPassword } = require('./backend/security/password');
const RBAC_SEED = require('./backend/data/rbac-seed.json');
const {
    RBAC_SEED_VERSION,
    ALLOWED_ROLES,
    PERMISSIONS,
    ROLE_CATALOG,
    getPermissions,
    hasPermission,
    getRoles
} = require('./backend/config/rolePermissions');

let app;
let server;
let baseUrl;
let tempDir;
const passwords = new Map();

before(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ttcs-rbac-test-'));
    process.env.DATA_FILE = path.join(tempDir, 'users.json');
    process.env.SESSION_STORE_FILE = path.join(tempDir, 'revoked-sessions.json');
    process.env.LOGIN_ATTEMPT_STORE_FILE = path.join(tempDir, 'login-attempts.json');
    process.env.ATTENDANCE_DATA_FILE = path.join(tempDir, 'attendance.json');
    process.env.GRADES_DATA_FILE = path.join(tempDir, 'grades.json');
    process.env.TUITION_DATA_FILE = path.join(tempDir, 'tuition.json');

    const roles = ['admin', 'teacher', 'accountant', 'student', 'training_staff'];
    const users = await Promise.all(roles.map(async role => {
        const email = `${role}@rbac.test`;
        const password = `Rbac-${role}-Pass1!`;
        passwords.set(role, password);
        return {
            id: `rbac-${role}`,
            name: `RBAC ${role}`,
            email,
            role,
            status: 'active',
            passwordHash: await hashPassword(password)
        };
    }));
    users.push({
        id: 'rbac-student-record',
        name: 'Học sinh kiểm thử',
        email: 'student-record@rbac.test',
        role: 'student',
        status: 'active',
        passwordHash: await hashPassword('Student-Record-Pass1!')
    });
    passwords.set('mixed-student', 'Mixed-Student-Pass1!');
    users.push({
          id: 'rbac-mixed-student',
          name: 'Học sinh có dữ liệu vai trò cũ',
          email: 'mixed-student@rbac.test',
          role: 'admin',
          roles: ['student', 'admin'],
          status: 'active',
          passwordHash: await hashPassword(passwords.get('mixed-student'))
    });
    passwords.set('mixed-teacher', 'Mixed-Teacher-Pass1!');
    users.push({
          id: 'rbac-mixed-teacher',
          name: 'Giáo viên có dữ liệu vai trò cũ',
          email: 'mixed-teacher@rbac.test',
          role: 'admin',
          roles: ['teacher', 'admin'],
          status: 'active',
          passwordHash: await hashPassword(passwords.get('mixed-teacher'))
    });
    passwords.set('pending-activation', 'Pending-Activation-Pass1!');
    users.push({
          id: 'rbac-pending-activation',
          name: 'Tài khoản chờ kích hoạt',
          email: 'pending-activation@rbac.test',
          role: 'student',
          status: 'pending',
          passwordHash: await hashPassword(passwords.get('pending-activation')),
          activationTokenHash: crypto.createHash('sha256').update('a'.repeat(64)).digest('hex'),
          activationExpiresAt: Date.now() + 60_000
    });
    passwords.set('pending-direct-activation', 'Pending-Direct-Activation-Pass1!');
    users.push({
        id: 'rbac-pending-direct-activation',
        name: 'Tài khoản chờ kích hoạt trực tiếp',
        email: 'pending-direct-activation@rbac.test',
        role: 'student',
        status: 'pending',
        passwordHash: await hashPassword(passwords.get('pending-direct-activation')),
        activationTokenHash: crypto.createHash('sha256').update('b'.repeat(64)).digest('hex'),
        activationExpiresAt: Date.now() + 60_000
    });
    await fs.writeFile(process.env.DATA_FILE, JSON.stringify(users));
    await fs.writeFile(process.env.GRADES_DATA_FILE, JSON.stringify([{
          id: 'other-student-grade',
          studentId: 'rbac-student-record',
          className: 'K15-CNTT01',
          subject: 'Lập trình Web',
          term: 'HK1-2026',
          score: 9,
          maxScore: 10,
          updatedAt: new Date().toISOString()
    }]));
    await fs.writeFile(process.env.TUITION_DATA_FILE, JSON.stringify([{
          id: 'other-student-tuition',
          studentId: 'rbac-student-record',
          academicYear: '2026-2027',
          amount: 12000000,
          paidAmount: 3000000,
          status: 'partial',
          updatedAt: new Date().toISOString()
    }]));

    ({ app } = require('./server'));
    server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (server) {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
    delete process.env.DATA_FILE;
    delete process.env.SESSION_STORE_FILE;
    delete process.env.LOGIN_ATTEMPT_STORE_FILE;
    delete process.env.ATTENDANCE_DATA_FILE;
    delete process.env.GRADES_DATA_FILE;
    delete process.env.TUITION_DATA_FILE;
});

async function request(pathname, { method = 'GET', body, token } = {}) {
    const response = await fetch(`${baseUrl}${pathname}`, {
        method,
        headers: {
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { response, data: await response.json() };
}

async function login(role) {
    const { response, data } = await request('/api/auth/login', {
        method: 'POST',
        body: { email: `${role}@rbac.test`, password: passwords.get(role) }
    });
    assert.equal(response.status, 200, JSON.stringify(data));
    return data.token;
}

function assertFriendlyForbidden(response, data, featureName) {
    assert.equal(response.status, 403);
    assert.deepEqual(Object.keys(data).sort(), [
        'code', 'errorType', 'featureName', 'message', 'role', 'roles', 'success'
    ]);
    assert.equal(data.success, false);
    assert.equal(data.code, 'ACCESS_FORBIDDEN');
    assert.equal(data.errorType, 'forbidden');
    assert.equal(data.featureName, featureName);
    assert.match(data.message, new RegExp(`Bạn chưa được cấp quyền truy cập ${featureName}`));
    assert.equal(data.stack, undefined);
    assert.equal(data.permission, undefined);
    assert.equal(Array.isArray(data.roles), true);
    assert.equal(data.role, data.roles[0] || null);
}

test('seeded RBAC catalog defines exactly eight roles and denies unknown roles by default', () => {
    const expectedRoles = [
        'admin',
        'teacher',
        'assistant',
        'student',
        'manager',
        'accountant',
        'department_head',
        'training_staff'
    ];
    assert.deepEqual([...ALLOWED_ROLES], expectedRoles);
    assert.deepEqual(Object.keys(ROLE_CATALOG), expectedRoles);
    assert.equal(hasPermission({ role: 'unknown-role' }, 'users.read'), false);
    assert.equal(hasPermission(null, 'users.read'), false);
    assert.equal(hasPermission({ role: 'teacher' }, 'not-a-permission'), false);
});

test('versioned RBAC seed is the startup source for every role and permission', () => {
    assert.equal(RBAC_SEED_VERSION, 1);
    assert.deepEqual(PERMISSIONS, RBAC_SEED.permissions);
    assert.deepEqual(Object.keys(ROLE_CATALOG), Object.keys(RBAC_SEED.roles));

    for (const [role, seededRole] of Object.entries(RBAC_SEED.roles)) {
        assert.equal(ROLE_CATALOG[role].label, seededRole.label);
        assert.deepEqual(ROLE_CATALOG[role].permissions, seededRole.permissions);
        assert.deepEqual(ROLE_CATALOG[role].navigation, seededRole.navigation);
    }
});

test('each business role has an explicit valid permission assignment', () => {
    const configuredRoles = Object.keys(ROLE_CATALOG);
    assert.equal(configuredRoles.length, 8);

    for (const [role, definition] of Object.entries(ROLE_CATALOG)) {
        assert.equal(typeof definition.label, 'string', `${role} must have a label`);
        assert.ok(Array.isArray(definition.permissions), `${role} must have a permission list`);
        assert.ok(definition.permissions.length > 0, `${role} must have at least one permission`);
        assert.equal(
            new Set(definition.permissions).size,
            definition.permissions.length,
            `${role} must not contain duplicate permissions`
        );
        for (const permission of definition.permissions) {
            assert.ok(PERMISSIONS.includes(permission), `${role} has unknown permission ${permission}`);
        }
    }

    assert.deepEqual(ROLE_CATALOG.admin.permissions, PERMISSIONS);
    assert.equal(ROLE_CATALOG.teacher.permissions.includes('tuition.write'), false);
    assert.equal(ROLE_CATALOG.accountant.permissions.includes('grades.write'), false);
    assert.equal(ROLE_CATALOG.student.permissions.includes('grades.write'), false);
    assert.equal(ROLE_CATALOG.student.permissions.includes('tuition.write'), false);
});

test('role-based denials use the same friendly response without exposing role details', () => {
    const { requireRoles, requirePermission } = require('./backend/middleware/authMiddleware');
    const result = {};
    const response = {
        status(statusCode) {
            result.status = statusCode;
            return this;
        },
        json(payload) {
            result.data = payload;
            return payload;
        }
    };

    requireRoles(['admin'], { featureName: 'cấu hình hệ thống' })(
        { user: { role: 'teacher' } },
        response,
        () => assert.fail('Denied role must not continue to the route')
    );

    assertFriendlyForbidden({ status: result.status }, result.data, 'cấu hình hệ thống');
    assert.equal(result.data.role, 'teacher');

    const denyUnknownPermission = requirePermission('unregistered.permission', {
        featureName: 'chức năng chưa đăng ký'
    });
    denyUnknownPermission(
        { user: { role: 'admin' } },
        response,
        () => assert.fail('An unregistered permission must be denied')
    );
    assertFriendlyForbidden({ status: result.status }, result.data, 'chức năng chưa đăng ký');
    assert.equal(result.data.role, 'admin');

    denyUnknownPermission(
        {},
        response,
        () => assert.fail('A request without an authenticated user must be denied')
    );
    assertFriendlyForbidden({ status: result.status }, result.data, 'chức năng chưa đăng ký');
    assert.equal(result.data.role, null);
});

test('student role stays exclusive and cannot inherit elevated permissions from legacy role data', async () => {
    const studentRoles = getRoles({ role: 'admin', roles: ['student', 'admin'] });
    assert.deepEqual(studentRoles, ['student']);
    assert.deepEqual(getPermissions({ role: 'admin', roles: ['student', 'admin'] }), ROLE_CATALOG.student.permissions);
    assert.equal(hasPermission({ role: 'admin', roles: ['student', 'admin'] }, 'users.read'), false);
    assert.equal(hasPermission({ role: 'admin', roles: ['student', 'admin'] }, 'grades.write'), false);

    const token = await login('mixed-student');
    const gradeList = await request('/api/grades', { token });
    const tuitionList = await request('/api/tuition', { token });
    const permissionList = await request('/api/auth/permissions', { token });
    assert.equal(gradeList.response.status, 200);
    assert.deepEqual(gradeList.data.data, []);
    assert.equal(tuitionList.response.status, 200);
    assert.deepEqual(tuitionList.data.data, []);
    assert.equal(permissionList.data.role, 'student');
    assert.deepEqual(permissionList.data.roles, ['student']);

    const deniedUsers = await request('/api/users', { token });
    assertFriendlyForbidden(deniedUsers.response, deniedUsers.data, 'quản lý người dùng');
});

test('teacher role stays exclusive and administrators cannot add roles to teacher accounts', async () => {
    const mixedRoles = { role: 'admin', roles: ['teacher', 'admin'] };
    assert.deepEqual(getRoles(mixedRoles), ['teacher']);
    assert.deepEqual(getPermissions(mixedRoles), ROLE_CATALOG.teacher.permissions);
    assert.equal(hasPermission(mixedRoles, 'users.read'), false);
    assert.equal(hasPermission(mixedRoles, 'tuition.write'), false);

    const token = await login('mixed-teacher');
    const permissions = await request('/api/auth/permissions', { token });
    assert.deepEqual(permissions.data.roles, ['teacher']);
    assert.deepEqual(permissions.data.permissions, ROLE_CATALOG.teacher.permissions);
    const deniedUsers = await request('/api/users', { token });
    assertFriendlyForbidden(deniedUsers.response, deniedUsers.data, 'quản lý người dùng');
    const deniedTuition = await request('/api/tuition', { token });
    assertFriendlyForbidden(deniedTuition.response, deniedTuition.data, 'thông tin học phí');

    const adminToken = await login('admin');
    const assignAdmin = await request('/api/users/rbac-teacher/roles', {
        method: 'POST',
        token: adminToken,
        body: { role: 'admin' }
    });
    assert.equal(assignAdmin.response.status, 400);
    assert.match(assignAdmin.data.message, /Giáo viên chỉ được gán vai trò giáo viên/);

    const updateTeacher = await request('/api/users/rbac-teacher', {
        method: 'PUT',
        token: adminToken,
        body: {
            name: 'RBAC teacher',
            email: 'teacher@rbac.test',
            phone: '',
            roles: ['teacher', 'manager']
        }
    });
    assert.equal(updateTeacher.response.status, 400);
    assert.match(updateTeacher.data.message, /Giáo viên chỉ được gán vai trò giáo viên/);

    const createTeacher = await request('/api/users', {
        method: 'POST',
        token: adminToken,
        body: {
            name: 'Teacher with extra role',
            email: 'teacher-manager@rbac.test',
            roles: ['teacher', 'manager']
        }
    });
    assert.equal(createTeacher.response.status, 400);
    assert.match(createTeacher.data.message, /Giáo viên chỉ được gán vai trò giáo viên/);
});

test('teacher may manage grades but cannot read or modify tuition or manage users', async () => {
    const token = await login('teacher');
    const permissions = getPermissions({ role: 'teacher' });
    assert.ok(permissions.includes('grades.write'));
    assert.equal(permissions.includes('tuition.write'), false);

    const denied = await request('/api/users', { token });
    assertFriendlyForbidden(denied.response, denied.data, 'quản lý người dùng');
});

test('accountant may manage tuition but cannot modify grades or record attendance', async () => {
    const token = await login('accountant');
    const permissions = getPermissions({ role: 'accountant' });
    assert.ok(permissions.includes('tuition.write'));
    assert.equal(permissions.includes('grades.write'), false);

    const tuition = await request('/api/tuition', {
        method: 'PUT',
        token,
        body: {
            studentId: 'rbac-student-record',
            academicYear: '2026-2027',
            amount: 12000000,
            paidAmount: 3000000,
            dueDate: '2026-12-31',
            status: 'partial',
            note: 'Đợt 1'
        }
    });
    assert.equal(tuition.response.status, 200, JSON.stringify(tuition.data));
    assert.equal(tuition.data.data.studentId, 'rbac-student-record');

    const denied = await request('/api/attendance', {
        method: 'POST',
        token,
        body: {
            className: 'K15-CNTT01',
            studentId: 'rbac-student-record',
            attendanceDate: '2026-10-07',
            status: 'present'
        }
    });
    assertFriendlyForbidden(denied.response, denied.data, 'quản lý điểm danh');

    const deniedGradeWrite = await request('/api/grades', {
        method: 'PUT',
        token,
        body: {
            studentId: 'rbac-student-record',
            className: 'K15-CNTT01',
            subject: 'Lập trình Web',
            term: 'HK1-2026',
            score: 9,
            maxScore: 10
        }
    });
    assertFriendlyForbidden(deniedGradeWrite.response, deniedGradeWrite.data, 'cập nhật điểm');
});

test('teacher and accountant are denied across high-risk operations outside their roles', async () => {
    const teacherToken = await login('teacher');
    const accountantToken = await login('accountant');
    const unauthorizedOperations = [
        {
            token: teacherToken,
            pathname: '/api/tuition',
            method: 'PUT',
            feature: 'cập nhật học phí',
            body: {
                studentId: 'rbac-student-record',
                academicYear: '2026-2027',
                amount: 1000,
                paidAmount: 1000,
                status: 'paid'
            }
        },
        {
            token: teacherToken,
            pathname: '/api/classes/cls_001/handover',
            method: 'PATCH',
            feature: 'thao tác bàn giao lớp học',
            body: { teacherId: 'rbac-teacher' }
        },
        {
            token: teacherToken,
            pathname: '/api/users/rbac-student-record/roles',
            method: 'POST',
            feature: 'gán vai trò',
            body: { role: 'admin' }
        },
        {
            token: teacherToken,
            pathname: '/api/users/rbac-student-record/lock',
            method: 'PATCH',
            feature: 'khóa tài khoản',
            body: { reason: 'Unauthorized role test' }
        },
        {
            token: accountantToken,
            pathname: '/api/grades',
            method: 'PUT',
            feature: 'cập nhật điểm',
            body: {
                studentId: 'rbac-student-record',
                className: 'K15-CNTT01',
                subject: 'Lập trình Web',
                term: 'HK1-2026',
                score: 8,
                maxScore: 10
            }
        },
        {
            token: accountantToken,
            pathname: '/api/attendance',
            method: 'POST',
            feature: 'quản lý điểm danh',
            body: {
                className: 'K15-CNTT01',
                studentId: 'rbac-student-record',
                attendanceDate: '2026-10-07',
                status: 'present'
            }
        },
        {
            token: accountantToken,
            pathname: '/api/classes/cls_001/handover',
            method: 'PATCH',
            feature: 'thao tác bàn giao lớp học',
            body: { teacherId: 'rbac-teacher' }
        },
        {
            token: accountantToken,
            pathname: '/api/users/reset',
            method: 'POST',
            feature: 'khôi phục dữ liệu hệ thống'
        },
        {
            token: accountantToken,
            pathname: '/api/users/rbac-student-record',
            method: 'DELETE',
            feature: 'xóa tài khoản người dùng'
        }
    ];

    for (const operation of unauthorizedOperations) {
        const result = await request(operation.pathname, {
            method: operation.method,
            token: operation.token,
            body: operation.body
        });
        assertFriendlyForbidden(result.response, result.data, operation.feature);
    }
});

test('teacher can create grades but cannot view or change tuition', async () => {
    const token = await login('teacher');
    const grade = await request('/api/grades', {
        method: 'PUT',
        token,
        body: {
            studentId: 'rbac-student-record',
            className: 'K15-CNTT01',
            subject: 'Lập trình Web',
            term: 'HK1-2026',
            score: 9,
            maxScore: 10,
            note: 'Kiểm tra giữa kỳ'
        }
    });
    assert.equal(grade.response.status, 200, JSON.stringify(grade.data));
    assert.equal(grade.data.data.score, 9);

    const invalidGrade = await request('/api/grades', {
        method: 'PUT',
        token,
        body: {
            studentId: 'rbac-student-record',
            className: 'K15-CNTT01',
            subject: 'Lập trình Web',
            term: 'HK1-2026',
            score: 11,
            maxScore: 10
        }
    });
    assert.equal(invalidGrade.response.status, 400);
    assert.equal(invalidGrade.data.code, 'VALIDATION_ERROR');

    const deniedTuitionWrite = await request('/api/tuition', {
        method: 'PUT',
        token,
        body: {
            studentId: 'rbac-student-record',
            academicYear: '2026-2027',
            amount: 12000000,
            paidAmount: 12000000,
            status: 'paid'
        }
    });
    assertFriendlyForbidden(deniedTuitionWrite.response, deniedTuitionWrite.data, 'cập nhật học phí');

    const deniedTuitionRead = await request('/api/tuition', { token });
    assertFriendlyForbidden(deniedTuitionRead.response, deniedTuitionRead.data, 'thông tin học phí');
});

test('student sees only their own grades and tuition records', async () => {
    const token = await login('student');
    const grades = await request('/api/grades', { token });
    const tuition = await request('/api/tuition', { token });

    assert.equal(grades.response.status, 200);
    assert.deepEqual(grades.data.data, []);
    assert.equal(tuition.response.status, 200);
    assert.deepEqual(tuition.data.data, []);

    const otherStudentWrite = await request('/api/grades', {
        method: 'PUT',
        token,
        body: {
            studentId: 'rbac-student-record',
            className: 'K15-CNTT01',
            subject: 'Lập trình Web',
            term: 'HK1-2026',
            score: 9,
            maxScore: 10
        }
    });
    assertFriendlyForbidden(otherStudentWrite.response, otherStudentWrite.data, 'cập nhật điểm');
});

test('administrator can inspect the seeded permission matrix while teacher cannot', async () => {
    const adminToken = await login('admin');
    const catalog = await request('/api/users/role-permissions', { token: adminToken });
    assert.equal(catalog.response.status, 200);
    assert.equal(catalog.data.data.length, 8);
    assert.ok(catalog.data.data.some(role => role.role === 'accountant'));
    assert.deepEqual(catalog.data.data, Object.entries(ROLE_CATALOG).map(([role, definition]) => ({
        role,
        label: definition.label,
        permissions: [...definition.permissions]
    })));

    const teacherToken = await login('teacher');
    const denied = await request('/api/users/role-permissions', { token: teacherToken });
    assertFriendlyForbidden(denied.response, denied.data, 'cấu hình vai trò và quyền');
});

test('admin can resend pending account activation email while teachers cannot', async () => {
    const teacherToken = await login('teacher');
    const forbidden = await request('/api/users/rbac-pending-activation/resend-activation', {
        method: 'POST',
        token: teacherToken
    });
    assertFriendlyForbidden(forbidden.response, forbidden.data, 'gửi lại email kích hoạt tài khoản');

    const adminToken = await login('admin');
    const previousActivationToken = 'a'.repeat(64);
    let activationLog = '';
    const originalInfo = console.info;
    console.info = message => { activationLog = String(message); };
    let resend;
    try {
        resend = await request('/api/users/rbac-pending-activation/resend-activation', {
            method: 'POST',
            token: adminToken
        });
    } finally {
        console.info = originalInfo;
    }

    assert.equal(resend.response.status, 200, JSON.stringify(resend.data));
    assert.match(resend.data.message, /SMTP chưa cấu hình/);
    const users = JSON.parse(await fs.readFile(process.env.DATA_FILE, 'utf8'));
    const pendingUser = users.find(user => user.id === 'rbac-pending-activation');
    assert.equal(pendingUser.status, 'pending');
    assert.notEqual(
        pendingUser.activationTokenHash,
        crypto.createHash('sha256').update(previousActivationToken).digest('hex')
    );
    assert.ok(pendingUser.activationExpiresAt > Date.now());

    const oldActivation = await request('/api/users/activate', {
        method: 'POST',
        body: { token: previousActivationToken }
    });
    assert.equal(oldActivation.response.status, 400);

    const activationUrl = activationLog.match(/https?:\/\/[^ ]+/)[0];
    const newActivationToken = new URL(activationUrl).searchParams.get('token');
    const activated = await request('/api/users/activate', {
        method: 'POST',
        body: { token: newActivationToken }
    });
    assert.equal(activated.response.status, 200);
    assert.equal(activationLog.includes(pendingUser.email), true);
});

test('admin can directly activate a pending account and invalidate its email token', async () => {
    const teacherToken = await login('teacher');
    const forbidden = await request('/api/users/rbac-pending-direct-activation/activate', {
        method: 'PATCH',
        token: teacherToken
    });
    assertFriendlyForbidden(forbidden.response, forbidden.data, 'kích hoạt tài khoản');

    const adminToken = await login('admin');
    const oldActivationToken = 'b'.repeat(64);
    const activated = await request('/api/users/rbac-pending-direct-activation/activate', {
        method: 'PATCH',
        token: adminToken
    });
    assert.equal(activated.response.status, 200, JSON.stringify(activated.data));
    assert.equal(activated.data.data.status, 'active');
    assert.equal(activated.data.data.statusLabel, 'Đang hoạt động');
    assert.equal('activationTokenHash' in activated.data.data, false);

    const users = JSON.parse(await fs.readFile(process.env.DATA_FILE, 'utf8'));
    const storedUser = users.find(user => user.id === 'rbac-pending-direct-activation');
    assert.equal(storedUser.status, 'active');
    assert.equal('activationTokenHash' in storedUser, false);
    assert.equal('activationExpiresAt' in storedUser, false);

    const oldActivation = await request('/api/users/activate', {
        method: 'POST',
        body: { token: oldActivationToken }
    });
    assert.equal(oldActivation.response.status, 400);

    const userLogin = await request('/api/auth/login', {
        method: 'POST',
        body: {
            email: 'pending-direct-activation@rbac.test',
            password: passwords.get('pending-direct-activation')
        }
    });
    assert.equal(userLogin.response.status, 200, JSON.stringify(userLogin.data));

    const activateAgain = await request('/api/users/rbac-pending-direct-activation/activate', {
        method: 'PATCH',
        token: adminToken
    });
    assert.equal(activateAgain.response.status, 409);
    assert.equal(activateAgain.data.code, 'ACCOUNT_NOT_PENDING');
});

test('training staff cannot assign elevated roles while creating or editing accounts', async () => {
    const token = await login('training_staff');
    const createAdmin = await request('/api/users', {
        method: 'POST',
        token,
        body: {
            name: 'Unauthorized Admin',
            email: 'unauthorized-admin@rbac.test',
            phone: '0900000000',
            role: 'admin'
        }
    });

    test('administrator cannot combine student role with another role', async () => {
        const token = await login('admin');
        const created = await request('/api/users', {
            method: 'POST',
            token,
            body: {
                name: 'Mixed Role Student',
                email: 'mixed-role-student@rbac.test',
                phone: '',
                roles: ['student', 'teacher']
            }
        });
        assert.equal(created.response.status, 400);
        assert.match(created.data.message, /Học sinh chỉ được gán vai trò học sinh/);

        const assigned = await request('/api/users/rbac-student-record/roles', {
            method: 'POST',
            token,
            body: { role: 'admin' }
        });
        assert.equal(assigned.response.status, 400);
        assert.match(assigned.data.message, /Học sinh chỉ được gán vai trò học sinh/);
    });
    assert.equal(createAdmin.response.status, 403);
    assert.equal(createAdmin.data.code, 'ACCESS_FORBIDDEN');

    const updateRole = await request('/api/users/rbac-student', {
        method: 'PUT',
        token,
        body: {
            name: 'Học sinh kiểm thử',
            email: 'student@rbac.test',
            phone: '0900000001',
            role: 'admin'
        }
    });
    assert.equal(updateRole.response.status, 403);
    assert.equal(updateRole.data.code, 'ACCESS_FORBIDDEN');
});

test('permission endpoint derives role from the authenticated user, not client input', async () => {
    const token = await login('teacher');
    const { response, data } = await request('/api/auth/permissions?role=admin', { token });
    assert.equal(response.status, 200);
    assert.equal(data.role, 'teacher');
    assert.equal(data.permissions.includes('tuition.write'), false);
});

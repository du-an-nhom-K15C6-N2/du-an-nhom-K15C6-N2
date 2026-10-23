const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  getRoles,
  hasPermission,
  isValidRoleAssignment,
  getRoleAssignmentError
} = require('../backend/config/rolePermissions');

test('học sinh và giáo viên chỉ được giữ 1 vai trò độc quyền', () => {
  assert.equal(isValidRoleAssignment(['student']), true);
  assert.equal(isValidRoleAssignment(['teacher']), true);
  assert.equal(isValidRoleAssignment(['student', 'teacher']), false);
  assert.equal(isValidRoleAssignment(['student', 'manager']), false);
  assert.equal(isValidRoleAssignment(['teacher', 'accountant']), false);
  assert.equal(isValidRoleAssignment(['admin', 'manager']), true);

  assert.deepEqual(getRoles({ roles: ['student', 'manager'] }), ['student']);
  assert.deepEqual(getRoles({ roles: ['teacher', 'admin'] }), ['teacher']);

  assert.match(getRoleAssignmentError(['student', 'manager']), /Học sinh chỉ được gán/);
  assert.match(getRoleAssignmentError(['teacher', 'accountant']), /Giáo viên chỉ được gán/);
});

test('lead permissions are limited to the configured admissions management roles', () => {
  assert.equal(hasPermission({ role: 'admin' }, 'leads.read'), true);
  assert.equal(hasPermission({ role: 'admin' }, 'leads.delete'), false);
  assert.equal(hasPermission({ role: 'manager' }, 'leads.delete'), true);
  assert.equal(hasPermission({ role: 'training_staff' }, 'leads.create'), true);
  assert.equal(hasPermission({ role: 'training_staff' }, 'leads.delete'), false);
  assert.equal(hasPermission({ role: 'accountant' }, 'leads.read'), false);
});

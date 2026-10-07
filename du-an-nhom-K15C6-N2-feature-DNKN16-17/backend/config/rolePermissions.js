const RBAC_SEED = require('../data/rbac-seed.json');

if (
  !Number.isInteger(RBAC_SEED.version)
  || !Array.isArray(RBAC_SEED.permissions)
  || !RBAC_SEED.roles
  || typeof RBAC_SEED.roles !== 'object'
) {
  throw new Error('Dữ liệu seed vai trò và quyền không hợp lệ.');
}

const PERMISSIONS = Object.freeze([...RBAC_SEED.permissions]);
const PERMISSION_SET = new Set(PERMISSIONS);

for (const [role, definition] of Object.entries(RBAC_SEED.roles)) {
  if (
    typeof definition.label !== 'string'
    || !Array.isArray(definition.permissions)
    || !Array.isArray(definition.navigation)
    || definition.permissions.some(permission => !PERMISSION_SET.has(permission))
  ) {
    throw new Error(`Dữ liệu seed vai trò không hợp lệ: ${role}.`);
  }
}

const ROLE_CATALOG = Object.freeze(Object.fromEntries(
  Object.entries(RBAC_SEED.roles).map(([role, definition]) => [
    role,
    Object.freeze({
      ...definition,
      permissions: Object.freeze([...definition.permissions]),
      navigation: Object.freeze(definition.navigation.map(item => Object.freeze({ ...item })))
    })
  ])
));

const ALLOWED_ROLES = new Set(Object.keys(ROLE_CATALOG));
const EXCLUSIVE_ROLES = new Set(['student', 'teacher']);

function getRoles(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [user?.role];
  const validRoles = [...new Set(roles.filter(role => ALLOWED_ROLES.has(role)))];
  const exclusiveRole = validRoles.find(role => EXCLUSIVE_ROLES.has(role));
  return exclusiveRole ? [exclusiveRole] : validRoles;
}

function isValidRoleAssignment(roles) {
  if (!Array.isArray(roles) || roles.length === 0 || roles.some(role => !ALLOWED_ROLES.has(role))) {
    return false;
  }
  const uniqueRoles = new Set(roles);
  return ![...EXCLUSIVE_ROLES].some(role => uniqueRoles.has(role) && uniqueRoles.size !== 1);
}

function getRoleAssignmentError(roles) {
  if (Array.isArray(roles) && roles.includes('student')) {
    return 'Học sinh chỉ được gán vai trò học sinh, không thể gán kèm vai trò khác.';
  }
  if (Array.isArray(roles) && roles.includes('teacher')) {
    return 'Giáo viên chỉ được gán vai trò giáo viên, không thể gán kèm vai trò khác.';
  }
  return 'Tài khoản phải có ít nhất một vai trò hợp lệ.';
}

function getPermissions(user) {
  const permissions = new Set();
  for (const role of getRoles(user)) {
    for (const permission of ROLE_CATALOG[role].permissions) {
      permissions.add(permission);
    }
  }
  return [...permissions];
}

function hasPermission(user, permission) {
  return PERMISSION_SET.has(permission) && getPermissions(user).includes(permission);
}

module.exports = {
  RBAC_SEED_VERSION: RBAC_SEED.version,
  ALLOWED_ROLES,
  PERMISSIONS,
  ROLE_CATALOG,
  getRoles,
  getPermissions,
  hasPermission,
  isValidRoleAssignment,
  getRoleAssignmentError
};

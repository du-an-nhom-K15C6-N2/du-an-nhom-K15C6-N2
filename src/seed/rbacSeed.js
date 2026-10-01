const rbacPolicy = require('../config/rbacPolicy');

const seedRoles = rbacPolicy.ROLE_LIST.map((role) => ({
  role,
  permissions: rbacPolicy[role],
}));

module.exports = {
  seedRoles,
  rbacPolicy,
};

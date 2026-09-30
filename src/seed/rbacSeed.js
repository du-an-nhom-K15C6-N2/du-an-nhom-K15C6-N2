const rbacPolicy = require('../config/rbacPolicy');

const seedRoles = Object.keys(rbacPolicy).map((role) => ({
  role,
  permissions: rbacPolicy[role],
}));

module.exports = {
  seedRoles,
  rbacPolicy,
};

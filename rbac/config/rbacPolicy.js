// Cấu hình danh sách 8 vai trò nghiệp vụ và quyền tương ứng.
// Mặc định: không có quyền nào được cấp ngoài danh sách này.
const rbacPolicy = {
  LECTURER: {
    grades: ['READ', 'WRITE'],
    tuition: [],
    system: [],
  },
  ACCOUNTANT: {
    grades: ['READ'],
    tuition: ['READ', 'WRITE'],
    system: [],
  },
  STUDENT: {
    grades: ['READ_SELF'],
    tuition: ['READ_SELF'],
    system: [],
  },
  ADMIN: {
    grades: ['READ', 'WRITE'],
    tuition: ['READ', 'WRITE'],
    system: ['READ', 'WRITE'],
  },
  ACADEMIC_MANAGER: {
    grades: ['READ', 'WRITE'],
    tuition: ['READ'],
    system: [],
  },
  HEAD_OF_DEPT: {
    grades: ['READ', 'APPROVE'],
    tuition: [],
    system: [],
  },
  EXAM_OFFICER: {
    grades: ['READ', 'WRITE'],
    tuition: [],
    system: [],
  },
  DORM_MANAGER: {
    grades: [],
    tuition: [],
    dormitory: ['READ', 'WRITE'],
    system: [],
  },
};

module.exports = rbacPolicy;
module.exports.ROLE_LIST = Object.keys(rbacPolicy);

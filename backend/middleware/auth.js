/**
 * Middleware xác thực và phân quyền cho hệ thống
 *
 * Hỗ trợ xác minh vai trò Quản lý đào tạo (training_manager / admin)
 * theo yêu cầu bảo mật của DNKN-257.
 */

const TRAINING_MANAGER_ROLES = new Set(['training_manager', 'admin', 'quan_ly_dao_tao']);

function normalizeRole(role) {
  if (!role) return '';
  return String(role).trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function isTrainingManager(role) {
  const norm = normalizeRole(role);
  return TRAINING_MANAGER_ROLES.has(norm);
}

/**
 * Trích xuất thông tin người dùng từ request (header, token hoặc mock)
 */
function extractUserMiddleware(req, res, next) {
  const roleHeader = req.header('x-user-role') || '';
  const idHeader = req.header('x-user-id') || '';
  let nameHeader = req.header('x-user-name') || '';
  try {
    nameHeader = decodeURIComponent(nameHeader);
  } catch {
    // giữ nguyên
  }

  const authHeader = req.header('authorization') || '';
  let tokenRole = '';
  let tokenSub = '';
  let tokenName = '';

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    // Hỗ trợ token dạng mock hoặc base64 json trong dev/test: {"role":"training_manager",...}
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
      if (decoded && typeof decoded === 'object') {
        tokenRole = decoded.role || '';
        tokenSub = decoded.id || decoded.sub || '';
        tokenName = decoded.name || '';
      }
    } catch {
      // Nếu token là chuỗi tên vai trò trực tiếp (như 'training_manager')
      if (['training_manager', 'admin', 'consultant', 'lecturer'].includes(token.toLowerCase())) {
        tokenRole = token;
      }
    }
  }

  const role = roleHeader || tokenRole || req.body?.userRole || 'guest';
  const id = idHeader || tokenSub || req.body?.userId || 'usr-default';
  const name = nameHeader || tokenName || req.body?.userName || (isTrainingManager(role) ? 'Quản lý đào tạo' : 'Người dùng');

  req.user = {
    id,
    name,
    role: normalizeRole(role),
    isTrainingManager: isTrainingManager(role)
  };

  next();
}

/**
 * Middleware bắt buộc vai trò Quản lý đào tạo
 */
function requireTrainingManagerMiddleware(req, res, next) {
  if (!req.user || !req.user.isTrainingManager) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN_OVERRIDE',
      message: 'Chỉ người có quyền Quản lý đào tạo mới được xác nhận ghi đè.'
    });
  }
  next();
}

module.exports = {
  TRAINING_MANAGER_ROLES,
  normalizeRole,
  isTrainingManager,
  extractUserMiddleware,
  requireTrainingManagerMiddleware
};

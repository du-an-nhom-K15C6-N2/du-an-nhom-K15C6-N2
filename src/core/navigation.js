/**
 * DNKN-3: Chuẩn bị hành vi chuyển hướng (Navigation logic)
 * Thiết lập logic điều hướng dựa trên Role của người dùng ngay sau khi xác thực thành công.
 */

export const USER_ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  USER: 'USER'
};

export const ROLE_NAVIGATION_MAP = {
  [USER_ROLES.ADMIN]: {
    path: '/admin/dashboard',
    title: 'Hệ thống Quản trị Cấp cao (Admin Portal)',
    description: 'Quản lý toàn diện tài khoản, cấu hình phân quyền và giám sát hệ thống.',
    badgeColor: '#ef4444',
    icon: 'shield-alert'
  },
  [USER_ROLES.MANAGER]: {
    path: '/manager/dashboard',
    title: 'Bảng Quản lý Hoạt động (Manager Dashboard)',
    description: 'Theo dõi tiến độ dự án, báo cáo nhóm và phê duyệt tài liệu.',
    badgeColor: '#f59e0b',
    icon: 'briefcase'
  },
  [USER_ROLES.USER]: {
    path: '/user/workspace',
    title: 'Không gian Làm việc (User Workspace)',
    description: 'Xem nhiệm vụ cá nhân, cập nhật tiến độ công việc và tài nguyên.',
    badgeColor: '#3b82f6',
    icon: 'user'
  }
};

/**
 * Xác định route đích dựa theo vai trò (Role)
 * @param {string} role - Vai trò của người dùng (ADMIN, MANAGER, USER)
 * @param {string} [returnUrl] - URL đích mong muốn nếu có trước khi bị chặn đăng nhập
 * @returns {{ path: string, title: string, description: string, badgeColor: string }}
 */
export function resolveNavigationByRole(role, returnUrl = null) {
  const normalizedRole = (role || '').toUpperCase();

  // Nếu có returnUrl hợp lệ và không trỏ vào trang login, ưu tiên chuyển về returnUrl
  if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('/login')) {
    const config = ROLE_NAVIGATION_MAP[normalizedRole] || ROLE_NAVIGATION_MAP[USER_ROLES.USER];
    return {
      path: returnUrl,
      title: config.title,
      description: `Đang chuyển hướng về trang bạn yêu cầu: ${returnUrl}`,
      badgeColor: config.badgeColor
    };
  }

  const roleConfig = ROLE_NAVIGATION_MAP[normalizedRole];

  if (roleConfig) {
    return roleConfig;
  }

  // Mặc định chuyển về user workspace nếu role không xác định
  return ROLE_NAVIGATION_MAP[USER_ROLES.USER];
}

/**
 * Thực hiện chuyển hướng (giả lập SPA navigation hoặc cập nhật window.location)
 * @param {string} path - Đường dẫn cần chuyển đến
 * @param {Object} [state] - Dữ liệu kèm theo
 */
export function navigateTo(path, state = {}) {
  try {
    window.history.pushState({ ...state, navigatedAt: Date.now() }, '', path);
    // Bắn custom event để các component lắng nghe và re-render SPA view
    window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path, state } }));
  } catch (err) {
    console.warn('Lỗi khi cập nhật history state:', err);
  }
}

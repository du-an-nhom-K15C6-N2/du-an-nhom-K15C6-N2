/**
 * DNKN-3: Dịch vụ xác thực (Auth Service)
 * Dễ dàng kết nối với API backend thực tế hoặc sử dụng Mock Service tích hợp sẵn.
 */

// Đọc cấu hình URL API từ biến môi trường (nếu có backend thật)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Danh sách tài khoản giả lập chuẩn để kiểm thử mọi luồng vai trò & lỗi
 */
export const DEMO_CREDENTIALS = [
  {
    label: 'Quản trị viên (Admin)',
    email: 'admin@system.com',
    password: 'Admin@123',
    role: 'ADMIN',
    fullName: 'Nguyễn Văn Quản Trị',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    description: 'Quyền hạn tối cao: Quản trị hệ thống, tài khoản, cấu hình toàn cục.'
  },
  {
    label: 'Trưởng phòng (Manager)',
    email: 'manager@company.com',
    password: 'Manager@123',
    role: 'MANAGER',
    fullName: 'Trần Thị Trưởng Phòng',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80',
    description: 'Quyền hạn quản lý: Theo dõi tiến độ nhóm, phê duyệt yêu cầu.'
  },
  {
    label: 'Nhân viên / User',
    email: 'user@portal.com',
    password: 'User@123',
    role: 'USER',
    fullName: 'Lê Hoàng Nhân Viên',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    description: 'Quyền hạn cơ bản: Sử dụng không gian làm việc cá nhân.'
  }
];

/**
 * Tạo chuỗi JWT giả lập chuẩn cấu trúc (Header.Payload.Signature)
 */
function createMockJwtToken(user) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = btoa(JSON.stringify({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.fullName,
    iat: now,
    exp: now + 3600 * 24 // Hết hạn sau 24h
  }));
  const signature = btoa('mock_dnkn3_secret_signature');
  return `${header}.${payload}.${signature}`;
}

/**
 * Gửi yêu cầu đăng nhập lên API Backend
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ success: boolean, token: string, user: Object, role: string }>}
 */
export async function loginApi({ email, password }) {
  // Nếu có API backend thật được cấu hình qua VITE_API_BASE_URL
  if (API_BASE_URL) {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage = data?.message || 
        (response.status === 401 ? 'Email hoặc mật khẩu không chính xác.' :
         response.status === 403 ? 'Tài khoản của bạn đã bị vô hiệu hóa hoặc chưa được cấp quyền.' :
         response.status === 500 ? 'Lỗi máy chủ nội bộ. Vui lòng liên hệ quản trị viên.' :
         `Đăng nhập thất bại (Mã lỗi HTTP ${response.status}).`);
      throw new Error(errorMessage);
    }

    return {
      success: true,
      token: data.token || data.accessToken,
      user: data.user,
      role: data.user?.role || data.role
    };
  }

  // Luồng Mock Service phục vụ kiểm thử Frontend DNKN-3
  return new Promise((resolve, reject) => {
    // Độ trễ ngẫu nhiên mô phỏng mạng thực tế (600ms - 900ms)
    const delay = 750;

    setTimeout(() => {
      const normalizedEmail = (email || '').trim().toLowerCase();

      // Trường hợp tài khoản bị khoá
      if (normalizedEmail === 'locked@system.com') {
        return reject(new Error('Tài khoản này đã bị khóa do vi phạm chính sách bảo mật.'));
      }

      // Trường hợp mô phỏng lỗi máy chủ
      if (normalizedEmail === 'server-error@system.com') {
        return reject(new Error('Máy chủ đang phản hồi chậm hoặc đang bảo trì định kỳ.'));
      }

      // Tìm trong danh sách demo
      const matchedAccount = DEMO_CREDENTIALS.find(
        (acc) => acc.email.toLowerCase() === normalizedEmail && acc.password === password
      );

      if (!matchedAccount) {
        return reject(new Error('Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.'));
      }

      const userData = {
        id: `usr_${matchedAccount.role.toLowerCase()}_${Date.now()}`,
        email: matchedAccount.email,
        fullName: matchedAccount.fullName,
        role: matchedAccount.role,
        avatar: matchedAccount.avatar,
        lastLogin: new Date().toISOString()
      };

      const token = createMockJwtToken(userData);

      resolve({
        success: true,
        token,
        user: userData,
        role: userData.role
      });
    }, delay);
  });
}

/**
 * Đăng xuất khỏi hệ thống
 */
export async function logoutApi() {
  if (API_BASE_URL) {
    try {
      await fetch(`${API_BASE_URL}/api/v1/auth/logout`, { method: 'POST' });
    } catch (err) {
      console.warn('Lỗi khi gọi API logout:', err);
    }
  }
  return { success: true };
}

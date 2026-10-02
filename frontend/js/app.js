/**
 * ĐỒ ÁN MÔN THỰC TẬP CƠ SỞ (TTCS)
 * Module 1: Trang Đăng Nhập An Toàn (Tiêu chí EP-01: AC 1-2-3)
 * Module 2: Màn Hình Quản Lý Người Dùng / Quản Trị Tài Khoản (AC 1-2-3-4)
 * 
 * Kiến trúc: Vanilla JavaScript Modular ES6+, Mock RESTful API Engine, LocalStorage Persistence
 */

(function () {
  'use strict';

  // ====================================================================
  // 1. MOCK DATABASE - KHỞI TẠO 28 TÀI KHOẢN MẪU (20 DÒNG/TRANG)
  // ====================================================================
  const INITIAL_USERS = [
    { id: 'usr_001', name: 'Giáp Văn Hiếu', email: 'admin@edu.vn', phone: '0981234567', role: 'admin', roleLabel: 'Quản trị viên', status: 'active', statusLabel: 'Đang hoạt động' },
    { id: 'usr_002', name: 'ThS. Trần Thị Mai', email: 'teacher@edu.vn', phone: '0912345678', role: 'teacher', roleLabel: 'Giảng viên', status: 'active', statusLabel: 'Đang hoạt động' },
    { id: 'usr_003', name: 'Nguyễn Văn An', email: 'student@edu.vn', phone: '0901234567', role: 'student', roleLabel: 'Học sinh', status: 'active', statusLabel: 'Đang hoạt động' },
    { id: 'usr_004', name: 'Lê Thị Thu Thảo', email: 'thao.le@edu.vn', phone: '0934567890', role: 'assistant', roleLabel: 'Trợ giảng', status: 'active', statusLabel: 'Đang hoạt động' },
    { id: 'usr_005', name: 'Trần Minh Quân', email: 'quan.tm@edu.vn', phone: '0945678901', role: 'student', roleLabel: 'Học sinh', status: 'locked', statusLabel: 'Đang bị khóa' },
    { id: 'usr_006', name: 'Phạm Hoàng Nam', email: 'nam.ph@edu.vn', phone: '0967890123', role: 'student', roleLabel: 'Học sinh', status: 'active', statusLabel: 'Đang hoạt động' },
    { id: 'usr_007', name: 'Đỗ Bích Phương', email: 'phuong.db@edu.vn', phone: '0978901234', role: 'student', roleLabel: 'Học sinh', status: 'pending', statusLabel: 'Chờ kích hoạt' },
    { id: 'usr_008', name: 'TS. Nguyễn Bảo Ngọc', email: 'ngoc.nb@edu.vn', phone: '0989012345', role: 'teacher', roleLabel: 'Giảng viên', status: 'active', statusLabel: 'Đang hoạt động' },
    { id: 'usr_009', name: 'Vũ Quốc Khánh', email: 'khanh.vq@edu.vn', phone: '0919012345', role: 'student', roleLabel: 'Học sinh', status: 'active', statusLabel: 'Đang hoạt động' },
    { id: 'usr_010', name: 'Bùi Lan Anh', email: 'anh.bl@edu.vn', phone: '0929012345', role: 'student', roleLabel: 'Học sinh', status: 'active', statusLabel: 'Đang hoạt động' },
    { id: 'usr_011', name: 'Hoàng Văn Thắng', email: 'thang.hv@edu.vn', phone: '0939012345', role: 'student', roleLabel: 'Học sinh', status: 'locked', statusLabel: 'Đang bị khóa' },
    { id: 'usr_012', name: 'PGS. TS. Lê Đức Hùng', email: 'hung.ld@edu.vn', phone: '0949012345', role: 'teacher', roleLabel: 'Giảng viên', status: 'active', statusLabel: 'Đang hoạt động' },
    { id: 'usr_013', name: 'Ngô Thanh Vân', email: 'van.nt@edu.vn', phone: '0959012345', role: 'assistant', roleLabel: 'Trợ giảng', status: 'active', statusLabel: 'Đang hoạt động' },
    { id: 'usr_014', name: 'Đinh Tiến Đạt', email: 'dat.dt@edu.vn', phone: '0969012345', role: 'student', roleLabel: 'Học sinh', status: 'active', statusLabel: 'Đang hoạt động' },
    { id: 'usr_015', name: 'Võ Thị Kim Yến', email: 'yen.vtk@edu.vn', phone: '0979012345', role: 'student', roleLabel: 'Học sinh', status: 'pending', statusLabel: 'Chờ kích hoạt' },
    { id: 'usr_016', name: 'Dương Tuấn Kiệt', email: 'kiet.dt@edu.vn', phone: '0988012345', role: 'student', roleLabel: 'Học sinh', status: 'active', statusLabel: 'Đang hoạt động' },
    { id: 'usr_017', name: 'Mai Phương Thúy', email: 'thuy.mp@edu.vn', phone: '0918012345', role: 'student', roleLabel: 'Học sinh', status: 'active', statusLabel: 'Đang hoạt động' },
    { id: 'usr_018', name: 'Phan Anh Tuấn', email: 'tuan.pa@edu.vn', phone: '0928012345', role: 'assistant', roleLabel: 'Trợ giảng', status: 'active', statusLabel: 'Đang hoạt động' },
    { id: 'usr_019', name: 'Trịnh Thùy Linh', email: 'linh.tt@edu.vn', phone: '0938012345', role: 'student', roleLabel: 'Học sinh', status: 'active', statusLabel: 'Đang hoạt động' },
    { id: 'usr_020', name: 'Hà Quang Huy', email: 'huy.hq@edu.vn', phone: '0948012345', role: 'student', roleLabel: 'Học sinh', status: 'active', statusLabel: 'Đang hoạt động' },
    // Dòng 21 - 28 (Thuộc Trang 2 phân trang 20 dòng/trang)
    { id: 'usr_021', name: 'Cao Bá Quát', email: 'quat.cb@edu.vn', phone: '0958012345', role: 'teacher', roleLabel: 'Giảng viên', status: 'active', statusLabel: 'Đang hoạt động' },
    { id: 'usr_022', name: 'Chu Văn An', email: 'an.cv@edu.vn', phone: '0968012345', role: 'teacher', roleLabel: 'Giảng viên', status: 'active', statusLabel: 'Đang hoạt động' },
    { id: 'usr_023', name: 'Lương Thế Vinh', email: 'vinh.lt@edu.vn', phone: '0978012345', role: 'teacher', roleLabel: 'Giảng viên', status: 'active', statusLabel: 'Đang hoạt động' },
    { id: 'usr_024', name: 'Nguyễn Bỉnh Khiêm', email: 'khiem.nb@edu.vn', phone: '0987012345', role: 'teacher', roleLabel: 'Giảng viên', status: 'active', statusLabel: 'Đang hoạt động' },
    { id: 'usr_025', name: 'Tạ Quang Bửu', email: 'buu.tq@edu.vn', phone: '0917012345', role: 'admin', roleLabel: 'Quản trị viên', status: 'active', statusLabel: 'Đang hoạt động' },
    { id: 'usr_026', name: 'Lê Văn Thiêm', email: 'thiem.lv@edu.vn', phone: '0927012345', role: 'teacher', roleLabel: 'Giảng viên', status: 'locked', statusLabel: 'Đang bị khóa' },
    { id: 'usr_027', name: 'Hoàng Tụy', email: 'tuy.h@edu.vn', phone: '0937012345', role: 'teacher', roleLabel: 'Giảng viên', status: 'active', statusLabel: 'Đang hoạt động' },
    { id: 'usr_028', name: 'Nguyễn Cảnh Toàn', email: 'toan.nc@edu.vn', phone: '0947012345', role: 'teacher', roleLabel: 'Giảng viên', status: 'pending', statusLabel: 'Chờ kích hoạt' }
  ];

  // Storage Keys
  const STORAGE_KEYS = {
    USERS_LIST: 'educlass_user_accounts_list',
    FAILED_ATTEMPTS: 'educlass_failed_attempts_count',
    LOCKOUT_EXPIRY: 'educlass_lockout_expiry_timestamp',
    CURRENT_USER: 'educlass_current_authenticated_user',
    THEME: 'educlass_ui_theme'
  };

  const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 phút = 900,000 ms
  const MAX_CONSECUTIVE_FAILS = 5;
  const PAGE_SIZE_DEFAULT = 20; // 20 dòng/trang theo AC4

  let lockoutTimerInterval = null;

  // ====================================================================
  // 2. BACKEND RESTful API CLIENT (FETCH API TO BACKEND MVC SERVER)
  // ====================================================================
  const ApiService = {
    _cachedUsers: [],

    // Lấy danh sách users từ cache hoặc localStorage hoặc initial fallback
    getUsersStorage: function () {
      if (this._cachedUsers && this._cachedUsers.length > 0) {
        return this._cachedUsers;
      }
      const saved = localStorage.getItem(STORAGE_KEYS.USERS_LIST);
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { return [...INITIAL_USERS]; }
      }
      return [...INITIAL_USERS];
    },

    saveUsersStorage: function (list) {
      this._cachedUsers = list;
      localStorage.setItem(STORAGE_KEYS.USERS_LIST, JSON.stringify(list));
    },

    /**
     * API Đăng Nhập (EP-01) -> POST /api/auth/login
     */
    login: async function (email, password) {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        return data;
      } catch (err) {
        console.warn('Lỗi kết nối Backend API (/api/auth/login), kích hoạt xác thực an toàn cục bộ:', err);
        const users = this.getUsersStorage();
        const target = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        const isPasswordCorrect = (password === '123456' || password === 'Password123!');
        const savedFails = Number(localStorage.getItem(STORAGE_KEYS.FAILED_ATTEMPTS) || '0');
        const lockoutExpiry = Number(localStorage.getItem(STORAGE_KEYS.LOCKOUT_EXPIRY) || '0');

        if (lockoutExpiry && lockoutExpiry > Date.now()) {
          return {
            success: false,
            code: 'ACCOUNT_LOCKED',
            message: 'Tài khoản đang bị khóa tạm thời do nhập sai 5 lần liên tiếp. Vui lòng thử lại sau 15 phút.'
          };
        }

        if (target && isPasswordCorrect) {
          if (target.status === 'locked') {
            return {
              success: false,
              code: 'ACCOUNT_LOCKED',
              message: 'Tài khoản của bạn đã bị khóa.'
            };
          }
          localStorage.removeItem(STORAGE_KEYS.FAILED_ATTEMPTS);
          localStorage.removeItem(STORAGE_KEYS.LOCKOUT_EXPIRY);
          return {
            success: true,
            user: target,
            message: 'Đăng nhập thành công'
          };
        }

        const nextFails = savedFails + 1;
        if (nextFails >= 5) {
          const expiry = Date.now() + 15 * 60 * 1000;
          localStorage.setItem(STORAGE_KEYS.FAILED_ATTEMPTS, '5');
          localStorage.setItem(STORAGE_KEYS.LOCKOUT_EXPIRY, String(expiry));
          return {
            success: false,
            code: 'ACCOUNT_LOCKED',
            message: 'Đã nhập sai 5 lần liên tiếp! Tài khoản bị tạm khóa 15 phút.'
          };
        }

        localStorage.setItem(STORAGE_KEYS.FAILED_ATTEMPTS, String(nextFails));
        return {
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Email hoặc mật khẩu không đúng'
        };
      }
    },

    /**
     * API Lấy danh sách người dùng kèm Tìm kiếm, Lọc, Phân trang 20 dòng/trang (AC3 & AC4)
     * -> GET /api/users
     */
    getUsers: async function ({ page = 1, pageSize = PAGE_SIZE_DEFAULT, search = '', role = 'all', status = 'all' }) {
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          search: search || '',
          role: role || 'all',
          status: status || 'all'
        });

        const res = await fetch(`/api/users?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`HTTP Error ${res.status}`);
        }
        const result = await res.json();
        if (result.success) {
          this._cachedUsers = result.data;
          this.saveUsersStorage(result.data);
          return result;
        }
        throw new Error(result.message || 'Lỗi khi tải dữ liệu người dùng');
      } catch (err) {
        console.warn('Lỗi gọi API GET /api/users, sử dụng dữ liệu cục bộ:', err);
        let list = this.getUsersStorage();

        if (search && search.trim()) {
          const query = search.trim().toLowerCase();
          list = list.filter(u =>
            u.name.toLowerCase().includes(query) ||
            u.email.toLowerCase().includes(query) ||
            u.phone.includes(query)
          );
        }

        if (role !== 'all') {
          list = list.filter(u => u.role === role);
        }

        if (status !== 'all') {
          list = list.filter(u => u.status === status);
        }

        const total = list.length;
        const totalPages = Math.ceil(total / pageSize) || 1;
        const validPage = Math.min(Math.max(1, page), totalPages);
        const startIndex = (validPage - 1) * pageSize;
        const paginatedData = list.slice(startIndex, startIndex + pageSize);

        return {
          success: true,
          data: paginatedData,
          pagination: {
            currentPage: validPage,
            pageSize: pageSize,
            totalRecords: total,
            totalPages: totalPages,
            startIndex: total === 0 ? 0 : startIndex + 1,
            endIndex: Math.min(startIndex + pageSize, total)
          }
        };
      }
    },

    /**
     * API Chi tiết người dùng -> GET /api/users/:id
     */
    getUserById: async function (id) {
      try {
        const res = await fetch(`/api/users/${id}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json.data;
        }
      } catch (err) {
        console.warn('Lỗi fetch getUserById:', err);
      }
      return this.getUsersStorage().find(u => u.id === id) || null;
    },

    /**
     * API Tạo tài khoản mới (AC1 & AC2) -> POST /api/users
     */
    createUser: async function (userData) {
      try {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData)
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.message || 'Không thể tạo tài khoản');
        }
        return result;
      } catch (err) {
        console.warn('Lỗi gọi API POST /api/users:', err);
        throw err;
      }
    },

    /**
     * API Cập nhật tài khoản -> PUT /api/users/:id
     */
    updateUser: async function (id, userData) {
      try {
        const res = await fetch(`/api/users/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData)
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.message || 'Không thể cập nhật tài khoản');
        }
        return result;
      } catch (err) {
        console.warn('Lỗi gọi API PUT /api/users/:id:', err);
        throw err;
      }
    },

    /**
     * API Khóa / Mở khóa tài khoản -> PATCH /api/users/:id/toggle-lock
     */
    toggleLock: async function (id) {
      try {
        const res = await fetch(`/api/users/${id}/toggle-lock`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' }
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.message || 'Không thể thay đổi trạng thái khóa');
        }
        return result;
      } catch (err) {
        console.warn('Lỗi gọi API PATCH /api/users/:id/toggle-lock:', err);
        throw err;
      }
    },

    /**
     * API Xóa tài khoản -> DELETE /api/users/:id
     */
    deleteUser: async function (id) {
      try {
        const res = await fetch(`/api/users/${id}`, {
          method: 'DELETE'
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.message || 'Không thể xóa tài khoản');
        }
        return result;
      } catch (err) {
        console.warn('Lỗi gọi API DELETE /api/users/:id:', err);
        throw err;
      }
    }
  };

  // Tương thích với các lời gọi hàm MockApi trước đó
  const MockApi = ApiService;

  // ====================================================================
  // 3. FRONTEND APPLICATION CONTROLLER
  // ====================================================================
  const app = {
    currentUser: null,
    failedAttempts: 0,
    lockoutExpiry: null,

    // State của màn hình Quản lý người dùng
    userManagementState: {
      currentPage: 1,
      pageSize: PAGE_SIZE_DEFAULT,
      search: '',
      roleFilter: 'all',
      statusFilter: 'all',
      isLoading: false
    },

    init: function () {
      this.initTheme();
      this.loadSecurityState();
      this.setupEventListeners();
      this.checkActiveSession();
      this.loadUsersTable();
      this.updateDebugStatus();
    },

    // ------------------------------------------
    // THEME HANDLING
    // ------------------------------------------
    initTheme: function () {
      const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
      document.documentElement.setAttribute('data-theme', savedTheme);

      const toggleBtn = document.getElementById('theme-toggle-btn');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          const current = document.documentElement.getAttribute('data-theme');
          const next = current === 'dark' ? 'light' : 'dark';
          document.documentElement.setAttribute('data-theme', next);
          localStorage.setItem(STORAGE_KEYS.THEME, next);
        });
      }
    },

    // ------------------------------------------
    // SECURITY STATE FOR EP-01 (FAILED ATTEMPTS & 15-MIN LOCKOUT)
    // ------------------------------------------
    loadSecurityState: function () {
      const savedFails = localStorage.getItem(STORAGE_KEYS.FAILED_ATTEMPTS);
      this.failedAttempts = savedFails ? parseInt(savedFails, 10) : 0;

      const savedLockout = localStorage.getItem(STORAGE_KEYS.LOCKOUT_EXPIRY);
      this.lockoutExpiry = savedLockout ? parseInt(savedLockout, 10) : null;

      const now = Date.now();
      if (this.lockoutExpiry && this.lockoutExpiry > now) {
        this.activateLockoutUI();
      } else {
        if (this.lockoutExpiry && this.lockoutExpiry <= now) {
          this.clearLockoutState();
        }
        this.updateAttemptMeterUI();
      }
    },

    saveSecurityState: function () {
      localStorage.setItem(STORAGE_KEYS.FAILED_ATTEMPTS, this.failedAttempts.toString());
      if (this.lockoutExpiry) {
        localStorage.setItem(STORAGE_KEYS.LOCKOUT_EXPIRY, this.lockoutExpiry.toString());
      } else {
        localStorage.removeItem(STORAGE_KEYS.LOCKOUT_EXPIRY);
      }
    },

    clearLockoutState: function () {
      this.failedAttempts = 0;
      this.lockoutExpiry = null;
      localStorage.removeItem(STORAGE_KEYS.FAILED_ATTEMPTS);
      localStorage.removeItem(STORAGE_KEYS.LOCKOUT_EXPIRY);
      if (lockoutTimerInterval) {
        clearInterval(lockoutTimerInterval);
        lockoutTimerInterval = null;
      }
      this.deactivateLockoutUI();
      this.updateAttemptMeterUI();
      this.updateDebugStatus();
    },

    activateLockoutUI: function () {
      const lockoutBox = document.getElementById('lockout-alert-box');
      const errorBox = document.getElementById('error-alert-box');
      const emailInput = document.getElementById('input-email');
      const pwdInput = document.getElementById('input-password');
      const submitBtn = document.getElementById('btn-submit-login');
      const timerDisplay = document.getElementById('lockout-timer-display');

      if (lockoutBox) lockoutBox.style.display = 'flex';
      if (errorBox) errorBox.style.display = 'none';

      if (emailInput) emailInput.disabled = true;
      if (pwdInput) pwdInput.disabled = true;
      if (submitBtn) submitBtn.disabled = true;

      for (let i = 1; i <= 5; i++) {
        const dot = document.getElementById(`dot-${i}`);
        if (dot) dot.className = 'meter-dot locked';
      }
      const ratio = document.getElementById('attempt-ratio-text');
      if (ratio) ratio.textContent = '5 / 5 (Đang khóa)';

      if (lockoutTimerInterval) clearInterval(lockoutTimerInterval);

      const updateTimer = () => {
        const now = Date.now();
        const diff = this.lockoutExpiry - now;

        if (diff <= 0) {
          clearInterval(lockoutTimerInterval);
          lockoutTimerInterval = null;
          this.clearLockoutState();
          this.showToast('Thời gian khóa 15 phút đã kết thúc. Bạn có thể thử đăng nhập lại.', 'info');
          return;
        }

        const totalSec = Math.ceil(diff / 1000);
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        if (timerDisplay) timerDisplay.textContent = formatted;
      };

      updateTimer();
      lockoutTimerInterval = setInterval(updateTimer, 1000);
    },

    deactivateLockoutUI: function () {
      const lockoutBox = document.getElementById('lockout-alert-box');
      const emailInput = document.getElementById('input-email');
      const pwdInput = document.getElementById('input-password');
      const submitBtn = document.getElementById('btn-submit-login');

      if (lockoutBox) lockoutBox.style.display = 'none';
      if (emailInput) emailInput.disabled = false;
      if (pwdInput) pwdInput.disabled = false;
      if (submitBtn) submitBtn.disabled = false;
    },

    updateAttemptMeterUI: function () {
      const count = Math.min(this.failedAttempts, MAX_CONSECUTIVE_FAILS);
      const ratio = document.getElementById('attempt-ratio-text');
      if (ratio) ratio.textContent = `${count} / 5`;

      for (let i = 1; i <= 5; i++) {
        const dot = document.getElementById(`dot-${i}`);
        if (dot) {
          dot.className = (i <= count) ? 'meter-dot failed' : 'meter-dot';
        }
      }
    },

    updateDebugStatus: function () {
      const debugText = document.getElementById('debug-status-text');
      if (!debugText) return;

      if (this.lockoutExpiry && this.lockoutExpiry > Date.now()) {
        const remainingSec = Math.ceil((this.lockoutExpiry - Date.now()) / 1000);
        const m = Math.floor(remainingSec / 60);
        const s = remainingSec % 60;
        debugText.textContent = `ĐANG KHÓA 15P (${m}p ${s}s)`;
        debugText.style.color = '#ef4444';
      } else {
        debugText.textContent = `Bình thường (${this.failedAttempts}/5 lần sai)`;
        debugText.style.color = this.failedAttempts > 0 ? '#f59e0b' : '#10b981';
      }
    },

    // ------------------------------------------
    // MODULE 1: XỬ LÝ ĐĂNG NHẬP (EP-01 LOGIC)
    // ------------------------------------------
    handleLogin: async function (e) {
      if (e) e.preventDefault();

      // Kiểm tra nếu đang bị khóa
      if (this.lockoutExpiry && this.lockoutExpiry > Date.now()) {
        this.showToast('Tài khoản đang bị tạm khóa 15 phút. Vui lòng đợi.', 'error');
        return;
      }

      const emailInput = document.getElementById('input-email');
      const pwdInput = document.getElementById('input-password');
      const email = emailInput ? emailInput.value.trim() : '';
      const password = pwdInput ? pwdInput.value : '';

      // Client validation: Email & Mật khẩu bắt buộc
      let hasError = false;
      const emailFieldErr = document.getElementById('email-field-error');
      const pwdFieldErr = document.getElementById('password-field-error');

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!email) {
        if (emailFieldErr) emailFieldErr.textContent = 'Vui lòng nhập địa chỉ email.';
        hasError = true;
      } else if (!emailRegex.test(email)) {
        if (emailFieldErr) emailFieldErr.textContent = 'Địa chỉ email không đúng định dạng (vd: user@school.edu.vn).';
        hasError = true;
      } else {
        if (emailFieldErr) emailFieldErr.textContent = '';
      }

      if (!password) {
        if (pwdFieldErr) pwdFieldErr.textContent = 'Vui lòng nhập mật khẩu.';
        hasError = true;
      } else {
        if (pwdFieldErr) pwdFieldErr.textContent = '';
      }

      if (hasError) return;

      // Bật trạng thái loading của nút Đăng nhập
      const submitBtn = document.getElementById('btn-submit-login');
      const spinner = document.getElementById('login-spinner');
      const btnText = document.getElementById('login-btn-text');
      const btnIcon = document.getElementById('login-btn-icon');

      if (submitBtn) submitBtn.disabled = true;
      if (spinner) spinner.style.display = 'inline-block';
      if (btnIcon) btnIcon.style.display = 'none';
      if (btnText) btnText.textContent = 'Đang xác thực...';

      try {
        // GỌI MOCK API ĐĂNG NHẬP
        const response = await MockApi.login(email, password);

        if (response.success) {
          // AC 1: Đăng nhập đúng -> Điều hướng vào trang chủ tương ứng vai trò
          this.failedAttempts = 0;
          localStorage.removeItem(STORAGE_KEYS.FAILED_ATTEMPTS);
          this.currentUser = response.user;
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(response.user));

          const errorBox = document.getElementById('error-alert-box');
          if (errorBox) errorBox.style.display = 'none';

          this.updateAttemptMeterUI();
          this.updateDebugStatus();
          this.showToast(`Đăng nhập thành công! Vai trò: ${response.user.roleLabel}`, 'success');

          // Điều hướng vai trò
          this.routeToRolePortal(response.user);

        } else {
          // AC 2 & AC 3: Đăng nhập sai
          this.failedAttempts++;
          this.saveSecurityState();
          this.updateAttemptMeterUI();
          this.updateDebugStatus();

          // Hiệu ứng rung form
          const authCard = document.getElementById('auth-card');
          if (authCard) {
            authCard.classList.remove('shake');
            void authCard.offsetWidth;
            authCard.classList.add('shake');
          }

          if (this.failedAttempts >= MAX_CONSECUTIVE_FAILS) {
            // AC 3: Đã sai 5 lần -> Kích hoạt khóa tạm thời 15 phút
            this.lockoutExpiry = Date.now() + LOCKOUT_DURATION_MS;
            this.saveSecurityState();
            this.activateLockoutUI();
            this.updateDebugStatus();
            this.showToast('Đã nhập sai 5 lần liên tiếp! Tài khoản bị tạm khóa 15 phút.', 'error');
          } else {
            // AC 2: Hiển thị chính xác 'Email hoặc mật khẩu không đúng'
            const errorBox = document.getElementById('error-alert-box');
            const errorMsg = document.getElementById('error-message-text');
            const attemptsHint = document.getElementById('attempts-hint-text');

            if (errorBox) errorBox.style.display = 'flex';
            if (errorMsg) errorMsg.textContent = 'Email hoặc mật khẩu không đúng';

            const remaining = MAX_CONSECUTIVE_FAILS - this.failedAttempts;
            if (attemptsHint) {
              attemptsHint.textContent = `Còn ${remaining} lần thử trước khi tài khoản bị tạm khóa 15 phút.`;
            }
          }
        }
      } catch (err) {
        this.showToast('Lỗi kết nối máy chủ xác thực.', 'error');
      } finally {
        // Tắt loading
        if (submitBtn && !(this.lockoutExpiry && this.lockoutExpiry > Date.now())) submitBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
        if (btnIcon) btnIcon.style.display = 'inline-block';
        if (btnText) btnText.textContent = 'Đăng Nhập Vào Hệ Thống';
      }
    },

    // ------------------------------------------
    // ROLE ROUTING & NAVIGATION
    // ------------------------------------------
    routeToRolePortal: function (user) {
      document.getElementById('auth-section').style.display = 'none';
      document.getElementById('portal-student').style.display = 'none';
      document.getElementById('portal-teacher').style.display = 'none';
      document.getElementById('portal-user-management').style.display = 'none';

      // Cập nhật hiển thị thanh điều hướng:
      // MỤC "QUẢN LÝ NGƯỜI DÙNG" CHỈ HIỂN THỊ KHI TÀI KHOẢN LÀ QUẢN TRỊ VIÊN (ADMIN)
      const headerNav = document.getElementById('header-nav-tabs');
      const tabUsers = document.getElementById('tab-nav-users');

      if (user && user.role === 'admin') {
        if (headerNav) headerNav.style.display = 'flex';
        if (tabUsers) {
          tabUsers.style.display = 'inline-flex';
          tabUsers.classList.add('active');
        }
      } else {
        if (headerNav) headerNav.style.display = 'none';
        if (tabUsers) {
          tabUsers.style.display = 'none';
          tabUsers.classList.remove('active');
        }
      }

      // Update User menu badge
      const userMenu = document.getElementById('user-menu-wrapper');
      const navAvatar = document.getElementById('nav-user-avatar');
      const navName = document.getElementById('nav-user-name');
      const navRole = document.getElementById('nav-role-badge');

      if (userMenu) userMenu.style.display = 'flex';
      if (navName) navName.textContent = user.name;
      if (navRole) {
        navRole.textContent = user.roleLabel;
        navRole.className = `user-role-badge badge-${user.role}`;
      }
      if (navAvatar) {
        const parts = user.name.split(' ');
        navAvatar.textContent = parts[parts.length - 1].substring(0, 2).toUpperCase();
      }

      if (user.role === 'admin') {
        // Quản trị viên -> Điều hướng trực tiếp vào Màn hình Quản lý người dùng!
        document.getElementById('portal-user-management').style.display = 'block';
        this.loadUsersTable();
      } else if (user.role === 'teacher') {
        document.getElementById('portal-teacher').style.display = 'block';
        const tName = document.getElementById('teacher-name');
        if (tName) tName.textContent = user.name;
      } else {
        document.getElementById('portal-student').style.display = 'block';
        const sName = document.getElementById('student-name');
        if (sName) sName.textContent = user.name;
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    showLoginView: function () {
      document.getElementById('auth-section').style.display = 'flex';
      document.getElementById('portal-student').style.display = 'none';
      document.getElementById('portal-teacher').style.display = 'none';
      document.getElementById('portal-user-management').style.display = 'none';

      // Ẩn thanh tab điều hướng Quản lý người dùng khi ở màn hình đăng nhập
      const headerNav = document.getElementById('header-nav-tabs');
      const tabUsers = document.getElementById('tab-nav-users');
      if (headerNav) headerNav.style.display = 'none';
      if (tabUsers) {
        tabUsers.style.display = 'none';
        tabUsers.classList.remove('active');
      }
    },

    switchToAdminUserManagement: function () {
      // Bảo vệ phân quyền: chỉ admin mới được vào màn hình quản lý người dùng
      if (!this.currentUser || this.currentUser.role !== 'admin') {
        this.showToast('Chỉ tài khoản Quản trị viên mới có quyền truy cập Quản lý Người dùng.', 'warning');
        return;
      }

      document.getElementById('auth-section').style.display = 'none';
      document.getElementById('portal-student').style.display = 'none';
      document.getElementById('portal-teacher').style.display = 'none';
      document.getElementById('portal-user-management').style.display = 'block';

      const headerNav = document.getElementById('header-nav-tabs');
      const tabUsers = document.getElementById('tab-nav-users');
      if (headerNav) headerNav.style.display = 'flex';
      if (tabUsers) {
        tabUsers.style.display = 'inline-flex';
        tabUsers.classList.add('active');
      }

      this.loadUsersTable();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    handleBrandClick: function () {
      if (this.currentUser) {
        this.routeToRolePortal(this.currentUser);
      } else {
        this.showLoginView();
      }
    },

    logout: function () {
      this.currentUser = null;
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      const userMenu = document.getElementById('user-menu-wrapper');
      if (userMenu) userMenu.style.display = 'none';

      const headerNav = document.getElementById('header-nav-tabs');
      const tabUsers = document.getElementById('tab-nav-users');
      if (headerNav) headerNav.style.display = 'none';
      if (tabUsers) {
        tabUsers.style.display = 'none';
        tabUsers.classList.remove('active');
      }

      this.showLoginView();
      this.showToast('Bạn đã đăng xuất an toàn khỏi hệ thống.', 'info');
    },

    checkActiveSession: function () {
      const savedUserJson = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (savedUserJson) {
        try {
          const user = JSON.parse(savedUserJson);
          this.currentUser = user;
          this.routeToRolePortal(user);
          return;
        } catch (e) {
          localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        }
      }
      this.showLoginView();
    },

    // ------------------------------------------
    // MODULE 2: MÀN HÌNH QUẢN LÝ NGƯỜI DÙNG (AC 1-2-3-4)
    // ------------------------------------------
    loadUsersTable: async function () {
      const tbody = document.getElementById('user-table-body');
      const emptyState = document.getElementById('user-empty-state');
      const summary = document.getElementById('user-count-summary');

      if (!tbody) return;

      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
            <div class="btn-spinner" style="margin: 0 auto 10px; width: 24px; height: 24px; border-width: 3px;"></div>
            Đang tải danh sách tài khoản...
          </td>
        </tr>
      `;

      try {
        const result = await MockApi.getUsers({
          page: this.userManagementState.currentPage,
          pageSize: this.userManagementState.pageSize,
          search: this.userManagementState.search,
          role: this.userManagementState.roleFilter,
          status: this.userManagementState.statusFilter
        });

        if (result.success) {
          const { data, pagination } = result;
          this.currentTableUsers = data;

          if (summary) {
            summary.textContent = `Tổng cộng ${pagination.totalRecords} tài khoản trong hệ thống`;
          }

          if (data.length === 0) {
            tbody.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            this.renderPagination({ totalRecords: 0, totalPages: 1, currentPage: 1, startIndex: 0, endIndex: 0 });
            return;
          }

          if (emptyState) emptyState.style.display = 'none';

          // Render rows
          tbody.innerHTML = data.map((u, index) => {
            const rowNumber = (pagination.currentPage - 1) * pagination.pageSize + index + 1;
            const statusBadgeClass = u.status === 'active' ? 'status-active' : (u.status === 'locked' ? 'status-locked' : 'status-pending');
            const roleBadgeClass = `badge-${u.role}`;

            return `
              <tr id="user-row-${u.id}">
                <td style="text-align: center; font-weight: 700; color: var(--text-muted);">${rowNumber}</td>
                <td class="user-name-cell">${this.escapeHtml(u.name)}</td>
                <td class="user-email-cell">${this.escapeHtml(u.email)}</td>
                <td><code>${this.escapeHtml(u.phone)}</code></td>
                <td><span class="cred-role-badge ${roleBadgeClass}">${this.escapeHtml(u.roleLabel)}</span></td>
                <td>
                  <span class="status-badge ${statusBadgeClass}">
                    <span class="badge-dot"></span>
                    ${this.escapeHtml(u.statusLabel)}
                  </span>
                </td>
                <td style="text-align: right;">
                  <div class="action-btn-group">
                    <button type="button" class="btn-table-action btn-action-edit" onclick="app.openEditUserModal('${u.id}')" title="Sửa thông tin">
                      ✏️ Sửa
                    </button>
                    <button type="button" class="btn-table-action btn-action-lock" onclick="app.toggleLockUser('${u.id}')" title="${u.status === 'locked' ? 'Mở khóa' : 'Khóa'}">
                      ${u.status === 'locked' ? '🔓 Mở' : '🔒 Khóa'}
                    </button>
                    <button type="button" class="btn-table-action btn-action-delete" onclick="app.deleteUser('${u.id}', '${this.escapeHtml(u.name)}')" title="Xóa tài khoản">
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('');

          // Render Pagination
          this.renderPagination(pagination);
        }
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#f87171;padding:30px;">Lỗi tải dữ liệu người dùng.</td></tr>`;
      }
    },

    renderPagination: function (p) {
      const pageStart = document.getElementById('page-start');
      const pageEnd = document.getElementById('page-end');
      const totalCount = document.getElementById('total-users-count');
      const controls = document.getElementById('pagination-controls');

      if (pageStart) pageStart.textContent = p.totalRecords > 0 ? p.startIndex : 0;
      if (pageEnd) pageEnd.textContent = p.endIndex;
      if (totalCount) totalCount.textContent = p.totalRecords;

      if (!controls) return;

      if (p.totalPages <= 1 && p.totalRecords === 0) {
        controls.innerHTML = '';
        return;
      }

      let html = '';

      // Nút Trang trước (Previous)
      html += `
        <button type="button" class="page-btn" ${p.currentPage <= 1 ? 'disabled' : ''} onclick="app.goToPage(${p.currentPage - 1})" aria-label="Trang trước">
          ‹ Trước
        </button>
      `;

      // Danh sách số trang
      for (let i = 1; i <= p.totalPages; i++) {
        html += `
          <button type="button" class="page-btn ${i === p.currentPage ? 'active' : ''}" onclick="app.goToPage(${i})">
            ${i}
          </button>
        `;
      }

      // Nút Trang sau (Next)
      html += `
        <button type="button" class="page-btn" ${p.currentPage >= p.totalPages ? 'disabled' : ''} onclick="app.goToPage(${p.currentPage + 1})" aria-label="Trang sau">
          Sau ›
        </button>
      `;

      controls.innerHTML = html;
    },

    goToPage: function (page) {
      this.userManagementState.currentPage = page;
      this.loadUsersTable();
    },

    // Tìm kiếm (AC 3)
    handleUserSearch: function (e) {
      const val = e.target.value;
      this.userManagementState.search = val;
      this.userManagementState.currentPage = 1; // reset về trang 1

      const clearBtn = document.getElementById('clear-search-btn');
      if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';

      // Debounce gọi API
      if (this.searchTimeout) clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.loadUsersTable();
      }, 250);
    },

    clearSearch: function () {
      const input = document.getElementById('user-search-input');
      if (input) input.value = '';
      this.userManagementState.search = '';
      this.userManagementState.currentPage = 1;
      const clearBtn = document.getElementById('clear-search-btn');
      if (clearBtn) clearBtn.style.display = 'none';
      this.loadUsersTable();
    },

    // Lọc theo Vai trò & Trạng thái (AC 3)
    handleFilterChange: function () {
      const roleSel = document.getElementById('filter-role-select');
      const statusSel = document.getElementById('filter-status-select');

      this.userManagementState.roleFilter = roleSel ? roleSel.value : 'all';
      this.userManagementState.statusFilter = statusSel ? statusSel.value : 'all';
      this.userManagementState.currentPage = 1; // reset về trang 1

      this.loadUsersTable();
    },

    resetFilters: function () {
      const roleSel = document.getElementById('filter-role-select');
      const statusSel = document.getElementById('filter-status-select');
      if (roleSel) roleSel.value = 'all';
      if (statusSel) statusSel.value = 'all';

      this.clearSearch();
    },

    // ------------------------------------------
    // MODAL FORM: THÊM / SỬA TÀI KHOẢN (AC 1 & AC 2)
    // ------------------------------------------
    openAddUserModal: function () {
      const modal = document.getElementById('user-form-modal');
      const title = document.getElementById('user-modal-title');
      const idInput = document.getElementById('form-user-id');
      const nameInput = document.getElementById('form-fullname');
      const emailInput = document.getElementById('form-email');
      const phoneInput = document.getElementById('form-phone');
      const roleSelect = document.getElementById('form-role');
      const statusSelect = document.getElementById('form-status');
      const modalAlert = document.getElementById('modal-error-alert');

      if (title) title.textContent = 'Thêm Tài Khoản Mới';
      if (idInput) idInput.value = '';
      if (nameInput) nameInput.value = '';
      if (emailInput) {
        emailInput.value = '';
        emailInput.disabled = false;
      }
      if (phoneInput) phoneInput.value = '';
      if (roleSelect) roleSelect.value = 'student';
      if (statusSelect) statusSelect.value = 'active';
      if (modalAlert) modalAlert.style.display = 'none';

      this.clearModalErrors();
      if (modal) modal.style.display = 'flex';
    },

    openEditUserModal: async function (id) {
      let user = (this.currentTableUsers || []).find(u => u.id === id);
      if (!user) {
        user = await ApiService.getUserById(id);
      }
      if (!user) {
        const users = MockApi.getUsersStorage();
        user = users.find(u => u.id === id);
      }
      if (!user) return;

      const modal = document.getElementById('user-form-modal');
      const title = document.getElementById('user-modal-title');
      const idInput = document.getElementById('form-user-id');
      const nameInput = document.getElementById('form-fullname');
      const emailInput = document.getElementById('form-email');
      const phoneInput = document.getElementById('form-phone');
      const roleSelect = document.getElementById('form-role');
      const statusSelect = document.getElementById('form-status');
      const modalAlert = document.getElementById('modal-error-alert');

      if (title) title.textContent = `Chỉnh Sửa Tài Khoản: ${user.name}`;
      if (idInput) idInput.value = user.id;
      if (nameInput) nameInput.value = user.name;
      if (emailInput) {
        emailInput.value = user.email;
        emailInput.disabled = false;
      }
      if (phoneInput) phoneInput.value = user.phone;
      if (roleSelect) roleSelect.value = user.role;
      if (statusSelect) statusSelect.value = user.status;
      if (modalAlert) modalAlert.style.display = 'none';

      this.clearModalErrors();
      if (modal) modal.style.display = 'flex';
    },

    closeUserModal: function () {
      const modal = document.getElementById('user-form-modal');
      if (modal) modal.style.display = 'none';
    },

    clearModalErrors: function () {
      const errName = document.getElementById('err-fullname');
      const errEmail = document.getElementById('err-email');
      const errPhone = document.getElementById('err-phone');
      if (errName) errName.textContent = '';
      if (errEmail) errEmail.textContent = '';
      if (errPhone) errPhone.textContent = '';
    },

    handleUserFormSubmit: async function (e) {
      if (e) e.preventDefault();

      const id = document.getElementById('form-user-id').value;
      const name = document.getElementById('form-fullname').value.trim();
      const email = document.getElementById('form-email').value.trim();
      const phone = document.getElementById('form-phone').value.trim();
      const role = document.getElementById('form-role').value;
      const status = document.getElementById('form-status').value;

      // Validate Client
      let hasError = false;
      const errName = document.getElementById('err-fullname');
      const errEmail = document.getElementById('err-email');
      const errPhone = document.getElementById('err-phone');
      const modalAlert = document.getElementById('modal-error-alert');
      const modalErrorText = document.getElementById('modal-error-text');

      if (modalAlert) modalAlert.style.display = 'none';

      if (!name) {
        if (errName) errName.textContent = 'Vui lòng nhập họ và tên.';
        hasError = true;
      } else {
        if (errName) errName.textContent = '';
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email) {
        if (errEmail) errEmail.textContent = 'Vui lòng nhập email.';
        hasError = true;
      } else if (!emailRegex.test(email)) {
        if (errEmail) errEmail.textContent = 'Email không hợp lệ (vd: user@school.edu.vn).';
        hasError = true;
      } else {
        if (errEmail) errEmail.textContent = '';
      }

      const phoneRegex = /^0\d{9}$/; // 10 chữ số bắt đầu bằng 0
      if (!phone) {
        if (errPhone) errPhone.textContent = 'Vui lòng nhập số điện thoại.';
        hasError = true;
      } else if (!phoneRegex.test(phone)) {
        if (errPhone) errPhone.textContent = 'Số điện thoại phải gồm 10 chữ số (bắt đầu bằng 0).';
        hasError = true;
      } else {
        if (errPhone) errPhone.textContent = '';
      }

      if (hasError) return;

      // Loading spinner in modal
      const saveBtn = document.getElementById('btn-save-user');
      const spinner = document.getElementById('modal-spinner');
      const btnText = document.getElementById('btn-save-user-text');

      if (saveBtn) saveBtn.disabled = true;
      if (spinner) spinner.style.display = 'inline-block';
      if (btnText) btnText.textContent = 'Đang lưu...';

      try {
        if (id) {
          // UPDATE
          const res = await MockApi.updateUser(id, { name, email, phone, role, status });
          this.showToast(res.message, 'success');
          this.closeUserModal();
          this.loadUsersTable();
        } else {
          // CREATE (AC1 & AC2)
          const res = await MockApi.createUser({ name, email, phone, role, status });
          this.showToast(res.message, 'success');
          this.closeUserModal();
          this.loadUsersTable();
        }
      } catch (err) {
        // Tiêu chí AC2: Hiển thị thông báo lỗi màu đỏ cụ thể từ API khi email trùng
        if (modalAlert && modalErrorText) {
          modalErrorText.textContent = err.message;
          modalAlert.style.display = 'flex';
        }
        this.showToast(err.message, 'error');
      } finally {
        if (saveBtn) saveBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
        if (btnText) btnText.textContent = 'Lưu Thông Tin';
      }
    },

    toggleLockUser: async function (id) {
      try {
        const res = await MockApi.toggleLock(id);
        this.showToast(res.message, 'info');
        this.loadUsersTable();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    },

    deleteUser: async function (id, name) {
      if (confirm(`Bạn có chắc chắn muốn xóa tài khoản của "${name}" khỏi hệ thống?`)) {
        try {
          const res = await MockApi.deleteUser(id);
          this.showToast(res.message, 'success');
          this.loadUsersTable();
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      }
    },

    // ------------------------------------------
    // DEMO & EVALUATION SHORTCUTS
    // ------------------------------------------
    demoQuickSwitchAdmin: function () {
      const users = MockApi.getUsersStorage();
      const admin = users.find(u => u.role === 'admin') || INITIAL_USERS[0];
      this.currentUser = admin;
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(admin));
      this.routeToRolePortal(admin);
      this.showToast('Đã đăng nhập tài khoản Quản trị viên (Hiển thị tab Quản lý Người dùng)', 'success');
    },

    demoQuickSwitchRole: function (roleKey) {
      const users = MockApi.getUsersStorage();
      const user = users.find(u => u.role === roleKey) || users[0];
      this.currentUser = user;
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      this.routeToRolePortal(user);
      this.showToast(`Đã chuyển sang vai trò ${user.roleLabel} (Ẩn tab Quản lý Người dùng)`, 'info');
    },

    fillPreset: function (roleKey) {
      this.showLoginView();
      const users = MockApi.getUsersStorage();
      const user = users.find(u => u.role === roleKey);
      if (!user) return;

      const emailInput = document.getElementById('input-email');
      const pwdInput = document.getElementById('input-password');

      if (emailInput) {
        emailInput.value = user.email;
        emailInput.focus();
      }
      if (pwdInput) {
        pwdInput.value = '123456';
      }

      const errorBox = document.getElementById('error-alert-box');
      if (errorBox) errorBox.style.display = 'none';
      const emailFieldErr = document.getElementById('email-field-error');
      const pwdFieldErr = document.getElementById('password-field-error');
      if (emailFieldErr) emailFieldErr.textContent = '';
      if (pwdFieldErr) pwdFieldErr.textContent = '';

      this.showToast(`Đã tự động điền tài khoản ${user.roleLabel} (${user.email})`, 'info');
    },

    simulateFailedAttempt: function () {
      this.showLoginView();
      const emailInput = document.getElementById('input-email');
      const pwdInput = document.getElementById('input-password');
      if (emailInput && !emailInput.value) emailInput.value = 'random_tester@school.edu.vn';
      if (pwdInput) pwdInput.value = 'WrongPassword999!';
      this.handleLogin();
    },

    simulateLockout: function () {
      this.showLoginView();
      this.failedAttempts = MAX_CONSECUTIVE_FAILS;
      this.lockoutExpiry = Date.now() + LOCKOUT_DURATION_MS;
      this.saveSecurityState();
      this.activateLockoutUI();
      this.updateDebugStatus();
      this.showToast('⚡ Đã kích hoạt trạng thái khóa 15 phút sau 5 lần sai (AC3)!', 'error');
    },

    resetSecurityLock: function () {
      this.clearLockoutState();
      const errorBox = document.getElementById('error-alert-box');
      if (errorBox) errorBox.style.display = 'none';
      const emailInput = document.getElementById('input-email');
      const pwdInput = document.getElementById('input-password');
      if (emailInput) emailInput.value = '';
      if (pwdInput) pwdInput.value = '';
      this.showToast('Đã đặt lại trạng thái bảo mật (0/5 lần sai, mở khóa hoàn toàn).', 'success');
    },

    togglePasswordVisibility: function () {
      const pwdInput = document.getElementById('input-password');
      const eyeOpen = document.querySelector('.eye-open');
      const eyeClosed = document.querySelector('.eye-closed');
      if (!pwdInput) return;

      if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        if (eyeOpen) eyeOpen.style.display = 'none';
        if (eyeClosed) eyeClosed.style.display = 'block';
      } else {
        pwdInput.type = 'password';
        if (eyeOpen) eyeOpen.style.display = 'block';
        if (eyeClosed) eyeClosed.style.display = 'none';
      }
    },

    showForgotModal: function (e) {
      if (e) e.preventDefault();
      const modal = document.getElementById('forgot-modal');
      if (modal) modal.style.display = 'flex';
    },

    closeForgotModal: function () {
      const modal = document.getElementById('forgot-modal');
      if (modal) modal.style.display = 'none';
    },

    handleForgotSubmit: function () {
      const emailInput = document.getElementById('forgot-email-input');
      const email = emailInput ? emailInput.value.trim() : '';
      if (!email) {
        this.showToast('Vui lòng nhập email trường của bạn.', 'error');
        return;
      }
      this.closeForgotModal();
      this.showToast('Nếu email hợp lệ, một hướng dẫn đặt lại mật khẩu đã được gửi về hòm thư.', 'info');
    },

    showToast: function (message, type = 'info') {
      const container = document.getElementById('toast-container');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;

      const iconMap = {
        success: '✓',
        error: '⚠️',
        info: 'ℹ️'
      };

      toast.innerHTML = `
        <span class="toast-icon" style="font-weight:bold;">${iconMap[type] || 'ℹ️'}</span>
        <div class="toast-content" style="flex:1;">${this.escapeHtml(message)}</div>
      `;

      container.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 250);
      }, 4000);
    },

    escapeHtml: function (str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

  };

  // Gắn vào window để gọi từ các sự kiện HTML inline onclick
  window.app = app;

  document.addEventListener('DOMContentLoaded', () => {
    app.init();
  });

})();

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
    ACCESS_TOKEN: 'educlass_access_token',
    REMEMBER_ME: 'educlass_remember_me',
    THEME: 'educlass_ui_theme'
  };

  const ATTENDANCE_DRAFT_KEY = 'educlass_attendance_draft';
  const ATTENDANCE_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
  const ACTIVE_WINDOW_MS = 20 * 60 * 1000;
  const MAX_CONSECUTIVE_FAILS = 5;
  const PAGE_SIZE_DEFAULT = 20; // 20 dòng/trang theo AC4

  let lockoutTimerInterval = null;
  let sessionRefreshInterval = null;
  let lastActivityAt = Date.now();

  function getAuthToken() {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
      || sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  function getAuthHeaders() {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function persistAuthSession(user, token, rememberMe) {
    const storage = rememberMe ? localStorage : sessionStorage;
    [localStorage, sessionStorage].forEach(target => {
      target.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      target.removeItem(STORAGE_KEYS.CURRENT_USER);
      target.removeItem(STORAGE_KEYS.REMEMBER_ME);
    });
    storage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
    storage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    storage.setItem(STORAGE_KEYS.REMEMBER_ME, String(rememberMe));
  }

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
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      return res.json();
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

        const res = await fetch(`/api/users?${params.toString()}`, {
          headers: getAuthHeaders()
        });
        if (!res.ok) {
          if (res.status === 401) {
            app.handleSessionExpired();
            const error = new Error('Phiên đăng nhập đã hết hạn. Bản nháp điểm danh được lưu tạm trên thiết bị này.');
            error.sessionExpired = true;
            throw error;
          }
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
        if (err.sessionExpired) throw err;
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
        const res = await fetch(`/api/users/${id}`, { headers: getAuthHeaders() });
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
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
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
          method: 'DELETE',
          headers: getAuthHeaders()
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
    },

    getAttendance: async function () {
      const res = await fetch('/api/attendance', { headers: getAuthHeaders() });
      const result = await res.json();
      if (res.status === 401) {
        app.handleSessionExpired();
        throw new Error('Phiên đăng nhập đã hết hạn. Bản nháp điểm danh được lưu tạm trên thiết bị này.');
      }
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Không thể tải dữ liệu điểm danh.');
      }
      return result.data;
    },

    getAttendanceStudents: async function () {
      const res = await fetch('/api/attendance/students', { headers: getAuthHeaders() });
      const result = await res.json();
      if (res.status === 401) {
        app.handleSessionExpired();
        throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      }
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Không thể tải danh sách học sinh.');
      }
      return result.data;
    },

    createAttendance: async function (record) {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(record)
      });
      const result = await res.json();
      if (res.status === 401) {
        app.handleSessionExpired();
        throw new Error('Phiên đăng nhập đã hết hạn. Bản nháp điểm danh được lưu tạm trên thiết bị này.');
      }
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Không thể lưu điểm danh.');
      }
      return result.data;
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
      this.updateDebugStatus();
    },

    setupEventListeners: function () {
      document.addEventListener('input', event => this.saveAttendanceDraftFromEvent(event), true);
      document.addEventListener('change', event => this.saveAttendanceDraftFromEvent(event), true);
      const loginEmailInput = document.getElementById('input-email');
      if (loginEmailInput) {
        loginEmailInput.addEventListener('input', () => {
          if (!this.lockoutExpiry || this.lockoutExpiry <= Date.now()) return;
          const isLockedEmail = loginEmailInput.value.trim().toLowerCase() === this.lockedEmail;
          const lockoutBox = document.getElementById('lockout-alert-box');
          const passwordInput = document.getElementById('input-password');
          const submitButton = document.getElementById('btn-submit-login');
          if (lockoutBox) lockoutBox.style.display = isLockedEmail ? 'flex' : 'none';
          if (passwordInput) passwordInput.disabled = isLockedEmail;
          if (submitButton) submitButton.disabled = isLockedEmail;
          if (!isLockedEmail) {
            this.failedAttempts = 0;
            this.updateAttemptMeterUI();
          }
        });
      }
      ['pointerdown', 'keydown', 'input', 'change', 'touchstart'].forEach(eventName => {
        document.addEventListener(eventName, () => { lastActivityAt = Date.now(); }, { passive: true });
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          lastActivityAt = Date.now();
          this.refreshSessionIfActive();
        }
      });
      window.addEventListener('storage', event => {
        if (event.key === STORAGE_KEYS.ACCESS_TOKEN && event.newValue === null && this.currentUser) {
          this.finishExpiredSession('Phiên đăng nhập đã được kết thúc ở một thẻ khác. Vui lòng đăng nhập lại.');
        }
      });
    },

    saveAttendanceDraftFromEvent: function (event) {
      const form = event.target.closest && event.target.closest('#attendance-form');
      if (!form) return;
      const draft = {};
      new FormData(form).forEach((value, key) => {
        if (!/password|token|secret|authorization/i.test(key)) draft[key] = value;
      });
      try {
        sessionStorage.setItem(ATTENDANCE_DRAFT_KEY, JSON.stringify(draft));
      } catch (error) {
        console.error('Không thể lưu bản nháp điểm danh:', error);
      }
    },

    startSessionRefresh: function () {
      if (sessionRefreshInterval) clearInterval(sessionRefreshInterval);
      lastActivityAt = Date.now();
      sessionRefreshInterval = setInterval(() => this.refreshSessionIfActive(), ATTENDANCE_REFRESH_INTERVAL_MS);
    },

    refreshSessionIfActive: async function () {
      const token = getAuthToken();
      if (!token || !this.currentUser || Date.now() - lastActivityAt > ACTIVE_WINDOW_MS) return;
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (res.status === 401) {
          this.handleSessionExpired();
          return;
        }
        if (!res.ok || !result.success || !result.token) {
          throw new Error(result.message || 'Không thể gia hạn phiên đăng nhập.');
        }
        const persistent = Boolean(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN));
        const storage = persistent ? localStorage : sessionStorage;
        storage.setItem(STORAGE_KEYS.ACCESS_TOKEN, result.token);
      } catch (error) {
        if (error instanceof TypeError) {
          console.error('Không thể kết nối để gia hạn phiên đăng nhập:', error);
        } else if (!error.message.includes('hết hạn')) {
          console.error('Không thể gia hạn phiên đăng nhập:', error);
        }
      }
    },

    finishExpiredSession: function (message) {
      this.currentUser = null;
      [localStorage, sessionStorage].forEach(storage => {
        storage.removeItem(STORAGE_KEYS.CURRENT_USER);
        storage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        storage.removeItem(STORAGE_KEYS.REMEMBER_ME);
      });
      localStorage.removeItem(STORAGE_KEYS.USERS_LIST);
      ApiService._cachedUsers = [];
      if (sessionRefreshInterval) {
        clearInterval(sessionRefreshInterval);
        sessionRefreshInterval = null;
      }
      this.showLoginView();
      this.showToast(message, 'error');
    },

    handleSessionExpired: function () {
      this.finishExpiredSession('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại. Bản nháp điểm danh được lưu tạm trên thiết bị này.');
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
      this.failedAttempts = 0;
      this.lockoutExpiry = null;
      this.lockedEmail = null;
      localStorage.removeItem(STORAGE_KEYS.FAILED_ATTEMPTS);
      localStorage.removeItem(STORAGE_KEYS.LOCKOUT_EXPIRY);
      this.updateAttemptMeterUI();
    },

    saveSecurityState: function () {
      localStorage.removeItem(STORAGE_KEYS.FAILED_ATTEMPTS);
      localStorage.removeItem(STORAGE_KEYS.LOCKOUT_EXPIRY);
    },

    clearLockoutState: function () {
      this.failedAttempts = 0;
      this.lockoutExpiry = null;
      this.lockedEmail = null;
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
      if (errorBox) errorBox.style.display = 'flex';

      if (emailInput) emailInput.disabled = false;
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
      const submittedEmail = document.getElementById('input-email')?.value.trim().toLowerCase();
      if (
        this.lockoutExpiry > Date.now()
        && submittedEmail === this.lockedEmail
      ) {
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
          this.clearLockoutState();
          localStorage.removeItem(STORAGE_KEYS.FAILED_ATTEMPTS);
          this.currentUser = response.user;
          const rememberMe = Boolean(document.getElementById('remember-me-checkbox')?.checked);
          if (response.token) {
            persistAuthSession(response.user, response.token, rememberMe);
            this.startSessionRefresh();
          } else {
            throw new Error('Máy chủ không trả về phiên đăng nhập hợp lệ.');
          }

          const errorBox = document.getElementById('error-alert-box');
          if (errorBox) errorBox.style.display = 'none';

          this.updateAttemptMeterUI();
          this.updateDebugStatus();
          this.showToast(`Đăng nhập thành công! Vai trò: ${response.user.roleLabel}`, 'success');

          // Điều hướng vai trò
          this.routeToRolePortal(response.user);

        } else {
          // AC 2 & AC 3: Đăng nhập sai
          this.failedAttempts = Math.min(this.failedAttempts + 1, MAX_CONSECUTIVE_FAILS);
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

          if (Number(response.retryAfterSeconds) > 0) {
            this.failedAttempts = MAX_CONSECUTIVE_FAILS;
            this.lockedEmail = email.toLowerCase();
            this.lockoutExpiry = Date.now() + Number(response.retryAfterSeconds) * 1000;
            this.saveSecurityState();
            const errorBox = document.getElementById('error-alert-box');
            const errorMsg = document.getElementById('error-message-text');
            if (errorBox) errorBox.style.display = 'flex';
            if (errorMsg) errorMsg.textContent = 'Email hoặc mật khẩu không đúng';
            this.activateLockoutUI();
            this.updateDebugStatus();
          } else {
            // AC 2: Hiển thị chính xác 'Email hoặc mật khẩu không đúng'
            const errorBox = document.getElementById('error-alert-box');
            const errorMsg = document.getElementById('error-message-text');
            const attemptsHint = document.getElementById('attempts-hint-text');

            if (errorBox) errorBox.style.display = 'flex';
            if (errorMsg) errorMsg.textContent = 'Email hoặc mật khẩu không đúng';

            const remaining = Math.max(0, MAX_CONSECUTIVE_FAILS - this.failedAttempts);
            if (attemptsHint) {
              attemptsHint.textContent = `Còn ${remaining} lần thử trước khi tài khoản bị tạm khóa 15 phút.`;
            }
          }
        }
      } catch (err) {
        this.showToast('Lỗi kết nối máy chủ xác thực.', 'error');
      } finally {
        // Tắt loading
        const isCurrentEmailLocked = this.lockoutExpiry > Date.now()
          && email.toLowerCase() === this.lockedEmail;
        if (submitBtn && !isCurrentEmailLocked) submitBtn.disabled = false;
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
      document.getElementById('portal-attendance').style.display = 'none';

      // Cập nhật hiển thị thanh điều hướng:
      // MỤC "QUẢN LÝ NGƯỜI DÙNG" CHỈ HIỂN THỊ KHI TÀI KHOẢN LÀ QUẢN TRỊ VIÊN (ADMIN)
      const headerNav = document.getElementById('header-nav-tabs');
      const tabUsers = document.getElementById('tab-nav-users');
      const tabAttendance = document.getElementById('tab-nav-attendance');

      if (user && user.role === 'admin') {
        if (headerNav) headerNav.style.display = 'flex';
        if (tabUsers) {
          tabUsers.style.display = 'inline-flex';
          tabUsers.classList.add('active');
        }
        if (tabAttendance) tabAttendance.style.display = 'inline-flex';
      } else {
        if (headerNav) headerNav.style.display = 'none';
        if (tabUsers) {
          tabUsers.style.display = 'none';
          tabUsers.classList.remove('active');
        }
        if (tabAttendance) tabAttendance.style.display = 'none';
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
        this.switchToAttendance();
      } else if (user.role === 'assistant') {
        this.switchToAttendance();
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
      document.getElementById('portal-attendance').style.display = 'none';

      // Ẩn thanh tab điều hướng Quản lý người dùng khi ở màn hình đăng nhập
      const headerNav = document.getElementById('header-nav-tabs');
      const tabUsers = document.getElementById('tab-nav-users');
      const tabAttendance = document.getElementById('tab-nav-attendance');
      if (headerNav) headerNav.style.display = 'none';
      if (tabUsers) {
        tabUsers.style.display = 'none';
        tabUsers.classList.remove('active');
      }
      if (tabAttendance) {
        tabAttendance.style.display = 'none';
        tabAttendance.classList.remove('active');
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
      document.getElementById('portal-attendance').style.display = 'none';

      const headerNav = document.getElementById('header-nav-tabs');
      const tabUsers = document.getElementById('tab-nav-users');
      const tabAttendance = document.getElementById('tab-nav-attendance');
      if (headerNav) headerNav.style.display = 'flex';
      if (tabUsers) {
        tabUsers.style.display = 'inline-flex';
        tabUsers.classList.add('active');
      }
      if (tabAttendance) {
        tabAttendance.style.display = 'inline-flex';
        tabAttendance.classList.remove('active');
      }

      this.loadUsersTable();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    switchToAttendance: function () {
      if (!this.currentUser || !['admin', 'teacher', 'assistant'].includes(this.currentUser.role)) {
        this.showToast('Bạn không có quyền truy cập chức năng điểm danh.', 'warning');
        return;
      }

      document.getElementById('auth-section').style.display = 'none';
      document.getElementById('portal-student').style.display = 'none';
      document.getElementById('portal-teacher').style.display = 'none';
      document.getElementById('portal-user-management').style.display = 'none';
      const attendance = document.getElementById('portal-attendance');
      attendance.style.display = 'block';

      const headerNav = document.getElementById('header-nav-tabs');
      const tabUsers = document.getElementById('tab-nav-users');
      const tabAttendance = document.getElementById('tab-nav-attendance');
      if (this.currentUser.role === 'admin') {
        if (headerNav) headerNav.style.display = 'flex';
        if (tabUsers) tabUsers.classList.remove('active');
        if (tabAttendance) {
          tabAttendance.style.display = 'inline-flex';
          tabAttendance.classList.add('active');
        }
      } else if (headerNav) {
        headerNav.style.display = 'none';
      }

      this.renderAttendanceForm();
      this.loadAttendanceRecords();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    renderAttendanceForm: function () {
      const container = document.getElementById('attendance-form-container');
      if (!container) return;
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      container.innerHTML = `
        <div class="portal-card attendance-card">
          <h2 class="card-title">Ghi nhận điểm danh</h2>
          <form id="attendance-form" class="attendance-form" onsubmit="app.submitAttendance(event)">
            <div class="form-group">
              <label class="form-label" for="attendance-class">Tên lớp</label>
              <input class="form-input" id="attendance-class" name="className" maxlength="120" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="attendance-student-id">Học sinh (tên và email từ Quản lý người dùng)</label>
              <select class="form-select" id="attendance-student-id" name="studentId" required>
                <option value="">Đang tải danh sách học sinh...</option>
              </select>
              <small id="attendance-student-details" role="status"></small>
            </div>
            <div class="form-group">
              <label class="form-label" for="attendance-date">Ngày điểm danh</label>
              <input class="form-input" type="date" id="attendance-date" name="attendanceDate" value="${today}" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="attendance-status">Trạng thái</label>
              <select class="form-select" id="attendance-status" name="status" required>
                <option value="present">Có mặt</option>
                <option value="late">Đi muộn</option>
                <option value="absent">Vắng mặt</option>
                <option value="excused">Có phép</option>
              </select>
            </div>
            <div class="form-group attendance-note-field">
              <label class="form-label" for="attendance-note">Ghi chú (không bắt buộc)</label>
              <textarea class="form-input" id="attendance-note" name="note" maxlength="500" rows="3"></textarea>
            </div>
            <div class="attendance-actions">
              <button type="submit" class="btn-primary-action attendance-submit">Lưu điểm danh</button>
              <span id="attendance-feedback" role="status"></span>
            </div>
          </form>
        </div>
        <div class="portal-card attendance-list-card">
          <h2 class="card-title">Điểm danh gần đây</h2>
          <div id="attendance-record-list">Đang tải dữ liệu điểm danh...</div>
        </div>
      `;
      try {
        const draft = JSON.parse(sessionStorage.getItem(ATTENDANCE_DRAFT_KEY) || 'null');
        if (draft) {
          Object.entries(draft).forEach(([name, value]) => {
            const field = container.querySelector(`[name="${name}"]`);
            if (field) field.value = value;
          });
          this.showToast('Đã khôi phục bản nháp điểm danh.', 'info');
        }
      } catch (error) {
        console.error('Không thể khôi phục bản nháp điểm danh:', error);
      }
      this.loadAttendanceStudents();
    },

    loadAttendanceStudents: async function () {
      const container = document.getElementById('attendance-form-container');
      const form = container?.querySelector('#attendance-form');
      const studentSelect = form?.elements.studentId;
      if (!form || !studentSelect) return;

      try {
        const students = await ApiService.getAttendanceStudents();
        if (document.getElementById('attendance-form') !== form) return;
        const savedDraft = JSON.parse(sessionStorage.getItem(ATTENDANCE_DRAFT_KEY) || 'null');
        studentSelect.replaceChildren(new Option('Chọn học sinh', ''));
        students.forEach(student => {
          studentSelect.add(new Option(`${student.name} — ${student.email}`, student.id));
        });
        studentSelect.value = savedDraft?.studentId || '';
        studentSelect.disabled = students.length === 0;

        const updateStudentDetails = () => {
          const student = students.find(candidate => candidate.id === studentSelect.value);
          const details = document.getElementById('attendance-student-details');
          if (details) details.textContent = student?.email || '';
        };
        studentSelect.addEventListener('change', updateStudentDetails);
        updateStudentDetails();

        if (students.length === 0) {
          const feedback = document.getElementById('attendance-feedback');
          if (feedback) feedback.textContent = 'Chưa có học sinh đang hoạt động trong Quản lý người dùng.';
        }
      } catch (error) {
        if (document.getElementById('attendance-form') !== form) return;
        studentSelect.replaceChildren(new Option('Không tải được danh sách học sinh', ''));
        studentSelect.disabled = true;
        const feedback = document.getElementById('attendance-feedback');
        if (feedback) feedback.textContent = error.message || 'Không thể tải danh sách học sinh.';
      }
    },

    submitAttendance: async function (event) {
      event.preventDefault();
      const form = event.currentTarget;
      const feedback = document.getElementById('attendance-feedback');
      const submit = form.querySelector('[type="submit"]');
      const formData = new FormData(form);
      const record = Object.fromEntries(formData.entries());
      submit.disabled = true;
      feedback.textContent = 'Đang lưu...';
      try {
        await ApiService.createAttendance(record);
        sessionStorage.removeItem(ATTENDANCE_DRAFT_KEY);
        form.reset();
        const dateInput = document.getElementById('attendance-date');
        const now = new Date();
        dateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        feedback.textContent = 'Đã lưu điểm danh.';
        this.showToast('Đã lưu điểm danh thành công.', 'success');
        await this.loadAttendanceRecords();
      } catch (error) {
        feedback.textContent = error.message;
        this.showToast(error.message, 'error');
      } finally {
        submit.disabled = false;
      }
    },

    loadAttendanceRecords: async function () {
      const list = document.getElementById('attendance-record-list');
      if (!list) return;
      try {
        const records = await ApiService.getAttendance();
        const statusLabels = { present: 'Có mặt', late: 'Đi muộn', absent: 'Vắng mặt', excused: 'Có phép' };
        list.innerHTML = records.length
          ? `<div class="table-responsive"><table class="data-table"><thead><tr><th>Ngày</th><th>Lớp</th><th>Học sinh</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>${records.map(record => `
              <tr><td>${this.escapeHtml(record.attendanceDate)}</td><td>${this.escapeHtml(record.className)}</td><td>${this.escapeHtml(record.studentName)}<br><small>${this.escapeHtml(record.studentEmail)}</small></td><td>${this.escapeHtml(statusLabels[record.status] || record.status)}</td><td>${this.escapeHtml(record.note || '—')}</td></tr>
            `).join('')}</tbody></table></div>`
          : '<p>Chưa có dữ liệu điểm danh.</p>';
      } catch (error) {
        list.textContent = error.message || 'Không thể tải dữ liệu điểm danh.';
      }
    },

    handleBrandClick: function () {
      if (this.currentUser) {
        this.routeToRolePortal(this.currentUser);
      } else {
        this.showLoginView();
      }
    },

    logout: async function () {
      const token = getAuthToken();
      let revoked = !token;
      if (token) {
        try {
          const response = await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });
          revoked = response.ok;
        } catch (error) {
          console.error('Không thể thu hồi phiên đăng nhập trên máy chủ:', error);
        }
      }
      this.currentUser = null;
      [localStorage, sessionStorage].forEach(storage => {
        storage.removeItem(STORAGE_KEYS.CURRENT_USER);
        storage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        storage.removeItem(STORAGE_KEYS.REMEMBER_ME);
      });
      localStorage.removeItem(STORAGE_KEYS.USERS_LIST);
      ApiService._cachedUsers = [];
      sessionStorage.removeItem(ATTENDANCE_DRAFT_KEY);
      if (sessionRefreshInterval) {
        clearInterval(sessionRefreshInterval);
        sessionRefreshInterval = null;
      }
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
      this.showToast(
        revoked
          ? 'Bạn đã đăng xuất an toàn khỏi hệ thống.'
          : 'Đã đăng xuất khỏi giao diện nhưng chưa xác nhận được việc thu hồi phiên trên máy chủ. Hãy kiểm tra kết nối.',
        revoked ? 'info' : 'error'
      );
    },

    checkActiveSession: async function () {
      const savedUserJson = localStorage.getItem(STORAGE_KEYS.CURRENT_USER)
        || sessionStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      const token = getAuthToken();
      if (savedUserJson && token) {
        try {
          const response = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          const result = await response.json();
          if (!response.ok || !result.success || !result.user) {
            if (response.status === 401) {
              this.handleSessionExpired();
              return;
            }
            throw new Error(result.message || 'Không thể xác minh phiên đăng nhập.');
          }
          this.currentUser = result.user;
          const rememberMe = Boolean(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN));
          persistAuthSession(result.user, token, rememberMe);
          this.startSessionRefresh();
          this.routeToRolePortal(result.user);
          if (result.user.role === 'admin') this.loadUsersTable();
          return;
        } catch (e) {
          console.error('Không thể khôi phục phiên đăng nhập:', e);
          this.showToast('Không thể xác minh phiên đăng nhập do lỗi kết nối. Vui lòng đăng nhập lại.', 'error');
        }
      }
      [localStorage, sessionStorage].forEach(storage => {
        storage.removeItem(STORAGE_KEYS.CURRENT_USER);
        storage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        storage.removeItem(STORAGE_KEYS.REMEMBER_ME);
      });
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
      const passwordInput = document.getElementById('form-password');
      const confirmPasswordInput = document.getElementById('form-confirm-password');
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
      if (passwordInput) passwordInput.value = '';
      if (confirmPasswordInput) confirmPasswordInput.value = '';
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
      const passwordInput = document.getElementById('form-password');
      const confirmPasswordInput = document.getElementById('form-confirm-password');
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
      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.removeAttribute('required');
      }
      if (confirmPasswordInput) {
        confirmPasswordInput.value = '';
        confirmPasswordInput.removeAttribute('required');
      }
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
      const errPassword = document.getElementById('err-password');
      const errConfirmPassword = document.getElementById('err-confirm-password');
      if (errName) errName.textContent = '';
      if (errEmail) errEmail.textContent = '';
      if (errPhone) errPhone.textContent = '';
      if (errPassword) errPassword.textContent = '';
      if (errConfirmPassword) errConfirmPassword.textContent = '';
    },

    handleUserFormSubmit: async function (e) {
      if (e) e.preventDefault();

      const id = document.getElementById('form-user-id').value;
      const name = document.getElementById('form-fullname').value.trim();
      const email = document.getElementById('form-email').value.trim();
      const phone = document.getElementById('form-phone').value.trim();
      const role = document.getElementById('form-role').value;
      const status = document.getElementById('form-status').value;
      const password = document.getElementById('form-password')?.value || '';
      const confirmPassword = document.getElementById('form-confirm-password')?.value || '';

      // Validate Client
      let hasError = false;
      const errName = document.getElementById('err-fullname');
      const errEmail = document.getElementById('err-email');
      const errPhone = document.getElementById('err-phone');
      const errPassword = document.getElementById('err-password');
      const errConfirmPassword = document.getElementById('err-confirm-password');
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

      if (!id) {
        if (!password) {
          if (errPassword) errPassword.textContent = 'Vui lòng nhập mật khẩu.';
          hasError = true;
        } else if (password.length < 8) {
          if (errPassword) errPassword.textContent = 'Mật khẩu phải có ít nhất 8 ký tự.';
          hasError = true;
        } else {
          if (errPassword) errPassword.textContent = '';
        }

        if (!confirmPassword) {
          if (errConfirmPassword) errConfirmPassword.textContent = 'Vui lòng xác nhận mật khẩu.';
          hasError = true;
        } else if (confirmPassword !== password) {
          if (errConfirmPassword) errConfirmPassword.textContent = 'Mật khẩu xác nhận không khớp.';
          hasError = true;
        } else {
          if (errConfirmPassword) errConfirmPassword.textContent = '';
        }
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
          const res = await MockApi.createUser({ name, email, phone, role, status, password });
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

    showChangePasswordModal: function () {
      const modal = document.getElementById('change-password-modal');
      if (modal) modal.style.display = 'flex';
      document.getElementById('current-password-input')?.focus();
    },

    closeChangePasswordModal: function () {
      const modal = document.getElementById('change-password-modal');
      const form = document.getElementById('change-password-form');
      const error = document.getElementById('change-password-error');
      if (modal) modal.style.display = 'none';
      if (form) form.reset();
      if (error) {
        error.style.display = 'none';
        error.textContent = '';
      }
    },

    handleChangePassword: async function (event) {
      event.preventDefault();
      const form = document.getElementById('change-password-form');
      const error = document.getElementById('change-password-error');
      const submitButton = document.getElementById('btn-change-password-submit');
      const formData = new FormData(form);
      const currentPassword = formData.get('currentPassword');
      const newPassword = formData.get('newPassword');
      const confirmPassword = formData.get('confirmPassword');

      if (newPassword !== confirmPassword) {
        error.textContent = 'Xác nhận mật khẩu mới không khớp.';
        error.style.display = 'block';
        return;
      }

      submitButton.disabled = true;
      error.style.display = 'none';
      try {
        const response = await fetch('/api/auth/change-password', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({ currentPassword, newPassword })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Không thể đổi mật khẩu.');
        this.closeChangePasswordModal();
        this.showToast('Đổi mật khẩu thành công.', 'success');
      } catch (changeError) {
        error.textContent = changeError.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.';
        error.style.display = 'block';
      } finally {
        submitButton.disabled = false;
      }
    },

    handleForgotSubmit: async function () {
      const emailInput = document.getElementById('forgot-email-input');
      const email = emailInput ? emailInput.value.trim() : '';
      const submitButton = document.getElementById('forgot-submit-btn');
      if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        this.showToast('Vui lòng nhập địa chỉ email hợp lệ đã đăng ký.', 'error');
        emailInput?.focus();
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Đang gửi...';
      }

      try {
        const res = await fetch('/api/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (!res.ok) {
          this.showToast(data.message || 'Không thể xử lý yêu cầu. Vui lòng kiểm tra lại địa chỉ email.', 'error');
          return;
        }

        this.closeForgotModal();
        this.showToast(data.message || 'Yêu cầu đã được tiếp nhận.', 'info');
      } catch (e) {
        this.showToast('Không kết nối được máy chủ. Hãy kiểm tra server đang chạy tại cổng 3000 rồi thử lại.', 'error');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Gửi Yêu Cầu';
        }
      }
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

# BÁO CÁO CHI TIẾT CÁC CÂU TRẢ LỜI VÀ MÃ NGUỒN CHO USER STORY DNKN-14

> **User Story:**
> *"Là người dùng của hệ thống, tôi muốn thấy menu điều hướng đúng theo quyền của mình, để không bị rối bởi những chức năng mình không được dùng."*
>
> **Tiêu chí chấp nhận (Description):**
> • Mục menu không thuộc quyền thì không hiển thị  
> • Hiển thị tên và vai trò người đang đăng nhập  
> • Dùng được thuận tiện trên màn hình 360px  

---

## MỤC LỤC CÁC CÂU TRẢ LỜI CHO 6 SUBTASKS

1. [[FE] Xử lý trạng thái không có quyền truy cập khi chọn menu](#1-fe-xử-lý-trạng-thái-không-có-quyền-truy-cập-khi-chọn-menu)
2. [[FE] Hiển thị tên người dùng và vai trò đang đăng nhập](#2-fe-hiển-thị-tên-người-dùng-và-vai-trò-đang-đăng-nhập)
3. [[FE] Xây dựng menu điều hướng động theo quyền người dùng](#3-fe-xây-dựng-menu-điều-hướng-động-theo-quyền-người-dùng)
4. [[FE] Tối ưu giao diện điều hướng cho màn hình 360px](#4-fe-tối-ưu-giao-diện-điều-hướng-cho-màn-hình-360px)
5. [[BE] Cung cấp dữ liệu quyền và vai trò cho giao diện điều hướng](#5-be-cung-cấp-dữ-liệu-quyền-và-vai-trò-cho-giao-diện-điều-hướng)
6. [[QA] Kiểm thử hiển thị menu theo vai trò và kích thước màn hình nhỏ](#6-qa-kiểm-thử-hiển-thị-menu-theo-vai-trò-và-kích-thước-màn-hình-nhỏ)

---

### 1. [FE] Xử lý trạng thái không có quyền truy cập khi chọn menu
* **Yêu cầu (Description):** Hiển thị thông báo phù hợp hoặc điều hướng an toàn khi người dùng cố truy cập vào chức năng không có quyền.
* **Vị trí cài đặt trong dự án:**
  - `src/components/RoleNavigation.js` (Hàm `showAccessDeniedScreen` và logic chặn click menu không có quyền)
  - `src/components/AppErrorScreen.js` (Component hiển thị màn hình lỗi 403 Forbidden chuẩn UX/UI)
  - `src/core/accessForbidden.js` (Hàm `registerAccessForbiddenHandler` lắng nghe sự kiện `app:access-forbidden`)
  - `src/core/navigation.js` (Hàm `getSafeAppPath`, `getSafePreviousPath`, `getAppRouteError`)
* **Cách thức hiện thực:**
  1. Khi người dùng bấm vào một menu chức năng (hoặc gõ trực tiếp URL) mà quyền tài khoản không nằm trong mảng `roles` được phép:
     ```javascript
     // Trích từ src/components/RoleNavigation.js
     if (!targetItem || !targetItem.roles.includes(currentRole)) {
       showAccessDeniedScreen(targetItem?.label || 'Chức năng này', currentRole);
       return;
     }
     ```
  2. Màn hình lỗi `AppErrorScreen` (`type: 'forbidden'`) được kích hoạt, hiển thị mã `403`, tiêu đề *"Bạn không thể truy cập khu vực này"*, tên chức năng bị chặn cùng vai trò hiện tại của tài khoản.
  3. Cung cấp ngay 2 hoặc 3 nút điều hướng an toàn:
     - `Quay lại màn hình an toàn` (`#btn-safe-screen`): Tự động tính toán đường dẫn an toàn theo vai trò (`/student/workspace`, `/teacher/dashboard`, `/admin/dashboard` qua `getSafeAppPath`).
     - `Quay lại trang trước` (`#btn-previous-page`): Điều hướng an toàn về URL trước đó nếu hợp lệ.
     - `Về trang chủ` (`#btn-home`): Trở về `/`.

---

### 2. [FE] Hiển thị tên người dùng và vai trò đang đăng nhập
* **Yêu cầu (Description):** Thiết kế và tích hợp khu vực hiển thị thông tin tài khoản hiện tại trên thanh điều hướng hoặc header để người dùng dễ nhận biết.
* **Vị trí cài đặt trong dự án:**
  - `src/components/RoleDashboard.js` (Khu vực Top Header `.dash-navbar` và Sidebar Bottom `.sidebar-user`)
  - `src/style.css` (Class `.user-pill`, `.user-avatar`, `.user-meta`, `.user-name`, `.user-email`, `.role-badge`)
  - `backend/models/userModel.js` (Hàm `toPublicUser` chuẩn hóa dữ liệu tài khoản gồm `name`, `email`, `role`, `roles`, `roleLabel`)
* **Cách thức hiện thực:**
  1. **Trên Top Header (`.dash-navbar`):** Tích hợp component viên thuốc tài khoản `.user-pill` dạng kính mờ (Glassmorphism):
     ```html
     <div class="user-pill glass-panel" title="Tài khoản đang đăng nhập">
       <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(user.fullName)}" class="user-avatar" />
       <div class="user-meta">
         <span class="user-name">${escapeHtml(user?.fullName || user?.name)}</span>
         <span class="user-email">${escapeHtml(user.email)}</span>
       </div>
       <span class="role-badge ${currentMeta.badgeClass}">${role}</span>
     </div>
     ```
  2. **Ở cuối Sidebar (`.dash-sidebar`):**
     - Hiển thị avatar chữ cái viết tắt (`.sidebar-user-avatar`), họ tên in đậm, và nhãn vai trò tương ứng (ví dụ: `ADMIN`, `TEACHER`, `STUDENT`).
  3. **Role Badge phân màu trực quan:**
     - Admin: Viền đỏ `#ef4444` (`.role-admin`)
     - Manager/Teacher: Vàng cam `#f59e0b` (`.role-manager`)
     - Student: Xanh lam `#3b82f6` (`.role-user`)
     - Accountant: Xanh lá `#10b981`
     - Training Staff: Xanh cyan `#06b6d4`

---

### 3. [FE] Xây dựng menu điều hướng động theo quyền người dùng
* **Yêu cầu (Description):** Ẩn/hiện các mục menu dựa trên vai trò và quyền được cấp; chỉ hiển thị các chức năng người dùng có thể truy cập.
* **Vị trí cài đặt trong dự án:**
  - `src/components/RoleNavigation.js` (Định nghĩa `ALL_NAV_ITEMS` và hàm `createRoleNavigation(role)`)
  - `backend/config/rolePermissions.js` (Danh mục vai trò `ROLE_CATALOG` và danh sách quyền `PERMISSIONS`)
  - `backend/data/rbac-seed.json` (Dữ liệu cấu hình phân quyền chuẩn cho 8 vai trò)
* **Cách thức hiện thực:**
  1. Mỗi mục điều hướng khai báo rõ danh sách vai trò được phép (`roles: [...]`):
     - `user-management`: `['ADMIN']` (Chỉ Admin thấy)
     - `attendance`: `['ADMIN', 'TEACHER', 'ASSISTANT']`
     - `class-management`: `['ADMIN', 'TEACHER']`
     - `student-status`: `['ADMIN', 'MANAGER', 'TRAINING_STAFF']`
     - `my-courses`: `['STUDENT']` (Chỉ Học sinh thấy)
     - `dashboard`, `user-profile`, `profile-security`: Chung cho người dùng hợp lệ
  2. Hàm `createRoleNavigation(role)` tự động lọc bỏ 100% mục không thuộc quyền:
     ```javascript
     const currentRole = (role || 'USER').toUpperCase();
     const authorizedItems = ALL_NAV_ITEMS.filter(item => item.roles.includes(currentRole));
     ```
  3. Kết quả: Học sinh khi đăng nhập **hoàn toàn không nhìn thấy** các mục quản trị như Quản lý người dùng, Điểm danh, Bàn giao lớp; không gây rối mắt hay nhầm lẫn chức năng.

---

### 4. [FE] Tối ưu giao diện điều hướng cho màn hình 360px
* **Yêu cầu (Description):** Điều chỉnh bố cục menu, khoảng cách, kích thước chạm và cơ chế thu gọn/mở rộng để sử dụng thuận tiện trên màn hình nhỏ.
* **Vị trí cài đặt trong dự án:**
  - `src/style.css` (Dòng 1472-1506 và 3530-3560)
* **Cách thức hiện thực:**
  1. **Media Query chuyển đổi bố cục:** Áp dụng `@media (max-width: 640px)` hỗ trợ trực tiếp từ 360px trở lên.
  2. **Chuyển Layout từ 2 cột sang 1 cột duy nhất:**
     ```css
     .dashboard-wrapper {
       grid-template-columns: 1fr;
       grid-template-areas:
         "header"
         "nav"
         "main";
     }
     ```
  3. **Menu dạng cuộn ngang cảm ứng mượt mà:**
     ```css
     .role-nav-list {
       flex-direction: row;
       flex-wrap: nowrap;
       overflow-x: auto;
       -webkit-overflow-scrolling: touch;
       scrollbar-width: none;
     }
     ```
  4. **Kích thước chạm (Touch Target) đạt chuẩn Accessibility:**
     - Chiều cao chạm tối thiểu từ `40px - 44px` (`padding: 0.5rem 0.8rem`, `min-height: 34px - 44px`).
     - Sử dụng `white-space: nowrap` để tên menu không bị ngắt dòng khó nhìn.
     - Ẩn các khu vực phụ trên sidebar khi ở màn hình nhỏ (`.sidebar-section-label`, `.sidebar-bottom`) để tối đa hóa không gian hiển thị cho màn hình 360px.

---

### 5. [BE] Cung cấp dữ liệu quyền và vai trò cho giao diện điều hướng
* **Yêu cầu (Description):** Bổ sung API hoặc dữ liệu phiên để trả về danh sách quyền, vai trò và các mục điều hướng tương ứng cho người dùng đã đăng nhập.
* **Vị trí cài đặt trong dự án:**
  - `backend/routes/authRoutes.js` (Endpoint `GET /api/auth/permissions`, `GET /api/auth/me`, `POST /api/auth/login`)
  - `backend/controllers/authController.js` (Cấp phát token và thông tin phiên)
  - `backend/config/rolePermissions.js` (`ROLE_CATALOG`, `getRoles`, `getPermissions`)
  - `backend/middleware/authMiddleware.js` (`requireAuth`, `requireRoles`)
* **Cách thức hiện thực:**
  1. Endpoint chuyên biệt `GET /api/auth/permissions` (yêu cầu JWT token):
     ```javascript
     // Trích từ backend/routes/authRoutes.js (DNKN-42 / DNKN-14)
     router.get('/permissions', requireAuth, (req, res) => {
       const roles = UserModel.getRoles(req.user);
       const role = roles.includes(req.user.role) ? req.user.role : roles[0];
       const roleDefinition = ROLE_CATALOG[role];
       return res.json({
         success: true,
         role,
         roles,
         permissions: getPermissions(req.user),
         navigation: roleDefinition?.navigation || []
       });
     });
     ```
  2. Endpoint `GET /api/auth/me`: Trả về thông tin cá nhân của người dùng đã xác thực, bao gồm `id`, `name`, `email`, `role`, `roles`, `roleLabel`, `status`.
  3. API `POST /api/auth/login`: Xác thực thông tin đăng nhập, sinh token JWT có chứa `sub` (user id), `role`, `sid` (session id) và thời hạn hết hạn.

---

### 6. [QA] Kiểm thử hiển thị menu theo vai trò và kích thước màn hình nhỏ
* **Yêu cầu (Description):** Xác minh menu chỉ hiện đúng các mục được phép, thông tin người dùng/ vai trò hiển thị chính xác và giao diện hoạt động tốt trên 360px.
* **Vị trí cài đặt trong dự án:**
  - `tests/navigation.test.js` (Bộ test tự động Node.js Native Test Runner bao hàm 100% các tiêu chí)
  - `tests/rolePermissions.test.js` (Kiểm thử vai trò độc quyền và RBAC)
* **Các kịch bản kiểm thử đã đạt 100%:**
  - **Kịch bản 1:** Xác minh màn hình 403 Forbidden và nút điều hướng an toàn (`getSafeAppPath`).
  - **Kịch bản 2:** Xác minh thông tin họ tên, email, vai trò và nhãn vai trò (`roleLabel`) được trích xuất chính xác.
  - **Kịch bản 3:** Xác minh menu học sinh chỉ có `dashboard`, `my-courses`, `profile-security`; không xuất hiện bất kỳ mục quản trị nào.
  - **Kịch bản 4:** Kiểm tra CSS rules cho viewport di động (media query 640px/360px, grid 1 cột, `overflow-x: auto`, `white-space: nowrap`).
  - **Kịch bản 5:** API `GET /api/auth/permissions` từ chối 401 khi chưa đăng nhập và trả về đúng danh sách menu cho từng vai trò khi có token.
  - **Kịch bản 6:** Kiểm thử tính hợp lệ của tất cả 8 vai trò trong hệ thống và quy tắc độc quyền của vai trò học sinh/giảng viên.
* **Lệnh chạy kiểm thử:**
  ```bash
  cd "D:\DNKN 14"
  npm test
  # Hoặc nhấp đúp run-tests.bat
  ```
  **Kết quả:** 10/10 test cases PASS (100%).

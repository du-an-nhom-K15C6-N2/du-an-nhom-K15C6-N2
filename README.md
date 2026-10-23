# MENU ĐIỀU HƯỚNG ĐỘNG THEO QUYỀN & TỐI ƯU 360PX (DNKN-14)
## Hệ thống Phân quyền Điều hướng & Giao diện Responsive Chuẩn EduClass Manager

Gói độc lập hoàn chỉnh chứa toàn bộ mã nguồn, dữ liệu thử nghiệm, kịch bản xem trước (Live Preview), bộ kiểm thử tự động (QA Test Suite) và công cụ ghép tự động vào dự án chính `D:\FILETONG\aaaaa`.

---

## 1. CẤU TRÚC THƯ MỤC TẠI `D:\DNKN 14`

```
D:\DNKN 14\
├── backend\                             # Khối xử lý Backend độc lập
│   ├── config\                          # Cấu hình app, database, rbac-seed
│   │   ├── app.config.js
│   │   ├── db.config.js
│   │   └── rolePermissions.js           # Xử lý RBAC, danh mục quyền ROLE_CATALOG
│   ├── controllers\
│   │   ├── authController.js            # Xử lý login, me, permissions, session
│   │   ├── profileController.js
│   │   ├── userController.js
│   │   └── dashboardController.js
│   ├── data\
│   │   ├── rbac-seed.json               # Dữ liệu phân quyền chuẩn 8 vai trò
│   │   ├── users.json                   # Dữ liệu tài khoản kiểm thử
│   │   └── revoked-sessions.json
│   ├── middleware\
│   │   ├── authMiddleware.js            # Xác thực JWT & xử lý từ chối 403 Forbidden
│   │   ├── errorMiddleware.js
│   │   └── loggerMiddleware.js
│   ├── models\
│   │   └── userModel.js                 # Model tài khoản, toPublicUser
│   ├── routes\
│   │   └── authRoutes.js                # Định tuyến /api/auth/* (permissions, me, login)
│   ├── security\                        # Mã hóa mật khẩu, session store, JWT token
│   │   ├── password.js
│   │   ├── sessionStore.js
│   │   └── token.js
│   ├── services\                        # Dịch vụ hỗ trợ backend
│   └── server.js                        # Cấu hình Express server độc lập
│
├── frontend\                            # Khối giao diện thử nghiệm độc lập
│   ├── components\
│   │   ├── RoleNavigation.js            # Component tạo Menu điều hướng động theo vai trò
│   │   ├── AppErrorScreen.js            # Màn hình thông báo lỗi 403 Forbidden & quay lại an toàn
│   │   └── RoleDashboard.js             # Shell Dashboard, Header tài khoản & Sidebar
│   ├── core\
│   │   ├── navigation.js                # Bảng điều hướng an toàn ROLE_NAVIGATION_MAP
│   │   ├── accessForbidden.js           # Bộ lắng nghe sự kiện app:access-forbidden
│   │   ├── authService.js               # Service gọi API xác thực & quyền
│   │   ├── authState.js                 # Quản lý trạng thái đăng nhập
│   │   └── storage.js                   # Lưu trữ phiên làm việc an toàn
│   ├── index.html                       # Trang chủ xem thử nghiệm có bộ chuyển Role & Viewport 360px
│   ├── preview.js                       # Logic nạp dữ liệu và kết nối API
│   └── style.css                        # CSS Glassmorphism & Tối ưu Responsive 360px
│
├── tests\                               # Bộ kiểm thử tự động QA
│   ├── navigation.test.js               # Kiểm thử đầy đủ 6 Subtasks của DNKN-14 (100% PASS)
│   └── rolePermissions.test.js          # Kiểm thử vai trò độc quyền và RBAC
│
├── data\                                # Dữ liệu mẫu độc lập
│   ├── users.json
│   └── rbac-seed.json
│
├── project-source\                      # TẬP HỢP CÁC TỆP SẴN SÀNG GHÉP VÀO D:\FILETONG\aaaaa
│   ├── backend\                         # Các tệp backend cần ghép
│   ├── src\                             # Các tệp frontend Vite cần ghép
│   └── tests\                           # Tệp test cho dự án chính
│
├── CAU_TRA_LOI_DNKN_14.md               # BÁO CÁO TRẢ LỜI CHI TIẾT TỪNG SUBTASK
├── package.json                         # Khai báo script test & preview
├── preview-server.js                    # Web server chạy thử nghiệm cổng 3014
├── start-preview.bat                    # Kịch bản khởi động xem trước bằng 1 click
├── run-tests.bat                        # Kịch bản chạy bộ kiểm thử tự động bằng 1 click
├── merge_to_project.js                  # Script Node.js tự động ghép mã nguồn vào dự án chính
└── merge_to_project.bat                 # Kịch bản ghép mã nguồn bằng 1 click
```

---

## 2. ÁNH XẠ 6 SUBTASKS CỦA DNKN-14

| STT | Tên Subtask | Yêu cầu | Tệp cài đặt | Trạng thái |
|:---:|:---|:---|:---|:---:|
| 1 | **[FE] Xử lý trạng thái không có quyền khi chọn menu** | Hiển thị thông báo 403 phù hợp hoặc điều hướng an toàn khi người dùng cố truy cập chức năng không có quyền. | `src/components/RoleNavigation.js`<br>`src/components/AppErrorScreen.js`<br>`src/core/navigation.js` | ✅ Đạt 100% |
| 2 | **[FE] Hiển thị tên người dùng và vai trò đang đăng nhập** | Thiết kế và tích hợp khu vực hiển thị thông tin tài khoản hiện tại trên thanh điều hướng hoặc header để dễ nhận biết. | `src/components/RoleDashboard.js`<br>`src/style.css`<br>`backend/models/userModel.js` | ✅ Đạt 100% |
| 3 | **[FE] Xây dựng menu điều hướng động theo quyền** | Ẩn/hiện các mục menu dựa trên vai trò và quyền được cấp; chỉ hiển thị các chức năng người dùng có thể truy cập. | `src/components/RoleNavigation.js`<br>`backend/config/rolePermissions.js`<br>`backend/data/rbac-seed.json` | ✅ Đạt 100% |
| 4 | **[FE] Tối ưu giao diện điều hướng cho màn hình 360px** | Điều chỉnh bố cục menu, khoảng cách, kích thước chạm và cơ chế thu gọn/mở rộng để sử dụng thuận tiện trên 360px. | `src/style.css` (Media queries 640px/360px, cuộn ngang, touch target >= 44px) | ✅ Đạt 100% |
| 5 | **[BE] Cung cấp dữ liệu quyền và vai trò cho điều hướng** | Bổ sung API hoặc dữ liệu phiên trả về danh sách quyền, vai trò và các mục điều hướng tương ứng cho người dùng. | `backend/routes/authRoutes.js`<br>`GET /api/auth/permissions`<br>`GET /api/auth/me` | ✅ Đạt 100% |
| 6 | **[QA] Kiểm thử hiển thị menu theo vai trò và 360px** | Xác minh menu chỉ hiện đúng các mục được phép, thông tin hiển thị chính xác và giao diện hoạt động tốt trên 360px. | `tests/navigation.test.js`<br>`tests/rolePermissions.test.js` | ✅ 10/10 PASS |

---

## 3. HƯỚNG DẪN SỬ DỤNG

### 3.1. Chạy Thử Giao Diện Trực Tiếp (Live Preview)
Nhấp đúp chuột vào tệp:
```cmd
D:\DNKN 14\start-preview.bat
```
Hoặc mở terminal tại thư mục này và gõ:
```bash
node preview-server.js
```
Truy cập trình duyệt tại: **`http://localhost:3014`**

**Tính năng trên màn hình xem trước:**
1. **Chuyển đổi vai trò tức thì:** Bấm chọn các nút `Admin`, `Giảng viên`, `Học sinh`, `Trợ giảng`, `Quản lý` để xem menu điều hướng tự động biến đổi tương ứng.
2. **Chế độ màn hình 360px:** Bấm nút `Mobile 360px` để xem giao diện tự động co về khung điện thoại di động 360px chuẩn với menu dạng cuộn ngang cảm ứng mượt mà.
3. **Thử nghiệm lỗi 403:** Bấm nút `Thử Lỗi 403` để kích hoạt màn hình thông báo không có quyền truy cập kèm nút quay lại an toàn.
4. **Xem dữ liệu API trực tiếp:** Bấm nút `API JSON` để xem dữ liệu JSON thực tế trả về từ `/api/auth/permissions` và `/api/auth/me`.

---

### 3.2. Chạy Bộ Kiểm Thử Tự Động (QA Test Suite)
Nhấp đúp chuột vào tệp:
```cmd
D:\DNKN 14\run-tests.bat
```
Hoặc chạy lệnh:
```bash
npm test
```
**Kết quả kiểm thử:**
```
✔ 1. [FE] Xử lý trạng thái không có quyền truy cập: màn hình 403 Forbidden & điều hướng an toàn
✔ 2. [FE] Hiển thị tên người dùng và vai trò đang đăng nhập trên header và sidebar
✔ 3. [FE] Xây dựng menu điều hướng động: Mục menu không thuộc quyền thì không hiển thị
✔ 4. [FE] Tối ưu giao diện điều hướng cho màn hình 360px (CSS responsive & touch targets)
✔ 5. [BE] API GET /api/auth/permissions trả về danh sách quyền, vai trò và navigation tương ứng
✔ 5.1 [BE] API GET /api/auth/me trả về thông tin tài khoản đang đăng nhập
✔ 6. [QA] Xác minh tính toàn vẹn của Role Catalog và tất cả 8 vai trò hệ thống
✔ 6.1 [QA] Kiểm thử ràng buộc vai trò độc quyền (Exclusive Roles)
✔ học sinh và giáo viên chỉ được giữ 1 vai trò độc quyền
✔ lead permissions are limited to the configured admissions management roles
ℹ tests 10 | pass 10 | fail 0 (100% PASS)
```

---

### 3.3. Ghép Mã Nguồn Vào Dự Án Chính
Khi cần đưa tính năng này vào thư mục dự án chính `D:\FILETONG\aaaaa`, bạn chỉ cần nhấp đúp:
```cmd
D:\DNKN 14\merge_to_project.bat
```
Công cụ sẽ tự động sao chép các tệp từ thư mục `project-source` vào `D:\FILETONG\aaaaa` một cách an toàn và chính xác.

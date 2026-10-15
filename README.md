# TÍNH NĂNG HỒ SƠ CÁ NHÂN (DNKN-86)
## Xem & Cập Nhật Hồ Sơ Cá Nhân - Chuẩn Hóa Số Điện Thoại Việt Nam - Khóa Chỉ Đọc Email & Vai Trò

Dự án này là gói độc lập hoàn chỉnh chứa toàn bộ mã nguồn, kịch bản chạy thử nghiệm và bộ kiểm thử tự động cho chức năng **DNKN-86**.

---

## 1. CẤU TRÚC THƯ MỤC TẠI `D:\DNKN 86`

```
D:\DNKN 86\
├── backend\                             # Khối xử lý Backend độc lập
│   ├── config\                          # Cấu hình app, database, phân quyền
│   ├── controllers\
│   │   └── profileController.js         # Xử lý API GET/PUT profile, chặn sửa email/role
│   ├── middleware\
│   │   └── authMiddleware.js            # Xác thực JWT Bearer Token
│   ├── models\
│   │   └── userModel.js                 # Mô hình dữ liệu người dùng, updateProfile
│   ├── routes\
│   │   └── profileRoutes.js             # Định tuyến /api/profile
│   ├── security\                        # Mã hóa mật khẩu scrypt, quản lý JWT token
│   ├── services\
│   │   └── vietnamPhoneService.js       # Xác thực & chuẩn hóa SĐT Việt Nam (+84 -> 0xxx)
│   └── server.js                        # Cấu hình Express server
│
├── frontend\                            # Khối giao diện thử nghiệm độc lập
│   ├── components\
│   │   ├── UserProfilePanel.js          # Component Xem và Form Cập nhật hồ sơ
│   │   └── UserProfilePanel.css         # Giao diện responsive, giao diện tối sang trọng
│   ├── core\
│   │   ├── authService.js               # Service gọi API
│   │   ├── authState.js                 # State management cho authentication
│   │   ├── profileService.js            # Service xử lý nghiệp vụ hồ sơ
│   │   ├── storage.js                   # Quản lý localStorage/sessionStorage
│   │   └── validation.js                # Ràng buộc dữ liệu & regex SĐT Việt Nam phía client
│   ├── index.html                       # Trang chủ xem thử nghiệm có nút đổi 3 tài khoản demo
│   └── preview.js                       # Logic nạp dữ liệu và kết nối API
│
├── tests\                               # Bộ kiểm thử tự động QA
│   └── profile.test.js                  # 15 test cases toàn diện (Đạt 100% PASS)
│
├── data\
│   └── users.json                       # Cơ sở dữ liệu mẫu độc lập phục vụ thử nghiệm
│
├── project-source\                      # TẬP HỢP CÁC TỆP SẴN SÀNG GHÉP VÀO D:\aaaaa\aaaaa
│   ├── backend\                         # Các tệp backend cần ghép
│   ├── src\                             # Các tệp frontend Vue/Vite cần ghép
│   ├── frontend\                        # Giao diện HTML & JS portal cũ
│   └── tests\                           # Tệp test cho dự án chính
│
├── preview-server.js                    # Máy chủ Node.js chạy độc lập trên cổng 3086
├── start-preview.bat                    # 1-Click: Mở máy chủ xem thử và tự bật trình duyệt
├── run-tests.bat                        # 1-Click: Chạy bộ 15 ca kiểm thử tự động
├── package.json                         # Cấu hình package
└── README.md                            # Tài liệu tổng quan này
```

---

## 2. ĐÁP ỨNG ĐẦY ĐỦ 8 HẠNG MỤC YÊU CẦU

### 1. `[FE] Xây dựng màn hình xem hồ sơ cá nhân`
- **Giao diện:** Hiển thị thẻ hồ sơ chuyên nghiệp gồm Avatar chữ cái đầu, Họ và tên, Email, Vai trò hệ thống, Số điện thoại, Ngày sinh (định dạng `DD/MM/YYYY`), Địa chỉ liên hệ và trạng thái hoạt động.
- **Bảo mật:** Gắn nhãn `🔒 Chỉ đọc` bên cạnh Email và Vai trò để người dùng nắm rõ quy định hệ thống.
- **Trải nghiệm:** Tự động định dạng ngày tháng sang tiếng Việt; nếu trường nào chưa cập nhật sẽ có nhãn gợi ý xám `Chưa cập nhật`.

### 2. `[FE] Xây dựng form cập nhật hồ sơ cá nhân`
- **Cho phép sửa:** Họ tên (`name`), Số điện thoại (`phone`), Ngày sinh (`dateOfBirth` - dạng datepicker, chặn ngày tương lai), Địa chỉ (`address` - textarea tối đa 255 ký tự).
- **Khóa an toàn:** Email và Vai trò được đặt trạng thái `readonly` và `disabled`, nền xám mờ không cho phép can thiệp.
- **Phản hồi:** Có thanh thông báo màu xanh khi lưu thành công và thanh thông báo màu đỏ khi có lỗi từ server.

### 3. `[BE] API lấy thông tin hồ sơ cá nhân`
- Endpoint: `GET /api/profile` (và `GET /api/auth/profile`).
- Yêu cầu Header: `Authorization: Bearer <token>`.
- Trả về đối tượng người dùng công khai (đã loại bỏ `passwordHash`).

### 4. `[BE] API cập nhật hồ sơ cá nhân với kiểm soát trường được phép sửa`
- Endpoint: `PUT /api/profile` hoặc `PATCH /api/profile` (cùng tương thích `/api/auth/profile`).
- **Quy tắc bảo mật trường:**
  - Nếu người dùng gửi `email` khác với email hiện tại: Trả về **HTTP 400** với lỗi `EMAIL_CHANGE_NOT_ALLOWED`.
  - Nếu người dùng gửi `role` hoặc `roles` khác với vai trò hiện tại: Trả về **HTTP 400** với lỗi `ROLE_CHANGE_NOT_ALLOWED`.
  - Chặn sửa các trường nội bộ: `status`, `password`, `passwordHash`, `permissions`.
  - Cho phép người dùng gửi lại đúng email hoặc vai trò hiện tại (từ form) mà không bị báo lỗi.

### 5. `[FE] Kiểm tra và hiển thị lỗi định dạng số điện thoại Việt Nam`
- Kiểm tra trực tiếp khi rời trường (`blur`) và khi người dùng gõ phím (`input`).
- Bắt buộc đúng cấu trúc 10 chữ số di động Việt Nam theo quy hoạch kho số quốc gia (đầu số 03, 05, 07, 08, 09).
- Báo lỗi ngay dưới ô nhập liệu nếu người dùng nhập thiếu số, thừa số, sai đầu số hoặc chứa ký tự chữ.

### 6. `[BE] Kiểm tra và chuẩn hóa số điện thoại Việt Nam`
- Service: `backend/services/vietnamPhoneService.js`.
- Tự động chuẩn hóa các định dạng đầu vào:
  - `+84 912 345 678` -> `0912345678`
  - `84912345678` -> `0912345678`
  - `0084912345678` -> `0912345678`
  - `0912-345-678` -> `0912345678`
  - `(0912) 345.678` -> `0912345678`
- Xác thực đầu số di động hợp lệ trước khi ghi vào cơ sở dữ liệu.

### 7. `[QA] Bộ kiểm thử tự động toàn diện (15 Test Cases)`
File kiểm thử: `tests/profile.test.js`.
Bao phủ 100% các tiêu chí:
1. `GET /api/profile` trả về đầy đủ thông tin hồ sơ người dùng.
2. `GET /api/auth/profile` và `GET /api/auth/me` tương thích chuẩn xác.
3. Từ chối truy cập khi không có token (401 Unauthorized).
4. Cập nhật hồ sơ thành công với dữ liệu hợp lệ (họ tên, SĐT, ngày sinh, địa chỉ).
5. Chuẩn hóa SĐT từ các định dạng `+84`, `84`, `0084`, dấu gạch ngang, khoảng trắng.
6. Từ chối SĐT sai định dạng (thiếu số, thừa số, đầu số bàn, chứa chữ cái).
7. Chặn thay đổi Email: trả về mã lỗi 400 `EMAIL_CHANGE_NOT_ALLOWED`.
8. Chặn thay đổi Vai trò: trả về mã lỗi 400 `ROLE_CHANGE_NOT_ALLOWED`.
9. Cho phép gửi kèm email/vai trò cũ không thay đổi mà không báo lỗi.
10. Chặn sửa các trường nhạy cảm (`status`, `passwordHash`, `permissions`).
11. Ràng buộc ngày sinh (từ chối ngày trong tương lai hoặc năm < 1900).
12. Ràng buộc họ tên (từ chối chuỗi rỗng hoặc vượt quá độ dài).
13. Ràng buộc địa chỉ (từ chối vượt quá 255 ký tự).
14. Đảm bảo tất cả các vai trò (Học sinh, Giảng viên, Quản trị viên) đều xem và sửa được hồ sơ của mình.
15. Kiểm thử biên hàm chuẩn hóa số điện thoại `normalizeVietnamesePhone`.

---

## 3. HƯỚNG DẪN CHẠY THỬ NGHIỆM

### Bước 1: Khởi động giao diện demo
Nhấp đúp chuột vào tệp:
```
start-preview.bat
```
*(Hoặc chạy lệnh `node preview-server.js` trong Command Prompt)*

Trình duyệt sẽ tự động mở trang: **`http://localhost:3086`**.

### Bước 2: Thử nghiệm các tính năng
- Sử dụng các nút bấm trên thanh công cụ để chuyển đổi qua lại giữa các vai trò:
  - 🎓 **Học sinh:** `an.nguyen@edu.vn` (Mật khẩu: `Password@123`)
  - 👨‍🏫 **Giảng viên:** `mai.tran@edu.vn` (Mật khẩu: `Password@123`)
  - 🛡️ **Quản trị viên:** `hoang@edu.vn` (Mật khẩu: `Password@123`)
- Nhấn **"Chỉnh sửa hồ sơ"**:
  - Thử nhập SĐT dạng `+84 912 345 678` -> Hệ thống sẽ tự chuẩn hóa thành `0912345678`.
  - Thử nhập SĐT sai định dạng (ví dụ `0123456789` hoặc `abc`) -> Hệ thống cảnh báo lỗi tức thì.
  - Quan sát thấy ô **Email** và **Vai trò** bị khóa hoàn toàn.
  - Sửa họ tên, ngày sinh, địa chỉ và nhấn **"Lưu thông tin hồ sơ"** -> Dữ liệu được lưu trữ và cập nhật lập tức trên màn hình.

### Bước 3: Chạy bộ kiểm thử tự động
Nhấp đúp chuột vào tệp:
```
run-tests.bat
```
*(Hoặc chạy lệnh `node --test tests/profile.test.js`)*

Kết quả: **15/15 tests PASS** trong ~1.3 giây.


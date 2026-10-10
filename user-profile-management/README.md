# Module: Quản Lý Hồ Sơ Cá Nhân (User Profile Management)
**User Story DNKN-86 | Task QA DNKN-110**
**Thực tập cơ sở - Nhóm K15C6-N2**

Module cung cấp tính năng **Xem và cập nhật hồ sơ cá nhân**, giúp người dùng duy trì thông tin liên lạc chính xác trong Hệ thống Quản lý Đào tạo.

---

## 1. TÍNH NĂNG CHÍNH (ACCEPTANCE CRITERIA)

* **Xem hồ sơ cá nhân**: Hiển thị đầy đủ Họ tên, Email, Vai trò, Số điện thoại, Ngày sinh, Địa chỉ và trạng thái hoạt động.
* **Cập nhật hồ sơ cá nhân**: Cho phép sửa Họ tên, Số điện thoại, Ngày sinh, Địa chỉ.
* **Bảo vệ trường cố định**: Chặn tuyệt đối việc người dùng tự sửa Email hoặc Vai trò (hiển thị 🔒 Chỉ đọc trên giao diện và trả về mã lỗi HTTP 400 `EMAIL_IMMUTABLE`, `ROLE_IMMUTABLE` ở Backend).
* **Validation số điện thoại Việt Nam**: 
  - Giao diện: Ràng buộc nhập 10 chữ số (đầu mạng 03, 05, 07, 08, 09), báo lỗi real-time, chặn submit nếu sai.
  - Máy chủ: Xác thực và tự động chuẩn hóa tiền tố quốc tế `+84` hoặc khoảng trắng/gạch nối về định dạng chuẩn 10 chữ số.
* **Ràng buộc nghiệp vụ**: Họ tên không được để trống, ngày sinh không được là ngày trong tương lai.

---

## 2. CẤU TRÚC THƯ MỤC MODULE

```text
user-profile-management/
├── index.html                   # Giao diện xem và cập nhật hồ sơ cá nhân
├── app.js                       # Logic giao diện, validation SĐT VN, API client
├── server.js                    # Máy chủ API độc lập (Express)
├── README.md                    # Tài liệu hướng dẫn sử dụng
│
├── controllers/
│   └── profileController.js     # Controller xử lý GET và PUT /api/profile
├── routes/
│   └── profileRoutes.js         # Định tuyến router API
├── models/
│   └── userModel.js             # Model đọc/ghi dữ liệu người dùng
├── utils/
│   └── phoneValidator.js        # Thư viện kiểm tra & chuẩn hóa SĐT Việt Nam
├── data/
│   └── users.json               # Cơ sở dữ liệu người dùng mẫu
└── tests/
    └── profile.test.js          # Bộ 11 kịch bản kiểm thử tự động (QA DNKN-110)
```

---

## 3. HƯỚNG DẪN CHẠY VÀ DEMO

### Cách 1: Chạy trực tiếp Offline Demo (Không cần cài đặt hay chạy server)
- Nhấp đúp (Double-click) trực tiếp vào tệp `index.html` để mở trong trình duyệt Chrome / Edge.
- Ứng dụng tự động kích hoạt **Chế độ Offline Demo**, cho phép xem, chỉnh sửa hồ sơ và lưu trữ qua `localStorage`.
- Có thể dùng thanh chọn trên Header để chuyển đổi giữa các vai trò: **Học sinh**, **Giảng viên**, **Quản trị viên**.

---

### Cách 2: Khởi động Máy chủ API (Live Backend Mode)
Từ thư mục gốc dự án:
```bash
node user-profile-management/server.js
```
- Máy chủ khởi động tại: `http://localhost:3000`
- Mở trình duyệt truy cập: `http://localhost:3000` để trải nghiệm giao diện kết nối API thực tế.

---

### Cách 3: Chạy bộ kiểm thử tự động (11/11 tests PASS)
```bash
node --test user-profile-management/tests/profile.test.js
```
Toàn bộ 11 kịch bản kiểm thử API, validation SĐT Việt Nam và phân quyền sẽ được thực thi tự động.

# Module: Chuyển Lead Đã Chốt Thành Hồ Sơ Học Viên (Lead To Student Conversion)
**Mã User Story: DNKN-174**
**Dự án: Hệ Thống Quản Lý Đào Tạo & Tuyển Sinh (Nhóm K15C6-N2)**

---

## 1. MỤC TIÊU CỦA USER STORY
> **Là Tư vấn tuyển sinh, tôi muốn chuyển một lead đã chốt thành hồ sơ học viên, để không phải nhập lại thông tin khách đã cung cấp ba lần trước đó.**

### Các tiêu chí chấp nhận (Acceptance Criteria):
* **Kế thừa dữ liệu không nhập lại**: Toàn bộ dữ liệu của lead (Họ tên, SĐT, Email, Địa chỉ, Chuyên ngành/Khóa học, Học phí, Nguồn) được tự động sao chép sang hồ sơ học viên mới.
* **Hệ thống sinh mã học viên tự động**: Định dạng chuẩn `HV{YYYY}{XXXX}` (ví dụ: `HV20260001`, `HV20260002`...), duy nhất, tăng tuần tự và không trùng lặp.
* **Tạo tài khoản học viên & Gửi email**: Tài khoản đăng nhập được tạo với vai trò `student`, trạng thái `active`; email thông báo kèm mật khẩu tạm thời được gửi ngay sau khi chuyển đổi.
* **Khóa chỉnh sửa Lead**: Lead chuyển sang trạng thái `Đã nhập học` (`enrolled`), khóa chỉnh sửa vĩnh viễn (`isLocked: true`). Mọi yêu cầu sửa lead qua API hoặc giao diện đều bị từ chối với mã lỗi HTTP 403 `LEAD_LOCKED`.

---

## 2. ĐỐI SOÁT 7 HẠNG MỤC CÔNG VIỆC (SUBTASKS)

| STT | Tên Subtask | File triển khai | Mô tả chi tiết |
| :---: | :--- | :--- | :--- |
| **1** | `[FE] Chức năng chuyển lead đã chốt thành học viên` | `index.html`, `app.js` | Giao diện danh sách lead, nút 'Chuyển Học Viên', modal xác nhận kế thừa dữ liệu, preview mã HV, thông báo kết quả. |
| **2** | `[BE] API chuyển lead đã chốt sang hồ sơ học viên` | `controllers/conversionController.js`, `routes/conversionRoutes.js` | Endpoint `POST /api/leads/:id/convert`: Tự động sao chép toàn bộ thông tin lead, tạo học viên mới mà không cần nhập lại. |
| **3** | `[BE] Sinh mã học viên tự động khi tạo hồ sơ` | `services/studentCodeService.js` | Quy chuẩn `HV{NĂM}{STT_4_SỐ}`, tự động tăng dần tuần tự, kiểm tra chống trùng lặp tuyệt đối. |
| **4** | `[BE] Tạo tài khoản đăng nhập cho học viên` | `services/accountService.js` | Tạo tài khoản người dùng gắn vai trò `student`, trạng thái `active`, cấp mật khẩu khởi tạo ban đầu. |
| **5** | `[BE] Gửi email thông báo tài khoản sau chuyển đổi` | `services/emailService.js` | Tự động gửi thư thông báo chứa mã học viên, email đăng nhập, mật khẩu tạm thời và đường dẫn Cổng Đào Tạo. |
| **6** | `[BE] Cập nhật trạng thái lead & Khóa chỉnh sửa` | `models/leadModel.js`, `controllers/conversionController.js` | Chuyển trạng thái sang `enrolled` (Đã nhập học); từ chối mọi yêu cầu sửa qua `PUT /api/leads/:id` với mã 403 `LEAD_LOCKED`. |
| **7** | `[QA] Kiểm thử toàn bộ luồng chuyển đổi` | `tests/conversion.test.js` | Bộ 10 bài test tự động bao quát chuyển đổi, sinh mã, tạo tài khoản, gửi email, khóa sửa, từ chối lead chưa chốt. |

---

## 3. CẤU TRÚC THƯ MỤC MODULE

```text
lead-to-student-conversion/
├── index.html                   # Giao diện Cổng Tư Vấn Tuyển Sinh
├── app.js                       # Logic tương tác, lọc lead, chuyển đổi
├── server.js                    # Máy chủ API Node.js/Express độc lập
├── README.md                    # Tài liệu hướng dẫn sử dụng module
│
├── controllers/
│   └── conversionController.js  # Controller xử lý chuyển đổi, kiểm tra điều kiện
├── routes/
│   └── conversionRoutes.js      # Định tuyến các endpoint /api/leads
├── services/
│   ├── studentCodeService.js    # Logic sinh mã học viên tự động duy nhất
│   ├── accountService.js        # Logic tạo tài khoản đăng nhập học viên
│   └── emailService.js          # Logic gửi email thông báo tài khoản
├── models/
│   ├── leadModel.js             # Model quản lý lead và khóa chỉnh sửa
│   └── studentModel.js          # Model quản lý hồ sơ học viên
├── data/
│   ├── leads.json               # Dữ liệu lead mẫu
│   ├── students.json            # Dữ liệu học viên chính thức
│   ├── users.json               # Dữ liệu tài khoản người dùng
│   └── sent-emails.json         # Nhật ký gửi email
└── tests/
    └── conversion.test.js       # Bộ 10 bài kiểm thử tự động QA (100% PASS)
```

---

## 4. HƯỚNG DẪN CHẠY VÀ DEMO

### Cách 1: Xem trực tiếp Offline Demo (Không cần bật server)
* Mở thư mục `lead-to-student-conversion`, **nhấp đúp chuột vào tệp `index.html`** để mở trong trình duyệt Chrome / Edge.
* Dữ liệu tự động lưu trữ và hoạt động trơn tru qua `localStorage`.

### Cách 2: Khởi động Máy chủ API (Live Backend Mode)
```bash
cd "D:\DNKN 174"
npm start
# Server chạy tại: http://localhost:3000
```
Mở trình duyệt truy cập: `http://localhost:3000`

### Cách 3: Chạy bộ kiểm thử tự động (10/10 tests PASS)
```bash
cd "D:\DNKN 174"
npm test
```

---

## 5. HƯỚNG DẪN GHÉP VÀO BÀI CỦA NGƯỜI KHÁC / DỰ ÁN NHÓM

* **Cách 1 (Khuyên dùng - Chuẩn module nhóm):** 
  Sao chép nguyên thư mục `lead-to-student-conversion` đặt vào thư mục gốc dự án của nhóm. Không gây bất kỳ xung đột nào với các tính năng khác.
* **Cách 2 (Nhúng vào server chung của nhóm):** 
  Copy các file trong `controllers/`, `services/`, `routes/`, `models/` sang backend của nhóm và thêm đúng 2 dòng vào file server chung:
  ```javascript
  const conversionRoutes = require('./routes/conversionRoutes');
  app.use('/api/leads', conversionRoutes);
  ```

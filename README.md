# Hệ Thống Quản Lý Đào Tạo & Tuyển Sinh (TMS)
Dự án thuộc học phần: **Thực tập cơ sở** - Nhóm: **K15C6-N2**

---

## 1. CẤU TRÚC DỰ ÁN (PROJECT STRUCTURE)

Dự án được chuẩn hóa theo mô hình Fullstack phân tầng rõ ràng giữa `backend` và `frontend`:

```text
D:\DNKN 174\
├── .env.example                 # File cấu hình môi trường mẫu
├── .gitignore                   # Cấu hình bỏ qua file rác (node_modules, logs)
├── package.json                 # Định nghĩa dependencies và scripts chạy dự án
├── package-lock.json            # Khóa phiên bản dependencies
├── README.md                    # Tài liệu dự án
│
├── backend/                     # MÃ NGUỒN MÁY CHỦ & API BACKEND
│   ├── server.js                # Entry point máy chủ Express & phục vụ static files
│   ├── controllers/             # Bộ điều khiển xử lý logic yêu cầu
│   │   └── conversionController.js
│   ├── routes/                  # Định tuyến API (/api/leads, /api/students)
│   │   └── conversionRoutes.js
│   ├── services/                # Nghiệp vụ core
│   │   ├── studentCodeService.js   # Sinh mã học viên tự động (HV2026xxxx)
│   │   ├── accountService.js       # Tạo tài khoản học viên (role: student, active)
│   │   └── emailService.js         # Gửi email thông báo tài khoản
│   ├── models/                  # Mô hình dữ liệu & khóa chỉnh sửa
│   │   ├── leadModel.js
│   │   └── studentModel.js
│   ├── data/                    # Cơ sở dữ liệu JSON
│   │   ├── leads.json
│   │   ├── students.json
│   │   ├── users.json
│   │   └── sent-emails.json
│   └── tests/                   # Bộ kiểm thử tự động QA (10 test cases)
│       └── conversion.test.js
│
└── frontend/                    # GIAO DIỆN NGƯỜI DÙNG (FRONTEND)
    ├── index.html               # Giao diện Cổng Tư Vấn Tuyển Sinh
    └── app.js                   # Logic xử lý giao diện, modal xác nhận & gọi API
```

---

## 2. USER STORY DNKN-174: CHUYỂN LEAD ĐÃ CHỐT THÀNH HỒ SƠ HỌC VIÊN

> **Là Tư vấn tuyển sinh, tôi muốn chuyển một lead đã chốt thành hồ sơ học viên, để không phải nhập lại thông tin khách đã cung cấp ba lần trước đó.**

### Kết quả đáp ứng 7 hạng mục (Subtasks):

| STT | Mã Subtask | File triển khai | Nội dung thực hiện |
| :---: | :--- | :--- | :--- |
| **1** | `[FE] Chức năng chuyển lead đã chốt thành học viên` | `frontend/index.html`, `frontend/app.js` | Giao diện tư vấn, nút chuyển đổi, modal xác nhận kế thừa dữ liệu, preview thông tin, thông báo kết quả. |
| **2** | `[BE] API chuyển lead đã chốt sang hồ sơ học viên` | `backend/controllers/conversionController.js`, `backend/routes/conversionRoutes.js` | API `POST /api/leads/:id/convert`: Tự động sao chép toàn bộ trường thông tin lead sang học viên, không phải nhập lại. |
| **3** | `[BE] Sinh mã học viên tự động` | `backend/services/studentCodeService.js` | Định dạng chuẩn `HV{YYYY}{XXXX}` (ví dụ: `HV20260001`), tự tăng tuần tự, cam kết duy nhất 100%. |
| **4** | `[BE] Tạo tài khoản đăng nhập cho học viên` | `backend/services/accountService.js` | Tạo user với `role: 'student'`, `status: 'active'`, mật khẩu khởi tạo an toàn. |
| **5** | `[BE] Gửi email thông báo tài khoản học viên` | `backend/services/emailService.js` | Soạn thảo & gửi email kích hoạt tài khoản kèm thông tin đăng nhập ngay sau khi chuyển đổi. |
| **6** | `[BE] Cập nhật trạng thái lead & Khóa chỉnh sửa` | `backend/models/leadModel.js` | Chuyển trạng thái sang `enrolled` (`Đã nhập học`), `isLocked: true`. Mọi yêu cầu sửa lead sau đó bị chặn bởi mã lỗi HTTP 403 `LEAD_LOCKED`. |
| **7** | `[QA] Kiểm thử toàn bộ luồng chuyển đổi` | `backend/tests/conversion.test.js` | 10 bài test tự động bao phủ 100% các tiêu chí chấp nhận và xử lý ngoại lệ (10/10 PASS). |

---

## 3. HƯỚNG DẪN KHỞI CHẠY DỰ ÁN

### Yêu cầu tiên quyết:
- Đã cài đặt **Node.js** (khuyến nghị v18 trở lên).

### Bước 1: Khởi động hệ thống (Fullstack: Backend + Frontend)
```bash
npm start
```
- Máy chủ backend chạy tại: `http://localhost:3000`
- Giao diện frontend tự động được phục vụ tại: `http://localhost:3000`

### Bước 2: Chạy kiểm thử tự động (QA Test Suite)
```bash
npm test
```
- Toàn bộ 10 bài test kiểm tra luồng API, logic sinh mã, tạo user, gửi mail và khóa sửa lead sẽ chạy và báo `pass 10, fail 0`.

### Bước 3: Xem trực tiếp Offline Demo (Không cần bật server)
- Vào thư mục `frontend/`, nhấp đúp chuột vào file `index.html` để mở trực tiếp trong trình duyệt. Hệ thống tự động hoạt động ở chế độ Demo với `localStorage`.

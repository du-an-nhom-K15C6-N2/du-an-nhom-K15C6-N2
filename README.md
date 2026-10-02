<<<<<<< HEAD
Hệ Thống Quản Lý Đào Tạo
Dự án thuộc học phần: Thực tập cơ sở
Nhóm: K15C6-N2
Hệ thống Quản lý Đào tạo (TMS) là giải pháp phần mềm giúp tối ưu hóa và tự động hóa các quy trình quản lý đào tạo trong các trường đại học, trung tâm hoặc doanh nghiệp. Hệ thống hỗ trợ kết nối giữa Quản trị viên (Admin), Giảng viên (Lecturer) và Sinh viên/Học viên (Student).
Mục tiêu chính
- Quản lý thông tin khóa học, môn học, lớp học và lịch trình đào tạo.
- Quản lý đăng ký học tập, điểm số và kết quả học tập của sinh viên.
- Theo dõi tiến độ giảng dạy và đếm buổi điểm danh.
- Cung cấp báo cáo, thống kê trực quan cho ban quản lý.
Tính năng chính
1. Quản trị viên (Admin)
- Quản lý người dùng: Thêm, sửa, xóa, phân quyền (Sinh viên, Giảng viên, Admin).
- Quản lý danh mục: Chương trình đào tạo, khoa/ngành, môn học, phòng học.
- Quản lý lớp học & Học kỳ: Mở lớp học phần, gán giảng viên giảng dạy.
- Thống kê & Báo cáo: Xuất báo cáo điểm, số lượng sinh viên, học phí.
2. Giảng viên (Lecturer)
- Lịch dạy: Xem thời khóa biểu giảng dạy theo tuần/tháng.
- Điểm danh: Điểm danh sinh viên theo từng buổi học.
- Quản lý điểm: Nhập, sửa và quản lý điểm quá trình, điểm thi.
- Tài liệu: Đăng tải bài giảng, bài tập cho lớp học phần.
3. Sinh viên (Student)
- Đăng ký học tập: Đăng ký môn học/lớp học phần theo kế hoạch.
- Xem thời khóa biểu: Theo dõi lịch học, phòng học hàng ngày.
- Xem kết quả học tập: Tra cứu bảng điểm chi tiết và điểm trung bình tích lũy (GPA).
- Phản hồi & Thông báo: Nhận thông báo từ nhà trường, gửi phản hồi về môn học.
Công nghệ sử dụng
- Frontend: React.js / Vue.js / HTML5, CSS3, JavaScript (TailwindCSS / Bootstrap)
- Backend: Node.js (Express) / Java (Spring Boot) / Python (Django/FastAPI) / PHP (Laravel)
- Database: PostgreSQL / MySQL / MongoDB
- Authentication: JWT (JSON Web Tokens) / OAuth2
- Tools & Version Control: Git, GitHub, Postman, Docker (nếu có)
Hướng dẫn cài đặt & Chạy ứng dụng
Yêu cầu hệ thống
- Node.js 
- Database: MySQL / PostgreSQL đã được cài đặt và cấu hình.
- Git
=======
# Academy Admin

Bản demo quản trị tài khoản chạy bằng Node.js, không cần cài package ngoài.

## Chạy ứng dụng

Cần Node.js 20 trở lên. Tại thư mục dự án:

```powershell
npm start
```

Mở `http://localhost:5173`. Tài khoản quản trị mặc định là `admin@academy.local`, mật khẩu `12345678`.

Có thể đặt thông tin quản trị trước khi chạy:

```powershell
$env:ADMIN_EMAIL = "admin@academy.local"
$env:ADMIN_PASSWORD = "your-strong-local-password"
npm start
```

Dữ liệu demo người dùng có mật khẩu `demo-password` cho API đăng nhập người dùng. Tài khoản bị khoá mẫu không thể đăng nhập. Các mật khẩu này chỉ dành cho demo local; hãy đặt `ADMIN_PASSWORD` mạnh trước khi triển khai.

## API

- `POST /api/admin/login` xác thực quản trị viên và cấp bearer token.
- `GET /api/accounts`, `GET /api/classes`, `GET /api/audit` yêu cầu token quản trị.
- `POST /api/admin/accounts/:id/lock` nhận `{ "reason": "..." }`, lưu lý do/lịch sử, thu hồi phiên người dùng và tạo cảnh báo bàn giao idempotent.
- `POST /api/admin/accounts/:id/unlock` mở khoá sau xác nhận ở giao diện; các phiên cũ không được khôi phục.
- `POST /api/auth/login` kiểm tra tài khoản có bị khoá trước khi cấp phiên.
- `GET /api/auth/me` kiểm tra phiên người dùng hiện tại; phiên bị thu hồi trả `401`.

Dữ liệu tài khoản, lịch sử và cảnh báo được lưu trong `data/store.json`. Phiên dùng bộ nhớ của một tiến trình và bị vô hiệu khi server dừng. Đây là nền tảng chạy/thử nghiệm một máy; triển khai nhiều instance hoặc production cần database giao dịch và kho phiên dùng chung (ví dụ Redis), quản lý secret và HTTPS.

## Kiểm thử

```powershell
npm test
```
>>>>>>> master

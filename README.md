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

API quản lý chương trình đào tạo
- Các endpoint quản lý chương trình và liên kết lớp yêu cầu đăng nhập bằng tài khoản Admin.
- Giao diện Admin có tab “Chương trình đào tạo” để tìm kiếm, lọc theo mã, phân trang, tạo mới, chỉnh sửa và xóa/ngừng áp dụng.
- `GET /api/programs` hỗ trợ `search` (tìm theo mã, tên, mô tả), `code` (lọc chính xác, không phân biệt hoa thường), `page` và `pageSize` (mặc định là trang 1 với 20 dòng/trang; tối đa 100 dòng/trang). Phản hồi danh sách có thông tin phân trang.
- Tạo chương trình bằng JSON gồm `code`, `name`, `description`, `totalDuration`, `standardTuition` và `status`. Ba trường mới có giá trị mặc định lần lượt `0`, `0` và `active` để tương thích với client cũ.
- Chỉnh sửa chương trình bằng `PUT /api/programs/:id` với cùng cấu trúc JSON; mã trùng với chương trình khác bị từ chối.
- `totalDuration` là số không âm, `standardTuition` là số nguyên không âm theo VNĐ; `status` nhận `active` hoặc `inactive`.
- Database SQLite hiện có sẽ tự bổ sung các cột mới khi mở lại ứng dụng; dữ liệu cũ nhận giá trị mặc định `0`, `0` và `active`.
- Mã chương trình được chuẩn hóa thành chữ hoa; mã trùng trả HTTP 409 với thông báo tiếng Việt.
- `POST /api/programs/:id/classes` liên kết lớp đang chạy theo `{ "classCode": "...", "className": "..." }`; mã lớp phải là duy nhất. `GET /api/programs/:id/classes` liệt kê liên kết hiện tại, và `DELETE /api/programs/:id/classes/:classId` kết thúc liên kết khi lớp không còn chạy.
- `DELETE /api/programs/:id` xóa cứng chương trình nếu không có lớp đang chạy. Nếu còn lớp liên kết, chương trình không bị xóa mà được chuyển sang `inactive`; phản hồi có mã `PROGRAM_DEACTIVATED_IN_USE`, số lớp đang chạy và thông báo rõ ràng. Danh sách chương trình trả thêm `runningClassCount`.
- Database tự tạo bảng `running_program_classes` khi khởi động; chỉ các liên kết lớp đang chạy mới được lưu ở bảng này.
- Dữ liệu chương trình được lưu trong SQLite tại `backend/data/programs.sqlite`. Có thể đổi vị trí bằng biến môi trường `PROGRAMS_DB_FILE`.

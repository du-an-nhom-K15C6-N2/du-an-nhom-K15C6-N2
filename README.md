<<<<<<< HEAD
# Đăng ký tư vấn công khai

Module độc lập có thể ghép vào ứng dụng Node.js/Express. Khách truy cập gửi yêu cầu không cần tài khoản; backend xác thực và chuẩn hóa thông tin liên hệ, sau đó lưu lead ở trạng thái `Mới`.

## API

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| POST | `/api/consultation-leads` | Tạo lead tư vấn công khai |

Ví dụ request:

```json
{
  "name": "Nguyễn Thị An",
  "phone": "0912 345 678",
  "email": "an@example.com",
  "program": "Lập trình viên",
  "message": "Tôi muốn tìm hiểu lộ trình học.",
  "consent": true
}
```

API trả HTTP 201 với `{ "success": true, "data": { "id": "...", "status": "Mới" }, "message": "..." }`. Lỗi dữ liệu có `success: false`, mã lỗi ổn định và thông báo tiếng Việt. Số điện thoại Việt Nam được chuẩn hóa về dạng `+84xxxxxxxxx`; email được trim và chuyển chữ thường. Email, chương trình quan tâm và lời nhắn không bắt buộc. API yêu cầu xác nhận đồng ý liên hệ (`consent: true`) và lưu thời điểm đồng ý cùng lead. Số điện thoại trùng với lead đã có trả HTTP `409` (`DUPLICATE_PHONE_NUMBER`); API quản lý tại `/api/leads` dùng chung kho dữ liệu và phát hiện trùng sau khi chuẩn hóa.

Endpoint không dùng middleware xác thực. Chống spam gồm trường honeypot `website` (không lưu lead nếu bị điền) và giới hạn 5 yêu cầu/IP trong 15 phút; IP lấy từ `req.ip` của Express, không tin header `X-Forwarded-For` do client tự gửi. Khi deploy sau proxy, chỉ cấu hình Express `trust proxy` cho các proxy tin cậy của hạ tầng.

## Ghép vào ứng dụng

1. Chép `features/consultation-registration` vào thư mục `features` ở root dự án.
2. Trong `backend/routes/index.js`, mount route trước các fallback yêu cầu đăng nhập:

   ```js
   const consultationLeadRoutes = require('../../features/consultation-registration/backend/consultationLeadRoutes');
   router.use('/consultation-leads', consultationLeadRoutes);
   ```

   Nếu router `/api` có middleware xác thực áp dụng toàn cục, mount router công khai này trước middleware đó. Đảm bảo `express.json()` được bật trước API router.
3. Static mount `/features` có thể phục vụ biểu mẫu tại
   `/features/consultation-registration/frontend/consultation-form.html`. Thêm liên kết công khai tới trang này từ website/trang chủ.
4. Mặc định lead được lưu trong `features/consultation-registration/data/consultation-leads.json`. Có thể đặt biến môi trường `CONSULTATION_LEADS_DATA_FILE` để trỏ tới kho dữ liệu bền vững riêng khi triển khai.
5. Sau khi gửi thành công, biểu mẫu hiển thị lời cảm ơn và cam kết trung tâm gọi lại trong vòng 1 ngày làm việc.

## Chạy thử và kiểm thử

Chạy `node .\features\consultation-registration\preview-server.js` từ root dự án, sau đó mở `http://127.0.0.1:4177`. Preview server dùng Node.js tích hợp sẵn, không yêu cầu cài package; không dùng preview server để triển khai thật.

Chạy kiểm thử nghiệp vụ bằng:

```powershell
node --test .\features\consultation-registration\tests\consultationLead.test.js
```
=======
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
>>>>>>> b93a7281b21b0826b903a4aa24f704321099af9a

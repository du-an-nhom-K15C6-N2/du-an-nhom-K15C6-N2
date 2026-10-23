# Quản lý buổi học theo môn

Module độc lập để ghép vào ứng dụng Node.js/Express hiện có. Danh mục môn dùng chung là nguồn xác thực `course.id` và `course.sessionCount`; module chỉ lưu các buổi học đã khai báo.

## API

Mount `courseSessionsRoutes` tại `/api/course-sessions`:

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| GET | `/api/course-sessions/:courseId/sessions` | Lấy các buổi học theo số thứ tự tăng dần |
| POST | `/api/course-sessions/:courseId/sessions` | Khai báo `{ "number": 1, "topic": "...", "objectives": "..." }` |
| PUT | `/api/course-sessions/:courseId/sessions/:number` | Cập nhật chủ đề và mục tiêu của buổi |
| DELETE | `/api/course-sessions/:courseId/sessions/:number` | Xoá buổi học |
| POST | `/api/course-sessions/:courseId/sessions/clone` | Nhân bản `{ "sourceCourseId": "..." }` vào môn đích |

Phản hồi thành công có dạng `{ "success": true, "data": ..., "message": "..." }`. Lỗi nghiệp vụ trả `success: false`, mã `code` ổn định và thông báo tiếng Việt. API yêu cầu đăng nhập cùng quyền `courses.read` hoặc `courses.manage`, đang được dùng cho danh mục môn học.

Số buổi khai báo không được vượt quá `sessionCount`; số thứ tự phải là số nguyên dương trong giới hạn đó và duy nhất trong môn. Nhân bản thay toàn bộ danh sách hiện có của môn đích, giữ nguyên số thứ tự/chủ đề/mục tiêu, không chia sẻ bản ghi giữa hai môn. Việc nhân bản bị từ chối nếu môn đích không đủ số buổi hoặc một số thứ tự không hợp lệ với giới hạn của môn đích. Dữ liệu được ghi qua tệp tạm cùng thư mục rồi đổi tên để tránh lưu dở dang.

## Ghép vào ứng dụng

1. Chép thư mục `features/course-sessions` vào thư mục `features` ở root dự án.
2. Trong `backend/routes/index.js`, thêm:

   ```js
   const courseSessionsRoutes = require('../../features/course-sessions/backend/courseSessionsRoutes');
   router.use('/course-sessions', courseSessionsRoutes);
   ```

3. Đảm bảo static mount `/features` phục vụ các tệp giao diện. Trang quản lý nằm tại `/features/course-sessions/frontend/course-sessions.html`; thêm liên kết tới trang vào menu quản lý đào tạo.
4. Cấp quyền `courses.read` và `courses.manage` cho các vai trò phù hợp trong RBAC. Tên quyền này được chia sẻ với module danh mục môn học.
5. Mặc định danh mục môn ở `backend/data/courses.json`, dữ liệu buổi học ở `features/course-sessions/data/course-sessions.json`. Có thể cấu hình `COURSE_CATALOG_DATA_FILE` và `COURSE_SESSIONS_DATA_FILE` khi tích hợp/triển khai.
6. Danh mục môn cần có các trường `id`, `code`, `name`, `sessionCount`; `sessionCount` phải là số nguyên không âm.

## Kiểm thử

Chạy kiểm thử nghiệp vụ bằng Node.js:

```powershell
node --test .\features\course-sessions\tests\courseSessions.test.js
```

Để xem thử giao diện và API không cần cài package, chạy `node .\features\course-sessions\preview-server.js` từ root dự án hoặc nhấp đúp `features\course-sessions\start-preview.bat`, sau đó mở `http://127.0.0.1:4176`. Máy chủ preview chỉ để thử nghiệm cục bộ, không có xác thực và không dùng để triển khai thật.

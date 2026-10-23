# Quản lý lộ trình chương trình đào tạo

Module độc lập để ghép vào ứng dụng Express hiện có. Module tham chiếu `course.id` từ danh mục môn học dùng chung; không sao chép bản ghi môn học. Mỗi chương trình lưu danh sách môn với thứ tự liên tục bắt đầu từ 1 và các `prerequisiteIds`.

## API

Mount `programCurriculumRoutes` tại `/api/program-curricula`:

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| GET | `/api/program-curricula/:programId/courses` | Lấy môn học theo thứ tự, kèm thông tin môn tiên quyết |
| POST | `/api/program-curricula/:programId/courses` | Gắn môn học (`{ "courseId": "..." }`) |
| DELETE | `/api/program-curricula/:programId/courses/:courseId` | Gỡ môn học; từ chối nếu môn còn là tiên quyết |
| PUT | `/api/program-curricula/:programId/courses/order` | Cập nhật thứ tự bằng danh sách đầy đủ `{ "courseIds": ["...", "..."] }` |
| PUT | `/api/program-curricula/:programId/courses/:courseId/prerequisites` | Cập nhật `{ "prerequisiteIds": ["..."] }` |

API yêu cầu đăng nhập và quyền `curricula.read` hoặc `curricula.manage`. Mọi phản hồi thành công có dạng `{ "success": true, "data": ..., "message": "..." }`; lỗi nghiệp vụ trả `success: false`, `code` ổn định và thông báo tiếng Việt.

Một môn tiên quyết phải thuộc cùng chương trình, không thể là chính môn đang khai báo, không được tạo chu trình và phải đứng trước môn học đó. API sắp xếp kiểm tra toàn bộ quan hệ trước khi lưu, vì vậy kéo một môn qua khỏi môn tiên quyết sẽ bị từ chối. Việc thêm/gỡ và sắp xếp đều tự đánh lại thứ tự `1..N`. Tệp được ghi qua tệp tạm cùng thư mục rồi đổi tên để tránh lưu dở dang.

Module dùng `programId` làm định danh chương trình. Mã nguồn được cung cấp chưa có danh mục/API chương trình đào tạo để kiểm tra mã tồn tại; khi ghép với nơi có danh mục này, cần thêm kiểm tra `programId` tại tầng nghiệp vụ.

## Giao diện

`frontend/program-curriculum.html` cung cấp màn hình tra cứu theo mã chương trình, gắn/gỡ môn, kéo thả hoặc dùng nút Lên/Xuống để đổi thứ tự, và chọn nhiều môn tiên quyết trong các môn đứng trước.

Giao diện dùng access token `educlass_access_token`, gọi API danh mục môn học `/api/courses` (tự tải các trang 100 môn) và API lộ trình ở trên. Để phục vụ trang, thêm static mount `/features` trỏ tới thư mục `features` ở root, như module danh mục môn học hiện tại.

## Ghép vào ứng dụng

1. Chép thư mục `features/program-curriculum` vào thư mục `features` của ứng dụng.
2. Gắn router trong API router: `router.use('/program-curricula', programCurriculumRoutes)`. Router định nghĩa đường dẫn tương đối `/:programId/courses`.
3. Cấp quyền `curricula.read` và `curricula.manage` trong cấu hình RBAC cho Quản lý đào tạo và các vai trò phù hợp.
4. Đảm bảo danh mục môn học tồn tại tại `backend/data/courses.json` và có trường `id`, `code`, `name`. Có thể đặt `COURSE_CATALOG_DATA_FILE` nếu vị trí khác.
5. Mặc định dữ liệu lộ trình nằm ở `features/program-curriculum/data/program-curricula.json`. Có thể đổi bằng `PROGRAM_CURRICULA_DATA_FILE`. Đưa tệp dữ liệu vào vùng lưu trữ bền vững/backup của ứng dụng khi triển khai.
6. Phục vụ trang tại `/features/program-curriculum/frontend/program-curriculum.html` và thêm liên kết vào menu quản lý đào tạo.

## Chạy thử giao diện độc lập trên Windows

Không cần cài package. Từ thư mục `DNKN 90`, chạy:

```powershell
node .\features\program-curriculum\preview-server.js
```

Hoặc nhấp đúp `features\program-curriculum\start-preview.bat`. Mở `http://127.0.0.1:4175`, nhập mã chương trình mẫu `CNTT-2026`. Bản xem trước có sẵn 5 môn học mẫu; dữ liệu lộ trình được lưu riêng tại `data/preview-program-curricula.json` và có thể xoá nội dung tệp để bắt đầu lại.

Máy chủ preview chỉ bind vào `127.0.0.1`, bỏ qua xác thực để tiện thử UI/API và **không dùng để triển khai thật**. Khi tích hợp production, dùng router Express có middleware đăng nhập/phân quyền ở trên.

## Kiểm thử nghiệp vụ

Module chỉ dùng thư viện dựng sẵn của Node.js trong kiểm thử:

```sh
node --test .\features\program-curriculum\tests\programCurriculum.test.js
```

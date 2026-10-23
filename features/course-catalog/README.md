# Danh mục môn học

Module độc lập để ghép vào ứng dụng Node.js/Express của dự án. Mỗi môn học có một `id` riêng và danh sách `programIds`, vì vậy nhiều chương trình có thể cùng tham chiếu một môn học mà không tạo bản ghi môn trùng lặp.

## API

Mount router tại `/api/courses`:

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| GET | `/api/courses?page=1&pageSize=20&q=web&programId=CNTT` | Tìm kiếm và phân trang |
| POST | `/api/courses` | Tạo môn học |
| PUT | `/api/courses/:id` | Cập nhật môn học |
| DELETE | `/api/courses/:id` | Xoá nếu chưa được lớp học sử dụng |

Ví dụ nội dung tạo/cập nhật:

```json
{
  "code": "CS101",
  "name": "Cơ sở dữ liệu",
  "sessionCount": 12,
  "weight": 1.5,
  "outcomesDescription": "Thiết kế và truy vấn cơ sở dữ liệu.",
  "programIds": ["CNTT-2026", "QTKD-2026"]
}
```

Danh sách trả về `data.items` và `data.pagination` (`page`, `pageSize`, `total`, `totalPages`). Mỗi môn có `classCount`. Mã môn được chuẩn hoá chữ hoa và kiểm tra duy nhất không phân biệt hoa/thường. Trùng mã trả HTTP 409 với mã lỗi `COURSE_CODE_DUPLICATE`; môn có lớp trả HTTP 409 với mã lỗi `COURSE_HAS_CLASSES`.

## Ghép vào ứng dụng

1. Giữ các tệp module này trong repo hoặc chuyển model/controller/router vào `backend/models`, `backend/controllers` và `backend/routes`.
2. Gắn `courseCatalogRoutes` tại `/courses` trong `backend/routes/index.js`. Router dùng `requireAuth` và các quyền `courses.read`, `courses.manage` theo middleware RBAC hiện có.
3. Thêm hai quyền trên vào `backend/data/rbac-seed.json`; cấp `courses.read` và `courses.manage` cho quản trị viên và vai trò quản lý đào tạo (`manager`). Cập nhật menu điều hướng phù hợp với chính sách của ứng dụng.
4. Cho phép route trang `/courses` trả `features/course-catalog/frontend/courses.html`; thêm static mount `/features` trỏ tới thư mục `features` ở root. Trang dùng khóa access token hiện có `educlass_access_token`.
5. Khi chương trình tham chiếu môn học, lưu `course.id` vào danh sách môn của chương trình; không sao chép thông tin môn học sang từng chương trình. Các `programIds` trong module là mã tham chiếu; cần xác thực chúng với danh mục chương trình của ứng dụng khi tích hợp.
6. Khi tạo lớp, lưu `courseId` của môn học. Cơ chế chặn xoá kiểm tra `courseId` và hỗ trợ tương thích với lớp cũ có `courseCode`. Mặc định module kiểm tra `backend/data/classes.json`; có thể đặt `CLASS_DATA_FILE` và `COURSE_CATALOG_DATA_FILE` để dùng vị trí dữ liệu khác. Lỗi đọc dữ liệu lớp được báo rõ và không cho phép xoá khi không xác minh được liên kết.

## Kiểm tra

Chạy kiểm thử độc lập bằng:

```sh
node --test features/course-catalog/tests/courseCatalog.test.js
```

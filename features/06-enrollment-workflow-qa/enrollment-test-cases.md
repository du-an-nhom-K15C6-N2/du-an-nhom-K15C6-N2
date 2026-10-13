# Test cases: Luồng ghi danh học viên

## Phạm vi và hợp đồng kiểm thử

- API ghi danh đơn: `POST /api/enrollments`, body `{ "classId": 10, "studentId": 101 }`.
- API ghi danh hàng loạt: `POST /api/enrollments/bulk`, body `{ "classId": 10, "studentIds": [101, 102] }`.
- Request phải có người dùng đã xác thực; controller đọc tài khoản từ `request.user.id`.
- Response thành công của controller là HTTP `200`, chứa `results[]` cho từng học viên. `results[].status` là trạng thái nghiệp vụ của từng mục (ví dụ `201`, `409`), không phải HTTP status của toàn request.
- Thành công trả `code: "ENROLLED"`; từ chối trả mã lỗi nghiệp vụ như `CLASS_FULL`, `ALREADY_ENROLLED`, `STUDENT_NOT_FOUND`.
- Mỗi ghi danh thành công phải lưu enrollment và lịch sử (`class_id`, `student_id`, `enrolled_at`, `created_by`) trong cùng transaction. Không tạo history cho mục thất bại.

### Dữ liệu dùng trong ví dụ

| Đối tượng | ID | Trạng thái |
|---|---:|---|
| Lớp A | 10 | Sĩ số tối đa 5, hiện có 2 học viên |
| Lớp đầy B | 20 | Sĩ số tối đa 2, hiện có 2 học viên |
| Học viên chưa ghi danh | 101, 102, 103 | Tồn tại |
| Học viên đã có trong lớp A | 104 | Đã ghi danh lớp A |
| Người thao tác | 9001 | Đã xác thực |

## Unit tests — EnrollmentValidationService

| ID | Tình huống / thao tác | Kết quả mong đợi |
|---|---|---|
| UT-01 | Gọi `enrollStudent(10, 101, 9001)` với lớp/học viên hợp lệ | Trả `success: true`, đúng class/student ID; repository được gọi lưu enrollment và history đúng một lần. |
| UT-02 | Gọi `enrollStudents(10, [101, 102], 9001)` | Trả hai kết quả thành công theo đúng thứ tự; lưu hai enrollment và hai history record. |
| UT-03 | Ghi danh vào lớp 20 đã đủ sĩ số | Trả `CLASS_FULL`; không tạo enrollment hoặc history. |
| UT-04 | Ghi danh học viên 104 đã có trong lớp 10 | Trả `ALREADY_ENROLLED`; không tạo enrollment hoặc history. |
| UT-05 | Cung cấp `classId` rỗng/không hợp lệ | Trả `INVALID_CLASS_ID`; không truy vấn/tạo enrollment/history. |
| UT-06 | Cung cấp `studentId` rỗng/không hợp lệ | Trả `INVALID_STUDENT_ID`; không tạo enrollment/history. |
| UT-07 | ID lớp hợp lệ nhưng lớp không tồn tại | Trả `CLASS_NOT_FOUND`; không tạo enrollment/history. |
| UT-08 | ID học viên hợp lệ nhưng học viên không tồn tại | Trả `STUDENT_NOT_FOUND`; không tạo enrollment/history. |
| UT-09 | Bulk có ID lặp `[101, 101]` | Mục đầu thành công; mục thứ hai `ALREADY_ENROLLED` trong cùng batch; chỉ một enrollment/history được tạo. |
| UT-10 | Lớp A còn một chỗ, bulk `[101, 102]` | 101 thành công; 102 `CLASS_FULL`; chỉ 101 có enrollment/history. |
| UT-11 | Repository từ chối `createEnrollmentWithHistory` | Promise của service reject; không trả kết quả thành công giả. Database adapter phải rollback cả enrollment lẫn history. |

## Integration tests — API và database

| ID | Request / thao tác | Kết quả mong đợi |
|---|---|---|
| IT-01 | Đăng ký controller với router giả | Router nhận `POST /api/enrollments` và `POST /api/enrollments/bulk`; cả hai route dùng cùng controller. |
| IT-02 | POST `/api/enrollments`, user 9001, body `{classId: 10, studentId: 101}` | HTTP 200; `results` có đúng một mục `success: true`, `status: 201`, `code: "ENROLLED"`; summary `requested=1, succeeded=1, failed=0`. |
| IT-03 | POST bulk lớp A với `[101, 102]`, user 9001 | HTTP 200; có hai kết quả thành công tương ứng; summary `2/2`. |
| IT-04 | POST bulk lớp A với `[101, 104, 102]` | HTTP 200; từng kết quả theo đúng thứ tự: 101 thành công, 104 `ALREADY_ENROLLED`/409, 102 thành công; summary `requested=3, succeeded=2, failed=1`. |
| IT-05 | POST bulk lớp B với `[101, 102]` | Mỗi học viên nhận `CLASS_FULL`/409; summary `0/2`; DB không có enrollment/history mới. |
| IT-06 | POST body không phải object, gửi đồng thời `studentId` và `studentIds`, hoặc `studentIds: []` | HTTP 400, `code: "INVALID_REQUEST"`; service không được gọi. |
| IT-07 | Gửi request không có user, `user.id` rỗng hoặc ID số không hợp lệ | HTTP 401, `code: "UNAUTHENTICATED"`; service/database không được gọi. |
| IT-08 | Ghi danh thành công, sau đó truy vấn `enrollment_history` | Có đúng một hàng với đúng class/student và `created_by=9001`; `enrolled_at` là timestamp hợp lệ, nằm giữa thời điểm trước và sau request (UTC/precision theo DB). |
| IT-09 | Ghi danh thất bại do lớp đầy hoặc trùng enrollment, sau đó truy vấn history | Không phát sinh hàng history cho lần thao tác thất bại. |
| IT-10 | Cố tình làm insert history thất bại trong adapter transaction | Request không được báo học viên thành công; kiểm tra DB xác nhận enrollment cũng rollback. |

## UI/API response scenarios

| ID | Thao tác UI / dữ liệu API | Kết quả mong đợi |
|---|---|---|
| UI-01 | Chọn lớp, chọn 3 học viên, bấm ghi danh | Frontend gửi đúng một POST đến `/api/enrollments/bulk` với `{classId, studentIds}`; nút bị khóa trong lúc chờ. |
| UI-02 | API trả 3 kết quả thành công | Hiện thông báo “Thành công 3/3 học viên” và liệt kê đủ 3 tên trong nhóm thành công. |
| UI-03 | API trả 2 thành công, 1 `CLASS_FULL` | Hiện “Thành công 2/3 học viên”; danh sách thành công gồm 2 người; danh sách bị từ chối hiển thị lý do lớp đã đạt sĩ số tối đa. |
| UI-04 | API trả `ALREADY_ENROLLED` | Học viên nằm trong nhóm bị từ chối, hiển thị lý do đã được ghi danh và mã lỗi nếu response có mã. |
| UI-05 | Response có `studentId` không nằm trong props `students` | Vẫn hiển thị mục đó bằng fallback `ID <studentId>`, không làm hỏng danh sách kết quả. |
| UI-06 | API lỗi HTTP/network hoặc response không có `results` hợp lệ | Hiển thị thông báo lỗi; không hiển thị danh sách kết quả cũ như thể request vừa thành công; nút được mở khóa sau khi request kết thúc. |

## Hướng dẫn chạy / tiêu chí hoàn tất

Workspace hiện chưa khai báo test runner, cấu hình ứng dụng backend hoặc adapter database. Khi tích hợp vào dự án, triển khai các unit tests bằng runner hiện có, chạy integration tests với database test riêng có migration `enrollment_history`, và chạy UI scenarios bằng công cụ UI test của dự án. Không dùng database production cho các case ghi/xóa dữ liệu.

Hoàn tất khi các case UT-01–UT-11, IT-01–IT-10 và UI-01–UI-06 đạt; đặc biệt xác nhận transaction rollback ở IT-10 và thời gian/người thao tác chính xác ở IT-08.

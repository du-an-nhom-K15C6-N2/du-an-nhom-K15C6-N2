# Ghi danh học viên

Feature DNKN177 được tích hợp vào dashboard và API Express hiện có. Không chạy Vite/React riêng; menu **Ghi danh học viên** hiển thị cho admin, quản lý đào tạo và nhân viên đào tạo. Backend kiểm tra lại quyền `students.manage` cho mọi endpoint.

## Luồng chức năng

- Chọn lớp đang hoạt động và một hoặc nhiều tài khoản học viên đang hoạt động.
- API ghi danh từng học viên theo thứ tự, từ chối ID không hợp lệ, lớp/học viên không tồn tại, học viên đã ghi danh và lớp đủ sĩ số.
- Giao diện hiển thị riêng kết quả thành công/từ chối, lý do và tổng số.
- Mỗi ghi danh thành công lưu bản ghi ghi danh cùng audit entry (`classId`, `studentId`, `enrolledAt`, `createdBy`) trong cùng lần thay thế nguyên tử của tệp JSON.
- Lịch sử gần đây được xem qua UI và API; thao tác lỗi không sinh audit entry.

Lớp hiện tại chưa khai báo sức chứa, vì vậy giá trị mặc định là 30 học viên. Có thể ghi `maxStudents` trên từng bản ghi lớp trong `backend/data/classes.json` để cấu hình sức chứa riêng. Không cần sửa các bản ghi lớp hiện có để chạy feature.

## API

Các endpoint đều yêu cầu Bearer token hợp lệ và quyền `students.manage`.

| Phương thức | Đường dẫn | Mục đích |
| --- | --- | --- |
| `GET` | `/api/enrollments/options` | Lớp đang hoạt động (kèm sĩ số) và học viên đang hoạt động |
| `POST` | `/api/enrollments` | Ghi danh đơn với `{ "classId": "...", "studentId": "..." }` |
| `POST` | `/api/enrollments/bulk` | Ghi danh nhiều học viên với `{ "classId": "...", "studentIds": ["...", "..."] }` |
| `GET` | `/api/enrollments/history?classId=...` | Lịch sử mới nhất (tối đa 100 entry; lọc lớp tùy chọn) |

Lỗi cấu trúc request trả `400`; lỗi xác thực/phân quyền trả `401`/`403`. Khi payload hợp lệ, API trả `200` và danh sách `data.results[]`; trạng thái từng mục nằm trong `results[].status` và mã lỗi trong `results[].code`. Ghi danh đơn cũng nhận mảng `studentIds` một phần tử. Enrollment và history được lưu tại `backend/data/enrollments.json`, có thể đổi bằng `ENROLLMENT_DATA_FILE`.

## Kiểm tra

```powershell
npm test -- --test-name-pattern="enrollment"
npm run build
```

Các test kiểm tra giới hạn sĩ số, ID không hợp lệ/không tồn tại, trùng học viên trong batch, audit, response API, quyền và dữ liệu lưu sai định dạng.

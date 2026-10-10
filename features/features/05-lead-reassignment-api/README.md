# API chuyển giao lead

NestJS + TypeORM implementation cho phép quản lý chuyển lead giữa các tư vấn viên, đồng thời ghi lại lịch sử trong cùng transaction với cập nhật lead.

## Endpoint

`PATCH /api/leads/{id}/reassign`

Request:

```json
{
  "consultantId": "f2d9c19d-f15c-43c2-9b08-3ba35698f415",
  "note": "Chuyển lead về nhóm phụ trách khu vực miền Nam"
}
```

Response `200 OK` trả về lead sau cập nhật:

```json
{
  "id": "0d68c4d4-3768-4b0f-98c4-9713418c8687",
  "assignedToId": "f2d9c19d-f15c-43c2-9b08-3ba35698f415"
}
```

## Kiểm tra và mã lỗi

- JWT không hợp lệ hoặc thiếu: `401 Unauthorized`.
- Chỉ `TRAINING_MANAGER` được chuyển giao lead; vai trò khác nhận `403 Forbidden`.
- ID lead phải là UUID; consultant ID được kiểm tra bằng DTO validation.
- Không tìm thấy lead: `404 Not Found`.
- Người nhận phải tồn tại trong `users`, có `role = ACADEMIC_ADVISOR` và `is_active = true`; nếu không hợp lệ trả `404 Not Found`.
- Chuyển lead cho chính tư vấn viên đang phụ trách bị từ chối với `400 Bad Request`.
- Mọi lỗi ở quá trình ghi lịch sử đều rollback cập nhật người phụ trách.

## Schema và tích hợp

- `leads`: có `id` UUID và `assigned_to` UUID nullable.
- `users`: có `id` UUID, `role` (`ACADEMIC_ADVISOR` / `TRAINING_MANAGER`) và `is_active` boolean. Nếu ứng dụng đã có `User` entity, thay `Consultant` bằng entity/repository hiện có và giữ nguyên các điều kiện lọc.
- `lead_assignment_history`: migration trong `src/leads/migrations` tạo các cột `id`, `lead_id`, `from_assigned_to`, `to_assigned_to`, `changed_by`, `note` và `created_at`, cùng index trên `(lead_id, created_at)`. Các ID người dùng được lưu để giữ dấu vết lịch sử ngay cả khi hồ sơ user bị xóa. Migration bật extension PostgreSQL `uuid-ossp` để sinh UUID; tài khoản chạy migration cần quyền tạo extension nếu extension chưa có.
- `Lead` ở đây chỉ ánh xạ hai trường cần thiết. Bổ sung các cột lead hiện có trong ứng dụng để API trả toàn bộ thông tin lead.

Đăng ký `LeadsModule` trong ứng dụng đã cấu hình TypeORM và Passport JWT. JWT strategy phải gắn `request.user` theo dạng `{ id, role }`. Bật `ValidationPipe` toàn cục hoặc sử dụng validation pipe trên endpoint như trong controller; cần các package NestJS, TypeORM và `class-validator` mà ứng dụng host thường đã cài.

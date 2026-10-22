# Lead Management UI

Giao diện responsive quản lý Lead cho đội ngũ tuyển sinh, gồm tìm kiếm, lọc nguồn/trạng thái, phân trang, xuất CSV, tạo/cập nhật và xóa Lead.

## Chạy trong project tổng

Module chạy độc lập để không phải sửa server, route hoặc cấu hình hiện có của project nhóm. Từ thư mục gốc project:

```powershell
$env:LEAD_MANAGER_TOKEN = "a-unique-local-manager-token"
$env:REGULAR_USER_TOKEN = "a-different-local-advisor-token"
node .\features\lead-management-ui\server.js
```

Mở `http://localhost:3001/`. API và UI được phục vụ cùng origin; module dùng chung file SQLite hiện có tại `features/lead-list-search-pagination/data/leads.sqlite`. Có thể đặt `PORT` hoặc `DATABASE_PATH` để chọn cổng/database khác.

Nhập bearer token local trong thanh đầu trang trước khi tạo/cập nhật. Cả token quản lý đào tạo và tư vấn tuyển sinh có thể tạo/sửa; chỉ token quản lý được xóa. Token được giữ trong `sessionStorage` tới khi đóng phiên trình duyệt. Cơ chế env-token chỉ dành cho local/demo, không thay thế xác thực production.

## Chạy giao diện mẫu offline

Mở trực tiếp `frontend/index.html` (`file:` URL). Dữ liệu mẫu được lưu trong browser `localStorage` (`edulead.leads.v1`). Server preview tĩnh độc lập không phải API.

## Hợp đồng API

- `GET /api/leads` hỗ trợ `q`, `status`, `source`, phân trang; CSV lấy đủ các trang phù hợp bộ lọc.
- `POST /api/leads` tạo từ các trường `name`, `phone`, `email`, `source`, `programOfInterest`, `status`, `note`.
- `PATCH /api/leads/:id` cập nhật các trường trên.
- `POST /api/leads/phone-check` kiểm tra số điện thoại trùng.
- `DELETE /api/leads/:id` yêu cầu quyền `Quản lý đào tạo`.
- Trùng số điện thoại trả HTTP `409` để form hiển thị lỗi ở trường số điện thoại.

Chương trình quan tâm là trường bắt buộc trong backend tích hợp. Các bản ghi localStorage cũ thiếu trường này được gán giá trị hiển thị `Chưa xác định` để vẫn có thể sửa trên form.

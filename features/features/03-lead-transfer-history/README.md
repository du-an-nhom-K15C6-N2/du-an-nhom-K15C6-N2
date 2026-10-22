# Phân công lead hàng loạt

Màn hình CRM hỗ trợ tìm kiếm/lọc lead, chọn từng lead hoặc tất cả lead đang hiển thị, sau đó phân công cho tư vấn viên với ghi chú tùy chọn. Giao diện dùng HTML/CSS/JavaScript thuần, không cần bước build.

## Chạy thử

Mở `index.html?demo=1` bằng trình duyệt để dùng dữ liệu mẫu. Nếu trình duyệt chặn tài nguyên khi mở trực tiếp bằng `file://`, chạy static server trong thư mục này:

```powershell
py -m http.server 8000
```

Sau đó mở `http://localhost:8000/?demo=1`.

## API contract mặc định

- `GET /api/leads` trả về mảng lead hoặc `{ "items": [...] }` / `{ "data": [...] }`.
- `GET /api/consultants` trả về mảng tư vấn viên hoặc cùng cấu trúc bọc trên.
- `POST /api/leads/assign-bulk` nhận `{ "leadIds": ["..."], "consultantId": "...", "note": "..." }`.
- Lead dùng `id`, `name`, `email`, `phone`, `source`, `createdAt` (hoặc `created_at`), `consultantId` (hoặc `consultant: { id, name }`). Tư vấn viên dùng `id`, `name`, và `team` tùy chọn.
- Lỗi HTTP có thể trả `{ "message": "..." }`; thông báo lỗi được hiển thị trong hộp phân công và toast. Sau khi phân công thành công, màn hình tải lại cả danh sách lead lẫn danh sách tư vấn viên.

Cùng host DNKN94, giao diện đọc JWT từ `localStorage.accessToken`; đăng nhập tại trang gốc trước. Cấu hình `apiBaseUrl` trong `config.js` nếu API chạy khác origin. Demo chỉ bật khi thêm `?demo=1` hoặc đặt `demo: true` trong cùng cấu hình.

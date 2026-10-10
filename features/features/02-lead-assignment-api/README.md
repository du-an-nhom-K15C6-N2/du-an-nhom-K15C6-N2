# Bulk Lead Assignment

Giao diện tiếng Việt cho phép tìm/lọc lead, chọn từng dòng hoặc chọn tất cả lead đang hiển thị, rồi phân công hàng loạt cho tư vấn viên. Không cần bước build.

## Chạy thử

Mở `index.html?demo=1` bằng trình duyệt để dùng dữ liệu mẫu. Nếu trình duyệt chặn tài nguyên khi mở trực tiếp bằng `file://`, chạy một static server trong thư mục này, ví dụ:

```powershell
py -m http.server 8000
```

Sau đó mở `http://localhost:8000/?demo=1`. Chế độ demo lưu thay đổi tạm trong bộ nhớ và tải lại dữ liệu mẫu sau mỗi lần phân công.

## API contract mặc định

- `GET /api/leads` trả về mảng lead hoặc `{ "items": [...] }` / `{ "data": [...] }`.
- `GET /api/consultants` trả về mảng tư vấn viên hoặc cùng cấu trúc bọc trên.
- `POST /api/leads/assign-bulk` nhận `{ "leadIds": ["..."], "consultantId": "...", "note": "..." }`.
- Lead dùng `id`, `name`, `email`, `phone`, `source`, `createdAt` (hoặc `created_at`), `consultantId` (hoặc `consultant: { id, name }`). Tư vấn viên dùng `id`, `name`, và `team` tùy chọn.
- API nên trả mã HTTP 2xx khi thành công; lỗi có thể trả `{ "message": "..." }` để hiển thị cho người dùng. Sau phản hồi thành công, danh sách và số liệu được tải lại từ API.

Khi chạy cùng host DNKN94, backend cùng origin và giao diện đọc JWT từ `localStorage.accessToken`; đăng nhập tại trang gốc trước. Để cấu hình backend khác origin, cập nhật `apiBaseUrl` trong `config.js`. Có thể bật demo bằng `demo: true` trong cùng file hoặc thêm `?demo=1` vào URL.
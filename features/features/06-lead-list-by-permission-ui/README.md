# Danh sách lead theo phân quyền

Giao diện web tĩnh tiếng Việt, không cần bước build. Mở `index.html` trên static server; dùng `?demo=1` để xem giao diện với dữ liệu minh họa.

## Chạy thử

```powershell
py -m http.server 8000
```

Mở `http://localhost:8000/?demo=1`. Chế độ demo chỉ bật khi có `?demo=1` hoặc `demo: true` trong `config.js`; nếu không, giao diện gọi backend thật và hiển thị lỗi khi API không sẵn sàng.

## Phân quyền và phiên đăng nhập

- Vai trò `manager`, `sales_manager`, `admin` và `training_manager` hiển thị danh sách toàn hệ thống cùng bộ lọc tư vấn viên.
- Vai trò `consultant`, `academic_advisor` và `advisor` chỉ hiển thị lead của người dùng hiện tại. Cột phụ trách chỉ đọc.
- Token lấy từ `localStorage.accessToken`; người dùng hiện tại lấy từ `localStorage.currentUser` (JSON có `role`, tùy chọn `name`). Có thể đổi khóa lưu hoặc cung cấp `currentUser`/`getToken()` trong `config.js`.
- Phân quyền thực sự phải được xác thực ở backend trên mọi request. Vai trò và bộ lọc phía trình duyệt chỉ điều khiển giao diện; API phải lấy danh tính từ token và không tin `consultantId` để cho phép truy cập lead ngoài phạm vi.

## API contract

Cấu hình `apiBaseUrl`, `leadsEndpoint` và `consultantsEndpoint` trong `config.js`.

- `GET /api/leads?search=&status=&page=1&pageSize=10` trả về trang lead. Quản lý có thể gửi thêm `consultantId`.
- Response khuyến nghị `{ "items": [], "total": 0, "page": 1 }` hoặc `{ "data": { "items": [], "total": 0, "page": 1 } }` để phân trang và lọc do backend thực hiện. Phản hồi mảng hoặc `{ "data": [] }` cũng được hỗ trợ; giao diện sẽ lọc/phân trang tại client trên đúng tập dữ liệu đã được API giới hạn quyền.
- Mỗi lead hỗ trợ `id`, `name`/`fullName`, `email`, `phone`, `status`, `createdAt`/`created_at` và thông tin phụ trách dạng `assignedConsultant`, `assigned_consultant` hoặc `consultant` (gồm `id`, `name`).
- `GET /api/consultants` (quản lý) trả về mảng tư vấn viên hoặc `{ "items": [] }` / `{ "data": [] }`; mỗi tư vấn viên có `id`, `name`.
- Lỗi HTTP có thể trả `{ "message": "..." }`; giao diện hiển thị lỗi thay vì thay bằng dữ liệu mẫu.

Điều chỉnh tên query/shape của API tại `app.js` nếu backend hiện hữu dùng contract khác.

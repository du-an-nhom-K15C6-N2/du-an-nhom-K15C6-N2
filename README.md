# Academy Admin

Bản demo quản trị tài khoản chạy bằng Node.js, không cần cài package ngoài.

## Chạy ứng dụng

Cần Node.js 20 trở lên. Tại thư mục dự án:

```powershell
npm start
```

Mở `http://localhost:5173`. Tài khoản quản trị mặc định là `admin@academy.local`, mật khẩu `12345678`.

Có thể đặt thông tin quản trị trước khi chạy:

```powershell
$env:ADMIN_EMAIL = "admin@academy.local"
$env:ADMIN_PASSWORD = "your-strong-local-password"
npm start
```

Dữ liệu demo người dùng có mật khẩu `demo-password` cho API đăng nhập người dùng. Tài khoản bị khoá mẫu không thể đăng nhập. Các mật khẩu này chỉ dành cho demo local; hãy đặt `ADMIN_PASSWORD` mạnh trước khi triển khai.

## API

- `POST /api/admin/login` xác thực quản trị viên và cấp bearer token.
- `GET /api/accounts`, `GET /api/classes`, `GET /api/audit` yêu cầu token quản trị.
- `POST /api/admin/accounts/:id/lock` nhận `{ "reason": "..." }`, lưu lý do/lịch sử, thu hồi phiên người dùng và tạo cảnh báo bàn giao idempotent.
- `POST /api/admin/accounts/:id/unlock` mở khoá sau xác nhận ở giao diện; các phiên cũ không được khôi phục.
- `POST /api/auth/login` kiểm tra tài khoản có bị khoá trước khi cấp phiên.
- `GET /api/auth/me` kiểm tra phiên người dùng hiện tại; phiên bị thu hồi trả `401`.

Dữ liệu tài khoản, lịch sử và cảnh báo được lưu trong `data/store.json`. Phiên dùng bộ nhớ của một tiến trình và bị vô hiệu khi server dừng. Đây là nền tảng chạy/thử nghiệm một máy; triển khai nhiều instance hoặc production cần database giao dịch và kho phiên dùng chung (ví dụ Redis), quản lý secret và HTTPS.

## Kiểm thử

```powershell
npm test
```

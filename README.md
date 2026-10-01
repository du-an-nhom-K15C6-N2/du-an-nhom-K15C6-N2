# DNKN 12 - Đặt lại mật khẩu

Ứng dụng Node.js/Express độc lập cho luồng đặt lại mật khẩu qua email. Workspace ban đầu không có hệ thống đăng nhập hay cơ sở dữ liệu người dùng, vì vậy ứng dụng dùng SQLite riêng và cần được kết nối với hệ thống xác thực thực tế trước khi đưa vào production.

## Chạy local

Cần Node.js 20 trở lên.

```powershell
npm install
Copy-Item .env.example .env
npm start
```

Mở `http://localhost:3000`. Để tạo tài khoản local, mở terminal tương tác mới:

```powershell
npm run user:add -- nguoidung@example.com
```

Mật khẩu được nhập ẩn trong terminal và phải có 12-128 ký tự. Trong development, nếu chưa cấu hình SMTP, liên kết đặt lại được in vào console của server. Chế độ này chỉ dành cho local.

## Cấu hình email

Mẫu `.env.example` đã điền máy chủ Gmail (`smtp.gmail.com`, port 465, TLS). Bật Xác minh 2 bước cho tài khoản Google, tạo App Password, rồi điền địa chỉ Gmail vào `SMTP_USER` và App Password vào `SMTP_PASSWORD` trong `.env` (không dùng mật khẩu đăng nhập Google thông thường). Có thể để `SMTP_FROM` trống để dùng chính địa chỉ Gmail đó làm người gửi.

Sau khi điền cấu hình, chạy `npm run smtp:check` để kiểm tra kết nối và xác thực mà không gửi email; sau đó khởi động lại `npm start`. Nếu không có đủ cấu hình SMTP trong development, app sẽ báo rõ trong console và chỉ in liên kết reset tại đó. Production bắt buộc có `APP_BASE_URL`, SMTP và người gửi email. Dùng HTTPS cho `APP_BASE_URL` khi triển khai công khai. Gmail hoặc quản trị viên Google Workspace có thể chặn SMTP/App Password theo chính sách tài khoản.

## API

- `POST /api/password-reset-requests` với `{ "email": "..." }`: luôn trả cùng thông báo chung, không cho biết email có tài khoản hay không. Giới hạn 5 yêu cầu mỗi IP trong 15 phút.
- `POST /api/password-resets` với `{ "token": "...", "password": "..." }`: đổi mật khẩu nếu token hợp lệ; mật khẩu dài 12-128 ký tự. Giới hạn 10 lần thử mỗi IP trong 15 phút.

Token ngẫu nhiên 256-bit chỉ được lưu dưới dạng SHA-256, có hiệu lực 30 phút. Token nằm trong URL fragment nên không được gửi theo yêu cầu tải trang; trình duyệt xóa fragment khỏi thanh địa chỉ sau khi đọc. Mỗi yêu cầu mới sẽ vô hiệu token cũ của tài khoản. Cập nhật mật khẩu và đánh dấu token đã dùng diễn ra trong cùng một giao dịch SQLite, nên token chỉ dùng được một lần. Mật khẩu được băm bằng scrypt.

## Tích hợp

API cập nhật bảng `users` của SQLite trong ứng dụng này. Hệ thống đăng nhập có sẵn cần dùng chung bảng/tầng lưu trữ người dùng hoặc thay truy vấn cập nhật trong `server.js` bằng repository xác thực của nó; nếu không, mật khẩu mới sẽ không có tác dụng với một hệ thống khác. Không lưu token reset trong log production.
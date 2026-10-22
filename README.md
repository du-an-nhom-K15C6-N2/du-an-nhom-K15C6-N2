# DNKN94 Lead Management

Host tích hợp mỏng cho các mẫu lead hiện có trong `features\features`. Backend Express/PostgreSQL của feature 04 phục vụ API, xác thực JWT và các UI gốc của features 02, 03, 06, 07. Các thư mục feature gốc được giữ nguyên vị trí; feature 01/05 là ví dụ NestJS/TypeORM được hợp nhất về cùng chính sách vai trò và schema của host, không phải các server cần khởi chạy riêng. Feature 08 là kế hoạch kiểm thử; test tự động của host bao phủ các luồng API tương ứng.

## Yêu cầu

- Windows PowerShell.
- Node.js 20 trở lên và npm.
- PostgreSQL 13 trở lên, đang chạy và truy cập được bằng `DATABASE_URL`.
- Cổng `3000` mặc định phải còn trống (có thể đổi bằng `PORT`).

## Cài đặt lần đầu

1. Tạo database và role PostgreSQL bằng tài khoản quản trị của bạn, ví dụ:

   ```sql
   CREATE ROLE dnkn94 LOGIN PASSWORD 'use-a-unique-password';
   CREATE DATABASE dnkn94 OWNER dnkn94;
   ```

2. Từ thư mục gốc `D:\DNKN94`, tạo file môi trường cục bộ:

   ```powershell
   Copy-Item .env.example .env
   ```

   Sửa `.env`: đặt `DATABASE_URL` đúng với PostgreSQL, và tạo `JWT_SECRET` ngẫu nhiên tối thiểu 32 ký tự. Không commit hoặc chia sẻ `.env`.

3. Cài dependencies của backend hiện có:

   ```powershell
   npm --prefix features\features\04-bulk-lead-assignment-ui install
   ```

4. Đọc lại `migrations\002_create_crm_schema.sql`, rồi áp dụng schema một cách tường minh:

   ```powershell
   npm run db:migrate
   ```

   Migration chỉ tạo bảng/index chưa có, nhưng **chưa được áp dụng tự động**. Tệp này định nghĩa schema riêng cho host DNKN94; nếu DB đang có dữ liệu hoặc các bảng trùng tên theo schema khác, hãy sao lưu và đối chiếu trước. Migration không xóa bảng/dữ liệu.

5. Tạo tài khoản admin ban đầu. Đặt `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` (ít nhất 12 ký tự) và `BOOTSTRAP_ADMIN_NAME` trong `.env`, sau đó chạy:

   ```powershell
   npm run db:bootstrap-admin
   ```

   Lệnh chỉ chèn tài khoản nếu email chưa tồn tại; không đặt lại mật khẩu hoặc ghi đè tài khoản cũ. Tạo tư vấn viên/manager bổ sung bằng `NEW_USER_EMAIL`, `NEW_USER_PASSWORD`, `NEW_USER_NAME`, `NEW_USER_ROLE` (`consultant`, `sales_manager` hoặc `training_manager`), rồi chạy `npm run db:create-user`. Các lệnh không in mật khẩu ra log.

## Chạy và kiểm thử

Khởi động toàn hệ thống bằng một lệnh tại root:

```powershell
npm start
```

Mở `http://localhost:3000/`, đăng nhập bằng tài khoản admin, tạo lead và quản lý dữ liệu. Chạy test unit và integration:

```powershell
npm test
```

Kiểm tra trạng thái server và database:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

Endpoint health trả `200` cùng `database: connected` khi pool kết nối PostgreSQL hoạt động; trả `503` nếu database chưa sẵn sàng. Backend không tự tạo dữ liệu mẫu hoặc tự chạy migration khi khởi động.

## Cấu hình

`.env.example` liệt kê cấu hình:

| Biến | Ý nghĩa |
| --- | --- |
| `PORT` | Cổng HTTP (mặc định `3000`) |
| `DATABASE_URL` | URL kết nối PostgreSQL |
| `DB_POOL_MAX` | Số kết nối tối đa của pool |
| `DB_CONNECTION_TIMEOUT_MS` | Thời gian chờ kết nối DB |
| `JWT_SECRET` | Bí mật ký HS256, tối thiểu 32 ký tự |
| `JWT_EXPIRES_IN` | Tuổi thọ token (mặc định `8h`) |
| `BOOTSTRAP_ADMIN_*` | Chỉ dùng cho bước tạo admin ban đầu |

Đăng nhập qua `POST /api/auth/login` với `{ "email": "...", "password": "..." }`; token trả về cần gửi dưới dạng `Authorization: Bearer <accessToken>`. Mỗi request được xác thực lại với bảng `users` để phát hiện tài khoản bị vô hiệu hóa và lấy role hiện tại từ DB. Không tin role hoặc user ID do trình duyệt gửi.

## Schema và phân quyền

Schema ở `features\features\04-bulk-lead-assignment-ui\migrations\002_create_crm_schema.sql` gồm `users`, `leads`, `lead_assignment_history`; số điện thoại được chuẩn hóa về chữ số khi ghi, có unique index để chặn trùng; cập nhật người phụ trách và ghi lịch sử dùng transaction. Role lưu được: `admin`, `sales_manager`, `training_manager`, `manager`, `consultant`, `academic_advisor` và tên role NestJS viết hoa tương ứng.

- Admin/quản lý: xem toàn bộ lead, tìm kiếm/lọc/phân trang, tạo/cập nhật/xóa lead, phân công và xem lịch sử.
- Tư vấn viên: chỉ xem/tìm/phân trang lead được giao; tạo lead tự nhận, cập nhật lead được giao và chuyển lead mình sở hữu; không được xóa, xem toàn bộ, hay phân công hàng loạt.
- API từ chối xóa lead nếu người dùng không phải quản lý; role kiểm tra ở backend cho mọi thao tác.

## API thống nhất

- `POST /api/auth/login`
- `GET /api/health`
- `GET /api/leads?search=&status=&consultantId=&page=1&pageSize=10`
- `GET /api/leads/:id`, `POST /api/leads`, `PATCH /api/leads/:id`, `DELETE /api/leads/:id`
- `GET /api/leads/phone-check?phone=&excludeId=`
- `GET /api/consultants` (quản lý)
- `POST /api/leads/assign-bulk` — `{ "leadIds": [], "consultantId": "...", "note": "..." }`
- `PUT` hoặc `PATCH /api/leads/:id/reassign`
- `GET /api/leads/:id/transfer-history`

Danh sách trả `{ "items": [], "total": 0, "page": 1, "pageSize": 10 }`; lỗi dùng `{ "message": "..." }`. Phone-check không trả dữ liệu cá nhân của lead trùng; tạo/cập nhật vẫn được bảo vệ bởi unique index và trả `409` khi số đã dùng.

## Các giao diện gốc

- `/` — host CRUD, đăng nhập, tìm kiếm/phân trang, kiểm tra trùng số điện thoại, xóa có phân quyền và xem lịch sử.
- `/features/06-lead-list-by-permission-ui/` — giao diện danh sách phân quyền.
- `/features/02-lead-assignment-api/` — giao diện phân công hàng loạt.
- `/features/03-lead-transfer-history/` và `/features/07-lead-history-detail-ui/?leadId=<UUID>` — lịch sử chuyển giao.

Token được chia sẻ trong `localStorage.accessToken` để các giao diện hiện hữu gọi chung API; cần đăng nhập ở trang gốc trước. UI chỉ hỗ trợ trải nghiệm; backend là nơi thực thi quyền.

## Giới hạn triển khai

Các feature đầu vào không có host, schema DB, quản lý người dùng hay UI tạo/cập nhật/xóa dùng chung; API NestJS 01/05 là ví dụ yêu cầu một ứng dụng host chưa có. Host này tái sử dụng Express, auth/reassignment/history service và các trang HTML/CSS/JS gốc, đồng thời bổ sung các endpoint/schema còn thiếu. Kiểm tra tích hợp thực tế với PostgreSQL cần DB cục bộ đang chạy và thông tin kết nối hợp lệ; không có migration nào tự chạy khi start.

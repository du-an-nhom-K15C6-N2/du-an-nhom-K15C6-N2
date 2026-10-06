# Hệ thống Quản lý Đào tạo

Dự án thuộc học phần Thực tập cơ sở của nhóm K15C6-N2. Hệ thống hướng đến việc hỗ trợ quản trị viên, giảng viên và người học trong các quy trình đào tạo.

# Đăng nhập và xác thực người dùng

## Chạy ứng dụng

1. Chạy `npm install`.
2. Trong terminal thứ nhất, chạy `npm run server` để khởi động API tại `http://localhost:3000`.
3. Trong terminal thứ hai, chạy `npm run dev` và mở địa chỉ Vite hiển thị trong terminal; Vite chuyển tiếp `/api` về backend.
4. Hoặc chạy `npm start` để build giao diện và chạy ứng dụng gộp tại `http://localhost:3000` (cũng là địa chỉ trong cấu hình VS Code).
5. Chạy kiểm thử bằng `npm test`; kiểm tra riêng bản production bằng `npm run build`.

## Luồng và quy tắc đăng nhập

- Giao diện kiểm tra email và mật khẩu trước khi gửi `POST /api/auth/login`.
- Máy chủ xác thực mật khẩu đã băm bằng scrypt, tạo JWT có chữ ký và thời hạn 24 giờ khi đăng nhập thành công.
- Giao diện lưu phiên và điều hướng theo vai trò: `admin`, `teacher`, `assistant`, `student`.
- JWT có thời hạn 24 giờ; khi người dùng còn hoạt động, giao diện tự gọi `POST /api/auth/refresh` định kỳ để gia hạn cùng phiên đăng nhập. Phiên không hoạt động sẽ không được gia hạn.
- API bảo vệ trả `401` với mã `SESSION_EXPIRED` khi phiên hết hạn hoặc đã bị thu hồi; giao diện đưa người dùng về đăng nhập và thông báo rõ ràng.
- Bản nháp của các biểu mẫu được lưu tạm trong `sessionStorage` theo tab, loại trừ mật khẩu, token và trường bí mật. Bản nháp được giữ lại sau khi khôi phục và chỉ bị xóa khi thao tác được lưu thành công hoặc người dùng đăng xuất chủ động; hết hạn phiên hoặc đăng xuất từ thẻ khác không xóa bản nháp đang có.
- Đăng xuất thu hồi toàn bộ token thuộc phiên hiện tại ngay trên server, bao gồm cả token đã được gia hạn trước đó.
- Giảng viên, trợ giảng và quản trị viên có thể sử dụng biểu mẫu điểm danh; danh sách chọn học sinh được nạp từ tài khoản đang hoạt động trong Quản lý người dùng qua `GET /api/attendance/students`. Biểu mẫu gửi ID học sinh; server tự lấy tên/email hiện tại từ tài khoản để lưu vào `backend/data/attendance.json`, không tin tên/email do trình duyệt gửi. API vẫn hỗ trợ client cũ gửi email và ngăn điểm danh trùng cùng lớp/ngày. Giao diện Vite đặt form trong dashboard vai trò; giao diện portal cũ tại `frontend/index.html` có tab **Điểm danh** trên thanh điều hướng admin và tự mở khu vực điểm danh cho giảng viên/trợ giảng.
- Sai thông tin luôn trả về cùng thông báo `Email hoặc mật khẩu không đúng`; sau 5 lần sai liên tiếp, email bị giới hạn đăng nhập 15 phút. Backend là nguồn quyết định thời gian khóa và trả số giây còn lại cho bộ đếm; đăng nhập thành công xóa số lần sai.
- Người dùng đã đăng nhập có thể đổi mật khẩu tại dashboard. API `PATCH /api/auth/change-password` bắt buộc mật khẩu hiện tại chính xác và mật khẩu mới từ 8 ký tự; giao diện yêu cầu nhập lại để xác nhận mật khẩu mới.
- Các API quản lý người dùng yêu cầu JWT hợp lệ và vai trò admin. `/api/auth/me` cũng yêu cầu phiên hợp lệ.
- Bộ đếm đăng nhập sai được lưu bền vững tại `backend/data/login-attempts.json`; email được băm SHA-256 trước khi lưu. Khóa file và ghi nguyên tử giúp các tiến trình dùng chung file không ghi đè số lần thử của nhau. Có thể đặt `LOGIN_ATTEMPT_STORE_FILE` để chọn vị trí khác. Khi chạy nhiều instance, tất cả phải dùng cùng file trên filesystem dùng chung; lỗi đọc/ghi kho sẽ được báo như lỗi máy chủ thay vì bỏ qua giới hạn đăng nhập.

## Mật khẩu và tài khoản cũ

- Mật khẩu không được lưu dạng văn bản. `POST /api/users` tự tạo mật khẩu tạm, lưu dạng hash và gửi qua email cùng liên kết kích hoạt dùng một lần, có hiệu lực 24 giờ. Tài khoản ở trạng thái `pending` cho đến khi gọi `POST /api/users/activate` qua liên kết; API không trả mật khẩu tạm, hash hoặc token kích hoạt.
- `GET /api/users` hỗ trợ tìm theo tên/email/số điện thoại qua `search`, lọc `role`/`status`, và phân trang mặc định 20 bản ghi (`page`, `pageSize`; kích thước tối đa 100). Các API quản lý yêu cầu tài khoản admin.
- `PUT /api/users/:id` cập nhật tên, email, số điện thoại, vai trò và trạng thái; email đã thuộc tài khoản khác bị từ chối bằng HTTP 409 và mã `EMAIL_ALREADY_EXISTS`.
- Một tài khoản có thể có nhiều vai trò (`roles`); dữ liệu cũ chỉ có `role` vẫn được hỗ trợ. Quản trị viên có thể gán vai trò qua `POST /api/users/:id/roles` với `{ "role": "teacher" }` và thu hồi qua `DELETE /api/users/:id/roles/:role`. Vai trò hợp lệ gồm `admin`, `teacher`, `assistant`, `student`, `manager` (Quản lý đào tạo). Không thể tự thu hồi vai trò admin. Quyền được đọc từ user store ở mỗi request; JWT đang hoạt động nhận quyền mới ở request tiếp theo mà không cần đăng nhập lại.
- Tài khoản đã tồn tại trong `backend/data/users.json` trước khi có trường `passwordHash` sẽ không đăng nhập được cho tới khi được cấp mật khẩu.
- Cấp mật khẩu khởi tạo cho admin bằng biến môi trường `BOOTSTRAP_ADMIN_EMAIL` và `BOOTSTRAP_ADMIN_PASSWORD` khi chạy máy chủ. Chỉ tài khoản admin chưa có hash mới được cập nhật; sau đó bỏ hai biến bootstrap. Admin có thể cấp mật khẩu cho tài khoản cũ bằng `PATCH /api/users/:id/password`; tài khoản mới được tạo qua quy trình email kích hoạt.
- Production phải đặt `AUTH_TOKEN_SECRET` thành một secret ngẫu nhiên đủ mạnh. Không dùng secret mặc định ở production.
- Danh sách token/phiên bị thu hồi được lưu bền vững tại `backend/data/revoked-sessions.json`; khởi động lại server không làm token đã đăng xuất có hiệu lực trở lại. Có thể đặt `SESSION_STORE_FILE` để chọn vị trí khác. Mọi instance phải dùng cùng `AUTH_TOKEN_SECRET` và cùng một đường dẫn kho trên filesystem dùng chung; file lock/ghi nguyên tử hỗ trợ truy cập đồng thời trên volume dùng chung. Không dùng đường dẫn cục bộ riêng nếu chạy nhiều instance.
- API điểm danh: `GET /api/attendance` lấy tối đa 50 bản ghi gần đây của người tạo (admin xem tất cả); `POST /api/attendance` nhận `className`, `studentEmail`, `attendanceDate` (`YYYY-MM-DD`), `status` (`present`, `late`, `absent`, `excused`) và `note`. Chỉ admin/giảng viên/trợ giảng được truy cập.
- Dự án chưa có mô hình lớp học hoặc quan hệ phân công giảng viên-học sinh; form điểm danh hiện xác minh học sinh đang hoạt động nhưng chưa thể giới hạn theo danh sách lớp được phân công. Cần bổ sung mô hình thành viên lớp trước khi dùng như hệ thống điểm danh production.

## Tính năng Quản lý phiên & Quên / Đặt lại mật khẩu

- **Root Server & start.bat**: Đã bổ sung file `server.js` ở thư mục gốc giúp chạy trực tiếp lệnh `node server.js` hoặc chạy file `start.bat`.
- **API Phiên hoạt động (`/api/session/*`)**:
  - `POST /api/session/login`: Đăng nhập bằng email và mật khẩu đã băm; không còn tài khoản/mật khẩu demo cố định.
  - Tài khoản phải đang hoạt động và có vai trò hợp lệ; sai thông tin dùng thông báo chung và cùng cơ chế khóa 5 lần/15 phút như `/api/auth/login`.
  - `GET /api/session`: Kiểm tra thời hạn hiệu lực của phiên hiện tại.
  - `POST /api/session/renew`: Gia hạn phiên khi người dùng còn hoạt động.
  - `POST /api/session/logout`: Thu hồi token và kết thúc phiên ngay lập tức.
- **API Khôi phục mật khẩu**:
  - `POST /api/forgot-password`: Nhận email, tạo token dùng một lần có hiệu lực 30 phút và gửi liên kết qua email. Với mọi email hợp lệ, API luôn trả cùng thông báo chung để không tiết lộ tài khoản có tồn tại hay không.
  - `POST /api/reset-password`: Kiểm tra token còn hạn/chưa dùng, đặt mật khẩu mới (8–1024 ký tự), cập nhật hash và vô hiệu hóa token. Token được giữ trong bộ nhớ; khởi động lại máy chủ sẽ vô hiệu hóa các liên kết đang chờ.
  - Cấu hình `SMTP_USER` và `SMTP_PASS` để bật gửi email qua Gmail; đặt `RESET_PASSWORD_URL` thành URL gốc của ứng dụng khi chạy ngoài máy local. Khi phát triển không có SMTP, liên kết chỉ được ghi vào console để kiểm thử; production không ghi token ra log và cần SMTP để gửi email.
  - Email mời kích hoạt tài khoản dùng cùng cấu hình SMTP và URL gốc. Ở môi trường phát triển chưa có SMTP, liên kết kích hoạt và mật khẩu tạm chỉ được ghi trong terminal backend; production từ chối tạo tài khoản nếu thiếu cấu hình SMTP.
  - Để gửi Gmail thật, sao chép `.env.example` thành `.env`, thay `SMTP_USER` bằng Gmail gửi thư và `SMTP_PASS` bằng Google App Password (cần bật xác minh 2 bước và tạo App Password trong tài khoản Google). Không dùng mật khẩu Gmail thông thường; không chia sẻ hoặc commit `.env`. Email khôi phục của tài khoản học sinh NGO TRUNG HIEU trong dữ liệu local đã được đặt thành `hieu12032006@gmail.com`.
- **Giao diện người dùng**:
  - `login.html`: Đăng nhập bằng email/mật khẩu qua API xác thực chính, lưu token theo lựa chọn "Ghi nhớ tôi" và điều hướng theo vai trò.
  - `session-demo.html`: Màn hình minh họa phiên và bản nháp; bản nháp được giữ khi phiên hết hạn và xóa khi đăng xuất chủ động.
  - `forgot-password.html` & `reset-password.html`: Luồng giao diện quên và đặt lại mật khẩu hoàn chỉnh.

# Đăng nhập và xác thực người dùng

## Chạy ứng dụng

1. Chạy `npm install`.
2. Trong terminal thứ nhất, chạy `npm run server` để khởi động API tại `http://localhost:3000`.
3. Trong terminal thứ hai, chạy `npm run dev` và mở địa chỉ Vite hiển thị trong terminal; Vite chuyển tiếp `/api` về backend.
4. Hoặc chạy `npm start` để build giao diện và chạy ứng dụng gộp tại `http://localhost:3000` (cũng là địa chỉ trong cấu hình VS Code).
5. Chạy kiểm thử bằng `npm test`; kiểm tra riêng bản production bằng `npm run build`.
6. Có thể nhấn **F5** trong VS Code; cấu hình trong `.vscode/launch.json` tự build, khởi động backend và mở `http://localhost:3000`.

### Triển khai production

- Production bắt buộc cấu hình `DATA_FILE` tới một tệp dữ liệu riêng, bền vững (không dùng `backend/data/users.json` mẫu), cùng `AUTH_TOKEN_SECRET` có ít nhất 32 byte. Giữ các giá trị này trong secret manager/environment của nền tảng, không commit chúng vào repository.
- Với kho dữ liệu mới, backend khởi tạo danh sách người dùng rỗng; cung cấp đồng thời `BOOTSTRAP_ADMIN_EMAIL` và `BOOTSTRAP_ADMIN_PASSWORD` lần đầu để tạo admin đang hoạt động. Mật khẩu bootstrap tối thiểu 12 ký tự, được băm trước khi lưu. Sau khi admin đã có thông tin đăng nhập, có thể gỡ hai biến bootstrap; server vẫn xác minh có admin hoạt động trước khi mở cổng.
- Nếu kho dữ liệu đã có tài khoản, email bootstrap phải thuộc một tài khoản admin hiện hữu chưa có mật khẩu. Bootstrap không ghi đè mật khẩu đã tồn tại và không thêm admin vào kho đang có dữ liệu nếu email không khớp; server dừng với lỗi cấu hình rõ ràng.
- API khôi phục 28 tài khoản mẫu chỉ dùng được trong môi trường phát triển; production từ chối thao tác này để tránh ghi đè kho người dùng thật.
- Render Blueprint ở `../render.yaml` dùng Node service, health check `/api/health` và persistent disk tại `/var/data` cho người dùng, phiên, đăng nhập sai, điểm danh, điểm và học phí. Khi tạo Blueprint, nhập email admin và mật khẩu bootstrap (tối thiểu 12 ký tự) trong ô secret của Render; không nhập hoặc lưu secret trong file YAML. Sau lần deploy đầu và khi xác nhận đăng nhập admin thành công, xóa hai biến `BOOTSTRAP_ADMIN_*` khỏi Environment để không giữ mật khẩu bootstrap lâu hơn cần thiết.
- URL kích hoạt/đặt lại mật khẩu mặc định lấy từ `RENDER_EXTERNAL_URL` của Render. Muốn bật gửi email kích hoạt và đặt lại mật khẩu, cấu hình `SMTP_USER` và `SMTP_PASS` (Gmail App Password) trong Environment; không ghi chúng vào repository.

## Vai trò và phân quyền

- Danh mục vai trò và quyền được khai báo tập trung tại `backend/config/rolePermissions.js`; backend từ chối mặc định nếu người dùng không có quyền được yêu cầu.
- Dữ liệu seed có phiên bản nằm ở `backend/data/rbac-seed.json` và được backend nạp, kiểm tra khi khởi động; do quyền được suy ra từ cấu hình server, không cần migration database hoặc sửa từng tài khoản để có danh mục quyền sau triển khai. Khi thay đổi seed, cập nhật `version` và kiểm thử RBAC; seed chỉ đọc cấu hình, không ghi đè dữ liệu người dùng.
- Tám vai trò gồm quản trị viên, giảng viên, trợ giảng, học sinh/sinh viên, quản lý đào tạo, kế toán, trưởng bộ môn và nhân viên đào tạo.
- Mỗi vai trò có danh sách quyền tường minh trong `ROLE_CATALOG`; mã quyền phải thuộc danh mục `PERMISSIONS`. Ma trận được cấu hình phía server và quản trị viên có thể xem qua API, không nhận thay đổi quyền trực tiếp từ dữ liệu client.
- API quản lý tài khoản, lớp học và điểm danh kiểm tra quyền ở server. Giảng viên không có quyền học phí; kế toán không có quyền sửa điểm. API chưa được triển khai (ví dụ học phí/điểm) không thể được truy cập và trả 404.
- Tài khoản đã đăng nhập xem quyền hiện hành qua `GET /api/auth/permissions`; quản trị viên xem ma trận quyền bằng `GET /api/users/role-permissions`.
- Từ chối truy cập trả HTTP 403, mã `ACCESS_FORBIDDEN` và thông báo tiếng Việt thân thiện.
- API bảng điểm: `GET /api/grades` xem điểm theo quyền (học viên chỉ xem dữ liệu của mình); `PUT /api/grades` tạo/cập nhật điểm theo học viên, lớp, môn và học kỳ. Giảng viên, trưởng bộ môn và quản trị viên được cập nhật điểm; backend kiểm tra điểm trong thang hợp lệ.
- API học phí: `GET /api/tuition` xem dữ liệu theo quyền (học viên chỉ xem dữ liệu của mình); `PUT /api/tuition` tạo/cập nhật học phí theo học viên và năm học. Chỉ kế toán và quản trị viên được cập nhật; API kiểm tra số tiền, trạng thái thanh toán và ngày đến hạn.
- Điểm và học phí lưu riêng trong `backend/data/grades.json` và `backend/data/tuition.json`; có thể đổi vị trí bằng `GRADES_DATA_FILE` và `TUITION_DATA_FILE`. Các file được tạo khi lưu bản ghi đầu tiên.
- Danh mục môn học dùng chung có tại `/courses`; chỉ quản trị viên và quản lý đào tạo được xem và chỉnh sửa. API `GET /api/courses` hỗ trợ tìm kiếm/phân trang, còn `POST`, `PUT /:id` và `DELETE /:id` quản lý môn học. Dữ liệu lưu ở `backend/data/courses.json` (có thể đổi bằng `COURSE_CATALOG_DATA_FILE`); môn học đang được lớp tham chiếu không thể bị xóa. Trang và API cũng hoạt động qua proxy Vite trong chế độ phát triển.

## Danh sách lớp học

- Quản trị viên, quản lý đào tạo và nhân viên đào tạo mở **Danh sách lớp học** từ menu ứng dụng.
- `GET /api/classes` lọc theo `status`, `programId`, `teacherId`, `startDate` và `endDate`. Khoảng thời gian là bao gồm hai đầu mút và trả về lớp có thời gian học giao với khoảng lọc; ngày nhận theo `YYYY-MM-DD`.
- Mỗi lớp trả về tên chương trình, ngày khai giảng/kết thúc, sĩ số hiện tại, sức chứa tối đa, số buổi đã học/tổng số buổi và phần trăm tiến độ. Sĩ số hiện tại được đếm từ dữ liệu ghi danh; sức chứa mặc định là 30 nếu lớp chưa khai báo `maxStudents`.
- Các bộ lọc được giữ trên URL (`view=classes` cùng tham số lọc) để có thể chia sẻ hoặc mở lại màn hình với cùng điều kiện.

## Quản lý Lead (tích hợp DNKN93)

- Trang quản lý truy cập tại `/lead-management`; liên kết xuất hiện trong menu của quản trị viên, quản lý đào tạo và nhân viên đào tạo. Trang dùng token phiên hiện có của ứng dụng, không dùng token demo DNKN93.
- API `/api/leads` cung cấp danh sách/tìm kiếm/lọc/phân trang, xem chi tiết, tạo, cập nhật, kiểm tra trùng số điện thoại và xóa. Nhân viên đào tạo quản lý Lead được phân công; Quản lý đào tạo có thể quản lý toàn bộ Lead. Đọc yêu cầu quyền `leads.read`; tạo/cập nhật yêu cầu lần lượt `leads.create` và `leads.update`. Chỉ vai trò `manager` (Quản lý đào tạo) được xóa từng Lead hoặc xóa tất cả qua `DELETE /api/leads/all`.
- Đã tích hợp phân quyền theo người phụ trách, lọc danh sách cho nhân viên đào tạo, phân công một/một nhóm Lead và xem lịch sử bàn giao. `training_staff` là vai trò tư vấn viên; chỉ `admin` và `manager` được phân công. API gồm `GET /api/consultants`, `POST /api/leads/assign-bulk`, `PUT/PATCH /api/leads/:id/reassign` và `GET /api/leads/:id/transfer-history`.
- Nhân viên đào tạo chỉ thấy và cập nhật Lead được giao cho mình; Lead mới do họ tạo được tự giao cho người tạo. Lead cũ hoặc đăng ký công khai vẫn chưa có người phụ trách và chỉ quản lý thấy cho tới khi được phân công. Dữ liệu phân công/lịch sử lưu trong cùng file JSON hiện có, không thêm database hay dependency.
- Lead quản lý và đăng ký tư vấn công khai dùng chung file `features/consultation-registration/data/consultation-leads.json` (đổi vị trí qua `CONSULTATION_LEADS_DATA_FILE`). Lead cũ được đọc theo cấu trúc hiện hữu và giữ lại `message`, `consentedAt` cùng metadata khi cập nhật; số điện thoại được chuẩn hóa để phát hiện trùng giữa các định dạng `0`, `84` và `+84`.
- Dự án nhóm dùng JSON làm kho dữ liệu, không có PostgreSQL/SQLite cho Lead. Lưu tệp được thay thế nguyên tử trong một tiến trình; kho JSON không cung cấp khóa giao dịch giữa nhiều tiến trình/instance. Khi triển khai, cấu hình file trên persistent storage và chỉ chạy một instance nếu cần bảo đảm kiểm tra trùng nhất quán.

### Phễu tư vấn và Lịch sử trạng thái Lead (tích hợp DNKN-172)

- Bổ sung màn hình **Phễu tư vấn Kanban** tại `/lead-management#pipeline` (và nút chuyển đổi trực tiếp giữa "Danh sách" và "Phễu tư vấn" trên thanh công cụ).
- 6 cột trạng thái theo chuẩn: `Mới`, `Đã liên hệ`, `Đang tư vấn`, `Hẹn học thử`, `Chốt`, `Từ chối`.
- Hỗ trợ kéo thả card lead giữa các cột và chọn nhanh từ danh sách thả xuống, có modal xác nhận cập nhật trạng thái.
- Ràng buộc nghiệp vụ: Chuyển sang trạng thái "Từ chối" bắt buộc chọn lý do hợp lệ (`Không phù hợp nhu cầu`, `Không liên hệ được`, `Học phí`, `Lịch học`, `Đã chọn nơi khác`); chuyển sang các trạng thái khác không nhận lý do.
- Slide-over Drawer xem chi tiết lead, dòng thời gian thay đổi trạng thái và nút mở modal chăm sóc tương tác (DNKN-173).
- API endpoints tương thích:
  - `GET /api/leads/board` hoặc `GET /api/leads/pipeline`: Lấy danh sách cột, số lượng và các lead theo từng cột.
  - `PATCH /api/leads/:id/status`: Cập nhật trạng thái lead, ghi nhận lịch sử thay đổi và trả về bảng phễu mới nhất.
  - `GET /api/leads/:id/history`: Lấy lịch sử chuyển đổi trạng thái của lead theo thứ tự mới nhất trước.
  - `GET /api/leads`: Tương thích kép, trả về đồng thời định dạng danh sách phân trang và cấu trúc bảng phễu (`statuses`, `counts`, `leadsByStatus`).

### Mô hình vai trò, quyền và lưu trữ chuẩn

- Các mã quyền nghiệp vụ chuẩn được khai báo một lần trong `PERMISSIONS`: `profile.read`, `profile.password.change`, `users.read`, `users.create`, `users.update`, `users.manage`, `roles.manage`, `users.delete`, `classes.read`, `classes.manage`, `classes.handover`, `courses.read`, `courses.manage`, `attendance.read`, `attendance.write`, `grades.read`, `grades.write`, `tuition.read`, `tuition.write`, `students.manage`, `reports.academic.read`, `reports.finance.read`, `system.configure`, `leads.read`, `leads.create`, `leads.update`, `leads.delete`.
- `backend/data/rbac-seed.json` là seed khởi tạo phiên bản 4, chứa toàn bộ mã quyền, 8 vai trò, nhãn, quyền gán và điều hướng. `backend/config/rolePermissions.js` nạp seed làm cấu hình thực thi lúc backend khởi động và dừng khởi tạo nếu seed sai định dạng hoặc tham chiếu quyền chưa khai báo.
- Ma trận trong `ROLE_CATALOG` gán quyền như sau:
  - `admin` (Quản trị viên): toàn bộ quyền trong `PERMISSIONS` ngoại trừ `leads.delete`, gồm `courses.read`, `courses.manage` và các quyền quản lý Lead khác.
  - `teacher` (Giảng viên): `profile.read`, `profile.password.change`, `classes.read`, `attendance.read`, `attendance.write`, `grades.read`, `grades.write`.
  - `assistant` (Trợ giảng): `profile.read`, `profile.password.change`, `classes.read`, `attendance.read`, `attendance.write`, `grades.read`.
  - `student` (Học sinh/Sinh viên): `profile.read`, `profile.password.change`, `classes.read`, `grades.read`, `tuition.read`.
  - `manager` (Quản lý đào tạo): `profile.read`, `profile.password.change`, `users.read`, `classes.read`, `classes.manage`, `classes.handover`, `courses.read`, `courses.manage`, `attendance.read`, `grades.read`, `students.manage`, `reports.academic.read`, `leads.read`, `leads.create`, `leads.update`, `leads.delete`.
  - `accountant` (Kế toán): `profile.read`, `profile.password.change`, `users.read`, `tuition.read`, `tuition.write`, `reports.finance.read`.
  - `department_head` (Trưởng bộ môn): `profile.read`, `profile.password.change`, `users.read`, `classes.read`, `attendance.read`, `grades.read`, `grades.write`, `reports.academic.read`.
  - `training_staff` (Nhân viên đào tạo): `profile.read`, `profile.password.change`, `users.read`, `users.create`, `users.update`, `classes.read`, `classes.manage`, `attendance.read`, `grades.read`, `students.manage`, `reports.academic.read`, `leads.read`, `leads.create`, `leads.update`.
- Bản ghi người dùng lưu vai trò trong trường `roles` (mảng mã vai trò); `role` đơn là trường tương thích dữ liệu cũ và vai trò chính. Không lưu một bản sao quyền trên từng tài khoản: backend suy ra quyền hiệu lực từ `ROLE_CATALOG` mỗi request, do đó thay đổi cấu hình được áp dụng thống nhất. Dữ liệu `roles` cũ vẫn đọc được; nếu không có mảng thì dùng `role`.
- Các vai trò `student` và `teacher` là độc quyền: tài khoản mang một trong hai vai trò này không được gán kèm vai trò khác. Vai trò không hợp lệ bị loại khỏi tập hiệu lực và không cấp quyền; quyền không có trong `PERMISSIONS` mặc định không được chấp nhận.

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
- Dashboard gọi `GET /api/dashboard/summary` bằng phiên hiện tại để lấy tổng số tài khoản, lớp đang hoạt động/cần bàn giao và lượt điểm danh. Backend chỉ trả từng nhóm số liệu nếu tài khoản có quyền tương ứng (`users.read`, `classes.read`, `attendance.read`); lượt điểm danh tuân theo phạm vi bản ghi của API điểm danh, còn số liệu được tính trên toàn bộ bản ghi trong kho thay vì giới hạn 50 dòng lịch sử. Có thể làm mới số liệu ngay trên dashboard.
- Các API quản lý người dùng yêu cầu JWT hợp lệ và vai trò admin. `/api/auth/me` cũng yêu cầu phiên hợp lệ.
- Bộ đếm đăng nhập sai được lưu bền vững tại `backend/data/login-attempts.json`; email được băm SHA-256 trước khi lưu. Khóa file và ghi nguyên tử giúp các tiến trình dùng chung file không ghi đè số lần thử của nhau. Có thể đặt `LOGIN_ATTEMPT_STORE_FILE` để chọn vị trí khác. Khi chạy nhiều instance, tất cả phải dùng cùng file trên filesystem dùng chung; lỗi đọc/ghi kho sẽ được báo như lỗi máy chủ thay vì bỏ qua giới hạn đăng nhập.

## Mật khẩu và tài khoản cũ

- Mật khẩu không được lưu dạng văn bản. `POST /api/users` tự tạo mật khẩu tạm, lưu dạng hash và gửi qua email cùng liên kết kích hoạt dùng một lần, có hiệu lực 24 giờ. Tài khoản ở trạng thái `pending` cho đến khi gọi `POST /api/users/activate` qua liên kết hoặc admin gọi `PATCH /api/users/:id/activate`; kích hoạt bởi admin chỉ áp dụng cho tài khoản đang chờ, đổi trạng thái sang `active` và vô hiệu hóa token email. Admin cũng có thể gửi lại email qua `POST /api/users/:id/resend-activation`. API không trả mật khẩu tạm, hash hoặc token kích hoạt.
- `GET /api/users` hỗ trợ tìm theo tên/email/số điện thoại qua `search`, lọc `role`/`status`, và phân trang mặc định 20 bản ghi (`page`, `pageSize`; kích thước tối đa 100). Các API quản lý yêu cầu tài khoản admin.
- `PUT /api/users/:id` cập nhật tên, email, số điện thoại và vai trò. Trạng thái không được đổi trực tiếp bằng PUT; phải dùng API khóa/mở khóa hoặc kích hoạt để tránh bỏ qua kiểm tra lý do và thu hồi phiên.
- Một tài khoản có thể có nhiều vai trò (`roles`); dữ liệu cũ chỉ có `role` vẫn được hỗ trợ. Quản trị viên có thể gán vai trò qua `POST /api/users/:id/roles` với `{ "role": "teacher" }` và thu hồi qua `DELETE /api/users/:id/roles/:role`. Vai trò hợp lệ gồm `admin`, `teacher`, `assistant`, `student`, `manager` (Quản lý đào tạo). Không thể tự thu hồi vai trò admin. Quyền được đọc từ user store ở mỗi request; JWT đang hoạt động nhận quyền mới ở request tiếp theo mà không cần đăng nhập lại.
- Tài khoản đã tồn tại trong `backend/data/users.json` trước khi có trường `passwordHash` sẽ không đăng nhập được cho tới khi được cấp mật khẩu.
- Cấp mật khẩu khởi tạo cho admin bằng biến môi trường `BOOTSTRAP_ADMIN_EMAIL` và `BOOTSTRAP_ADMIN_PASSWORD` khi chạy máy chủ. Chỉ tài khoản admin chưa có hash mới được cập nhật; sau đó bỏ hai biến bootstrap. Admin có thể cấp mật khẩu cho tài khoản cũ bằng `PATCH /api/users/:id/password`; tài khoản mới được tạo qua quy trình email kích hoạt.
- Production phải đặt `AUTH_TOKEN_SECRET` thành một secret ngẫu nhiên đủ mạnh. Không dùng secret mặc định ở production.
- Danh sách token/phiên bị thu hồi được lưu bền vững tại `backend/data/revoked-sessions.json`; khởi động lại server không làm token đã đăng xuất có hiệu lực trở lại. Khi admin khóa tài khoản, tất cả phiên đang hoạt động của tài khoản đó được thu hồi ngay. Có thể đặt `SESSION_STORE_FILE` để chọn vị trí khác. Mọi instance phải dùng cùng `AUTH_TOKEN_SECRET` và cùng một đường dẫn kho trên filesystem dùng chung; file lock/ghi nguyên tử hỗ trợ truy cập đồng thời trên volume dùng chung. Không dùng đường dẫn cục bộ riêng nếu chạy nhiều instance.
- API điểm danh: `GET /api/attendance` lấy tối đa 50 bản ghi gần đây của người tạo (admin xem tất cả); `POST /api/attendance` nhận `className`, `studentId` (hoặc `studentEmail` cho client cũ), `attendanceDate` (`YYYY-MM-DD`), `status` (`present`, `late`, `absent`, `excused`) và `note`. Chỉ admin/giảng viên/trợ giảng được truy cập. Form trên dashboard lấy danh sách lớp đang hoạt động từ `GET /api/classes` và danh sách học sinh hoạt động từ `GET /api/attendance/students`; dữ liệu tổng quan dùng cùng kho JSON backend hiện tại.
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
  - `POST /api/auth/forgot-password`: Nhận email, tạo token dùng một lần có hiệu lực 30 phút và gửi liên kết qua email. Mỗi tài khoản chỉ có một liên kết đặt lại còn hiệu lực; yêu cầu mới sẽ vô hiệu hóa token trước đó. Với mọi email hợp lệ, API luôn trả cùng thông báo chung để không tiết lộ tài khoản có tồn tại hay không. Các đường dẫn `/api/forgot-password` và `/api/reset-password` vẫn được giữ tương thích với client cũ.
  - `POST /api/auth/reset-password`: Kiểm tra token còn hạn/chưa dùng, đặt mật khẩu mới (8–1024 ký tự), cập nhật hash và vô hiệu hóa token. Token được giữ trong bộ nhớ; khởi động lại máy chủ sẽ vô hiệu hóa các liên kết đang chờ.
  - Cấu hình `SMTP_USER` và `SMTP_PASS` để bật gửi email qua Gmail; đặt `RESET_PASSWORD_URL` thành URL gốc của ứng dụng khi chạy ngoài máy local. Khi phát triển không có SMTP, liên kết chỉ được ghi vào console để kiểm thử; production không ghi token ra log và cần SMTP để gửi email.
  - Email mời kích hoạt tài khoản dùng cùng cấu hình SMTP và URL gốc. Ở môi trường phát triển chưa có SMTP, liên kết kích hoạt và mật khẩu tạm chỉ được ghi trong terminal backend; production từ chối tạo tài khoản nếu thiếu cấu hình SMTP.
  - Để gửi Gmail thật, sao chép `.env.example` thành `.env`, thay `SMTP_USER` bằng Gmail gửi thư và `SMTP_PASS` bằng Google App Password (cần bật xác minh 2 bước và tạo App Password trong tài khoản Google). Không dùng mật khẩu Gmail thông thường; không chia sẻ hoặc commit `.env`. Email khôi phục của tài khoản học sinh NGO TRUNG HIEU trong dữ liệu local đã được đặt thành `hieu12032006@gmail.com`.
- **Khóa/mở khóa tài khoản:** `PATCH /api/users/:id/lock` bắt buộc body `{ "reason": "..." }` (tối đa 500 ký tự), lưu `lockReason` và thu hồi toàn bộ phiên đăng nhập đang hoạt động. `PATCH /api/users/:id/unlock` mở khóa và xóa `lockReason`. `PATCH /api/users/:id/toggle-lock` vẫn được giữ để tương thích client cũ và áp dụng cùng quy tắc. Chỉ admin mới được gọi các API quản lý này.

- **Giao diện người dùng**:
  - `login.html`: Đăng nhập bằng email/mật khẩu qua API xác thực chính, lưu token theo lựa chọn "Ghi nhớ tôi" và điều hướng theo vai trò.
  - `session-demo.html`: Màn hình minh họa phiên và bản nháp; bản nháp được giữ khi phiên hết hạn và xóa khi đăng xuất chủ động.
  - `forgot-password.html` & `reset-password.html`: Luồng giao diện quên và đặt lại mật khẩu hoàn chỉnh.

## Ghi danh học viên (DNKN177)

Chức năng ghi danh đơn/hàng loạt, xác thực sĩ số, phản hồi từng kết quả và audit history được tích hợp vào dashboard hiện tại. Menu chỉ hiển thị cho admin, quản lý đào tạo và nhân viên đào tạo; API dùng quyền `students.manage`. Dữ liệu ghi danh và lịch sử được lưu nguyên tử trong `backend/data/enrollments.json` (có thể đổi bằng `ENROLLMENT_DATA_FILE`). Sức chứa mặc định là 30 học viên nếu lớp chưa có `maxStudents`. API contract, luồng sử dụng và test được mô tả tại [features/student-enrollment/README.md](./features/student-enrollment/README.md).

## Phân công giảng viên và trợ giảng cho lớp theo từng môn (DNKN-179)

Chức năng phân công giảng viên chính chịu trách nhiệm chuyên môn và trợ giảng hỗ trợ cho lớp học theo từng môn đã được tích hợp đầy đủ vào hệ thống cho Quản lý đào tạo (`manager`) và Quản trị viên (`admin`).
- **Truy vấn tài khoản theo vai trò**: Bổ sung API `GET /api/users/by-role/:role?status=active` và `GET /api/assignments/options` phục vụ chọn giảng viên và trợ giảng đang hoạt động.
- **Ràng buộc nghiệp vụ**: Giảng viên chính là bắt buộc; giảng viên phải có vai trò `teacher` và đang hoạt động; trợ giảng phải có vai trò `assistant` và đang hoạt động; nghiêm cấm trợ giảng trùng với giảng viên chính của cùng môn; kiểm tra hợp lệ lớp và môn học; ngăn chặn phân công trùng lặp cho cùng một môn trong lớp.
- **API phân công RESTful**: `GET /api/assignments`, `GET /api/assignments/options`, `GET /api/assignments/classes/:classId`, `POST /api/assignments`, `PUT /api/assignments/:id`, `DELETE /api/assignments/:id`, `GET /api/assignments/history`.
- **Giao diện phân công**: Menu **Phân công giảng dạy** trên thanh điều hướng, bảng ma trận môn học theo lớp kèm huy hiệu trạng thái, modal phân công/bàn giao với validation realtime, và timeline lịch sử thay đổi.
- **Lưu trữ & Kiểm thử**: Dữ liệu lưu nguyên tử tại `backend/data/teaching-assignments.json` (đổi vị trí qua `TEACHING_ASSIGNMENT_DATA_FILE`). Bộ kiểm thử 15 test case toàn diện tại `tests/teachingAssignment.test.js`. Chi tiết xem tại [features/class-teaching-assignment/README.md](./features/class-teaching-assignment/README.md).

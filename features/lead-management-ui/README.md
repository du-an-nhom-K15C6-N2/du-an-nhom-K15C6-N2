# Quản lý Lead

Giao diện DNKN93 được phục vụ trong ứng dụng nhóm tại `/lead-management`. Ở URL này, frontend dùng bearer token của phiên đăng nhập nhóm (`dnkn_auth_token`) để gọi API same-origin; không cần nhập token demo.

API tích hợp là `/api/leads`. Nhân viên đào tạo quản lý các Lead được phân công; quản lý đào tạo có thể xem và quản lý toàn bộ Lead. Đọc danh sách cần `leads.read`; tạo/cập nhật yêu cầu lần lượt `leads.create` và `leads.update`. Chỉ vai trò `manager` (Quản lý đào tạo) được xóa từng Lead hoặc xóa toàn bộ Lead; server kiểm tra vai trò này ở API, đồng thời giao diện chỉ hiển thị các nút xóa cho vai trò đó. API xóa toàn bộ là `DELETE /api/leads/all`.

## Phân công và giới hạn truy cập

- Tài khoản `training_staff` được dùng làm tư vấn viên. Quản trị viên (`admin`) và quản lý đào tạo (`manager`) được xem toàn bộ Lead, lọc theo tư vấn viên và phân công; nhân viên đào tạo chỉ xem/cập nhật Lead đã được giao cho chính mình.
- Lead do nhân viên đào tạo tạo qua API được tự giao cho người tạo. Lead cũ và Lead đến từ form đăng ký công khai vẫn giữ nguyên người phụ trách hiện tại; quản lý cần phân công chúng trước khi nhân viên nhìn thấy.
- API quản lý phân công: `GET /api/consultants`, `POST /api/leads/assign-bulk` với `{ "leadIds": [], "consultantId": "...", "note": "..." }`, `PUT` hoặc `PATCH /api/leads/:id/reassign`, và `GET /api/leads/:id/transfer-history`. Mỗi lần chuyển được ghi cùng bản ghi Lead trong file JSON hiện có.
- Bộ lọc quản lý dùng `GET /api/leads?consultantId=<userId>`; `consultantId=unassigned` lọc Lead chưa phân công. Backend luôn ép nhân viên đào tạo về phạm vi người dùng hiện tại, kể cả khi request tự gửi ID người khác. Các endpoint chi tiết, lịch sử, trạng thái, chăm sóc và nhắc gọi lại cũng kiểm tra phạm vi này.
- Chỉ tài khoản đang hoạt động có vai trò `training_staff` xuất hiện trong danh sách người nhận. Hãy cấp vai trò này cho từng tư vấn viên và kích hoạt tài khoản trước khi phân công.

Lead được lưu chung với biểu mẫu đăng ký tư vấn tại `features/consultation-registration/data/consultation-leads.json`. Có thể đổi vị trí bằng `CONSULTATION_LEADS_DATA_FILE`; trong production, cần trỏ biến này tới persistent storage. Kho JSON hiện tại phù hợp với kiến trúc nhóm nhưng không hỗ trợ giao dịch/khóa chống trùng giữa nhiều tiến trình.

Mở trực tiếp `frontend/index.html` vẫn chạy chế độ mẫu offline bằng localStorage của trình duyệt; chỉ URL `/lead-management` bật API và xác thực phiên nhóm.

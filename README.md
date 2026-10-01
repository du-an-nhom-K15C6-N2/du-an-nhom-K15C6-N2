# 🛡️ DNKN - Quản lý nhiều vai trò cho người dùng

Hệ thống quản lý **phân quyền (RBAC) nhiều vai trò** cho người dùng. Triển khai story **DNKN-17**: quản trị hệ thống có thể **gán và thu hồi vai trò**, hỗ trợ một người dùng giữ **nhiều vai trò cùng lúc** (ví dụ: vừa là Giảng viên vừa là Quản lý đào tạo).

Công nghệ: **Node.js + Express + SQLite** (thư viện `better-sqlite3`).

## ✨ Tính năng

- 🔐 **Đăng nhập JWT** — token chỉ chứa `userId`, vai trò đọc mới từ DB mỗi request
- 👥 **Quản lý người dùng** — thêm / sửa / xóa, gán nhiều vai trò
- 🛡️ **Quản lý vai trò** — tạo / sửa / xóa vai trò tùy chỉnh (vai trò hệ thống được bảo vệ)
- 🔀 **Gán / thu hồi vai trò** — một người dùng có nhiều vai trò, thay đổi có hiệu lực **ngay lập tức** không cần đăng nhập lại
- 🚫 **Ràng buộc an toàn** — không tự thu hồi vai trò quản trị của chính mình; không xóa chính mình / quản trị viên cuối cùng
- 🕓 **Nhật ký thao tác** — ghi lại mọi lần gán / thu hồi (ai, cho ai, vai trò nào, khi nào)
- 📊 **Bảng điều khiển** — thống kê người dùng, vai trò, phân bố vai trò, hoạt động gần đây
- 🔍 **Tìm kiếm & lọc** người dùng theo tên / vai trò

## 🚀 Cách chạy

Yêu cầu: **Node.js từ 18 trở lên** (đã test trên Node 18/20/22/24).

```bash
npm install
npm start        # chạy tại http://localhost:3001
npm test         # chạy bộ kiểm thử (32 test)
```

## 👤 Tài khoản mẫu

| Tên đăng nhập | Mật khẩu | Vai trò |
|---|---|---|
| `admin` | `admin123` | Quản trị hệ thống |
| `giangvien` | `123456` | Giảng viên |
| `quanly` | `123456` | Quản lý đào tạo |
| `linh` | `123456` | Giảng viên + Quản lý đào tạo (nhiều vai trò) |

## 🔑 Yêu cầu đã đáp ứng (mapping ticket)

| Ticket | Nội dung | Trạng thái |
|---|---|---|
| DNKN-68 | Mô hình nhiều-vai-trò (bảng `user_roles`, khóa ghép chống trùng lặp) | ✅ |
| DNKN-67 | JWT chỉ chứa userId, đọc vai trò mới mỗi request | ✅ |
| DNKN-70 | API thu hồi vai trò | ✅ |
| DNKN-71 | API gán vai trò (báo lỗi khi trùng / dữ liệu sai) | ✅ |
| DNKN-69 | Chặn tự thu hồi vai trò quản trị của chính mình | ✅ |
| DNKN-72 | Màn hình xem / gán / thu hồi vai trò | ✅ |
| DNKN-73 | Hiển thị trạng thái + phản hồi tức thì | ✅ |
| DNKN-74 | Kiểm thử nhiều vai trò, hiệu lực ngay, thao tác lặp lại | ✅ |
| DNKN-75 | Kiểm thử tự thu hồi vai trò quản trị bị từ chối | ✅ |

## 📁 Cấu trúc

```
role-management/
├── server.js            # Khởi động server (port 3001)
├── app.js               # Ứng dụng Express (tách để kiểm thử)
├── db.js                # SQLite: users / roles / user_roles / role_audit_log
├── middleware/auth.js   # JWT + đọc vai trò mỗi request + phân quyền
├── test/                # 32 kiểm thử (node:test + supertest)
├── public/              # Giao diện (dashboard, users, roles, audit, login)
└── dnkn.db              # File DB (tự tạo khi chạy lần đầu)
```

## 🧪 API chính

- `POST /api/auth/login` — đăng nhập, trả JWT
- `GET  /api/auth/me` — thông tin + vai trò hiện tại
- `GET/POST/PUT/DELETE /api/roles` — quản lý vai trò
- `GET/POST/PUT/DELETE /api/users` — quản lý người dùng
- `GET/POST /api/users/:id/roles` — xem / gán vai trò
- `DELETE /api/users/:id/roles/:roleId` — thu hồi vai trò
- `GET /api/audit` — nhật ký gán / thu hồi
- `GET /api/stats` — thống kê bảng điều khiển

## 📝 Ghi chú

- Dữ liệu mẫu tự nạp lần chạy đầu tiên (file `dnkn.db`).
- Muốn reset dữ liệu: dừng server, xóa file `dnkn.db` rồi `npm start`.

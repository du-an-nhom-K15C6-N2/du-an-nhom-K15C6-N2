# 🛡️ DNKN - Quản lý nhiều vai trò cho người dùng

Triển khai story **DNKN-17**: quản trị hệ thống có thể **gán và thu hồi vai trò** cho người dùng, hỗ trợ một người dùng giữ **nhiều vai trò cùng lúc** (ví dụ: vừa là Giảng viên vừa là Quản lý đào tạo).

Công nghệ: **Node.js + Express + SQLite** (module `node:sqlite` có sẵn, không cần driver native).

## ✨ Yêu cầu đã đáp ứng (mapping ticket)

| Ticket | Loại | Trạng thái |
|---|---|---|
| DNKN-68 | BE - mô hình nhiều-vai-trò (bảng `user_roles`, khóa ghép chống trùng lặp) | ✅ |
| DNKN-67 | BE - JWT chỉ chứa userId, **đọc vai trò mới mỗi request** | ✅ |
| DNKN-70 | BE - API thu hồi vai trò | ✅ |
| DNKN-71 | BE - API gán vai trò (báo lỗi khi vai trò đã tồn tại / dữ liệu sai) | ✅ |
| DNKN-69 | BE - chặn **tự thu hồi vai trò quản trị của chính mình** | ✅ |
| DNKN-72 | FE - màn hình xem / gán / thu hồi vai trò | ✅ |
| DNKN-73 | FE - hiển thị vai trò hiện tại + phản hồi tức thì | ✅ |
| DNKN-74 | QA - kiểm thử gán/thu hồi nhiều vai trò, hiệu lực ngay, thao tác lặp lại | ✅ |
| DNKN-75 | QA - kiểm thử tự thu hồi vai trò quản trị bị từ chối | ✅ |

## 🚀 Cách chạy

Yêu cầu: **Node.js từ 22.5 trở lên** (đã test trên Node 24).

```bash
npm install
npm start        # chạy tại http://localhost:3001
npm test         # chạy bộ kiểm thử (node --test)
```

## 👤 Tài khoản mẫu

| Tên đăng nhập | Mật khẩu | Vai trò |
|---|---|---|
| `admin` | `admin123` | Quản trị hệ thống |
| `giangvien` | `123456` | Giảng viên |
| `quanly` | `123456` | Quản lý đào tạo |
| `linh` | `123456` | Giảng viên + Quản lý đào tạo (nhiều vai trò) |

## 🔑 Điểm kiến trúc quan trọng

JWT **chỉ chứa `userId`**, không nhúng vai trò. Middleware `authenticate` đọc vai trò **mới từ DB ở mỗi request**, vì vậy khi admin gán/thu hồi vai trò, quyền của người dùng thay đổi **ngay ở request kế tiếp** mà không cần đăng nhập lại (đúng yêu cầu DNKN-67).

## 📁 Cấu trúc

```
role-management/
├── server.js            # Khởi động server (port 3001)
├── app.js               # Ứng dụng Express (tách để kiểm thử)
├── db.js                # SQLite: tạo bảng users/roles/user_roles + seed
├── middleware/auth.js   # JWT + đọc vai trò mỗi request + phân quyền
├── test/                # Bộ kiểm thử (node:test + supertest)
├── public/              # Giao diện (login + quản lý vai trò)
└── dnkn.db              # File DB (tự tạo khi chạy lần đầu)
```

## 🧪 Các API chính

- `POST /api/auth/login` — đăng nhập, trả JWT
- `GET  /api/auth/me` — thông tin + vai trò hiện tại
- `GET  /api/roles` — danh sách vai trò (admin)
- `GET  /api/users` — danh sách người dùng + vai trò (admin)
- `GET  /api/users/:id/roles` — vai trò của một người dùng (admin)
- `POST /api/users/:id/roles` — gán vai trò `{ role_ids: [..] }` (admin)
- `DELETE /api/users/:id/roles/:roleId` — thu hồi vai trò (admin)

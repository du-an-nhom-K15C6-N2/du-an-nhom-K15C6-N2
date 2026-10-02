# Hệ thống quản lý lớp học

## 1. Giới thiệu

Đây là dự án xây dựng hệ thống quản lý lớp học, hỗ trợ người dùng đăng nhập và sử dụng các chức năng phù hợp với vai trò được phân quyền.

Hệ thống hướng đến việc quản lý thông tin lớp học và dữ liệu học tập một cách thuận tiện, bảo mật và dễ sử dụng.

## 2. Mục tiêu

- Xây dựng hệ thống đăng nhập và xác thực người dùng.
- Phân quyền người dùng theo từng vai trò.
- Bảo vệ thông tin và dữ liệu của người dùng.
- Xây dựng giao diện đơn giản, dễ sử dụng.
- Tạo nền tảng để phát triển thêm các chức năng quản lý lớp học.

## 3. Chức năng chính

### Đăng nhập

Người dùng đăng nhập bằng:

- Email
- Mật khẩu

Các yêu cầu chính:

- Đăng nhập thành công sẽ chuyển đến trang tương ứng với vai trò.
- Email hoặc mật khẩu sai sẽ hiển thị thông báo lỗi.
- Không tiết lộ thông tin nhạy cảm trong thông báo lỗi.
- Tài khoản bị khóa tạm thời sau 5 lần đăng nhập sai liên tiếp.
- Phiên đăng nhập được quản lý để bảo vệ tài khoản.

### Phân quyền

Hệ thống hỗ trợ phân quyền người dùng theo vai trò.

Mỗi vai trò chỉ được phép truy cập các chức năng phù hợp với quyền được cấp.

## 4. Công nghệ sử dụng

### Frontend

- HTML
- CSS
- JavaScript

### Backend

- Node.js
- Express.js

### Database

- [Điền tên database bạn đang sử dụng]

### Công cụ

- Visual Studio Code
- Git
- GitHub

## 5. Cấu trúc dự án

```text
TTCS/
│
├── backend/
│   ├── server.js
│   └── ...
│
├── frontend/
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── ...
│
├── README.md
├── package.json
└── ...

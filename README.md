# Phần phụ trách: Đăng nhập và xác thực người dùng

## 1. Mô tả

Phụ trách xây dựng chức năng đăng nhập và xác thực người dùng cho hệ thống quản lý lớp học.

Người dùng đăng nhập bằng email và mật khẩu để truy cập các chức năng phù hợp với vai trò của mình.

## 2. Chức năng thực hiện

- Đăng nhập bằng email và mật khẩu.
- Kiểm tra thông tin tài khoản khi đăng nhập.
- Xác thực thông tin người dùng.
- Phân quyền truy cập theo vai trò.
- Chuyển hướng người dùng đến trang tương ứng sau khi đăng nhập thành công.
- Hiển thị thông báo khi email hoặc mật khẩu không đúng.
- Không tiết lộ thông tin nhạy cảm trong thông báo lỗi.
- Khóa tài khoản tạm thời sau 5 lần đăng nhập sai liên tiếp.
- Quản lý phiên đăng nhập của người dùng.

## 3. Yêu cầu xử lý

### Đăng nhập thành công
- Người dùng nhập đúng email và mật khẩu.
- Hệ thống xác thực tài khoản.
- Người dùng được chuyển đến trang tương ứng với vai trò.

### Đăng nhập thất bại
- Email hoặc mật khẩu không đúng.
- Hệ thống hiển thị thông báo lỗi.
- Không hiển thị thông tin chi tiết có thể làm lộ dữ liệu tài khoản.

### Khóa tài khoản
- Theo dõi số lần đăng nhập sai.
- Sau 5 lần đăng nhập sai liên tiếp, tài khoản bị khóa tạm thời.
- Trong thời gian khóa, người dùng không thể đăng nhập.

## 4. Công nghệ sử dụng

- HTML/CSS/JavaScript
- Node.js
- Express.js
- Database của dự án

## 5. Kết quả

Đã hoàn thành chức năng đăng nhập và xác thực người dùng, bao gồm kiểm tra thông tin đăng nhập, xử lý đăng nhập sai, phân quyền và cơ chế khóa tài khoản khi đăng nhập sai nhiều lần.

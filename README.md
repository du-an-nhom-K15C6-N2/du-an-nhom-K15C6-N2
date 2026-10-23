# DNKN87 – Chức năng thay đổi ảnh đại diện người dùng

## 1. Giới thiệu

**Mã nhiệm vụ:** DNKN87  
**Tên chức năng:** Thay đổi ảnh đại diện (Update User Avatar)  
**Dự án:** Hệ thống quản lý DNKN  
**Công nghệ:** JavaScript, Node.js, Express.js, HTML, CSS  
**Trạng thái:** Đã triển khai và kiểm thử các chức năng chính.

### Mô tả

Chức năng DNKN87 cho phép người dùng đã đăng nhập thay đổi ảnh đại diện tại trang Hồ sơ cá nhân.

Người dùng có thể chọn ảnh từ thiết bị, xem trước ảnh, điều chỉnh vùng cắt và cập nhật ảnh đại diện.

Hệ thống kiểm tra định dạng, dung lượng ảnh và yêu cầu xác thực trước khi cho phép cập nhật.

## 2. Các chức năng đã thực hiện

### 2.1. Chọn ảnh đại diện

- Cho phép người dùng chọn ảnh từ thiết bị.
- Hỗ trợ định dạng JPG/JPEG và PNG.
- Hiển thị ảnh được chọn trên giao diện.

### 2.2. Xem trước ảnh (Preview)

- Hiển thị ảnh trước khi cập nhật.
- Giúp người dùng kiểm tra ảnh đã chọn.
- Hỗ trợ thay đổi ảnh trước khi xác nhận.

### 2.3. Cắt và điều chỉnh ảnh (Cropper)

- Tích hợp chức năng cắt ảnh.
- Cho phép điều chỉnh vùng ảnh muốn sử dụng.
- Hỗ trợ phóng to, thu nhỏ và lựa chọn vùng cắt.

### 2.4. Kiểm tra dung lượng ảnh

- Giới hạn dung lượng ảnh tối đa 2MB.
- Kiểm tra dung lượng trước khi tải ảnh lên.
- Ngăn tải ảnh vượt quá dung lượng cho phép.

### 2.5. Kiểm tra định dạng ảnh

- Chấp nhận ảnh JPG/JPEG và PNG.
- Không cho phép sử dụng định dạng không được hỗ trợ.

### 2.6. Xác thực người dùng

- Chỉ người dùng đã đăng nhập mới được phép cập nhật ảnh đại diện.
- Sử dụng JWT Token để xác thực yêu cầu.
- API từ chối yêu cầu không có Token hợp lệ.
- Đã kiểm thử trường hợp chưa đăng nhập và nhận phản hồi HTTP 401 Unauthorized.

## 3. Quy trình sử dụng

**Bước 1:** Đăng nhập vào hệ thống.

**Bước 2:** Truy cập mục Hồ sơ cá nhân.

**Bước 3:** Chọn chức năng thay đổi ảnh đại diện.

**Bước 4:** Nhấn nút chọn ảnh và tải ảnh từ thiết bị.

**Bước 5:** Xem trước và điều chỉnh vùng cắt ảnh.

**Bước 6:** Xác nhận cập nhật ảnh đại diện.

## 4. Công nghệ sử dụng

| Công nghệ | Mục đích |
|---|---|
| HTML | Xây dựng cấu trúc giao diện |
| CSS | Thiết kế giao diện thay đổi ảnh |
| JavaScript | Xử lý chọn ảnh, preview và cropper |
| Node.js | Môi trường chạy backend |
| Express.js | Xây dựng API |
| JWT | Xác thực người dùng |
| Thunder Client | Kiểm thử API |
| Git/GitHub | Quản lý phiên bản mã nguồn |

## 5. API liên quan

### Cập nhật ảnh đại diện

**Endpoint:**

`POST /api/profile/avatar`

**Xác thực:**

Yêu cầu JWT Token hợp lệ.

**Các trường hợp kiểm thử:**

- Người dùng chưa đăng nhập: HTTP 401 Unauthorized.
- Ảnh có dung lượng lớn hơn 2MB: Bị chặn.
- Ảnh hợp lệ: Có thể chọn, xem trước và xử lý trên giao diện.

## 6. Các file liên quan

Các vị trí mã nguồn chính được sử dụng trong quá trình triển khai:

- `src/components/RoleDashboard.js` – Xử lý giao diện hồ sơ cá nhân và thay đổi ảnh đại diện.
- `backend/server.js` – Xử lý API phía backend.
- Các đoạn CSS liên quan đến giao diện thay đổi ảnh đại diện.

**Lưu ý:** Cần đối chiếu với cấu trúc thư mục thực tế của nhánh DNKN87 khi tích hợp vào dự án chính.

## 7. Kiểm thử chức năng

| STT | Nội dung kiểm thử | Kết quả ghi nhận |
|---|---|---|
| 1 | Chọn ảnh từ thiết bị | Đạt |
| 2 | Hiển thị ảnh xem trước | Đạt |
| 3 | Hiển thị công cụ cắt ảnh | Đã triển khai |
| 4 | Chặn ảnh vượt quá 2MB | Đạt |
| 5 | Gọi API khi chưa đăng nhập | HTTP 401 |
| 6 | Kiểm tra JPG/PNG | Cần xác nhận lại bằng test riêng |
| 7 | Cập nhật và lưu ảnh vào hệ thống | Cần kiểm thử tích hợp |

## 8. Quản lý mã nguồn Git

**Nhánh phát triển:**

`feature/DNKN-87-new`

Chức năng DNKN87 được phát triển và tách riêng nhằm thuận tiện cho việc quản lý, kiểm thử và tích hợp vào dự án nhóm.

## 9. Kết luận

DNKN87 đã triển khai các thành phần chính của chức năng thay đổi ảnh đại diện, bao gồm:

- Chọn ảnh từ thiết bị.
- Xem trước ảnh.
- Cắt và điều chỉnh ảnh.
- Giới hạn dung lượng tối đa 2MB.
- Kiểm tra xác thực người dùng bằng JWT.
- Từ chối yêu cầu cập nhật không có xác thực.

Trước khi tích hợp chính thức vào hệ thống chung, cần kiểm tra lại quá trình lưu ảnh, cập nhật dữ liệu người dùng và khả năng hoạt động đồng bộ với các chức năng khác.

---

**Task:** DNKN87  
**Module:** User Profile – Avatar Management  
**Project:** DNKN

# Phân công giảng viên và trợ giảng theo từng môn (DNKN-179)

Feature **DNKN-179** cho phép **Quản lý đào tạo** (Training Manager) và **Quản trị viên** (Admin) phân công giảng viên chính chịu trách nhiệm chuyên môn và trợ giảng hỗ trợ cho từng môn học trong mỗi lớp học.

---

## 1. User Story

> **Là Quản lý đào tạo**, tôi muốn phân công giảng viên và trợ giảng cho lớp theo từng môn, để mỗi môn đều có người chịu trách nhiệm chuyên môn rõ ràng.

---

## 2. Các yêu cầu chức năng & Nghiệp vụ đã hoàn thiện

1. **Bổ sung truy vấn danh sách tài khoản theo vai trò cho màn hình phân công**:
   - Bổ sung phương thức `UserModel.findActiveTeachers()`, `UserModel.findActiveAssistants()`, `UserModel.findByRole(role, { status })`.
   - Endpoint: `GET /api/users/by-role/:role?status=active` (cho phép lọc tài khoản theo vai trò và trạng thái).
   - Endpoint: `GET /api/assignments/options` (cung cấp đồng thời danh sách lớp đang hoạt động, danh mục môn học, danh sách giảng viên đang hoạt động và danh sách trợ giảng đang hoạt động).
   - Kiểm tra chặt chẽ quyền `users.read` và `classes.read`.

2. **Kiểm tra ràng buộc nghiệp vụ khi phân công giảng viên và trợ giảng**:
   - **Giảng viên chính bắt buộc**: Mỗi môn học trong lớp bắt buộc phải có một giảng viên chính chịu trách nhiệm chuyên môn (`PRIMARY_TEACHER_REQUIRED`).
   - **Xác thực vai trò giảng viên**: Tài khoản phân công làm giảng viên chính phải có vai trò `teacher` (`INVALID_TEACHER_ROLE`).
   - **Trạng thái giảng viên**: Không được phân công giảng viên đang bị khóa (`TEACHER_LOCKED`) hoặc đang chờ kích hoạt (`TEACHER_PENDING`).
   - **Xác thực trợ giảng**: Trợ giảng (nếu có) phải có vai trò `assistant` (`INVALID_ASSISTANT_ROLE`) và trạng thái hoạt động (`ASSISTANT_LOCKED` nếu bị khóa).
   - **Ngăn chặn xung đột Giảng viên - Trợ giảng**: Giảng viên chính không thể đồng thời là trợ giảng của cùng một môn học trong lớp (`TEACHER_ASSISTANT_CONFLICT`).
   - **Ràng buộc lớp và môn học**: Lớp học phải tồn tại và đang hoạt động (`CLASS_NOT_FOUND`, `CLASS_INACTIVE`); Môn học phải có trong danh mục (`COURSE_NOT_FOUND`).
   - **Ràng buộc duy nhất**: Mỗi môn học trong lớp chỉ có một bản ghi phân công có hiệu lực; ngăn chặn tạo trùng lặp với mã lỗi `409 DUPLICATE_ASSIGNMENT`.
   - **Phân quyền RBAC**: Chỉ người dùng có quyền `classes.manage` (Quản lý đào tạo `manager` và Quản trị viên `admin`) mới được tạo, chỉnh sửa hoặc hủy phân công. Các vai trò khác bị từ chối với HTTP 403 `ACCESS_FORBIDDEN`.
   - **Audit Trail & Lưu vết**: Mọi thao tác tạo mới, bàn giao đổi giảng viên, cập nhật hoặc hủy đều được lưu vết chi tiết với người thực hiện, thời gian và lý do.
   - **Lưu trữ nguyên tử**: Lưu trữ bền vững tại `backend/data/teaching-assignments.json` sử dụng cơ chế ghi qua file tạm và rename nguyên tử, chống hỏng dữ liệu khi ghi đồng thời.

3. **Xây dựng API phân công giảng viên chính và trợ giảng theo từng môn**:

| Phương thức | Đường dẫn | Mục đích | Quyền yêu cầu |
| --- | --- | --- | --- |
| `GET` | `/api/users/by-role/:role?status=active` | Truy vấn danh sách tài khoản theo vai trò | `users.read` |
| `GET` | `/api/assignments/options` | Lấy dữ liệu nguồn cho form phân công (lớp, môn, GV, TA) | `classes.read` |
| `GET` | `/api/assignments` | Danh sách toàn bộ phân công (lọc theo classId, courseId, teacherId) | `classes.read` |
| `GET` | `/api/assignments/classes/:classId` | Bảng ma trận các môn đã phân công và chưa phân công của lớp | `classes.read` |
| `GET` | `/api/assignments/:id` | Xem chi tiết một bản ghi phân công | `classes.read` |
| `POST` | `/api/assignments` | Phân công GV chính và trợ giảng cho môn trong lớp | `classes.manage` |
| `PUT` | `/api/assignments/:id` | Cập nhật phân công / Bàn giao giảng viên | `classes.manage` |
| `DELETE` | `/api/assignments/:id` | Hủy phân công môn học trong lớp | `classes.manage` |
| `GET` | `/api/assignments/history` | Xem lịch sử phân công và bàn giao | `classes.read` |

4. **Xây dựng giao diện phân công giảng viên và trợ giảng theo từng môn**:
   - Menu **Phân công giảng dạy** xuất hiện trên thanh điều hướng cho vai trò `MANAGER` và `ADMIN`.
   - Bảng ma trận trực quan hiển thị từng môn trong lớp:
     + Mã môn, tên môn, số buổi, trọng số.
     + Thông tin giảng viên chính (Avatar, họ tên, email, trạng thái).
     + Thông tin trợ giảng (Họ tên, email hoặc "Chưa có trợ giảng").
     + Huy hiệu trạng thái: `Đã phân công đầy đủ`, `Chưa có trợ giảng`, `Chưa phân công`.
   - Modal phân công và bàn giao chuyên nghiệp:
     + Dropdown chọn giảng viên chính (chỉ hiển thị giảng viên đang hoạt động).
     + Danh sách trợ giảng với tính năng tự động vô hiệu hóa giảng viên chính đang chọn để tránh xung đột chuyên môn trực tiếp trên UI.
     + Form nhập học kỳ, niên khóa, ghi chú/lý do bàn giao.
     + Client-side validation realtime và thông báo lỗi/thành công rõ ràng.
   - Tab **Lịch sử phân công & bàn giao**: Timeline trực quan lưu vết toàn bộ hoạt động phân công.

5. **Kiểm thử chức năng phân công giảng viên và trợ giảng theo từng môn**:
   - File test: `tests/teachingAssignment.test.js`
   - Đạt 15/15 test case bao phủ toàn bộ các ràng buộc nghiệp vụ, phân quyền RBAC và lưu trữ nguyên tử.

---

## 3. Hướng dẫn chạy kiểm thử và ứng dụng

### Chạy kiểm thử:
```powershell
npm test -- .\tests\teachingAssignment.test.js
```
Hoặc chạy toàn bộ kiểm thử của dự án:
```powershell
npm test
```

### Chạy ứng dụng:
```powershell
npm start
```
Hoặc chạy server và client dev riêng biệt:
- Terminal 1: `npm run server` (chạy API tại http://localhost:3000)
- Terminal 2: `npm run dev` (chạy giao diện Vite tại http://127.0.0.1:5173)

### Tài khoản kiểm thử:
- **Quản lý đào tạo**: `hoang@edu.vn` (Mật khẩu: `admin123456` hoặc tài khoản bootstrap)
- **Quản trị viên**: `admin@edu.vn`

# BÁO CÁO GIỮ KIỆN & GIẢI PHÁP KỸ THUẬT DNKN-242

## ĐỀ BÀI:
> **Là Quản lý đào tạo, tôi muốn xem thời khoá biểu dạng lịch theo tuần và theo tháng, để phát hiện ngay khoảng trống và điểm chồng chéo khi xếp lịch.**

---

## CÁC GIỮ KIỆN VÀ TÍNH NĂNG ĐÃ TRIỂN KHAI VÀO GÓI DNKN-242:

### 1. Xây dựng API lấy dữ liệu thời khoá biểu phục vụ chế độ tuần và tháng:
- **Tập tin:**
  - `backend/models/timetableModel.js`: Xử lý thuật toán tính khoảng ngày (Thứ 2 đến CN cho Tuần, ngày 1 đến cuối tháng cho Tháng), phát hiện điểm chồng chéo (trùng phòng, trùng giảng viên) và khoảng trống các ca học.
  - `backend/controllers/timetableController.js`: Controller cung cấp các endpoint REST API:
    + `GET /api/timetable?view=week|month&date=...&classId=...&teacherId=...&room=...`
    + `GET /api/timetable/sessions/:id` (Chi tiết buổi học)
    + `POST /api/timetable/sessions` (Xếp lịch buổi học mới)
  - `backend/routes/timetableRoutes.js`: Định tuyến và kiểm tra quyền RBAC (`classes.read`).
  - `backend/data/timetable.json`: Bộ dữ liệu lịch học mẫu có sẵn các buổi học, các slot trống và các điểm chồng chéo để phát hiện.

### 2. Xây dựng giao diện thời khoá biểu dạng lịch theo tuần và theo tháng:
- **Tập tin:** `src/components/TimetablePanel.js` & `src/components/TimetablePanel.css`
- **Chế độ Tuần:** Bảng ma trận 7 ngày trong tuần x 4 ca học chuẩn, hiển thị thẻ buổi học trực quan với mã lớp, tên môn, phòng, giảng viên. Ô bị trùng lịch hiển thị viền đỏ nổi bật và nhãn cảnh báo. Ô trống hiển thị slot nét đứt `+ Trống`.
- **Chế độ Tháng:** Lưới 7 cột đầy đủ các ngày trong tháng, làm nổi bật ngày hôm nay và cảnh báo màu đỏ cho ngày có lịch bị trùng.

### 3. Cài đặt chuyển đổi chế độ xem giữa tuần và tháng:
- Nút Segmented Switch `[ Lịch theo Tuần ]` và `[ Lịch theo Tháng ]` chuyển đổi tức thì không cần tải lại trang.
- Bộ điều hướng thời gian đồng bộ: `◀ Lùi lại`, `Hôm nay`, `Tiếp theo ▶` tự động nhận biết đang ở tuần hay tháng để nhảy thời gian tương ứng.

### 4. Bổ sung bộ lọc thời khoá biểu theo lớp, giảng viên và phòng:
- Thanh bộ lọc (Filter Bar) với 3 dropdown:
  + Lọc theo Lớp học (`classId`)
  + Lọc theo Giảng viên (`teacherId`)
  + Lọc theo Phòng học (`room`)
- Nút **"↺ Đặt lại bộ lọc"** khôi phục hiển thị toàn bộ lịch của trung tâm.

### 5. Xây dựng chi tiết buổi học khi bấm vào một ô lịch:
- Khi người dùng bấm vào bất kỳ buổi học nào trên lịch tuần hoặc tháng, một Modal popup chi tiết sẽ hiển thị:
  + Tên lớp, mã lớp, tên môn học, sĩ số học viên.
  + Giảng viên, phòng học, khung giờ (07:30–09:30), ca học, ngày học.
  + Hộp cảnh báo xung đột chi tiết (nếu có): Nêu rõ buổi học này đang bị trùng phòng hoặc trùng giảng viên với lớp nào, ca nào và hướng xử lý.

### 6. Tối ưu hiển thị thời khoá biểu trên màn hình điện thoại:
- Thiết kế Responsive trong `src/components/TimetablePanel.css`:
  + Media queries `@media (max-width: 768px)`.
  + Thanh công cụ và bộ lọc co giãn theo cột dọc dễ thao tác trên màn hình nhỏ.
  + Lưới lịch tuần hỗ trợ cuộn ngang mượt mà với thanh header cố định.
  + Modal chi tiết tự động chuyển thành Bottom Sheet chuẩn di động.

### 7. Kiểm thử chức năng xem thời khoá biểu theo tuần, tháng và bộ lọc:
- **Tập tin:** `tests/timetable.test.js`
- Gồm **9 test cases** tự động:
  1. Lấy dữ liệu theo chế độ Tuần
  2. Lấy dữ liệu theo chế độ Tháng
  3. Bộ lọc theo lớp học
  4. Bộ lọc theo giảng viên
  5. Bộ lọc theo phòng học
  6. Phát hiện chính xác điểm chồng chéo phòng và giảng viên
  7. Phát hiện các khoảng trống (gaps)
  8. Lấy chi tiết buổi học qua ID
  9. Kiểm tra Controller API trả về đúng mã HTTP 200, 404
- **Kết quả chạy:** 9/9 tests đều PASS 100%.

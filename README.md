# 📅 DNKN-242: QUẢN LÝ THỜI KHOÁ BIỂU THEO TUẦN VÀ THEO THÁNG DÀNH CHO QUẢN LÝ ĐÀO TẠO

> **User Story:**
> *"Là Quản lý đào tạo, tôi muốn xem thời khoá biểu dạng lịch theo tuần và theo tháng, để phát hiện ngay khoảng trống và điểm chồng chéo khi xếp lịch."*

---

## 📌 BẢNG TỔNG HỢP 7 TIÊU CHÍ NGHIỆP VỤ & KẾT QUẢ ĐẠT ĐƯỢC

| STT | Giữ kiện / Tiêu chí nghiệp vụ | File triển khai chính | Kết quả đạt được |
| :---: | :--- | :--- | :--- |
| **1** | **Xây dựng API lấy dữ liệu thời khoá biểu phục vụ chế độ tuần và tháng** | `backend/models/timetableModel.js`<br>`backend/controllers/timetableController.js`<br>`backend/routes/timetableRoutes.js` | • Cung cấp endpoint `GET /api/timetable` (hỗ trợ `view=week` và `view=month`).<br>• Tích hợp thuật toán phát hiện **Điểm chồng chéo (Conflicts)**: tự động kiểm tra trùng phòng học và trùng giảng viên cùng khung giờ.<br>• Thuật toán nhận diện **Khoảng trống (Gaps)**: liệt kê các ca học chuẩn còn trống theo từng phòng để Quản lý đào tạo xếp thêm lịch. |
| **2** | **Xây dựng giao diện thời khoá biểu dạng lịch theo tuần và theo tháng** | `src/components/TimetablePanel.js`<br>`src/components/TimetablePanel.css` | • **Lịch tuần (Week View)**: Bảng ma trận 7 ngày (Thứ 2 đến Chủ nhật) x các ca học chuẩn (Ca 1 đến Ca 4). Thẻ buổi học hiển thị lớp, môn, phòng, giảng viên. Ô bị trùng lịch hiển thị viền đỏ và nhãn `⚠️ Trùng lịch!`.<br>• **Lịch tháng (Month View)**: Lưới 7 cột toàn bộ ngày trong tháng, highlight ngày hiện tại và gắn cờ cảnh báo đỏ cho các ngày có xung đột. |
| **3** | **Cài đặt chuyển đổi chế độ xem giữa tuần và tháng** | `src/components/TimetablePanel.js` | • Nút chuyển đổi Segmented Switch `[ Lịch theo Tuần ]` và `[ Lịch theo Tháng ]` mượt mà không tải lại trang.<br>• Bộ điều hướng thời gian đồng bộ: nút `◀ Lùi lại`, `Hôm nay`, `Tiếp theo ▶` tự động điều chỉnh nhảy +/- 7 ngày hoặc +/- 1 tháng tương ứng. |
| **4** | **Bổ sung bộ lọc thời khoá biểu theo lớp, giảng viên và phòng** | `src/components/TimetablePanel.js`<br>`backend/models/timetableModel.js` | • Dropdown lọc theo **Lớp học** (`classId`).<br>• Dropdown lọc theo **Giảng viên** (`teacherId`).<br>• Dropdown lọc theo **Phòng học** (`room`).<br>• Nút **"↺ Đặt lại bộ lọc"** khôi phục hiển thị toàn bộ lịch của trung tâm. |
| **5** | **Xây dựng chi tiết buổi học khi bấm vào một ô lịch** | `src/components/TimetablePanel.js`<br>`src/core/timetableService.js` | • Bấm vào bất kỳ card buổi học nào trên lịch tuần/tháng sẽ mở **Modal chi tiết**:<br>  - Tên môn, mã môn, mã lớp, sĩ số học viên.<br>  - Giảng viên phụ trách, khung giờ (07:30–09:30), ca học, ngày học.<br>  - Phòng học và loại phòng.<br>  - Hộp cảnh báo xung đột (nếu có): nêu rõ lý do bị trùng với lớp nào, ca nào và hướng xử lý. |
| **6** | **Tối ưu hiển thị thời khoá biểu trên màn hình điện thoại** | `src/components/TimetablePanel.css` | • Media Queries `@media (max-width: 768px)`:<br>  - Thanh công cụ và bộ lọc co giãn theo cột dọc vừa vặn màn hình.<br>  - Lưới lịch tuần hỗ trợ cuộn ngang mượt mà với thanh header cố định.<br>  - Modal chi tiết tự động chuyển thành giao diện **Bottom Sheet** chuẩn di động. |
| **7** | **Kiểm thử chức năng xem thời khoá biểu theo tuần, tháng và bộ lọc** | `tests/timetable.test.js` | • Bộ kiểm thử tự động toàn diện gồm **9 test cases** viết bằng `node:test` chuẩn Node.js.<br>• **Kết quả chạy:** 9/9 tests đều **PASS 100%**. |

---

## 📂 CẤU TRÚC GÓI TÍNH NĂNG (FEATURE PACKAGE)
```
c:\Users\ASUS\Downloads\DNKN-242\
├── backend\
│   ├── controllers\
│   │   └── timetableController.js     # API Controller xử lý request & response
│   ├── data\
│   │   └── timetable.json             # Dữ liệu lịch học mẫu có khoảng trống và điểm chồng chéo
│   ├── models\
│   │   └── timetableModel.js          # Model xử lý tính toán lịch, xung đột và khoảng trống
│   └── routes\
│       └── timetableRoutes.js         # Khai báo các router RESTful với RBAC middleware
├── src\
│   ├── components\
│   │   ├── TimetablePanel.js          # Component giao diện lịch tuần/tháng, bộ lọc, modal
│   │   └── TimetablePanel.css         # CSS responsive và hiệu ứng cảnh báo xung đột
│   └── core\
│       └── timetableService.js        # Service frontend gọi API backend có xác thực token
├── tests\
│   └── timetable.test.js              # Bộ kiểm thử tự động 9 test cases
└── README.md                          # Tài liệu kỹ thuật chi tiết của module DNKN-242
```

---

## 🔧 HƯỚNG DẪN TÍCH HỢP VÀO DỰ ÁN CHÍNH

### Bước 1: Đăng ký Router trong Backend
Trong file `backend/routes/index.js`, thêm:
```javascript
const timetableRoutes = require('./timetableRoutes');
// Mount endpoint
router.use('/timetable', timetableRoutes);
router.use('/schedules', timetableRoutes);
```

### Bước 2: Bổ sung Menu điều hướng cho Quản lý đào tạo
Trong file `src/components/RoleNavigation.js`, bổ sung vào mảng `ALL_NAV_ITEMS`:
```javascript
{ id: 'timetable', label: 'Thời khoá biểu', icon: '📅', roles: ['ADMIN', 'MANAGER', 'TRAINING_STAFF', 'TEACHER'] }
```

### Bước 3: Đăng ký Màn hình trong Bảng điều khiển
Trong file `src/components/RoleDashboard.js`:
1. Import component:
   ```javascript
   import { renderTimetablePanel } from './TimetablePanel.js';
   ```
2. Thêm thẻ HTML mount:
   ```html
   <section class="dashboard-content-view timetable-view" data-dashboard-view="timetable" hidden aria-labelledby="timetable-title">
     <div id="timetable-mount"></div>
   </section>
   ```
3. Xử lý sự kiện click menu:
   ```javascript
   if (navId === 'timetable') {
     const timetableMount = container.querySelector('#timetable-mount');
     if (timetableMount && !timetableMount.dataset.initialized) {
       renderTimetablePanel(timetableMount);
       timetableMount.dataset.initialized = 'true';
     }
   }
   ```

---

## 🧪 KẾT QUẢ CHẠY KIỂM THỬ TỰ ĐỘNG
Chạy lệnh tại thư mục dự án:
```bash
node --test tests/timetable.test.js
```
Kết quả kiểm thử:
```
▶ Kiểm thử Thời khoá biểu Quản lý đào tạo (Timetable Module)
  ✔ 1. Lấy dữ liệu thời khoá biểu theo chế độ Tuần (Week view)
  ✔ 2. Lấy dữ liệu thời khoá biểu theo chế độ Tháng (Month view)
  ✔ 3. Bộ lọc thời khoá biểu theo lớp học (classId)
  ✔ 4. Bộ lọc thời khoá biểu theo giảng viên (teacherId)
  ✔ 5. Bộ lọc thời khoá biểu theo phòng học (room)
  ✔ 6. Phát hiện chính xác điểm chồng chéo phòng học và giảng viên
  ✔ 7. Phát hiện các khoảng trống (Gaps) để Quản lý đào tạo xếp thêm lịch
  ✔ 8. Xem chi tiết buổi học khi bấm vào ô lịch qua ID
  ✔ 9. Controller API xử lý getTimetable và getSessionDetail trả về đúng mã HTTP
✔ 9 tests passed (100%)
```

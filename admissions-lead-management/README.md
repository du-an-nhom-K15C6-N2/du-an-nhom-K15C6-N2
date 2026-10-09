# TÍNH NĂNG DNKN-95: TÌM KIẾM VÀ LỌC LEAD ĐA ĐIỀU KIỆN (CRM TUYỂN SINH)

## 📌 User Story
> **Là Tư vấn tuyển sinh**, tôi muốn tìm kiếm và lọc lead theo nhiều điều kiện, để tìm lại được cuộc trao đổi từ tháng trước khi khách gọi lại.

### 4 Tiêu chí nghiệm thu (Acceptance Criteria):
1. **Chuẩn hoá tham số truy vấn và tối ưu điều kiện lọc lead theo thời gian** (Index `LastInteractionDate`, `PhoneNumber`, Composite Index).
2. **Xây dựng giao diện tìm kiếm và bộ lọc lead đa điều kiện** (Có nút chọn nhanh `[⚡ Cuộc gọi tháng trước]`, bảng trích dẫn cuộc trao đổi quá khứ, modal timeline).
3. **Kiểm thử chức năng tìm kiếm và lọc lead theo nhiều điều kiện** (Bộ Unit Tests với xUnit & InMemoryDb).
4. **Xây dựng API tìm kiếm và lọc lead theo trạng thái, nguồn, người phụ trách và khoảng thời gian** (`GET /api/leads/search`).

---

## 📁 Cấu trúc thư mục DNKN95

| Tên File / Thư mục | Mô tả | Cách sử dụng |
|---|---|---|
| **`index.html`** & **`app.js`** | **Giao diện Web trực quan** (nhắc đến trong ảnh) | Nhấp đúp mở bằng Chrome/Edge để trải nghiệm ngay bộ lọc và tìm kiếm cuộc trao đổi tháng trước. |
| **`SingleFile_AdmissionsLeadSystem.cs`** | **Toàn bộ mã nguồn gom trong 1 file duy nhất** | Chứa đầy đủ Models, DbContext, Services, API Controller, UI và Unit Test. Dán vào `Program.cs` là chạy. |
| **`AdmissionsLeadManagement.sln`** | **File Solution Visual Studio** | Nhấp đúp để mở trọn bộ dự án Web API và Unit Tests trong Visual Studio. |
| **`src/`** | Thư mục mã nguồn backend phân tầng Web API | Cấu trúc chuyên nghiệp ASP.NET Core .NET 8. |
| **`tests/`** | Thư mục chứa các bài kiểm thử Unit Test | xUnit kiểm thử bộ lọc đa điều kiện. |

---

## 🚀 Hướng dẫn mở nhanh

1. **Mở giao diện Web**: Nhấp đúp trực tiếp vào file `index.html`.
2. **Mở bằng Visual Studio**: Nhấp đúp vào file `AdmissionsLeadManagement.sln`.

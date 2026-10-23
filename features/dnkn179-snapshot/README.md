# DNKN-179 — Phân công giảng viên và trợ giảng theo từng môn

> **Tính năng:** Là Quản lý đào tạo, tôi muốn phân công giảng viên và trợ giảng cho lớp theo từng môn,
> để mỗi môn đều có người chịu trách nhiệm chuyên môn rõ ràng.

---

## Cấu trúc thư mục

```
DNKN_179/
├── backend/
│   ├── config/
│   │   └── app.config.js                        ← (Đã sửa) Thêm 3 hằng đường dẫn data file
│   ├── controllers/
│   │   ├── teachingAssignmentController.js       ← (Mới) REST API controller phân công
│   │   └── userController.js                    ← (Đã sửa) Thêm getUsersByRole()
│   ├── data/
│   │   ├── courses.json                          ← (Đã sửa) Bổ sung catalog môn học
│   │   └── teaching-assignments.json             ← (Mới) Data store phân công (JSON)
│   ├── models/
│   │   ├── teachingAssignmentModel.js            ← (Mới) Model CRUD + atomic write + history
│   │   └── userModel.js                          ← (Đã sửa) Thêm findActiveTeachers/Assistants/ByRole
│   ├── routes/
│   │   ├── index.js                              ← (Đã sửa) Mount route /assignments
│   │   ├── teachingAssignmentRoutes.js           ← (Mới) Express router với RBAC guard
│   │   └── userRoutes.js                         ← (Đã sửa) Thêm GET /by-role/:role
│   └── services/
│       └── teachingAssignmentValidationService.js ← (Mới) Kiểm tra ràng buộc nghiệp vụ
├── features/
│   └── class-teaching-assignment/
│       └── README.md                             ← (Mới) Tài liệu đặc tả tính năng
├── src/
│   ├── components/
│   │   ├── RoleDashboard.js                     ← (Đã sửa) Mount TeachingAssignmentPanel
│   │   ├── RoleNavigation.js                    ← (Đã sửa) Thêm mục "Phân công giảng dạy"
│   │   ├── TeachingAssignmentPanel.js           ← (Mới) UI Panel đầy đủ
│   │   └── TeachingAssignmentPanel.css          ← (Mới) Style glassmorphism
│   └── core/
│       └── teachingAssignmentService.js         ← (Mới) Frontend API client service
├── tests/
│   └── teachingAssignment.test.js               ← (Mới) 15 test cases (Jest)
└── rbac.test.js                                 ← (Đã sửa) Cập nhật version + permission assertions
```

---

## Danh sách sub-tasks DNKN-179

| # | Sub-task | File liên quan |
|---|----------|----------------|
| 1 | **Bổ sung truy vấn danh sách tài khoản theo vai trò** | `backend/models/userModel.js`, `backend/controllers/userController.js`, `backend/routes/userRoutes.js` |
| 2 | **Xây dựng giao diện phân công giảng viên và trợ giảng theo từng môn** | `src/components/TeachingAssignmentPanel.js`, `src/components/TeachingAssignmentPanel.css`, `src/components/RoleDashboard.js`, `src/components/RoleNavigation.js` |
| 3 | **Kiểm tra ràng buộc nghiệp vụ khi phân công** | `backend/services/teachingAssignmentValidationService.js` |
| 4 | **Xây dựng API phân công giảng viên chính và trợ giảng theo từng môn trong lớp** | `backend/controllers/teachingAssignmentController.js`, `backend/routes/teachingAssignmentRoutes.js`, `backend/routes/index.js`, `backend/models/teachingAssignmentModel.js` |
| 5 | **Kiểm thử chức năng phân công giảng viên và trợ giảng** | `tests/teachingAssignment.test.js`, `rbac.test.js` |

---

## API Endpoints

| Method | Path | Mô tả | Phân quyền |
|--------|------|--------|------------|
| `GET` | `/api/assignments/options` | Lấy danh sách lớp, môn, GV, TG để populate form | ADMIN, MANAGER |
| `GET` | `/api/assignments` | Danh sách tất cả phân công | ADMIN, MANAGER |
| `GET` | `/api/assignments/class/:classId` | Phân công theo lớp | ADMIN, MANAGER |
| `GET` | `/api/assignments/:id` | Chi tiết phân công | ADMIN, MANAGER |
| `POST` | `/api/assignments` | Tạo mới phân công | ADMIN, MANAGER |
| `PUT` | `/api/assignments/:id` | Cập nhật phân công | ADMIN, MANAGER |
| `DELETE` | `/api/assignments/:id` | Xóa phân công | ADMIN, MANAGER |
| `GET` | `/api/assignments/:id/history` | Lịch sử thay đổi phân công | ADMIN, MANAGER |
| `GET` | `/api/users/by-role/:role` | Danh sách user theo role (teacher/assistant) | ADMIN, MANAGER |

---

## Ràng buộc nghiệp vụ (Business Rules)

1. **Giảng viên chính là bắt buộc** — không được để trống `teacherId`.
2. **Kiểm tra role** — `teacherId` phải có role `teacher`, `assistantId` (nếu có) phải có role `assistant`.
3. **Lớp phải tồn tại** — `classId` phải có trong hệ thống.
4. **Môn học phải hợp lệ** — `courseCode` phải có trong danh mục môn học.
5. **Không phân công trùng** — mỗi cặp `(classId, courseCode)` chỉ có 1 bản ghi active.
6. **Lớp bị khóa/đang chờ duyệt** — không được phân công khi trạng thái lớp là `locked` hoặc `pending`.
7. **Không tự phân công làm trợ giảng** — `assistantId` ≠ `teacherId`.

---

## Hướng dẫn tích hợp vào dự án gốc

> **Lưu ý:** Thư mục này chứa các file DNKN-179. Để tích hợp vào dự án gốc `du-an-nhom-K15C6-N2-feature-DNKN16`:

### Bước 1 — Copy các file MỚI
Copy toàn bộ các file có nhãn **(Mới)** vào đúng vị trí trong dự án gốc:
- `backend/models/teachingAssignmentModel.js`
- `backend/services/teachingAssignmentValidationService.js`
- `backend/controllers/teachingAssignmentController.js`
- `backend/routes/teachingAssignmentRoutes.js`
- `backend/data/teaching-assignments.json`
- `src/core/teachingAssignmentService.js`
- `src/components/TeachingAssignmentPanel.js`
- `src/components/TeachingAssignmentPanel.css`
- `tests/teachingAssignment.test.js`
- `features/class-teaching-assignment/README.md`

### Bước 2 — Merge các file ĐÃ SỬA
Xem nội dung các file có nhãn **(Đã sửa)** trong thư mục này và merge thủ công vào file tương ứng trong dự án gốc.

### Bước 3 — Chạy kiểm thử
```bash
npm test -- tests/teachingAssignment.test.js
npm test -- rbac.test.js
```

---

## Chạy kiểm thử độc lập

```bash
# Từ dự án DNKN-179 (nơi đã cài node_modules)
npm test -- tests/teachingAssignment.test.js --verbose
```

Kết quả mong đợi: **15/15 tests pass**

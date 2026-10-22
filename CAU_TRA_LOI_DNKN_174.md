# BÁO CÁO CHI TIẾT CÁC CÂU TRẢ LỜI VÀ MÃ NGUỒN CHO USER STORY DNKN-174

> **User Story:**
> *"Là Tư vấn tuyển sinh, tôi muốn chuyển một lead đã chốt thành hồ sơ học viên, để không phải nhập lại thông tin khách đã cung cấp ba lần trước đó."*
>
> **Tiêu chí chấp nhận (Description):**
> • Dữ liệu lead được chuyển sang hồ sơ học viên, không phải nhập lại  
> • Hệ thống sinh mã học viên tự động  
> • Tài khoản đăng nhập cho học viên được tạo và gửi email  
> • Lead chuyển sang trạng thái Đã nhập học và không sửa được nữa  

---

## MỤC LỤC CÁC CÂU TRẢ LỜI CHO 7 SUBTASKS

1. [[BE] Cập nhật trạng thái lead sang Đã nhập học và khóa chỉnh sửa](#1-be-cập-nhật-trạng-thái-lead-sang-đã-nhập-học-và-khóa-chỉnh-sửa)
2. [[BE] Gửi email thông báo tài khoản học viên sau khi chuyển đổi](#2-be-gửi-email-thông-báo-tài-khoản-học-viên-sau-khi-chuyển-đổi)
3. [[BE] Tạo tài khoản đăng nhập cho học viên sau khi chuyển đổi lead](#3-be-tạo-tài-khoản-đăng-nhập-cho-học-viên-sau-khi-chuyển-đổi-lead)
4. [[BE] Sinh mã học viên tự động khi tạo hồ sơ từ lead](#4-be-sinh-mã-học-viên-tự-động-khi-tạo-hồ-sơ-từ-lead)
5. [[BE] Xây dựng API chuyển lead đã chốt sang hồ sơ học viên](#5-be-xây-dựng-api-chuyển-lead-đã-chốt-sang-hồ-sơ-học-viên)
6. [[FE] Xây dựng thao tác/chức năng chuyển lead đã chốt thành hồ sơ học viên](#6-fe-xây-dựng-thao-tácchức-năng-chuyển-lead-đã-chốt-thành-hồ-sơ-học-viên)
7. [[QA] Kiểm thử luồng chuyển lead thành hồ sơ học viên, sinh mã, tạo tài khoản và khóa chỉnh sửa](#7-qa-kiểm-thử-luồng-chuyển-lead-thành-hồ-sơ-học-viên-sinh-mã-tạo-tài-khoản-và-khóa-chỉnh-sửa)

---

### 1. [BE] Cập nhật trạng thái lead sang Đã nhập học và khóa chỉnh sửa
* **Yêu cầu (Description):** Sau khi chuyển đổi thành công, cập nhật lead sang trạng thái Đã nhập học, đồng thời ngăn không cho sửa lại dữ liệu lead từ các màn hình liên quan.
* **Vị trí cài đặt trong dự án:**
  - `backend/models/leadModel.js` (Hàm `enrollLead` và các hàm chặn thao tác `update`, `delete`, `addCareLog`, `setReminder`, `updateStatus`)
  - `backend/models/studentModel.js` (Bước 7 trong hàm `convertFromLead` gọi `LeadModel.enrollLead`)
* **Cách thức hiện thực:**
  1. **Hàm cập nhật trạng thái `enrollLead`:**
     - Thiết lập `status = 'Đã nhập học'`.
     - Kích hoạt cờ khóa an toàn `isLocked = true`.
     - Ghi nhận `studentCode`, `studentId`, `enrolledAt` và `updatedAt`.
     - Lưu bản ghi vết kiểm toán vào mảng `statusHistory`:
       ```javascript
       // Trích từ backend/models/leadModel.js
       static enrollLead(id, { studentCode, studentId, actor = 'Tư vấn viên' } = {}) {
         const leads = readLeads();
         const index = leads.findIndex(lead => String(lead.id) === String(id));
         if (index < 0) throw new LeadError(404, 'LEAD_NOT_FOUND', 'Không tìm thấy Lead.');

         const lead = leads[index];
         if (lead.status === 'Đã nhập học' || lead.isLocked) {
           throw new LeadError(409, 'LEAD_ALREADY_ENROLLED', 'Lead đã ở trạng thái Đã nhập học.');
         }

         const fromStatus = lead.status || null;
         const toStatus = 'Đã nhập học';
         const changedAt = new Date().toISOString();

         const historyItem = {
           id: (Array.isArray(lead.statusHistory) ? lead.statusHistory.length : 0) + 1,
           leadId: lead.id,
           fromStatus,
           toStatus,
           reason: `Chuyển đổi thành hồ sơ học viên (${studentCode || 'Đã sinh mã'})`,
           changedAt,
           changedBy: actor
         };

         lead.status = toStatus;
         lead.isLocked = true;
         lead.studentCode = studentCode || null;
         lead.studentId = studentId || null;
         lead.enrolledAt = changedAt;
         lead.updatedAt = changedAt;
         if (!Array.isArray(lead.statusHistory)) lead.statusHistory = [];
         lead.statusHistory.unshift(historyItem);

         writeLeads(leads);
         return toLeadResponse(lead);
       }
       ```
  2. **Cơ chế khóa chỉnh sửa toàn diện (Lockdown):**
     - Tại `LeadModel.update`: Nếu `lead.status === 'Đã nhập học' || lead.isLocked` thì lập tức ném lỗi HTTP 403 `LEAD_LOCKED` ("Lead đã ở trạng thái Đã nhập học và đã bị khóa, không thể chỉnh sửa").
     - Tại `LeadModel.delete`: Ngăn xóa Lead đã nhập học, trả về HTTP 403 `LEAD_LOCKED`.
     - Tại `LeadModel.addCareLog`: Ngăn thêm nhật ký chăm sóc, trả về HTTP 403 `LEAD_LOCKED`.
     - Tại `LeadModel.setReminder`: Ngăn đặt lịch nhắc gọi lại, trả về HTTP 403 `LEAD_LOCKED`.
     - Tại `LeadModel.updateStatus`: Ngăn chuyển trạng thái phễu quay lui, trả về HTTP 403 `LEAD_LOCKED`.

---

### 2. [BE] Gửi email thông báo tài khoản học viên sau khi chuyển đổi
* **Yêu cầu (Description):** Tích hợp gửi email chứa thông tin tài khoản/đường dẫn kích hoạt cho học viên ngay sau khi lead được chuyển thành hồ sơ học viên thành công.
* **Vị trí cài đặt trong dự án:**
  - `backend/services/accountActivationMailer.js` (Hàm `sendStudentWelcomeEmail`)
  - `backend/models/studentModel.js` (Gọi gửi email trong hàm `convertFromLead`)
* **Cách thức hiện thực:**
  1. Xây dựng dịch vụ gửi email chuẩn HTML giao diện thư chuyên nghiệp với Nodemailer:
     ```javascript
     // Trích từ backend/services/accountActivationMailer.js
     async function sendStudentWelcomeEmail({ name, email, studentCode, course, activationUrl, temporaryPassword }) {
       const transporter = getTransporter();
       if (!transporter) return false;

       await transporter.sendMail({
         from: `"Hệ Thống Quản Lý Tuyển Sinh & Đào Tạo" <${process.env.SMTP_USER || config.SMTP_USER}>`,
         to: email,
         subject: `[Thông báo tài khoản học viên] Chào mừng bạn gia nhập - Mã HV: ${studentCode}`,
         html: `
           <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1e293b;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px">
             <h2 style="color:#4338ca;margin-top:0">Chúc mừng bạn đã nhập học thành công!</h2>
             <p>Chào <strong>${escapeHtml(name)}</strong>,</p>
             <p>Hồ sơ học viên của bạn đã được thiết lập thành công từ thông tin đăng ký tư vấn tuyển sinh. Dưới đây là thông tin tài khoản học viên của bạn:</p>
             <div style="background:#f8fafc;padding:16px;border-radius:6px;margin:16px 0;border-left:4px solid #4f46e5">
               <p style="margin:4px 0"><strong>Mã học viên:</strong> <span style="font-size:16px;color:#4f46e5;font-weight:bold">${escapeHtml(studentCode)}</span></p>
               <p style="margin:4px 0"><strong>Khóa học/Chương trình:</strong> ${escapeHtml(course || 'Chương trình chuẩn')}</p>
               <p style="margin:4px 0"><strong>Tên đăng nhập (Email):</strong> ${escapeHtml(email)}</p>
               <p style="margin:4px 0"><strong>Mật khẩu tạm thời:</strong> <code style="background:#e0e7ff;padding:2px 6px;border-radius:4px;font-weight:bold;color:#3730a3">${escapeHtml(temporaryPassword)}</code></p>
             </div>
             <p>Vui lòng kích hoạt tài khoản trong vòng 24 giờ để bắt đầu học tập và theo dõi tiến độ:</p>
             <p style="text-align:center;margin:24px 0">
               <a href="${escapeHtml(activationUrl)}" style="background:#4f46e5;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block">Kích hoạt tài khoản</a>
             </p>
           </div>
         `
       });
       return true;
     }
     ```
  2. **Xử lý môi trường kiểm thử (Testing / Fallback):**
     - Khi chạy trong môi trường test (`NODE_ENV === 'test'`) hoặc khi chưa cấu hình SMTP Gmail, hệ thống ghi log thông tin kích hoạt vào console và trả về `activationUrl` + `temporaryPassword` trong đối tượng kết quả, giúp bộ kiểm thử QA và dev preview có thể kiểm chứng luồng hoạt động chính xác.

---

### 3. [BE] Tạo tài khoản đăng nhập cho học viên sau khi chuyển đổi lead
* **Yêu cầu (Description):** Tạo tài khoản người dùng cho học viên từ thông tin hồ sơ vừa sinh, gắn đúng vai trò và trạng thái cần thiết để học viên có thể đăng nhập hệ thống.
* **Vị trí cài đặt trong dự án:**
  - `backend/models/studentModel.js` (Bước 4 trong hàm `convertFromLead`)
  - `backend/models/userModel.js` (Hàm `create`, `findByEmail`, `toPublicUser`)
  - `backend/security/password.js` (Hàm `hashPassword` sử dụng thuật toán Scrypt bảo mật cao)
* **Cách thức hiện thực:**
  1. Kiểm tra tài khoản hiện có theo email:
     - Nếu email đã tồn tại với vai trò khác (như `admin`, `teacher`): Ném lỗi xung đột HTTP 409 `EMAIL_ALREADY_EXISTS`.
     - Nếu email đã thuộc về một học viên: Tự động cập nhật `studentCode` cho tài khoản đó.
  2. Nếu tài khoản chưa tồn tại:
     - Tự động sinh mật khẩu tạm thời an toàn ngẫu nhiên bằng `crypto.randomBytes(16).toString('base64url') + 'Aa1!'`.
     - Sinh mã kích hoạt ngẫu nhiên 32 bytes hex (`activationToken`), tính mã băm SHA-256 (`activationTokenHash`) và hạn sử dụng 24 giờ (`activationExpiresAt = Date.now() + 24 * 3600 * 1000`).
     - Băm mật khẩu tạm bằng Scrypt (`hashPassword`).
     - Khởi tạo tài khoản người dùng qua `UserModel.create`:
       ```javascript
       createdUser = UserModel.create({
         name: fullName,
         email: cleanEmail,
         phone: normalizedPhone,
         role: 'student',
         roles: ['student'],
         studentCode,
         passwordHash,
         activationTokenHash,
         activationExpiresAt
       });
       ```
  3. **Cơ chế Rollback nguyên tử:** Nếu bước ghi Lead sau đó gặp sự cố, hệ thống sẽ tự động gọi `UserModel.delete(createdUser.id)` và hoàn tác hồ sơ học viên để tránh để lại dữ liệu rác.

---

### 4. [BE] Sinh mã học viên tự động khi tạo hồ sơ từ lead
* **Yêu cầu (Description):** Thiết kế và triển khai cơ chế sinh mã học viên tự động, đảm bảo mã duy nhất, đúng định dạng và không trùng với các hồ sơ đã tồn tại.
* **Vị trí cài đặt trong dự án:**
  - `backend/models/studentModel.js` (Hàm `StudentModel.generateStudentCode()`)
* **Cách thức hiện thực:**
  1. **Quy tắc định dạng:** `HVYYYYXXXX`
     - Tiền tố cố định `HV`.
     - `YYYY`: Năm hiện tại (ví dụ: `2026`).
     - `XXXX`: Số thứ tự tuần tự gồm 4 chữ số (ví dụ: `0001`, `0002`, ...).
  2. **Thuật toán sinh mã và kiểm tra chống trùng lặp đa nguồn:**
     ```javascript
     // Trích từ backend/models/studentModel.js
     static generateStudentCode() {
       const year = new Date().getFullYear();
       const prefix = `HV${year}`;
       const students = readStudents();
       const users = db.readUsers();

       let maxSeq = 0;
       const regex = new RegExp(`^HV${year}(\\d+)$`, 'i');

       const checkCode = (code) => {
         if (typeof code === 'string') {
           const match = code.trim().match(regex);
           if (match) {
             const seq = parseInt(match[1], 10);
             if (!isNaN(seq) && seq > maxSeq) {
               maxSeq = seq;
             }
           }
         }
       };

       // Quét cả trong danh sách học viên lẫn danh sách người dùng
       students.forEach(s => checkCode(s.studentCode));
       users.forEach(u => checkCode(u.studentCode));

       const existingCodes = new Set([
         ...students.map(s => String(s.studentCode || '').toUpperCase()),
         ...users.map(u => String(u.studentCode || '').toUpperCase())
       ]);

       let nextSeq = maxSeq + 1;
       let code = `${prefix}${String(nextSeq).padStart(4, '0')}`;
       while (existingCodes.has(code.toUpperCase())) {
         nextSeq++;
         code = `${prefix}${String(nextSeq).padStart(4, '0')}`;
       }

       return code;
     }
     ```
  3. **Ưu điểm:** Đảm bảo mã duy nhất 100%, không bị trùng lặp ngay cả khi có bản ghi bị xóa hoặc được nhập thủ công từ trước.

---

### 5. [BE] Xây dựng API chuyển lead đã chốt sang hồ sơ học viên
* **Yêu cầu (Description):** Phát triển API lấy dữ liệu từ lead để tạo hồ sơ học viên mới, đảm bảo không phải nhập lại các thông tin đã có và xử lý đầy đủ các trường bắt buộc khi chuyển đổi.
* **Vị trí cài đặt trong dự án:**
  - `backend/routes/leadRoutes.js` (Endpoint `POST /api/leads/:id/convert-to-student`, alias `POST /api/leads/:id/convert`, `GET /api/leads/:id/student`)
  - `backend/routes/studentRoutes.js` (Endpoint `POST /api/students/convert-from-lead` và `GET /api/students`)
  - `backend/models/studentModel.js` (Hàm nghiệp vụ trung tâm `convertFromLead`)
* **Cách thức hiện thực:**
  1. **Định nghĩa API RESTful chuẩn:**
     - `POST /api/leads/:id/convert-to-student`
     - Quyền yêu cầu: `leads.update` (Tư vấn tuyển sinh, Quản lý đào tạo, Admin; chặn học viên với mã 403).
     - Payload (tùy chọn bổ sung/ghi đè):
       ```json
       {
         "email": "hocvien@example.com",
         "course": "Lập trình Web Fullstack",
         "note": "Đã thanh toán học phí đợt 1"
       }
       ```
  2. **Kế thừa dữ liệu - Không phải nhập lại:**
     - Tự động lấy họ tên: `lead.name || lead.fullName`
     - Tự động lấy số điện thoại: `lead.phone || lead.phoneNumber` (chuẩn hóa qua `normalizePhoneNumber`)
     - Tự động lấy email: `overrides.email || lead.email`
     - Tự động lấy khóa học: `overrides.course || lead.course || lead.programOfInterest`
     - Tự động lấy ghi chú: `overrides.note || lead.note`
  3. **Kiểm tra trạng thái Lead:**
     - Nếu `lead.status !== 'Chốt'` (ví dụ còn ở mức "Mới", "Đang tư vấn", "Hẹn học thử"): Trả về HTTP 400 `LEAD_NOT_CLOSED` ("Chỉ có thể chuyển đổi Lead có trạng thái 'Chốt' sang hồ sơ học viên").
     - Nếu `lead.status === 'Đã nhập học'`: Trả về HTTP 409 `LEAD_ALREADY_ENROLLED`.
  4. **Dữ liệu trả về (HTTP 201 Created):**
     ```json
     {
       "success": true,
       "message": "Chuyển đổi lead thành hồ sơ học viên thành công.",
       "data": {
         "student": {
           "id": "stu_b39d1b6e-...",
           "studentCode": "HV20260001",
           "leadId": "lead-001",
           "fullName": "Nguyễn Văn An",
           "phone": "0901234567",
           "email": "nguyenvanan@gmail.com",
           "course": "Khóa học Lập trình Web Fullstack",
           "status": "enrolled",
           "statusLabel": "Đang học"
         },
         "user": {
           "id": "usr_...",
           "name": "Nguyễn Văn An",
           "email": "nguyenvanan@gmail.com",
           "role": "student",
           "studentCode": "HV20260001"
         },
         "emailSent": true
       }
     }
     ```

---

### 6. [FE] Xây dựng thao tác/chức năng chuyển lead đã chốt thành hồ sơ học viên
* **Yêu cầu (Description):** Thiết kế giao diện và luồng thao tác để tư vấn tuyển sinh thực hiện chuyển đổi lead sang hồ sơ học viên, kèm xác nhận trước khi thực hiện.
* **Vị trí cài đặt trong dự án:**
  - `features/lead-management-ui/frontend/index.html` (Modal xác nhận chuyển đổi `#convert-student-modal-backdrop`, form `#convert-student-form`, hộp tóm tắt quy trình `.convert-summary-box`)
  - `features/lead-management-ui/frontend/app.js` (Hàm `openConvertStudentModal`, `closeConvertStudentModal`, `handleConvertStudentSubmit`, logic menu thao tác)
  - `features/lead-management-ui/frontend/styles.css` (Giao diện modal sang trọng, badge trạng thái `Đã nhập học` nổi bật)
* **Cách thức hiện thực và Luồng trải nghiệm người dùng (UX):**
  1. **Hiển thị nút hành động thông minh theo trạng thái:**
     - Khi Lead ở trạng thái **"Chốt"**: Menu hành động hiển thị nút nổi bật màu xanh lá: `🎓 Chuyển thành học viên`.
     - Trong Drawer chi tiết phễu (Pipeline Drawer): Nút chuyển đổi lớn xuất hiện ngay đầu danh sách tác vụ.
     - Khi Lead đã ở trạng thái **"Đã nhập học"**: Nút chuyển đổi tự động chuyển thành nhãn `🔒 Đã khóa (Đã nhập học)`, vô hiệu hóa nút sửa và ẩn nút xóa.
  2. **Modal xác nhận chuyển đổi trực quan:**
     - Tự động điền đầy đủ: Họ tên, Số điện thoại (chế độ `readonly`, nền xám nhạt chống sửa sai thông tin khách).
     - Trường Email: Tự động điền nếu Lead đã có sẵn email; nếu Lead chưa có email, cho phép tư vấn viên nhập bổ sung ngay trên modal kèm thông báo kiểm tra định dạng.
     - Khóa học / Chương trình: Tự động điền khóa học khách quan tâm.
     - Hộp tóm tắt quy trình tự động báo rõ cho tư vấn viên:
       + Kế thừa dữ liệu không cần gõ lại.
       + Tự sinh mã học viên `HVYYYYXXXX`.
       + Tự tạo tài khoản học viên và gửi email kích hoạt.
       + Khóa vĩnh viễn dữ liệu Lead để bảo toàn dữ liệu tuyển sinh.
  3. **Tương tác khi gửi:**
     - Nút xác nhận hiển thị trạng thái đang xử lý (`Đang chuyển đổi...` kèm Spinner xoay).
     - Bắt lỗi API và hiển thị thông báo lỗi màu đỏ nếu xảy ra sự cố.
     - Khi thành công: Đóng modal, hiển thị Toast chúc mừng màu xanh: `"🎉 Chuyển đổi thành công! Học viên [Tên] được cấp mã [HV20260001]. Lead đã chuyển sang Đã nhập học."` và tự động cập nhật bảng danh sách.

---

### 7. [QA] Kiểm thử luồng chuyển lead thành hồ sơ học viên, sinh mã, tạo tài khoản và khóa chỉnh sửa
* **Yêu cầu (Description):** Kiểm thử toàn bộ luồng chuyển đổi từ lead đã chốt sang hồ sơ học viên, bao gồm sao chép dữ liệu, sinh mã học viên, tạo tài khoản, gửi email và trạng thái Đã nhập học không còn chỉnh sửa được.
* **Vị trí cài đặt trong dự án:**
  - `tests/leadConversion.test.js` (Bộ kiểm thử tự động toàn diện viết bằng Node.js Native Test Runner `node:test` và `node:assert/strict`)
* **8 ca kiểm thử chi tiết đã chạy và ĐẠT 100%:**
  1. `[BE] Sinh mã học viên tự động: Đúng định dạng HVYYYYXXXX, duy nhất và tuần tự tăng dần`:
     - Kiểm tra sinh mã tự động tăng từ `HV20260001`, `HV20260002`...
     - Kiểm tra không trùng lặp với bất kỳ mã nào trong DB.
  2. `[BE] Chuyển lead đã chốt sang hồ sơ học viên: Kế thừa dữ liệu và sinh hồ sơ mới`:
     - Xác minh hồ sơ học viên mới kế thừa chính xác 100% họ tên, số điện thoại, email, khóa học từ Lead.
  3. `[BE] Tạo tài khoản đăng nhập cho học viên và gửi email kích hoạt`:
     - Xác minh tạo tài khoản người dùng với `role: 'student'`, `roles: ['student']`, mã băm kích hoạt `activationTokenHash`, mật khẩu tạm an toàn.
  4. `[BE] Cập nhật trạng thái lead sang "Đã nhập học" và khóa chỉnh sửa`:
     - Xác minh Lead chuyển sang `status: 'Đã nhập học'`, `isLocked: true`, gắn đúng `studentCode`.
     - Xác minh từ chối các thao tác sửa họ tên/số điện thoại/khóa học (báo 403 `LEAD_LOCKED`).
     - Xác minh từ chối xóa lead (báo 403 `LEAD_LOCKED`).
     - Xác minh từ chối cập nhật trạng thái khác (báo 403 `LEAD_LOCKED`).
  5. `[BE] Xử lý lead chưa có email: Cho phép bổ sung email khi gọi API chuyển đổi`:
     - Xác minh Lead không có email vẫn có thể chuyển đổi mượt mà khi người dùng cung cấp email qua request body.
  6. `[Ràng buộc] Từ chối chuyển đổi lead chưa ở trạng thái "Chốt" hoặc đã "Đã nhập học"`:
     - Thử chuyển lead "Đang tư vấn" -> Nhận lỗi 400 `LEAD_NOT_CLOSED`.
     - Thử chuyển lead đã "Đã nhập học" lần thứ 2 -> Nhận lỗi 409 `LEAD_ALREADY_ENROLLED`.
  7. `[API REST] Endpoint POST /api/leads/:id/convert-to-student và GET /api/students`:
     - Kiểm tra tích hợp qua HTTP server thực tế, gọi POST tạo học viên và gọi GET tra cứu danh sách học viên.
  8. `[RBAC] Học viên không được phép gọi API chuyển đổi lead (403 ACCESS_FORBIDDEN)`:
     - Giả lập người dùng vai trò `student` gọi API -> Bị chặn với mã HTTP 403 `ACCESS_FORBIDDEN`.
* **Kết quả thực thi kiểm thử:**
  ```text
  ▶ [QA] Kiểm thử luồng chuyển lead thành hồ sơ học viên, sinh mã, tạo tài khoản và khóa chỉnh sửa
    ✔ 1. [BE] Sinh mã học viên tự động: Đúng định dạng HVYYYYXXXX, duy nhất và tuần tự tăng dần
    ✔ 2. [BE] Chuyển lead đã chốt sang hồ sơ học viên: Kế thừa dữ liệu và sinh hồ sơ mới
    ✔ 3. [BE] Tạo tài khoản đăng nhập cho học viên và gửi email kích hoạt
    ✔ 4. [BE] Cập nhật trạng thái lead sang "Đã nhập học" và khóa chỉnh sửa
    ✔ 5. [BE] Xử lý lead chưa có email: Cho phép bổ sung email khi gọi API chuyển đổi
    ✔ 6. [Ràng buộc] Từ chối chuyển đổi lead chưa ở trạng thái "Chốt" hoặc đã "Đã nhập học"
    ✔ 7. [API REST] Endpoint POST /api/leads/:id/convert-to-student và GET /api/students
    ✔ 8. [RBAC] Học viên không được phép gọi API chuyển đổi lead (403 ACCESS_FORBIDDEN)
  ✔ [QA] Kiểm thử luồng chuyển lead thành hồ sơ học viên, sinh mã, tạo tài khoản và khóa chỉnh sửa (8/8 PASS - 100%)
  ```

---

## TỔNG HỢP DANH SÁCH FILE VÀ CÔNG CỤ TẠI `D:\DNKN 174`

| Tệp / Thư mục | Chức năng |
|---|---|
| `CAU_TRA_LOI_DNKN_174.md` | Báo cáo chi tiết trả lời trọn vẹn 7 subtasks theo yêu cầu đề bài |
| `README.md` | Tài liệu hướng dẫn sử dụng, cấu trúc thư mục và danh mục API |
| `run-tests.bat` | Phím tắt 1-click chạy bộ 8 ca kiểm thử tự động QA (PASS 100%) |
| `start-preview.bat` | Phím tắt 1-click khởi động máy chủ xem trước tại `http://localhost:3174` |
| `merge_to_project.bat` | Phím tắt 1-click ghép mã nguồn vào dự án chính `D:\FILETONG\aaaaa` |
| `merge_to_project.js` | Script Node.js tự động sao chép mã nguồn từ `project-source` |
| `preview-server.js` | Máy chủ Express độc lập phục vụ chạy thử nghiệm và tương tác UI |
| `package.json` | Cấu hình dự án và scripts `npm test`, `npm start` |
| `project-source/` | Tập hợp đầy đủ mã nguồn backend, frontend, tests sẵn sàng ghép vào dự án chính |
| `backend/` | Khối xử lý nghiệp vụ backend độc lập |
| `frontend/` | Giao diện tư vấn tuyển sinh và modal chuyển đổi học viên |
| `data/` | Dữ liệu mẫu ban đầu (Leads chốt, Leads đang tư vấn, Học viên, Users) |
| `tests/` | Bộ kiểm thử tự động QA `leadConversion.test.js` |

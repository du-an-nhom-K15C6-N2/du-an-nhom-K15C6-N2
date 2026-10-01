# du-an-nhom-K15C6-N2

## RBAC

Chính sách quyền nằm tại `src/config/rbacPolicy.js` và khai báo tám vai trò: `LECTURER`, `ACCOUNTANT`, `STUDENT`, `ADMIN`, `ACADEMIC_MANAGER`, `HEAD_OF_DEPT`, `EXAM_OFFICER` và `DORM_MANAGER`. API cập nhật điểm và học phí kiểm tra quyền ở middleware server; mặc định request không có quyền phù hợp nhận HTTP 403 với thông báo tiếng Việt.

Ứng dụng không xác thực người dùng và không tin header `x-user-role`. Khi tích hợp với hệ thống đăng nhập, truyền middleware xác thực hiện có vào factory để middleware đó gán `req.user` sau khi xác minh session/token:

```js
const { createApp } = require('./src/app');
const app = createApp({ authenticate: existingAuthenticationMiddleware });
```

Không gán `req.user` từ dữ liệu role do client tự gửi. Nếu không truyền middleware xác thực, API nghiệp vụ từ chối mọi request theo mặc định.

Dữ liệu seed có thể lấy từ `src/seed/rbacSeed.js` (`seedRoles`), mỗi phần tử gồm tên vai trò và quyền tương ứng, để ghi vào kho dữ liệu của môi trường triển khai. Repository hiện chưa tích hợp database adapter.

Chạy kiểm thử bằng `npm test`.
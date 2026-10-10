# DNKN94 shared API host

Feature này cung cấp Express/PostgreSQL backend cho host DNKN94: JWT authentication, lead CRUD/list/search/pagination, kiểm tra trùng số điện thoại, phân quyền, bulk/single reassignment và transfer history. Frontend gốc của các feature 02, 03, 06 và 07 được phục vụ trực tiếp bởi server chung, không cần build.

Từ thư mục gốc `D:\DNKN94`, làm theo hướng dẫn cài đặt, migration, bootstrap admin và chạy trong README tại root. Không khởi chạy feature này độc lập; lệnh chuẩn là `npm start` tại root.

Các unit/integration tests của backend nằm trong `test\`; lệnh `npm test` tại root chạy chúng. Migration `migrations\002_create_crm_schema.sql` chỉ chạy theo yêu cầu qua `npm run db:migrate` và không được tự động áp dụng khi server khởi động.

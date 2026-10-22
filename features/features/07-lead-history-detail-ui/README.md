# Lịch sử chuyển giao trên chi tiết lead

Trang chi tiết lead hiển thị timeline các lần phân công/chuyển giao, bao gồm thời điểm, người thực hiện, tư vấn viên cũ và mới, cùng ghi chú. Trang dùng HTML/CSS/JavaScript thuần và không cần bước build.

## Chạy thử

```powershell
py -m http.server 8000
```

Mở `http://localhost:8000/?leadId=LD-24018&demo=1` để xem dữ liệu mẫu. Dùng `?demo=empty` để kiểm tra empty state. Chế độ demo chỉ bật chủ động qua query string hoặc `demo: true` trong `config.js`.

## API contract

Mặc định trang gọi:

```http
GET /api/leads/{leadId}/transfer-history
Accept: application/json
Authorization: Bearer <accessToken> (nếu accessToken có trong localStorage)
```

`leadId` lấy từ query string `?leadId=...`, sau đó từ `config.js`; nếu không có, dùng `LD-24018`. Có thể đổi `apiBaseUrl`, `historyEndpoint` (dùng placeholder `{leadId}`), `authTokenKey` hoặc `leadId` trong `config.js`.

Response hỗ trợ mảng trực tiếp hoặc danh sách trong `items`, `history`, `data`, `data.items` hay `data.history`. Ví dụ:

```json
{
  "items": [
    {
      "id": "TH-1051",
      "transferredAt": "2026-10-08T14:32:00+07:00",
      "performedBy": { "name": "Nguyễn Minh Anh" },
      "fromConsultant": { "name": "Trần Hoàng Nam" },
      "toConsultant": { "name": "Lê Phương Thảo" },
      "note": "Điều chỉnh phân bổ theo khu vực phụ trách."
    }
  ]
}
```

Các trường thời gian, người thao tác, người chuyển đi/nhận và ghi chú chấp nhận cả camelCase và snake_case; thông tin tư vấn viên có thể là chuỗi tên hoặc object có `name`, `fullName`, `full_name`, `displayName`. Danh sách được sắp xếp mới nhất trước và thời gian hiển thị theo múi giờ Việt Nam. Response `204` hoặc danh sách rỗng hiển thị empty state; lỗi API được hiển thị riêng kèm nút thử lại.

# Test Plan & Test Cases: Phân công lead, phân quyền xem lead và lịch sử chuyển giao

## 1. Mục tiêu

Xác minh người dùng có thể phân công một hoặc nhiều lead, chuyển lead giữa các tư vấn viên, chỉ xem được lead theo đúng quyền và tra cứu được lịch sử chuyển giao chính xác. Kiểm thử cả giao diện, API, dữ liệu lưu trữ và khả năng chống truy cập trái phép.

## 2. Phạm vi

- Phân công một lead và phân công hàng loạt.
- Chuyển lead từ tư vấn viên A sang tư vấn viên B.
- Quyền xem lead của tư vấn viên và quản lý; chặn truy cập trái phép qua giao diện, URL trực tiếp và API.
- Lịch sử chuyển giao: thời gian, người thực hiện, người nhận; kiểm tra tính nhất quán với trạng thái lead hiện tại.
- Kiểm thử hồi quy các màn hình/danh sách/bộ lọc lead bị ảnh hưởng.

Ngoài phạm vi: quy tắc phân phối lead tự động, thông báo, SLA và báo cáo nếu chưa được yêu cầu cụ thể.

## 3. Vai trò, dữ liệu và giả định cần xác nhận

### Vai trò

- **Admin/Quản lý (M):** được xem toàn bộ lead trong phạm vi quản lý và thực hiện phân công/chuyển giao theo chính sách.
- **Tư vấn viên A (A), Tư vấn viên B (B):** chỉ được xem lead đang được phân công cho chính mình.
- **Người dùng không đăng nhập (G):** không được truy cập dữ liệu lead.

### Dữ liệu kiểm thử đề xuất

- `L-OWN-A`: lead đang thuộc A.
- `L-OWN-B`: lead đang thuộc B.
- `L-UNASSIGNED`: lead chưa được phân công.
- `L-OTHER-TEAM`: lead thuộc nhóm/đơn vị khác, dùng để kiểm tra ranh giới phạm vi quản lý nếu hệ thống có phân cấp.
- Một lô gồm ít nhất 3 lead: lead hợp lệ, lead đã thuộc người khác và lead không tồn tại/không có quyền thao tác.

Không dùng dữ liệu cá nhân thật; tạo dữ liệu giả trong môi trường kiểm thử và dọn dẹp sau lượt chạy.

### Quyết định sản phẩm cần chốt trước khi nghiệm thu

1. Phân công hàng loạt có **tất cả thành công hoặc tất cả thất bại** hay cho phép thành công một phần? Các ca dưới đây yêu cầu ghi nhận rõ từng lead và đối chiếu với chính sách đã chọn; nếu chưa có chính sách, khuyến nghị xử lý nguyên tử (không cập nhật dở dang).
2. Ai được phép phân công/chuyển giao: quản lý, tư vấn viên, hay cả hai? Bộ test mặc định chỉ cho quản lý thao tác; điều chỉnh ma trận quyền theo đặc tả.
3. Có cho phép chuyển lead cho chính người đang sở hữu, người dùng đã bị khóa, hoặc người ngoài nhóm/phạm vi không?
4. Lịch sử cần ghi nhận cả phân công lần đầu hay chỉ các lần chuyển giao? Quy ước múi giờ/độ chính xác timestamp là gì?
5. Lead đã đóng/xóa mềm có được xem hoặc chuyển giao không? Phạm vi quản lý có bao gồm toàn tổ chức hay chỉ nhóm trực thuộc?

## 4. Môi trường và cách thực hiện

- Môi trường QA/staging, dữ liệu giả lập, tài khoản cho từng vai trò.
- Ghi lại build/version, trình duyệt, API base URL, thời gian chạy và kết quả.
- Chạy theo thứ tự: kiểm tra API/Integration → kiểm tra E2E → kiểm tra phân quyền bằng URL/API → xác minh DB/audit log nếu có quyền.
- Với kiểm thử song song, dùng lead độc lập cho mỗi worker để tránh tranh chấp dữ liệu.
- Mọi kiểm tra bảo mật phải xác nhận cả mã HTTP lẫn nội dung phản hồi; không được lộ tên, số điện thoại, email hoặc metadata lead khi bị từ chối.

## 5. Ma trận quyền mong đợi

| Hành động | Tư vấn viên A | Tư vấn viên B | Quản lý | Chưa đăng nhập |
|---|---:|---:|---:|---:|
| Xem danh sách lead của mình | Cho phép | Cho phép | Cho phép | Từ chối |
| Xem chi tiết lead của mình | Cho phép | Cho phép | Cho phép | Từ chối |
| Xem lead của tư vấn viên khác | Từ chối/không hiển thị | Từ chối/không hiển thị | Cho phép trong phạm vi | Từ chối |
| Phân công/chuyển giao lead | Theo đặc tả; mặc định từ chối | Theo đặc tả; mặc định từ chối | Cho phép trong phạm vi | Từ chối |
| Xem lịch sử lead được phép xem | Cho phép | Cho phép | Cho phép trong phạm vi | Từ chối |

Kỳ vọng ưu tiên: API kiểm tra quyền ở phía máy chủ trên **từng lead**, không chỉ ẩn nút hoặc lọc giao diện. Phản hồi truy cập trái phép có thể là `403` hoặc `404` theo chính sách chống dò ID, nhưng phải nhất quán và không trả dữ liệu nhạy cảm.

## 6. Test Cases

Mức ưu tiên: **P0** = chặn phát hành; **P1** = quan trọng; **P2** = bổ sung.

### A. Phân công một lead và hàng loạt

| ID | Ưu tiên | Loại | Tiền điều kiện | Bước thực hiện | Kết quả mong đợi |
|---|---|---|---|---|---|
| ASG-01 | P0 | Happy path | M đăng nhập; `L-UNASSIGNED` tồn tại | M mở lead, chọn A, xác nhận phân công | Lead được gán cho A; chi tiết và danh sách cập nhật; chỉ tạo lịch sử nếu chính sách yêu cầu; không có bản ghi trùng |
| ASG-02 | P0 | Happy path | M đăng nhập; lead thuộc A | M phân công lead cho B | Chủ sở hữu hiện tại là B; dữ liệu được lưu bền vững sau tải lại/đăng nhập lại; lịch sử có người thực hiện và người nhận đúng |
| ASG-03 | P0 | Happy path | M có ít nhất 3 lead hợp lệ | Chọn nhiều lead, chọn B, xác nhận | Tất cả lead được chọn và hợp lệ thuộc B; số lượng thành công khớp số lượng đã chọn; không bị bỏ sót hoặc cập nhật nhầm |
| ASG-04 | P1 | Happy path | Có bộ lọc/tìm kiếm danh sách | Chọn một tập lead sau khi lọc, phân công hàng loạt | Chỉ đúng các lead đã chọn được cập nhật; bộ lọc không làm lệch ID hoặc cập nhật cả các hàng không chọn |
| ASG-05 | P1 | Edge | Lô chứa ID trùng lặp | Gửi yêu cầu phân công với cùng ID nhiều lần | Không tạo lịch sử/phân công lặp; kết quả rõ ràng, số lead được cập nhật phản ánh số ID duy nhất |
| ASG-06 | P0 | Edge | M gửi lô gồm lead hợp lệ và ID không tồn tại | Phân công hàng loạt | Không cập nhật âm thầm sai số lượng; trả kết quả lỗi/chi tiết theo chính sách nguyên tử hoặc thành công một phần đã chốt; không rò rỉ dữ liệu của ID không được phép |
| ASG-07 | P0 | Edge | Lô gồm lead M được phép và `L-OTHER-TEAM` ngoài phạm vi | Gửi yêu cầu hàng loạt | Quyền được kiểm tra từng lead; lead ngoài phạm vi không bị thay đổi; kết quả tuân theo chính sách nguyên tử/thành công một phần |
| ASG-08 | P1 | Edge | Mở hai phiên; một phiên cập nhật lead trước | Phiên còn lại phân công với dữ liệu cũ | Phát hiện xung đột hoặc áp dụng quy tắc cập nhật được xác định; không ghi đè im lặng làm mất thao tác mới hơn |
| ASG-09 | P1 | Edge | Có tài khoản tư vấn viên đang bị khóa/không hoạt động | M thử chọn tài khoản này làm người nhận | Từ chối hoặc loại khỏi danh sách theo chính sách; không tạo trạng thái lead gán cho tài khoản không hợp lệ |
| ASG-10 | P1 | Edge | Lead đã thuộc B | M phân công lại cho chính B | Hành vi idempotent hoặc thông báo không thay đổi theo chính sách; không tạo các sự kiện chuyển giao giả |
| ASG-11 | P1 | Edge | Tập lead có trạng thái đóng/xóa mềm | M thử phân công | Áp dụng đúng chính sách trạng thái; không thể cập nhật lead bị khóa nếu không được phép |
| ASG-12 | P0 | Security | A đăng nhập; biết ID lead thuộc B | A gọi API phân công hoặc sửa owner trực tiếp | Bị từ chối phía máy chủ; owner và lịch sử không đổi; phản hồi không chứa dữ liệu lead trái quyền |
| ASG-13 | P1 | Reliability | Có lệnh phân công đang xử lý | Gửi lại cùng yêu cầu do retry/mất phản hồi | Không tạo nhiều lần chuyển giao ngoài ý muốn; kết quả retry nhất quán nếu API hỗ trợ idempotency |

### B. Chuyển giao lead A sang B

| ID | Ưu tiên | Loại | Tiền điều kiện | Bước thực hiện | Kết quả mong đợi |
|---|---|---|---|---|---|
| TRF-01 | P0 | Happy path | Lead thuộc A; M có quyền | M chuyển lead cho B | Chủ sở hữu hiện tại thành B; A không còn thấy lead trong danh sách “của tôi”; B thấy lead; M vẫn thấy lead trong phạm vi |
| TRF-02 | P0 | Happy path | Chuyển giao thành công | M tải lại trang/mở lại lead bằng tài khoản B | Owner và quyền truy cập vẫn đúng; không phụ thuộc cache trình duyệt |
| TRF-03 | P0 | History | Có thể xem lịch sử | Mở lịch sử của lead vừa chuyển | Có sự kiện với người thực hiện M, người nhận B và thời gian hợp lệ; liên kết đúng lead |
| TRF-04 | P1 | History | Lead đã chuyển A→B rồi B→A | Thực hiện hai lần chuyển liên tiếp | Có đủ hai sự kiện đúng thứ tự; không ghi đè lịch sử cũ; owner hiện tại là A |
| TRF-05 | P1 | Edge | Chuyển lead cho chính owner hiện tại | Thực hiện chuyển giao A→A | Không đổi owner; không tạo lịch sử giả trừ khi chính sách ghi nhận thao tác không đổi |
| TRF-06 | P0 | Edge | Hai quản lý/phiên cùng chuyển một lead | Gửi hai yêu cầu đồng thời tới hai người nhận khác nhau | Một kết quả cuối cùng nhất quán; lịch sử phản ánh đúng thứ tự thực tế; không tạo trạng thái owner và audit log mâu thuẫn |
| TRF-07 | P1 | Edge | Mất mạng/timeout sau khi gửi yêu cầu | Retry thao tác chuyển giao | Trạng thái cuối và lịch sử không bị nhân đôi; UI hiển thị rõ kết quả, không báo thành công nếu chưa xác nhận |
| TRF-08 | P1 | Edge | Người nhận bị khóa hoặc không còn thuộc phạm vi | Thử chuyển giao cho người nhận đó | Từ chối theo chính sách; owner và lịch sử không đổi |

### C. Phân quyền xem và truy cập trực tiếp

| ID | Ưu tiên | Loại | Tiền điều kiện | Bước thực hiện | Kết quả mong đợi |
|---|---|---|---|---|---|
| PER-01 | P0 | Happy path | A đăng nhập; `L-OWN-A` thuộc A | A mở danh sách và chi tiết lead | Lead hiển thị đầy đủ trong phạm vi quyền |
| PER-02 | P0 | Happy path | B đăng nhập; `L-OWN-A` thuộc A | B xem danh sách của mình | `L-OWN-A` không xuất hiện trong dữ liệu trả về hoặc UI |
| PER-03 | P0 | Happy path | M đăng nhập; có lead A, B và chưa gán trong phạm vi | M mở danh sách/tìm kiếm | M xem được toàn bộ lead thuộc phạm vi quản lý theo chính sách |
| PER-04 | P0 | Security | B đăng nhập; biết URL/ID của `L-OWN-A` | Dán URL chi tiết trực tiếp vào trình duyệt | Không xem được lead; điều hướng/thông báo phù hợp; không render dữ liệu nhạy cảm thoáng qua |
| PER-05 | P0 | Security | B có token hợp lệ | Gọi API chi tiết lead thuộc A bằng ID đã biết | Trả `403`/`404` nhất quán; body không lộ lead; không thay đổi dữ liệu |
| PER-06 | P0 | Security | A có token hợp lệ | Thử sửa tham số owner/assignee trong request để đọc lead của B | Máy chủ bỏ qua mọi quyền tự khai báo từ client và từ chối; không dựa vào ID hoặc role do client gửi |
| PER-07 | P0 | Security | A đăng nhập | Gọi API danh sách với filter ownerId của B, đổi page/sort/search hoặc bỏ filter | Không trả lead của B; quyền vẫn đúng với mọi biến thể truy vấn |
| PER-08 | P0 | Security | A đăng nhập; biết URL lịch sử lead của B | Mở URL trực tiếp và gọi API history | Bị từ chối; không lộ người thực hiện, người nhận, timestamp hay thông tin lead |
| PER-09 | P0 | Security | Không đăng nhập | Truy cập URL/API danh sách, chi tiết, lịch sử và endpoint chuyển giao | Yêu cầu xác thực; không có dữ liệu; thao tác ghi không được thực hiện |
| PER-10 | P1 | Security | Tài khoản M quản lý nhóm X; lead thuộc nhóm Y | Truy cập UI/API lead nhóm Y | Từ chối nếu quản lý không có phạm vi toàn tổ chức; kiểm tra quyền theo scope thay vì chỉ theo role |
| PER-11 | P1 | Security | Quyền/tài khoản bị thu hồi trong phiên | Thu hồi quyền rồi dùng token/session cũ truy cập lead | Quyền bị thu hồi có hiệu lực theo thời gian chính sách; không tiếp tục được cấp dữ liệu ngoài quyền |
| PER-12 | P1 | Security | A đang xem lead của mình | Thực hiện chuyển giao thành công A→B, sau đó dùng tab/token cũ truy cập lead | Không còn quyền xem sau khi chuyển giao; cache/API không tiếp tục phục vụ dữ liệu trái quyền |

### D. Lịch sử chuyển giao và tính toàn vẹn dữ liệu

| ID | Ưu tiên | Loại | Tiền điều kiện | Bước thực hiện | Kết quả mong đợi |
|---|---|---|---|---|---|
| HIS-01 | P0 | History | M chuyển lead từ A sang B | Đối chiếu UI history với API/DB audit nếu có | `actor` là người thực hiện M; `recipient/newOwner` là B; `leadId` đúng; timestamp có giá trị |
| HIS-02 | P0 | History | Có sự kiện chuyển giao vừa tạo | So sánh thời gian bắt đầu/kết thúc thao tác với timestamp lưu | Thời gian nằm trong khoảng hợp lý theo độ chính xác hệ thống; timezone hiển thị đúng, không lệch ngày/giờ |
| HIS-03 | P1 | History | Có nhiều lần chuyển giao | Sắp xếp history tăng/giảm dần | Thứ tự nhất quán theo thời gian và không mất sự kiện khi hai thao tác gần nhau |
| HIS-04 | P0 | Integrity | Lead đã chuyển A→B | Đối chiếu owner hiện tại với sự kiện mới nhất | Owner hiện tại khớp người nhận của sự kiện gần nhất; không có khoảng lệch giữa bảng lead và audit |
| HIS-05 | P1 | Integrity | Thao tác chuyển giao bị từ chối/lỗi validation | Kiểm tra history | Không ghi lịch sử thành công giả; nếu hệ thống có audit thất bại, loại sự kiện và trạng thái phải phân biệt rõ |
| HIS-06 | P1 | Integrity | Thử chỉnh sửa history bằng API không được cấp quyền | Gửi request sửa/xóa audit event | Bị từ chối; lịch sử là bất biến với người dùng thông thường |
| HIS-07 | P1 | Edge | Người thực hiện hoặc người nhận đổi tên/vô hiệu hóa sau sự kiện | Mở history cũ | Sự kiện vẫn truy vết được đúng danh tính ổn định (ID); cách hiển thị tên lịch sử theo chính sách |
| HIS-08 | P1 | Edge | Nhiều lần chuyển giao trong cùng giây | Tạo các chuyển giao liên tiếp | Không mất hoặc tráo thứ tự sự kiện; có tie-breaker ổn định như sequence/ID nếu timestamp trùng |

## 7. Tiêu chí hoàn tất

- Tất cả ca P0 đạt; không còn lỗi truy cập trái quyền hoặc sai owner/audit.
- Ca P1 có kết quả rõ ràng; mọi ngoại lệ được ghi nhận và chấp thuận.
- Quyết định cho các câu hỏi ở mục 3 được thống nhất trước khi chốt expected result cho bulk assignment và phạm vi quản lý.
- Không có lỗi nghiêm trọng/cao còn mở; dữ liệu lead và lịch sử nhất quán sau khi tải lại.
- Đính kèm bằng chứng: request/response đã ẩn thông tin nhạy cảm, ảnh UI, ID dữ liệu giả và timestamp chạy.

## 8. Khung Integration Test / E2E tự động

Ví dụ dưới đây dùng **Playwright Test + TypeScript**. Endpoint, payload và selector là placeholder vì workspace chưa có API/UI hay hợp đồng dữ liệu. Thay chúng bằng route, schema, fixture đăng nhập và selector ổn định của ứng dụng. Không lưu token hoặc thông tin đăng nhập thật trong mã nguồn; lấy chúng từ biến môi trường/secret store của CI.

### 8.1 Integration/API test — phân quyền và chuyển giao

Đặt ví dụ tại `tests/integration/lead-transfer.spec.ts`. API giả định:

- `POST /api/test/sessions` cấp token cho tài khoản fixture QA.
- `GET /api/leads/:id` đọc lead.
- `POST /api/leads/:id/transfer` nhận `{ assigneeId }`.
- `GET /api/leads/:id/transfer-history` trả về mảng sự kiện.

```ts
import { expect, test } from "@playwright/test";

const apiBaseUrl = process.env.API_BASE_URL;
if (!apiBaseUrl) {
  throw new Error("API_BASE_URL must be configured for integration tests");
}

type Session = { token: string };
type Lead = { id: string; assigneeId: string };
type TransferEvent = {
  actorId: string;
  recipientId: string;
  createdAt: string;
};

async function login(
  request: import("@playwright/test").APIRequestContext,
  username: string,
  password: string,
): Promise<Session> {
  const response = await request.post(`${apiBaseUrl}/api/test/sessions`, {
    data: { username, password },
  });
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<Session>;
}

test("manager transfers a lead and only its owner can read it", async ({
  request,
}) => {
  const manager = await login(
    request,
    process.env.QA_MANAGER_USERNAME!,
    process.env.QA_MANAGER_PASSWORD!,
  );
  const advisorA = await login(
    request,
    process.env.QA_ADVISOR_A_USERNAME!,
    process.env.QA_ADVISOR_A_PASSWORD!,
  );
  const advisorB = await login(
    request,
    process.env.QA_ADVISOR_B_USERNAME!,
    process.env.QA_ADVISOR_B_PASSWORD!,
  );

  const leadId = process.env.QA_TRANSFER_LEAD_ID;
  const advisorAId = process.env.QA_ADVISOR_A_ID;
  const advisorBId = process.env.QA_ADVISOR_B_ID;
  if (!leadId || !advisorAId || !advisorBId) {
    throw new Error("QA lead and advisor IDs must be configured");
  }

  const managerHeaders = { Authorization: `Bearer ${manager.token}` };
  const advisorAHeaders = { Authorization: `Bearer ${advisorA.token}` };
  const advisorBHeaders = { Authorization: `Bearer ${advisorB.token}` };

  const before = await request.get(`${apiBaseUrl}/api/leads/${leadId}`, {
    headers: managerHeaders,
  });
  expect(before.ok()).toBeTruthy();
  expect((await before.json() as Lead).assigneeId).toBe(advisorAId);

  const transfer = await request.post(
    `${apiBaseUrl}/api/leads/${leadId}/transfer`,
    { headers: managerHeaders, data: { assigneeId: advisorBId } },
  );
  expect(transfer.ok()).toBeTruthy();

  const readAsB = await request.get(`${apiBaseUrl}/api/leads/${leadId}`, {
    headers: advisorBHeaders,
  });
  expect(readAsB.ok()).toBeTruthy();
  expect((await readAsB.json() as Lead).assigneeId).toBe(advisorBId);

  const readAsA = await request.get(`${apiBaseUrl}/api/leads/${leadId}`, {
    headers: advisorAHeaders,
  });
  expect([403, 404]).toContain(readAsA.status());
  expect(await readAsA.text()).not.toContain(leadId);

  const historyResponse = await request.get(
    `${apiBaseUrl}/api/leads/${leadId}/transfer-history`,
    { headers: managerHeaders },
  );
  expect(historyResponse.ok()).toBeTruthy();
  const history = await historyResponse.json() as TransferEvent[];
  const latest = history.at(-1);
  expect(latest).toBeDefined();
  expect(latest?.actorId).toBe(process.env.QA_MANAGER_ID);
  expect(latest?.recipientId).toBe(advisorBId);
  expect(Number.isNaN(Date.parse(latest!.createdAt))).toBe(false);
});
```

**Lưu ý điều chỉnh:** Dùng schema validator hiện có thay cho type assertion ở ví dụ nếu dự án có Zod/OpenAPI client. Không dùng `!` cho cấu hình trong test suite thực tế; nên validate toàn bộ biến môi trường một lần ở fixture để lỗi cấu hình xuất hiện sớm. Dùng fixture dữ liệu cô lập hoặc reset lead về owner A trước mỗi lần chạy; không chạy nhiều worker trên cùng `QA_TRANSFER_LEAD_ID`.

### 8.2 E2E test — người dùng thao tác qua giao diện

Ví dụ đặt tại `tests/e2e/lead-permissions.spec.ts`. Thay URL và `getByTestId` bằng route/selector đã được ứng dụng hỗ trợ; ưu tiên `data-testid` ổn định hoặc role/name accessibility.

```ts
import { expect, test } from "@playwright/test";

test("advisor cannot open another advisor's lead by direct URL", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.QA_ADVISOR_B_USERNAME!);
  await page.getByLabel("Password").fill(process.env.QA_ADVISOR_B_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/dashboard/);

  const otherAdvisorLeadId = process.env.QA_ADVISOR_A_LEAD_ID;
  if (!otherAdvisorLeadId) {
    throw new Error("QA_ADVISOR_A_LEAD_ID must be configured");
  }

  await page.goto(`/leads/${otherAdvisorLeadId}`);
  await expect(page.getByTestId("lead-details")).toHaveCount(0);
  await expect(
    page.getByText(/không có quyền|không tìm thấy|truy cập bị từ chối/i),
  ).toBeVisible();
});

test("manager transfers a lead from advisor A to advisor B", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.QA_MANAGER_USERNAME!);
  await page.getByLabel("Password").fill(process.env.QA_MANAGER_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập" }).click();

  const leadId = process.env.QA_TRANSFER_LEAD_ID;
  if (!leadId) {
    throw new Error("QA_TRANSFER_LEAD_ID must be configured");
  }

  await page.goto(`/leads/${leadId}`);
  await page.getByRole("button", { name: /chuyển giao|phân công/i }).click();
  await page.getByLabel(/tư vấn viên nhận|người nhận/i).selectOption({
    label: process.env.QA_ADVISOR_B_DISPLAY_NAME!,
  });
  await page.getByRole("button", { name: /xác nhận|lưu/i }).click();

  await expect(page.getByTestId("lead-assignee")).toContainText(
    process.env.QA_ADVISOR_B_DISPLAY_NAME!,
  );
  await page.getByRole("tab", { name: /lịch sử/i }).click();
  await expect(page.getByTestId("transfer-history")).toContainText(
    process.env.QA_ADVISOR_B_DISPLAY_NAME!,
  );
});
```

### 8.3 Chạy test (sau khi dự án cài Playwright)

```powershell
$env:API_BASE_URL = "https://qa.example.test"
npx playwright test tests/integration/lead-transfer.spec.ts
npx playwright test tests/e2e/lead-permissions.spec.ts
```

Trước khi đưa vào CI, cấu hình project/baseURL, fixture xác thực an toàn, tài khoản role riêng và bước tạo/reset dữ liệu. Không chạy test trên production. Nếu ứng dụng có test DB/API riêng, nên kiểm tra lịch sử qua API được hỗ trợ thay vì truy cập trực tiếp DB từ E2E.

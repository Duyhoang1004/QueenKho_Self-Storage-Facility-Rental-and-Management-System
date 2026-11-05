# Kiểm thử backend

Chạy từ thư mục gốc repo (không cần bật SQL Server cho unit test và MockMvc):

```powershell
./scripts/test-business.ps1
```

Script chạy JUnit/Mockito và các test frontend. `-TestPattern` chọn lớp JUnit theo
cú pháp Maven Surefire; mặc định vẫn là `*Test`. Để chỉ chạy nhóm bổ sung này:

```powershell
./scripts/test-business.ps1 -TestPattern '*WorkflowTest,VoucherManagementTest,RefundStatusServiceTest,EmailDeliveryTest,*ApiValidationTest,*ApiAuthorizationTest,*ApiContractTest'
```

## Phạm vi test bổ sung

| Lớp test | Trường hợp chính |
|---|---|
| `RefundStatusServiceTest` | Ưu tiên refund đang mở, task hoàn tất, fallback giao dịch, dữ liệu thiếu/null |
| `ReservationCleanupWorkflowTest` | Đơn hết hạn, thông báo đúng khách, chạy lại, lỗi DB không báo thành công giả |
| `RenewalReminderWorkflowTest` | Mốc nhắc bị bỏ lỡ, khóa chống trùng, điều khoản v3/v4, cảnh báo tới mốc thanh lý, miễn phí trễ |
| `VoucherManagementTest` | Validation khi BOM tạo/sửa, mã trùng, mã đã dùng, giới hạn lượt, voucher mặc định duy nhất |
| `EmailDeliveryTest` | Thiếu cấu hình, tắt gửi, lỗi SMTP, MIME UTF-8, escape nội dung và liên kết frontend |
| `UnitSensorWorkflowTest` | Biên ngưỡng cảm biến, cảnh báo FM/khách, tạo task, thiếu hợp đồng, tóm tắt số đo |
| `AuthApiValidationTest` | Bean Validation, JSON sai, lỗi login, đăng ký công khai, logout idempotent |
| `ReservationApiAuthorizationTest` | 401/403, khóa tài khoản, giả mạo ID, scope cơ sở, ownership, lỗi binding/JSON |
| `VoucherApiContractTest` | Filter + controller + service voucher thật, quyền BOM, validation, 400/404 |
| `VnpayApiContractTest` | Quyền tạo link/xem trạng thái, danh tính theo token, callback công khai, redirect, định dạng lỗi |
| `UploadApiValidationTest` | Quyền upload, tên file an toàn, đuôi không hỗ trợ, file rỗng, thiếu multipart |

MockMvc dùng filter `AccessControlFilter`, `AccessPolicy`, `CurrentUserProvider` và
`OwnershipGuard` thật. Repository/JDBC và các service không thuộc đối tượng kiểm
thử được mock. File upload dùng `@TempDir`; email không gửi tới SMTP thật và
test thanh toán không gọi VNPAY thật.

## Giới hạn và lỗi hiện có

Các test này không thay thế kiểm thử SQL Server, transaction rollback, xử lý đồng
thời, Spring Security/CORS đầy đủ hay thao tác trên trình duyệt. Chưa có báo cáo
JaCoCo để kết luận phần trăm coverage.

`ApiAuthorizationSmokeTest`, `IsolatedRentalFlowTest` và
`SqlRefundTriggerBusinessTest` cần bật rõ ràng bằng `-Api`/`-SqlServer` và các biến
`QK_API_*`/`QK_SQLSERVER_TEST_*`; mặc định chúng bị skip, không tính là pass.
`ApiApplicationTests` cần database thật và không nằm trong mẫu `*Test` của script.

Bộ test tổng hiện có 6 regression thất bại ở `BusinessRegressionTest` (5) và
`StorageUnitBusinessTest` (1): tiền hoàn theo kỳ đã trả, trần tiền hoàn khi lỗi cơ
sở, callback sau chấm dứt hợp đồng, sức chứa khi gia hạn/đặt kho và mở lại ô chưa
kiểm kê. Không tắt hoặc nới các assertion này để làm xanh kết quả.

Kết quả từng suite được lưu ở `target/business-test-results.json` và báo cáo
Surefire ở `target/surefire-reports/`.

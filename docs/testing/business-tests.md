# Bộ test nghiệp vụ bổ sung — 05/11/2026

## Phạm vi của bước 1

Chỉ bổ sung test, công cụ chạy test và tài liệu. Không sửa service/controller, SQL sản phẩm hay Docker. Các ca regression đang đỏ được giữ nguyên để làm đầu vào cho bước sửa bug. Không stage, commit hoặc push.

Bộ test kiểm tra các miền nghiệp vụ chính, kết hợp 203 unit test có sẵn. Đây không phải cam kết phủ mọi dòng code hoặc tìm được mọi bug; chưa có báo cáo coverage đo bằng công cụ.

## Kết quả đã chạy trên mốc `9d7dd5c`

Ngày 05/11/2026, chạy runner với `-SqlServer -Api`:

| Nhóm | Tổng ca | Pass | Fail | Error | Skip |
|---|---:|---:|---:|---:|---:|
| Backend (cả test cũ và mới) | 481 | 465 | 16 | 0 | 0 |
| Frontend mới | 20 | 20 | 0 | 0 | 0 |
| Tổng | 501 | 485 | 16 | 0 | 0 |

So với 203 ca có sẵn, bổ sung **278 ca backend + 20 ca frontend = 298 ca**. Số ca tính cả từng đầu vào của parameterized test; một ca flow có nhiều bước/assertion nhưng vẫn tính là một ca.

16 ca fail gồm: 5 regression tính tiền/gia hạn, 1 ca bỏ qua kiểm kê, 8 ca trigger trên hai script SQL, 2 ca callback qua HTTP + DB. Trong 8 flow HTTP cách ly, 6 flow thuận pass và 2 regression fail. 19 ca API smoke phân quyền pass. Exit code 1 là kết quả bắt bug, không phải lỗi compile/hạ tầng. Không sửa nghiệp vụ sản phẩm trong bước này.

Chi tiết toàn bộ file dự kiến đưa vào commit nằm ở [step-1-files.md](step-1-files.md). Các file review cũ, tài liệu/ảnh cá nhân có sẵn không thuộc phạm vi commit này.

| Miền nghiệp vụ | Test bổ sung | Nội dung chính |
|---|---|---|
| Đăng nhập/đăng ký/phiên | `AuthBusinessTest`, `SessionBusinessTest` | Dữ liệu trống, sai mật khẩu, tài khoản khoá/vô hiệu, 5 vai trò, mật khẩu được encode, logout, token giả và token sau restart. |
| Phân quyền từng bản ghi | `OwnershipBoundaryBusinessTest` | Chủ hợp đồng/đơn, phạm vi cơ sở, phạm vi toàn chuỗi; kết hợp ma trận endpoint và filter có sẵn. |
| Đặt kho | `BookingBusinessTest` | Ngày/kỳ thuê, đồng ý điều khoản, cơ sở/loại kho ngừng hoạt động, nợ, snapshot bảo hiểm và điều khoản. |
| Voucher | `VoucherBusinessTest` | Ngày hiệu lực, cơ sở, gói tối thiểu, lượt đang giữ, giới hạn mỗi khách, trần tiền và không giảm vào cọc. |
| Nhận kho | ~~`OnlineCheckInBusinessTest`~~ | Đã xoá 06/11/2026 cùng check-in online (D-16); `IsolatedRentalFlowTest` chuyển sang check-in tại quầy. |
| Trả kho | `CheckoutBusinessTest` | Báo trước, ân hạn, hợp đồng quá hạn, cách nhận tiền, tài khoản ngân hàng, huỷ lịch và đồng bộ đơn/hợp đồng. |
| Chuyển ô | `UnitTransferBusinessTest` | Cùng cơ sở/loại, lý do, bảo trì ô cũ, mất ô do thao tác khác, giữ PIN/giá/thời hạn và lịch sử. |
| Hỗ trợ | `SupportBusinessTest` | Hợp đồng đủ điều kiện, chủ sở hữu, mô tả, loại sự cố, trùng ticket và giới hạn đang mở. |
| Bảo hiểm/bồi thường/cảm biến | `CompensationWorkflowBusinessTest`, `MoneyBoundaryBusinessTest` | Hồ sơ, kiểm tra, thẩm định, tách duyệt và chi, bằng chứng, quyền BOM/FM, trần bồi thường, bất khả kháng và ngưỡng cảm biến. |
| Quản trị tài khoản | `AdminAccountBusinessTest` | Admin hoạt động, không tự khoá, giữ admin cuối, khách đang thuê, Staff giữ việc và tài khoản system. |
| Ô kho/bảo trì/hàng lưu giữ | `StorageUnitBusinessTest` | Trạng thái ô, giảm năng lực đã đặt, ghi chú bảo trì và ngăn bỏ qua kiểm kê sau thanh lý. |
| Lịch sử/thông báo/báo cáo/danh mục | Các lớp có sẵn + API smoke | Giữ nguyên test hiện có cho notification, login history, doanh thu BOM, chính sách thuê, loại kho, nhân viên và mặt bằng. Không ghi nhận là test mới của bước này. |
| Tiền và callback | `VnpayCallbackBusinessTest`, `BusinessRegressionTest` | Chữ ký, số tiền, IPN lặp, trả nợ lỗi, quyền xem giao dịch, hoàn vượt thực thu, snapshot giá, hợp đồng kết thúc và tranh suất. |
| Trigger SQL thật | `SqlRefundTriggerBusinessTest` | Cùng kịch bản chạy trên trigger trích từ cả `QueenKho_full.sql` và `QueenKho_TongHop.sql`. |
| Flow HTTP + DB thật | `IsolatedRentalFlowTest` | Đặt → thanh toán → gán → nhận; gia hạn; trả → nghiệm thu → hoàn; hỗ trợ; bồi thường; quá hạn → liên hệ → thanh lý → kiểm kê/lưu giữ. Có thêm callback muộn và thay link trả nợ. |
| API trên app đang chạy | `ApiAuthorizationSmokeTest` | Đăng nhập 5 vai trò, endpoint đúng/sai quyền, token thiếu/giả, danh mục bảo hiểm công khai. |
| Frontend | `receipt.test.mjs`, `image-evidence.test.mjs` | Biên nhận, bảo hiểm/voucher, escape dữ liệu, popup, nén ảnh, giới hạn kích thước, lỗi đọc ảnh và nhãn tiếng Việt. |

## Cách chạy

Từ thư mục gốc, dùng PowerShell:

```powershell
# Unit + regression + frontend; các bài cần SQL/API sẽ được skip nếu chưa cấu hình.
./scripts/test-business.ps1
```

Runner chọn các lớp `*Test`, giữ các bài `ApiApplicationTests` cần môi trường DB mặc định ở ngoài lần chạy này. Không bỏ qua regression đang fail. Runner vẫn chạy frontend khi backend fail và trả exit code 1 nếu một phía fail.

Nếu máy hạn chế Mockito tự attach, runner tìm agent trong Maven cache. Có thể chỉ định đúng JAR của phiên bản dự án đang sử dụng:

```powershell
./scripts/test-business.ps1 -MockitoAgent 'C:/path/to/mockito-core-version.jar'
```

Chạy riêng frontend:

```powershell
cd frontend
npm test
```

### SQL Server và flow hoàn toàn cách ly

```powershell
$env:QK_SQLSERVER_TEST_SERVER = 'localhost:1433'
$env:QK_SQLSERVER_TEST_USER = 'test-user'
$env:QK_SQLSERVER_TEST_PASSWORD = '<password>'
./scripts/test-business.ps1 -SqlServer
```

Tài khoản cần quyền tạo/xoá database test. Hai lớp test tạo tên ngẫu nhiên `QueenKho_Test_<uuid>` và `QueenKho_FlowTest_<uuid>`, kiểm tra chặt tên trước khi xoá. DB hiện có không được sử dụng làm nơi ghi dữ liệu test.

- Trigger test tạo các bảng tối thiểu cho hợp đồng trigger và chạy trigger thật; không dùng H2 hoặc giả lập T-SQL.
- Flow test tạo DB riêng, chỉ nạp phần schema/seed sau marker `CREATE TABLE roles`, từ chối câu lệnh cấp database trong phần đó. Không thực thi phần DROP/CREATE/USE `QueenKhoDB` của script.
- Flow test khởi động Spring Boot trên cổng ngẫu nhiên, cấu hình datasource trỏ vào DB test, tắt gửi email và dùng merchant secret chỉ dành cho test. Nó gửi IPN có chữ ký hợp lệ nội bộ, không giao dịch với ngân hàng/VNPAY thật.
- Thời hạn task và dữ liệu quá hạn được chuẩn bị bằng SQL chỉ bên trong DB fixture để test không phải chờ nhiều ngày.
- Ứng dụng test được đóng rồi DB được xoá trong teardown. Nếu tiến trình bị kill cứng hoặc máy mất điện, teardown có thể không chạy: chỉ kiểm tra/dọn đúng tên DB test được tạo, không xoá DB ứng dụng.

### API smoke trên ứng dụng đang chạy

```powershell
$env:QK_API_BASE_URL = 'http://localhost:8080/api/v1'
$env:QK_API_PASSWORD = '<shared-test-password>'
$env:QK_API_CUSTOMER_EMAIL = '<customer-test-email>'
$env:QK_API_STAFF_EMAIL = '<staff-test-email>'
$env:QK_API_FACILITY_MANAGER_EMAIL = '<manager-test-email>'
$env:QK_API_BOM_EMAIL = '<bom-test-email>'
$env:QK_API_ADMIN_EMAIL = '<admin-test-email>'
./scripts/test-business.ps1 -Api
```

Có thể kết hợp `-SqlServer -Api`. API smoke không tạo đơn/hợp đồng/chi tiền; thao tác đăng nhập/đăng xuất vẫn sinh login history bình thường. Phiên test được thu hồi khi xong. Không lưu token hoặc mật khẩu vào kết quả test.

## Đọc kết quả

- Backend: XML và TXT trong `backend/api/target/surefire-reports/`.
- Runner: `backend/api/target/business-test-results.json`, chỉ lấy báo cáo được cập nhật trong lần chạy hiện tại.
- Frontend: kết quả từng ca được Node test runner in ra terminal.
- Không đưa thư mục `target`, log máy cá nhân, uploads, token hay dữ liệu DB vào commit.

### Các lỗi đang được test bắt

1. Tiền hoàn do sự cố vượt tiền thực trả của kỳ tương lai.
2. Đơn giá hiện tại làm thay đổi quyết toán kỳ đã thanh toán.
3. Gia hạn qua callback vẫn áp dụng lên hợp đồng đã kết thúc.
4. Callback gia hạn không bảo vệ suất đã được khách khác cần tới.
5. Ô giải phóng muộn bị tính là thay thế cho một đơn nhận sớm hơn.
6. Mở lại ô sau thanh lý bỏ qua kiểm kê hàng.
7. Tạo lại link trả nợ làm callback của lần trả cũ không còn tìm thấy giao dịch.
8. Trigger hoàn tiền giao dịch thừa làm kết thúc hợp đồng đang thuê và xoá cọc đang giữ.
9. Trigger hoàn tiền giao dịch thừa đánh dấu đơn đang thuê thành REFUNDED.
10. Trigger ở script full đổi LIQUIDATED thành TERMINATED khi hoàn tiền, khác script Tổng Hợp.
11. Trigger full không đưa cọc về 0 khi hợp đồng đã TERMINATED trước lúc hoàn tiền.
12. Trigger có thể đánh dấu một giao dịch hoàn FAILED khác thành SUCCESS chỉ vì cùng mã đơn trong ghi chú task.

Nhiều ca cùng phát hiện một lỗi ở tầng khác nhau hoặc trên hai script SQL; **số ca fail không phải số bug độc lập**. Các rule còn cần nhóm quyết định (gia hạn khi đã hẹn trả, vòng đời quyền chấm dứt miễn phí, phạm vi miễn phí trễ khi trả kho) chưa được đưa vào suite mặc định như lỗi chắc chắn. Test miễn phí trễ có sẵn vẫn kiểm tra chính hàm tính phí/miễn; chưa suy ra cùng quyết định áp dụng cho mọi phương án kết thúc hợp đồng.

## Giới hạn cần biết

- Flow test là E2E qua HTTP và SQL, không tự bấm trình duyệt. Chưa kiểm tra layout, routing/sessionStorage thực tế và toàn bộ tương tác React.
- Chưa tự động kiểm chứng lịch chạy scheduler qua nhiều ngày, thiết bị cửa/IoT thật, SMTP thật hay đối tác bảo hiểm thật.
- Test mất ô lúc chuyển kiểm tra cập nhật có điều kiện; chưa thay thế bài stress hai request giao ô/chi trả đồng thời trên SQL Server.
- Mock hạ tầng không chứng minh rollback thật. Các flow SQL thật bổ sung bằng chứng cho những đường được liệt kê, không suy rộng cho mọi transaction.
- Test tiếp tục chạy với expected đúng; không thêm `@Disabled`, không đổi actual thành expected để che lỗi. Bước 2 mới xử lý logic sản phẩm.

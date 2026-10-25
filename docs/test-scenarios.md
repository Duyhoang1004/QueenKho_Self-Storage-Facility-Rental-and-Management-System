# Kịch bản test — các chức năng đã hoàn thành

Cập nhật: 2026-10-05 · nhánh `main` (commit `ecf1386`).
Cột **Kết quả** để trống cho người test điền: ✅ Pass / ❌ Fail / ⚠️ Pass có lưu ý. Ca nào đánh dấu 🐞 là **đã biết sẽ fail** với code hiện tại (xem bảng bug ở `test-flow-dat-cho.md`), để làm ca hồi quy khi sửa.

## 0. Chuẩn bị

1. Chạy trên SSMS: `QueenKho.sql` → `QueenKhoDuLieuMau_UC09.sql` → `setup_test_env.sql` (lưu ý file cuối **xoá toàn bộ reservations/contracts/payments**).
2. Backend `cd backend/api && ./mvnw spring-boot:run` (8080), frontend `cd frontend && npm run dev` (5173).
3. Tài khoản test (mật khẩu đều là `123456`):

| Vai trò | Email | Cơ sở |
|---|---|---|
| CUSTOMER | `khachhang@gmail.com` | — |
| FACILITY_MANAGER | `fmtanbinh@gmail.com` (hoặc `fm1@gmail.com`) | QueenKho Tân Bình |
| FACILITY_MANAGER | `fmbinhthanh@gmail.com` (hoặc `fm2@gmail.com`) | QueenKho Bình Thạnh |
| FACILITY_MANAGER | `fmthuduc@gmail.com`, `fmgovap@gmail.com`, `fmcaugiay@gmail.com`, `fmquan7@gmail.com` | theo tên |

**Ngoài phạm vi** (chưa xong / đang dùng dữ liệu giả): Dashboard quản lý (`/manager`), Quản lý danh mục kho (`/manager/storage`), Huỷ đơn đặt chỗ (đang làm dở), phân quyền/token (Security đang `permitAll`).

---

## 1. Đăng ký tài khoản — `/register` · `POST /api/v1/auth/register`

| ID | Kịch bản | Dữ liệu / Bước | Kết quả mong đợi | Kết quả |
|---|---|---|---|---|
| REG-01 | Đăng ký hợp lệ | Họ tên `Test User`, SĐT `0911111111`, email mới `test01@gmail.com`, mật khẩu `123456` → Đăng ký | Thông báo xanh thành công, sau 2s chuyển về `/login`; DB có user role CUSTOMER, status ACTIVE, `password_hash` dạng `$2a$...` | |
| REG-02 | Đăng nhập bằng tài khoản vừa tạo | Đăng nhập `test01@gmail.com` / `123456` | Vào trang chủ `/` | |
| REG-03 | Bỏ trống họ tên | Để trống họ tên | Lỗi "Vui lòng nhập họ và tên." — không gọi API | |
| REG-04 | Bỏ trống SĐT | | "Vui lòng nhập số điện thoại." | |
| REG-05 | Email sai định dạng | `abc@`, `abc.com` | "Email không đúng định dạng." | |
| REG-06 | Mật khẩu < 6 ký tự | `12345` | "Mật khẩu phải có ít nhất 6 ký tự." | |
| REG-07 | Email đã tồn tại | `khachhang@gmail.com` | Lỗi đỏ "Email này đã được sử dụng", không tạo user mới | |
| REG-08 | Gọi API bỏ qua FE | `POST /register` body thiếu `password` | 400, không tạo user | |
| REG-09 | Ẩn/hiện mật khẩu | Bấm icon con mắt | Chuyển giữa `•••` và chữ thường | |

## 2. Đăng nhập — `/login` · `POST /api/v1/auth/login`

| ID | Kịch bản | Dữ liệu / Bước | Kết quả mong đợi | Kết quả |
|---|---|---|---|---|
| LOG-01 | Customer đăng nhập | `khachhang@gmail.com` / `123456` | Chuyển `/`; `sessionStorage.user` có `role: CUSTOMER`, `userId` | |
| LOG-02 | Manager đăng nhập | `fmtanbinh@gmail.com` / `123456` | Chuyển `/manager`, header hiện "Quản lý Tân Bình" | |
| LOG-03 | Lặp LOG-02 với 5 tài khoản `fm<cơ sở>` còn lại | | Mỗi tài khoản vào `/manager`, tên đúng cơ sở | |
| LOG-04 | Sai mật khẩu | `khachhang@gmail.com` / `000000` | "Email hoặc mật khẩu không đúng." | |
| LOG-05 | Email không tồn tại | `khongco@gmail.com` | "Email hoặc mật khẩu không đúng." | |
| LOG-06 | Bỏ trống email / mật khẩu | | "Vui lòng nhập email." / "Vui lòng nhập mật khẩu." | |
| LOG-07 | Email sai định dạng | `abc` | "Email không đúng định dạng." | |
| LOG-08 | 🐞 Tài khoản bị khoá | Đặt `status='LOCKED'` cho user test rồi đăng nhập | Mong đợi: "Tài khoản đã bị khóa…". Hiện tại: vẫn đăng nhập được (BE không kiểm tra status) | |
| LOG-09 | 🐞 Customer vào trang quản lý | Đăng nhập customer, gõ URL `/manager/customers` | Mong đợi: bị chặn. Hiện tại: vào được (chưa có route guard) | |
| LOG-10 | Đăng xuất | Menu user → Đăng xuất | Xoá `sessionStorage.user`, về `/login` | |

## 3. Tìm kiếm kho — `/tim-va-dat-kho` · `GET /api/v1/facilities/search`, `/cities`, `/unit-types`

| ID | Kịch bản | Dữ liệu / Bước | Kết quả mong đợi | Kết quả |
|---|---|---|---|---|
| SRC-01 | Mở trang tìm kiếm | Vào `/tim-va-dat-kho` | Dropdown thành phố (TP.HCM, Hà Nội…) và loại kho được nạp từ API | |
| SRC-02 | Tìm không lọc | Bấm Tìm | Danh sách cặp (cơ sở × loại kho) **còn slot > 0**; mỗi thẻ có giá/tháng, diện tích, số ô còn trống | |
| SRC-03 | Lọc theo thành phố | `TP.HCM` | Chỉ cơ sở ở TP.HCM (không có Cầu Giấy) | |
| SRC-04 | Lọc theo từ khoá | `Thủ Đức` | Chỉ QueenKho Thủ Đức | |
| SRC-05 | Lọc loại kho | `Kho Mini M` | Mọi kết quả đều là Kho Mini M | |
| SRC-06 | Lọc khoảng giá | min 500.000 – max 1.000.000 | Mọi kết quả có giá trong khoảng | |
| SRC-07 | Lọc diện tích | min 3 – max 6 m² | Mọi kết quả có diện tích trong khoảng | |
| SRC-08 | Không có kết quả | Từ khoá `xyz` | Hiện trạng thái rỗng, không lỗi | |
| SRC-09 | Cơ sở hết ô | Cơ sở có `totalAvailableUnits = 0` (Tân Bình trong DB mẫu) | Không xuất hiện trong kết quả | |
| SRC-10 | Slot trừ đơn đang giữ | Ghi lại số ô trống của 1 cặp → tạo 1 đơn PENDING cho cặp đó → tìm lại | Số ô trống giảm 1 | |
| SRC-11 | 🐞 Phân trang | `GET /search?page=0&size=3` | Mong đợi: 3 item, `totalElements` khớp. Hiện tại: số item ≠ size (phân trang theo cơ sở) | |
| SRC-12 | Xem chi tiết slot cơ sở | `GET /facilities/{id}/availability` hoặc bấm chọn kho | Mỗi loại kho có `totalUnits`, `availableCount`; id không tồn tại → lỗi "Không tìm thấy cơ sở" | |

## 4. Đặt chỗ + thanh toán cọc — `/booking` · `POST /api/v1/reservations`, `/api/payments/sepay-pg/*`

Tiền điều kiện: đăng nhập `khachhang@gmail.com`, chọn 1 kho còn slot ở bước 3.
Công thức thanh toán lần đầu = `giá × số tháng − giảm giá gói + cọc 1 tháng − voucher 100.000`, giảm giá gói: 3 tháng 5%, 6 tháng 10%, 12 tháng 15%, còn lại 0%.

| ID | Kịch bản | Dữ liệu / Bước | Kết quả mong đợi | Kết quả |
|---|---|---|---|---|
| RES-01 | Mở trang đặt chỗ | Từ kết quả tìm kiếm bấm Đặt | Hiện đúng cơ sở, loại kho, giá; thông tin khách điền sẵn từ tài khoản | |
| RES-02 | Tính tiền 1 tháng | Kho Mini M (750.000), 1 tháng | Tổng **1.400.000** | |
| RES-03 | Tính tiền 3 tháng | Kho Mini M, 3 tháng | Tổng **2.787.500** | |
| RES-04 | Tính tiền 6 tháng | Kho Mini M, 6 tháng | Tổng **4.700.000** | |
| RES-05 | Tính tiền 12 tháng | Kho Mini M, 12 tháng | Tổng **8.300.000** | |
| RES-06 | Chưa tick cam kết | Bỏ tick → Thanh toán | "Bạn cần đồng ý với cam kết lưu trữ…" | |
| RES-07 | Chưa chọn ngày | | "Vui lòng chọn ngày bắt đầu nhận kho." | |
| RES-08 | Thiếu thông tin khách | Xoá tên hoặc SĐT | "Vui lòng điền đầy đủ thông tin khách hàng." | |
| RES-09 | Ngày ở quá khứ (API) | `startDate` = hôm qua | 400 "Ngày bắt đầu không được ở quá khứ" | |
| RES-10 | Số tháng = 0 (API) | `durationMonths: 0` | 400 "Thời gian thuê phải tối thiểu 1 tháng" | |
| RES-11 | Thiếu cơ sở/loại kho (API) | bỏ `facilityId` | 400 "Vui lòng chọn cơ sở và loại kho" | |
| RES-12 | Đặt thành công → sang cổng SePay | Điền đủ, Thanh toán | Tạo đơn PENDING (mã `RES-xxxxxx`), chuyển sang trang SePay sandbox với đúng số tiền ở RES-02..05 | |
| RES-13 | Thanh toán thành công | Hoàn tất trên SePay | Về `/booking/confirmation`; đơn → `DEPOSIT_PAID`, có 1 dòng `payment_transactions` DEPOSIT SUCCESS | |
| RES-14 | Huỷ trên cổng SePay | Bấm huỷ/quay lại | Về `/booking?payment=failed`, hiện "Thanh toán thất bại hoặc đã bị hủy…"; đơn vẫn PENDING | |
| RES-15 | Tạo link cho đơn không còn PENDING | `POST /sepay-pg/create` với đơn đã DEPOSIT_PAID | 409 "Reservation is not waiting for deposit" | |
| RES-16 | 🐞 Đặt khi hết slot | Gọi API tạo đơn cho cặp có `availableCount = 0` | Mong đợi: 400. Hiện tại: tạo được (overbooking) | |
| RES-17 | 🐞 Xác nhận trùng | Reload trang confirmation 2 lần | Mong đợi: 1 giao dịch. Hiện tại: có thể sinh 2 dòng DEPOSIT | |
| RES-18 | 🐞 Bỏ qua cổng thanh toán | Gọi thẳng `POST /sepay-pg/confirm-dev` cho đơn PENDING | Mong đợi: bị từ chối. Hiện tại: đơn thành DEPOSIT_PAID | |

## 5. Kho của tôi (Customer) — `/kho-cua-toi` · `GET /api/v1/reservations/my`

| ID | Kịch bản | Dữ liệu / Bước | Kết quả mong đợi | Kết quả |
|---|---|---|---|---|
| MY-01 | Xem danh sách đơn | Customer có đơn ở nhiều trạng thái | Hiện đủ đơn, nhãn trạng thái đúng màu: Chờ thanh toán cọc / Đã đặt cọc - chờ gán ô / Đã gán ô | |
| MY-02 | Thẻ thống kê | | Số đếm mỗi thẻ khớp số đơn theo trạng thái | |
| MY-03 | Lọc theo tab | Bấm lần lượt Tất cả / Chờ thanh toán / Đã đặt cọc / Đã gán ô / Đã đóng | Chỉ hiện đơn đúng trạng thái | |
| MY-04 | Khách chưa có đơn | Đăng nhập `test01@gmail.com` (REG-01) | Trạng thái rỗng, không lỗi | |
| MY-05 | Nút xem hợp đồng | Đơn UNIT_ASSIGNED có nút; đơn khác không có | | |
| MY-06 | Không đăng nhập | Xoá sessionStorage, vào `/kho-cua-toi` | Không crash; hiện "Bạn cần đăng nhập để xem đơn đặt chỗ." | |

## 6. Gán ô kho cho đơn (Manager) — `/manager/pending` · `/reservations/pending`, `/{id}/available-units`, `/{id}/assign`

Tiền điều kiện: có ít nhất 1 đơn DEPOSIT_PAID ở Tân Bình (làm RES-13), đăng nhập `fmtanbinh@gmail.com`.

| ID | Kịch bản | Dữ liệu / Bước | Kết quả mong đợi | Kết quả |
|---|---|---|---|---|
| ASG-01 | Xem đơn chờ gán | Mở `/manager/pending` | Chỉ hiện đơn DEPOSIT_PAID **của cơ sở Tân Bình** | |
| ASG-02 | Manager cơ sở khác | Đăng nhập `fmbinhthanh@gmail.com` | Không thấy đơn của Tân Bình | |
| ASG-03 | Mở modal gán ô | Bấm Gán ô | Danh sách ô AVAILABLE cùng cơ sở, cùng loại kho; hết ô → danh sách rỗng | |
| ASG-04 | Gán thành công | Chọn 1 ô → Xác nhận | "Gán kho và tạo hợp đồng thành công"; đơn biến khỏi danh sách; ô → OCCUPIED; đơn → UNIT_ASSIGNED | |
| ASG-05 | Hợp đồng tự sinh | `GET /contracts?reservationId={id}` | HĐ `HD-xxxxxx`, ACTIVE, `endDate = startDate + số tháng`, cọc giữ = giá 1 tháng | |
| ASG-06 | Gán lại đơn đã gán | Gọi lại `/assign` | 400 "Đơn đặt chỗ chưa thanh toán cọc hoặc đã được gán ô" | |
| ASG-07 | Gán đơn còn PENDING | | 400 như ASG-06 | |
| ASG-08 | Gán ô đã OCCUPIED | `storageUnitId` là ô đã thuê | 400 "Ô kho này hiện không khả dụng…" | |
| ASG-09 | Không chọn ô | body `{}` | 400 "Vui lòng chọn ô kho thực tế" | |
| ASG-10 | 🐞 Gán ô khác cơ sở / khác loại | Gán ô của Bình Thạnh cho đơn Tân Bình | Mong đợi: 400. Hiện tại: gán được, sinh HĐ sai | |
| ASG-11 | Customer thấy kết quả | Đăng nhập customer → Kho của tôi | Đơn hiện "Đã gán ô" kèm mã ô | |

## 7. Hợp đồng — Customer `/kho-cua-toi/hop-dong/:reservationId` · Manager `/manager/customers`, `/manager/contracts/:id`

| ID | Kịch bản | Dữ liệu / Bước | Kết quả mong đợi | Kết quả |
|---|---|---|---|---|
| CTR-01 | Customer xem HĐ | Từ MY-05 bấm Xem hợp đồng | Đúng mã HĐ, mã đơn, ô kho (tầng/khu/phòng), loại kho, diện tích, ngày bắt đầu–kết thúc, tiền cọc | |
| CTR-02 | Customer xem HĐ đơn chưa gán | Gõ URL với id đơn PENDING | "Không tìm thấy hợp đồng cho đơn đặt chỗ này." + nút quay lại | |
| CTR-03 | Manager xem DS khách & HĐ | `fmtanbinh` mở `/manager/customers` | Chỉ HĐ của cơ sở Tân Bình; tên/SĐT khách, ô, trạng thái đúng | |
| CTR-04 | Manager cơ sở khác | `fmbinhthanh` mở cùng trang | Không thấy HĐ của Tân Bình | |
| CTR-05 | Manager xem chi tiết HĐ | Bấm 1 dòng | `/manager/contracts/{id}` hiện đủ thông tin như CTR-01 | |
| CTR-06 | HĐ không tồn tại | `/manager/contracts/99999` | "Không tìm thấy hợp đồng hoặc đã xảy ra lỗi." | |
| CTR-07 | API thiếu tham số | `GET /api/v1/contracts` không query | 400 "Cần truyền facilityId, managerId, customerId hoặc reservationId" | |

## 8. Luồng end-to-end (chạy cuối cùng)

| Bước | Actor | Hành động | Kiểm tra |
|---|---|---|---|
| 1 | Khách mới | Đăng ký `e2e@gmail.com` → đăng nhập | REG-01, LOG-01 |
| 2 | Khách | Tìm Kho Mini M ở TP.HCM, ghi lại số ô trống | SRC-05 |
| 3 | Khách | Đặt 3 tháng, thanh toán SePay | Tổng 2.787.500; đơn DEPOSIT_PAID; số ô trống giảm 1 |
| 4 | Manager cơ sở đó | Gán ô | Đơn UNIT_ASSIGNED, HĐ ACTIVE |
| 5 | Khách | Kho của tôi → Xem hợp đồng | Thông tin khớp bước 4 |
| 6 | Manager | Khách hàng & Hợp đồng | Thấy khách `e2e@gmail.com` và HĐ mới |

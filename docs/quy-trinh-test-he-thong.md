# Quy trình test & demo toàn hệ thống theo 7 Flow

Cập nhật: 26/10/2026, theo code `main` @ `56b3899` cộng phần hoàn thiện 5 flow Must-have (chưa commit). Phần hoàn thiện gồm: phân quyền theo token, FM giao việc, UC-20 thanh toán, báo cáo cơ sở, ưu đãi gói / miễn phí trễ do BOM chỉnh, lịch sử đăng nhập và các bản sửa lỗi.

File này là **quy trình chạy theo flow nghiệp vụ**: mỗi bước một vai trò, đi từ đầu đến cuối. Các ca biên / lỗi chi tiết nằm trong [kich-ban-test-dat-kho.md](kich-ban-test-dat-kho.md); mỗi flow có ghi "Ca chi tiết: mục X" để nhảy sang.
Cột **KQ** để người test điền ✅ / ❌ / ⚠️.

---

## 0. Chuẩn bị (làm 1 lần)

1. **DB**
   - Đang có dữ liệu → chạy lần lượt `sql_script/Update_rental_policy_uc07.sql` rồi `sql_script/Update_hoan_thien_flow.sql` (chạy lại nhiều lần không sao).
   - Tạo mới → `sql_script/QueenKho_full.sql` (đã gộp sẵn).
   - Chạy bằng `sqlcmd` thì thêm `-I -f 65001`:
     ```bash
     sqlcmd -S localhost -U sa -P 12345 -I -f 65001 -i sql_script/Update_hoan_thien_flow.sql
     ```
2. **Chạy app**: backend `cd backend/api && ./mvnw spring-boot:run`, frontend `cd frontend && npm run dev`, rồi mở `http://localhost:5173`.
3. **Phiên đăng nhập**: token lưu trong RAM backend. Restart backend thì FE tự đưa về trang đăng nhập với thông báo "Phiên đăng nhập đã hết hạn" và quay lại đúng trang sau khi đăng nhập.
4. Mật khẩu mọi tài khoản: `123456`.

| Vai trò | Tài khoản | Ghi chú |
|---|---|---|
| CUSTOMER | `khachhang1@gmail.com`, `khachhang2@gmail.com` | KH1 chạy luồng chính, KH2 thử quyền |
| STAFF | `stafftanbinh1@gmail.com`, `stafftanbinh2@gmail.com`, `stafftanbinh3@gmail.com` | cơ sở 1 – Tân Bình |
| FACILITY_MANAGER | `fmtanbinh@gmail.com` (cơ sở 1), `fmbinhthanh@gmail.com` (cơ sở 2) | |
| BOM | `bom@queenkho.com` | |
| ADMIN | `admin@queenkho.com` | |

- **Kho dùng chính**: Tân Bình (id 1) – Kho Mini M 750.000đ/tháng. Kho phụ: Kho nhỏ 2m² 500.000đ/tháng.
- **Thẻ VNPAY sandbox**: NCB · `9704198526191432198` · `NGUYEN VAN A` · `07/15` · OTP `123456`.
- **Tua thời gian bằng SQL** và **câu SQL soi trạng thái**: xem mục 0.5 / 0.6 của `kich-ban-test-dat-kho.md`.

### 0.1 Test tự động (chạy trước khi demo)

| Loại | Lệnh | Mong đợi |
|---|---|---|
| Unit test backend (120 bài) | `cd backend/api && ./mvnw test` | `BUILD SUCCESS`. Riêng `AccessPolicyTest` quét **mọi endpoint** của mọi controller: API nào quên khai báo quyền thì test fail |
| E2E 5 flow + giả lập qua API thật | `bash docs/test-e2e/e2e-5-flow.sh` (Git Bash, backend + DB đang chạy; backend ở cổng khác thì thêm `E2E_HOST=http://localhost:8090` phía trước) | `KẾT QUẢ: 80 PASS / 0 FAIL`. Script ký IPN VNPAY sandbox nên không cần nhập thẻ; chạy lại nhiều lần được (tự dọn dữ liệu `RFID-E2E-*` của lần trước) |
| Frontend | `cd frontend && npm run build` | build OK |

### 0.2 Nút "⚡ Giả lập" — tua thời gian khi demo

Các quy tắc phụ thuộc thời gian (giữ chỗ 15 phút, hẹn nhận kho, No-Show 48h, quá hạn, thanh lý 30 ngày, tự đóng ticket 3 ngày) không thể chờ thật trong buổi demo. Nút **⚡ Giả lập** (viền đứt màu cam) chỉ sửa **mốc thời gian**, sau đó nghiệp vụ thật chạy tiếp: job, nút No-Show, nút Thanh lý, phí trễ…

- Mỗi lần bấm có hộp xác nhận và ghi nhật ký `[SIMULATION]` kèm người bấm, nên hội đồng xem `/admin/logs` sẽ thấy rõ đây là thao tác tua thời gian.
- Tắt khi chạy thật: `SIMULATION_ENABLED=false` → toàn bộ nút tự ẩn.

| Nút | Ở đâu (ai bấm) | Kết quả ngay sau khi bấm | Bước demo tiếp theo |
|---|---|---|---|
| ⚡ Khách tới hôm nay | Chi tiết task Check-in (Staff `/staff/tasks/:id` hoặc FM `/manager/tasks/:id`) | Ngày hẹn và HĐ dời về hôm nay, task hạn 21:00 | Staff lập biên bản check-in ngay (trước đó báo `CHECK_IN_TOO_EARLY`) |
| ⚡ Quá 15p | `/kho-cua-toi`, đơn "Chờ thanh toán" (Khách) | Đơn **Hết hạn**, suất kho được nhả | Tìm kho thấy số ô trống tăng lại |
| ⚡ Khách bùng hẹn (đủ No-Show) | Chi tiết task Check-in của FM (`/manager/tasks/:id`) | Giờ hẹn lùi 49h + 2 lần gọi thất bại cách 25h | `/manager/pending` → tab No-Show: nút huỷ No-Show đã bật |
| ⚡ Quá hạn 3 ngày | Chi tiết HĐ của FM (`/manager/contracts/:id`) | HĐ **Quá hạn**, PIN bị khoá, phí trễ 3 ngày | `/manager/overdue` → **Miễn phí trễ**; khách gia hạn |
| ⚡ Quá hạn 31 ngày (thanh lý) | Chi tiết HĐ, hoặc nút "⚡ 31 ngày" ở `/manager/overdue` | Vượt mốc 30 ngày | Nút **Thanh lý** được bật |
| ⚡ Quá 3 ngày | `/ho-tro`, ticket "Chờ xác nhận" (Khách) | Hệ thống tự **đóng** ticket | Xem log `[SUPPORT_AUTO_CLOSE]` |

---

## 1. Kịch bản demo ~15 phút (gợi ý thứ tự trình bày)

| Phút | Vai trò | Màn | Nói gì / làm gì |
|---|---|---|---|
| 0–2 | BOM | `/bom/policies` | Mở chính sách Tân Bình: cọc, huỷ, phí trễ, **ưu đãi gói 3/6/12 tháng**, **cho phép FM miễn phí trễ**. Tạo phiên bản mới, xem lịch sử phiên bản |
| 2–5 | Khách | `/tim-va-dat-kho` → `/booking` | Tìm kho, chọn Mini M 3 tháng: giá theo ưu đãi BOM vừa đặt. Thanh toán VNPAY sandbox → "Đã đặt cọc" |
| 5–7 | FM | `/manager/pending` → `/manager/tasks` | Gán ô (chỉ hiện ô đúng loại) → hợp đồng chờ check-in → bấm **Giao việc** cho Staff 1 |
| 7–9 | Staff 1 | `/staff` | Mở task (đã được giao). Nếu khách hẹn ngày khác: bấm **⚡ Khách tới hôm nay**. Lập biên bản 5 mục, PIN, RFID → hợp đồng ACTIVE |
| 9–11 | Khách | `/kho-cua-toi`, `/ho-tro`, `/thanh-toan` | Xem PIN, gửi yêu cầu hỗ trợ khoá, xem lịch sử thanh toán |
| 11–13 | FM | `/manager/reports`, `/manager/contracts/:id`, `/manager/overdue` | Báo cáo cơ sở (xuất CSV). Ở chi tiết HĐ bấm **⚡ Quá hạn 3 ngày** → sang màn quá hạn **Miễn phí trễ**; **⚡ 31 ngày** → **Thanh lý** |
| 13–15 | Admin | `/admin/roles`, `/admin/login-history` | Ma trận quyền **lấy thẳng từ backend**. Thử KH2 gọi API của KH1 → 403. Xem lịch sử đăng nhập |

---

## Flow 4a — BOM: cơ sở, bảng giá, chính sách

Đăng nhập `bom@queenkho.com` (vào thẳng `/bom`).

| # | Màn | Thao tác | Mong đợi | KQ |
|---|---|---|---|---|
| 4.1 | `/bom/facilities` | Xem danh sách cơ sở | Đủ 6 cơ sở, có trạng thái, nút chi tiết / sửa | |
| 4.2 | | **Thêm cơ sở mới** | Cơ sở mới xuất hiện; DB có thêm 1 dòng `rental_policy` v1 đang hiệu lực | |
| 4.3 | | **Ngừng cơ sở** → khách tìm kho / đặt kho | Cơ sở ngừng không hiện; đặt bằng API → 400 "Cơ sở này đang tạm ngưng nhận đặt chỗ mới". Kích hoạt lại sau khi thử | |
| 4.4 | `/bom/unit-types` | Thêm loại kho, sửa giá, **Tạm ngưng** 1 loại | Giá mới hiện ở trang tìm kho; loại tạm ngưng không hiện, đặt bằng API → 400 | |
| 4.5 | `/bom/policies` | Xem chính sách Tân Bình: 4 nhóm quy định | Có nhóm **"Ưu đãi theo gói & miễn phí"**: đặt mới 5/10/15%, gia hạn 0/5/10%, cho phép miễn phí trễ | |
| 4.6 | | **Tạo phiên bản mới**: cọc 2 tháng, phí huỷ 30%, miễn phí huỷ 48 giờ, ưu đãi đặt mới 3 tháng **8%** | Có **v2 đang hiệu lực**, v1 vẫn còn trong lịch sử | |
| 4.7 | | Nhập sai: cọc 4 · phí huỷ 101 · ưu đãi 60% | Báo lỗi tại ô, không tạo phiên bản | |
| 4.8 | | **Lịch sử** → **Áp dụng phiên bản này** cho v1 | v1 hiệu lực lại, **không** sinh v3 | |
| 4.9 | FM gọi API tạo chính sách | `POST /rental-policies/facilities/1` bằng token FM | 403 `FORBIDDEN_ROLE` (FM chỉ xem) | |

---

## Flow 5 — FM: ô kho, nhân viên, giao việc, báo cáo

Đăng nhập `fmtanbinh@gmail.com`.

| # | Màn | Thao tác | Mong đợi | KQ |
|---|---|---|---|---|
| 5.1 | `/manager/storage` | Xem danh mục ô: mã, loại, diện tích, vị trí, giá, trạng thái, khách thuê, hạn hợp đồng | Chỉ ô của Tân Bình | |
| 5.2 | | Thêm ô mới, sửa vị trí, **khoá bảo trì** rồi mở lại | Ô bảo trì không được gợi ý khi gán ô | |
| 5.3 | | Sửa URL / API sang ô của cơ sở 2 (`/storage-units/KV-BT-...`) | 403 `FORBIDDEN_FACILITY` | |
| 5.4 | `/manager/staff` | Thêm nhân viên mới, đặt lại mật khẩu, khoá / mở khoá | Khoá → đăng nhập bị chặn | |
| 5.5 | `/manager/tasks` | Mặc định tab **"Tất cả việc cơ sở"**; lọc theo loại / trạng thái | Task `[KHẨN]` nằm đầu | |
| 5.6 | | Task "Chờ nhận" → **Giao việc** → chọn nhân viên (danh sách có số việc đang làm) | Task "Đang xử lý" + tên nhân viên; log `[TASK_ASSIGN]` | |
| 5.7 | | Task đang xử lý → **Đổi người** sang nhân viên khác | Đổi người phụ trách; giao lại đúng người cũ → 409 | |
| 5.8 | | Thử giao task của cơ sở khác / cho nhân viên đang bị khoá (API) | 403 `FORBIDDEN_FACILITY` / 400 `STAFF_INACTIVE` | |
| 5.9 | `/manager` | Dashboard cơ sở | Không còn ô chọn cơ sở khác (FM chỉ xem cơ sở mình) | |
| 5.10 | `/manager/reports` | **Báo cáo cơ sở**: chọn tháng / quý / năm | Ô kho (tổng, đang thuê, trống, bảo trì, % lấp đầy), doanh thu thuần / thuê / phí / đã hoàn, biểu đồ 12 tháng, doanh thu theo loại kho, hợp đồng quá hạn, giao dịch gần nhất | |
| 5.11 | | **Xuất CSV** | Tải file `QueenKho_BaoCao_...csv`, Excel đọc đúng tiếng Việt | |
| 5.12 | | Số liệu khớp BOM: BOM chọn cơ sở Tân Bình ở `/bom/revenue` | Cùng doanh thu thuần, vì dùng chung API và filter khoá cơ sở | |

Ca chi tiết: mục **E** (nhận việc, gỡ người).

---

## Flow 1 — Đặt kho

Đăng nhập `khachhang1@gmail.com`.

| # | Actor · Màn | Thao tác | Mong đợi | KQ |
|---|---|---|---|---|
| 1.1 | KH · `/tim-va-dat-kho` | Xem cơ sở, loại, kích thước, giá, số ô trống; lọc | Chỉ cặp cơ sở × loại còn suất | |
| 1.2 | KH · `/booking` | Mini M, ngày bắt đầu **hôm nay**, **3 tháng** | Huy hiệu "Tiết kiệm X%" và số tiền lấy từ chính sách BOM. Với v1 (5%): 2.250.000 − 112.500 + cọc 750.000 − voucher 100.000 = **2.787.500** | |
| 1.3 | | (Khi Tân Bình đang v2 ở bước 4.6) | 3 tháng giảm 8%, cọc 2 tháng: 2.070.000 + 1.500.000 − 100.000 = **3.470.000**. Chính sách được chốt vào đơn lúc tạo | |
| 1.4 | KH · VNPAY | Thanh toán thẻ NCB | Về `/booking/confirmation` báo thành công; đơn **DEPOSIT_PAID** | |
| 1.5 | KH2 | Đặt suất **cuối cùng** của loại kho vừa hết | 409 `NO_AVAILABILITY` "…vừa hết chỗ trống" (chống overbooking) | |
| 1.6 | KH | Huỷ đơn đã cọc (trước mốc miễn phí) | Hoàn 100%, đơn chờ hoàn tiền, có task REFUND cho FM | |
| 1.7 | KH2 | Gọi `cancel-preview` / `cancel` đơn của KH1 (API) | 403 `FORBIDDEN_OWNER` | |
| 1.8 | FM · `/manager/pending` | **Gán ô** | Chỉ hiện ô **đúng loại** khách đặt; hết ô đúng loại → thông báo, không gợi ý loại khác | |
| 1.9 | | Gán thành công | Đơn UNIT_ASSIGNED, HĐ PENDING_CHECK_IN, task CHECK_IN; log `[UNIT_ASSIGN]` | |
| 1.10 | FM Bình Thạnh | Gán ô cho đơn Tân Bình (API) | 403 `FORBIDDEN_FACILITY` | |

Ca chi tiết: mục **A**, **B**, **C**, **D**.

---

## Flow 2 — Check-in & bàn giao

| # | Actor · Màn | Thao tác | Mong đợi | KQ |
|---|---|---|---|---|
| 2.1 | Staff1 · `/staff` | Danh sách việc trong ngày | Thấy task CHECK_IN (do FM giao ở 5.6 hoặc tự nhận) | |
| 2.2 | Staff1 | Mở task → thông tin đơn, khách, ô, ngày hẹn | Khớp đơn KH1 | |
| 2.3 | Staff1 | Biên bản 5 mục, PIN gợi ý, RFID → **Hoàn tất bàn giao** | HĐ **ACTIVE** có PIN + RFID | |
| 2.4 | Staff2 | Check-in task Staff1 đang giữ | 409 `TASK_NOT_YOURS` | |
| 2.5 | Staff1 | Đơn có ngày hẹn **ngày mai** → check-in hôm nay | 409 `CHECK_IN_TOO_EARLY` | |
| 2.6 | KH · `/kho-cua-toi/hop-dong/:id` | Xem HĐ | Đang thuê, PIN, RFID, ngày bắt đầu – kết thúc | |
| 2.7 | FM | No-Show (đủ 2 lần liên hệ cách 24h, quá 48h) | Đơn CANCELLED, ô AVAILABLE, **có giao dịch REFUND PENDING** cho tiền thuê, task REFUND | |
| 2.8 | FM | Dời lịch nhận kho | Ngày hẹn mới, task CHECK_IN hạn 21:00 ngày mới | |

Ca chi tiết: mục **E**, **F**, **G**.

---

## Flow 3 — Quản lý kho đang thuê

| # | Actor · Màn | Thao tác | Mong đợi | KQ |
|---|---|---|---|---|
| 3.1 | KH · `/kho-cua-toi` | Có ≥ 2 hợp đồng | Mỗi kho trạng thái riêng | |
| 3.2 | KH2 | Mở hợp đồng của KH1 (`/contracts/{id}`) / gọi `?facilityId=1` | 403 / chỉ ra hợp đồng của chính KH2 | |
| 3.3 | KH · `/thanh-toan` | Menu **Thanh toán** | Tổng đã trả, đã hoàn, trừ vào cọc, còn nợ + lịch sử giao dịch (lọc loại, ẩn giao dịch thất bại) | |
| 3.4 | FM · `/manager/customers`, `/manager/contracts/:id` | Xem khách & hợp đồng | Đủ thời hạn, trạng thái, tiền | |
| 3.5 | KH | **Yêu cầu trả kho** (chuyển khoản) | TERMINATION_PENDING, task CHECK_OUT | |
| 3.6 | KH | Huỷ yêu cầu trả kho khi đang có ticket hỗ trợ mở | HĐ ACTIVE lại; **ticket hỗ trợ vẫn mở** | |
| 3.7 | FM | Giao task nghiệm thu cho Staff2 | Staff2 thấy task "Đang xử lý" | |
| 3.8 | Staff2 | Nghiệm thu không sự cố | HĐ TERMINATED, ô AVAILABLE, REFUND PENDING + task REFUND | |
| 3.9 | Staff2 | Biến thể: sự cố **vượt cọc** (vd 3.000.000) | Ô MAINTENANCE; phát sinh **khoản nợ** phí sự cố | |
| 3.10 | KH | Đặt kho mới khi còn nợ | 409 `CUSTOMER_HAS_DEBT` | |
| 3.11 | KH · `/thanh-toan` | **Thanh toán VNPAY** khoản nợ | Huỷ trên VNPAY → nợ vẫn còn; trả thành công → "Thanh toán phí sự cố thành công", đặt kho được lại; log `[DEBT_PAID]` | |
| 3.12 | FM · `/manager/refunds` | Hoàn tất task hoàn tiền (mã FT) | **Chỉ** giao dịch của task đó SUCCESS; đơn / hợp đồng khác đang chờ hoàn không bị đổi | |

Ca chi tiết: mục **I**, **J**, **K**.

---

## Flow 4b — Doanh thu & báo cáo hệ thống (BOM)

| # | Màn | Thao tác | Mong đợi | KQ |
|---|---|---|---|---|
| 4.10 | `/bom/revenue` | Chọn kỳ tháng / quý / năm | Doanh thu, phụ phí, hoàn tiền, cọc đang giữ khớp giao dịch ở các flow trên | |
| 4.11 | | Theo cơ sở, theo loại kho, tỷ lệ lấp đầy, tái ký | Tái ký ≤ 100%; cơ sở 0 HĐ hiện 0 | |
| 4.12 | | Chi tiết chứng từ hoàn tiền | Thấy mã FT / ảnh / ghi chú | |
| 4.13 | | **Xuất CSV Đối Soát** | Tải được file, đủ dòng | |
| 4.14 | FM gọi `/bom/revenue/by-facility` | | 403 (chỉ BOM so sánh các cơ sở) | |

---

## Flow 7 — Hỗ trợ & sự cố (nice to have)

| # | Actor | Thao tác | Mong đợi | KQ |
|---|---|---|---|---|
| 7.1 | KH · `/ho-tro` | Ticket **LOCK_ISSUE** | `[KHẨN]` nổi đầu bảng việc | |
| 7.2 | FM | **Giao việc** task SUPPORT cho Staff1 | Ticket IN_PROGRESS | |
| 7.3 | Staff1 | **Cấp lại PIN**, ghi kết quả → Hoàn tất | Ticket RESOLVED | |
| 7.4 | KH | "Chưa xong" → xử lý lại → "Đã ổn" | Ticket CLOSED | |
| 7.5 | FM | Task SUPPORT quá hạn → gia hạn + lý do | Task mở lại | |

Ca chi tiết: mục **M**.

---

## Flow 6 — Gia hạn, quá hạn, miễn phí trễ (nice to have)

| # | Actor · Màn | Thao tác | Mong đợi | KQ |
|---|---|---|---|---|
| 6.1 | KH · trang HĐ ACTIVE | Mở **Gia hạn** | 4 gói, % giảm lấy từ chính sách BOM (mặc định 0/0/5/10%). Số tiền = báo giá backend = số VNPAY thu | |
| 6.2 | Hệ thống | Tua `end_date` = hôm qua → restart BE | HĐ OVERDUE, PIN bị khoá; trang `/thanh-toan` hiện "Hợp đồng quá hạn… GIA HẠN NGAY" | |
| 6.3 | KH | Gia hạn 1 tháng khi quá hạn 3 ngày (Kho nhỏ 500.000) | 500.000 + phí trễ 10% × 3 × 500.000 = **650.000** | |
| 6.4 | FM · `/manager/overdue` | **Miễn phí trễ** + lý do (5–400 ký tự) | Cột phí trễ hiện "Đã miễn"; log `[FEE_WAIVE]` | |
| 6.5 | KH | Mở lại Gia hạn | Dòng "Phí trễ hạn: Đã được quản lý miễn", tổng **500.000** | |
| 6.6 | KH | Trả VNPAY | HĐ ACTIVE; cờ miễn tự tắt | |
| 6.7 | BOM tắt "Cho phép miễn phí trễ" → FM thử miễn | | 403 `WAIVER_NOT_ALLOWED` | |
| 6.8 | FM | Quá hạn 31 ngày → **Thanh lý** | LIQUIDATED, vẫn trừ phí trễ theo D-09 (kể cả đã miễn trước đó) | |

Ca chi tiết: mục **H**, **L**.

---

## Flow 8 — Admin: tài khoản, phân quyền, nhật ký, lịch sử đăng nhập

Đăng nhập `admin@queenkho.com`.

| # | Màn | Thao tác | Mong đợi | KQ |
|---|---|---|---|---|
| 8.1 | `/admin/users` | Tạo tài khoản STAFF / FM gắn cơ sở, BOM | Đăng nhập được, vào đúng portal | |
| 8.2 | | **Đổi cơ sở** của 1 staff → staff đăng nhập lại | Staff chỉ thấy việc của cơ sở mới (phạm vi dữ liệu theo cơ sở được gán) | |
| 8.3 | | **Khoá** tài khoản đang đăng nhập ở tab khác → tab kia bấm bất kỳ | Bị đưa về đăng nhập: "Tài khoản của bạn vừa bị khoá…" | |
| 8.4 | `/admin/roles` | **Ma trận quyền** | Dòng "Đồng bộ với bảng phân quyền backend đang áp dụng (18 nhóm chức năng)"; ô ghi phạm vi: Của chính mình / Cơ sở được gán / Toàn hệ thống | |
| 8.5 | Thử ngoài quyền | KH gọi `/api/v1/staff-tasks`; FM gọi `/api/v1/admin/users` | 403 `FORBIDDEN_ROLE` kèm tên nhóm chức năng | |
| 8.6 | `/admin/logs` | Lọc Hôm nay | Có `[RESERVATION_CREATE]`, `[UNIT_ASSIGN]`, `[TASK_ASSIGN]`, `[FEE_WAIVE]`, `[DEBT_PAID]`… | |
| 8.7 | `/admin/login-history` | Lọc sự kiện / ngày / email / IP | Đăng nhập thành công, **thất bại kèm lý do** (sai mật khẩu, tài khoản khoá), đăng xuất; IP, trình duyệt | |
| 8.8 | `/admin` | Dashboard | Ô "Lượt đăng nhập hôm nay", "Đăng nhập thất bại hôm nay" | |

Ca chi tiết: mục **N**, **O**.

---

## 9. Đối chiếu yêu cầu đề bài → chỗ test

| Vai trò · Yêu cầu | Test ở | Tình trạng |
|---|---|---|
| **KH** Xem cơ sở, loại, size, giá, ô trống | 1.1 | ✅ |
| KH Đặt kho (cơ sở, loại, ngày, kỳ thuê) | 1.2–1.5 | ✅ (chống overbooking) |
| KH Trả cọc / tiền thuê / gia hạn / phụ phí | 1.4, 6.3, 3.11 | ✅ (phụ phí sự cố trả ở `/thanh-toan`) |
| KH Check-in theo lịch hẹn | 2.3, 2.5 | ✅ (chặn check-in trước ngày hẹn) |
| KH Quản lý nhiều kho đang thuê | 3.1–3.3 | ✅ |
| KH Gửi yêu cầu hỗ trợ | 7.1 | ✅ |
| **Staff** Kiểm tra đơn khi khách đến | 2.2 | ✅ |
| Staff Check-in, giao khoá / thẻ / mã | 2.3 | ✅ |
| Staff Cập nhật trạng thái ô | 2.3, 3.8, 3.9 | ✅ (tự động theo nghiệp vụ) |
| Staff Nghiệm thu khi trả kho | 3.8–3.9 | ✅ |
| Staff Xử lý sự cố tại chỗ | 7.3 | ✅ |
| Staff Danh sách việc trong ngày | 2.1 | ✅ |
| **FM** Quản lý ô kho | 5.1–5.3 | ✅ |
| FM Gán ô phù hợp | 1.8–1.10 | ✅ (đúng loại, đúng cơ sở) |
| FM Theo dõi khách, HĐ, kỳ thuê, thanh toán | 3.4, 5.10 | ✅ |
| FM Bàn giao / trả / gia hạn / quá hạn | 2.7–2.8, 3.7, 3.12, 6.4, 6.8 | ✅ |
| FM **Phân công staff** | 5.6–5.8, 3.7, 7.2 | ✅ |
| FM **Báo cáo cơ sở** | 5.10–5.12 | ✅ |
| **BOM** Quản lý cơ sở | 4.1–4.3 | ✅ |
| BOM Chính sách chung | 4.5–4.9 | ✅ |
| BOM Khung giá, phí trễ, **ưu đãi / miễn phí** | 4.4–4.6, 6.4, 6.7 | ✅ |
| BOM Doanh thu, tỷ lệ sử dụng, hiệu quả từng cơ sở | 4.10–4.11 | ✅ |
| BOM Xuất báo cáo | 4.13 | ✅ CSV |
| **Admin** Quản lý tài khoản, gán vai trò | 8.1–8.3 | ✅ |
| Admin **Phân quyền dữ liệu theo vai trò & cơ sở** | 8.2, 8.4, 8.5 | ✅ backend thực thi; ma trận chỉ xem (5 vai trò cố định — PR-A1), phạm vi theo cơ sở gán ở UC-08 |
| Admin **Lịch sử đăng nhập** + nhật ký | 8.6–8.8 | ✅ |

## 10. Dọn dữ liệu sau test
- Chính sách: áp dụng lại **v1** cho Tân Bình (bước 4.8). Script E2E tự làm bước này.
- Dữ liệu khách test: script mục **7** của `kich-ban-test-dat-kho.md`.

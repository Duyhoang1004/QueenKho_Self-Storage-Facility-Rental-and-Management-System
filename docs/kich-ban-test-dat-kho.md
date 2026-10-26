# Kịch bản test toàn luồng Đặt kho → Trả kho / Hỗ trợ

Cập nhật: 25/10/2026 · viết theo code `main` @ `1f99e1b` (#78) **+ nhánh UC-31 chưa merge** (log dời lịch / No-Show ghi đúng FM, màn `/admin/logs`).
Thay cho `test-flow-dat-cho.md` và `test-scenarios.md` (2 file đó viết từ thời SePay, đã lỗi thời).

**Cách đọc**
- Cột **Loại**: `HP` happy case · `BD` biên (boundary) · `NG` dữ liệu sai / sai trạng thái · `PM` phân quyền · `CC` đồng thời / bấm 2 lần · `JOB` job tự chạy · `$` kiểm tra tiền.
- Cột **KQ** để người test điền: ✅ / ❌ / ⚠️.
- 🐞 = **đọc code thấy sẽ fail** (chưa chạy thật). Ghi kết quả thật vào KQ; nếu đúng là lỗi thì chuyển sang mục 6.
- Mỗi bước có cột **Log** = dòng phải thấy ở `/admin/logs` (đăng nhập admin). `—` = hiện chưa ghi log (thiếu so với PR-A9).

---

## 0. Chuẩn bị

### 0.1 Dữ liệu & chạy app
1. DB: chạy `sql_script/QueenKho_full.sql` (DB mới) **hoặc** `Migration_Consolidated_Update.sql` + `Update_unit_types_status.sql` + `Update_vnpay_business_rules.sql` (giữ dữ liệu cũ). Chạy bằng SSMS thì không sao; chạy bằng `sqlcmd` thì **mọi file đều phải thêm `-I`**. Thiếu `-I`, trigger hoàn tiền bị lưu với `QUOTED_IDENTIFIER OFF`, và mọi thao tác cập nhật task (nhận việc, check-in…) sẽ lỗi 500 `UPDATE failed because … 'QUOTED_IDENTIFIER'`.
2. Backend `cd backend/api && ./mvnw spring-boot:run` · Frontend `cd frontend && npm run dev`.
3. `application.yaml` đang để `vnpay.local-return-confirm: true` → khi VNPAY redirect về `/return`, backend tự xác nhận như IPN (vì IPN thật không gọi được về localhost).
4. ⚠️ Token đăng nhập lưu trong RAM backend → **restart backend là phải đăng nhập lại** (nếu không, gọi VNPAY sẽ bị 401).

### 0.2 Tài khoản (mật khẩu đều `123456`)
| Vai trò | Email | Ghi chú |
|---|---|---|
| CUSTOMER | `khachhang1@gmail.com` (id 1) | khách chính |
| CUSTOMER | `khachhang2@gmail.com` (id 2) | khách thứ 2 (test quyền, tranh suất) |
| STAFF | `stafftanbinh1@gmail.com` (12), `stafftanbinh2@gmail.com` (13) | cơ sở 1 – Tân Bình |
| STAFF | 1 staff bất kỳ của cơ sở 2 | test khác cơ sở |
| FACILITY_MANAGER | `fmtanbinh@gmail.com` (6) | cơ sở 1 |
| FACILITY_MANAGER | `fmbinhthanh@gmail.com` (7) | cơ sở 2 – test khác cơ sở |
| ADMIN | `admin@queenkho.com` (31) | xem log |
| BOM | `bom@queenkho.com` (30) | xem doanh thu sau khi thanh toán |

Kho dùng chính: **QueenKho Tân Bình (id 1) – Kho Mini M (unit_type 1, 750.000đ/tháng)**. Trước khi test chạy:
```sql
SELECT id, status FROM storage_units WHERE facility_id = 1 AND unit_type_id = 1;
```
Cần ít nhất 1 ô `AVAILABLE`. Thiếu thì `UPDATE storage_units SET status='AVAILABLE' WHERE id='...'`.

### 0.3 Thẻ test VNPAY sandbox
Ngân hàng **NCB** · Số thẻ `9704198526191432198` · Tên `NGUYEN VAN A` · Ngày phát hành `07/15` · OTP `123456`.

### 0.4 Gọi API bằng curl (Git Bash)
```bash
API=http://localhost:8080/api/v1
# Đăng nhập lấy token (chỉ VNPAY cần token, API khác nhận id qua query/body)
curl -s -X POST $API/auth/login -H "Content-Type: application/json" \
  -d '{"email":"khachhang1@gmail.com","password":"123456"}'
TOKEN=<token trả về>
```

### 0.5 "Tua thời gian" bằng SQL (dùng ở nhiều ca)
| Muốn giả lập | SQL | Sau đó |
|---|---|---|
| Đơn quá 15 phút giữ chỗ | `UPDATE reservations SET created_at = DATEADD(minute,-16,SYSDATETIME()) WHERE id = @r` | đợi ≤ 1 phút (job) |
| Task quá hạn | `UPDATE facility_tasks SET due_at = DATEADD(minute,-1,SYSDATETIME()) WHERE id = @t` | đợi ≤ 1 phút |
| Còn < 24h tới giờ hẹn | `UPDATE reservations SET expected_appointment_time = DATEADD(hour,23,SYSDATETIME()) WHERE id = @r` | gọi cancel-preview |
| Đã qua 48h từ giờ hẹn | `UPDATE reservations SET expected_appointment_time = DATEADD(hour,-49,SYSDATETIME()) WHERE id = @r` | — |
| 2 lần liên hệ cách 24h | sau khi báo cáo 1 lần: `UPDATE activity_logs SET created_at = DATEADD(hour,-25,created_at) WHERE action LIKE '%CONTACT%' AND target_id IN (...)` | báo cáo lần 2 |
| Hợp đồng hết hạn | `UPDATE rental_contracts SET end_date = DATEADD(day,-1,CAST(GETDATE() AS date)) WHERE id = @c` | **restart backend** (job chạy bù lúc khởi động) hoặc đợi 00:05 |
| Quá hạn đủ 30 ngày để thanh lý | `UPDATE rental_contracts SET end_date = DATEADD(day,-31,CAST(GETDATE() AS date)) WHERE id = @c` (HĐ đã `OVERDUE`) | — |
| Ticket RESOLVED quá 3 ngày | `UPDATE support_requests SET resolved_at = DATEADD(day,-4,SYSDATETIME()) WHERE id = @s` | đợi ≤ 1 phút |

### 0.6 SQL soi nhanh trạng thái
```sql
DECLARE @r INT = <reservation_id>;
SELECT id, reservation_code, status, storage_unit_id, deposit_amount, total_deposit_paid, start_date, expected_appointment_time FROM reservations WHERE id = @r;
SELECT id, contract_code, status, start_date, end_date, deposit_held_amount, access_pin_code, rfid_card_code FROM rental_contracts WHERE reservation_id = @r;
SELECT id, transaction_code, payment_type, payment_method, amount, renewal_months, status, paid_at FROM payment_transactions
 WHERE reservation_id = @r OR contract_id IN (SELECT id FROM rental_contracts WHERE reservation_id = @r) ORDER BY id;
SELECT id, task_type, status, staff_id, due_at, completed_at, LEFT(note,120) note FROM facility_tasks
 WHERE contract_id IN (SELECT id FROM rental_contracts WHERE reservation_id = @r) ORDER BY id;
SELECT TOP 20 l.id, u.email, l.action, l.target_entity, l.target_id, l.created_at FROM activity_logs l JOIN users u ON u.id = l.user_id ORDER BY l.id DESC;
```

---

## 1. Sơ đồ trạng thái (đối chiếu khi test)

```
ĐƠN (reservations)
PENDING ──VNPAY OK──► DEPOSIT_PAID ──FM gán ô──► UNIT_ASSIGNED ──KH yêu cầu trả──► TERMINATION_PENDING ──nghiệm thu──► COMPLETED
   │ 15' không trả         │ KH huỷ                  │ No-Show                      │ KH huỷ trả kho → UNIT_ASSIGNED
   ▼                       ▼                         ▼                              │ thanh lý → COMPLETED
EXPIRED              REFUND_PENDING              CANCELLED
   (KH huỷ lúc PENDING → CANCELLED; VNPAY về muộn → REFUND_PENDING)

HỢP ĐỒNG (rental_contracts)
PENDING_CHECK_IN ──check-in──► ACTIVE ──yêu cầu trả──► TERMINATION_PENDING ──nghiệm thu──► TERMINATED
      │ No-Show → TERMINATED     │ hết hạn (job)          │ quá end+5 ngày (job) → OVERDUE
                                 ▼                        │ huỷ trả kho → ACTIVE/OVERDUE
                              OVERDUE ──gia hạn──► ACTIVE
                                 │ ≥ 30 ngày → FM thanh lý → LIQUIDATED

TASK (facility_tasks): OPEN ──nhận──► IN_PROGRESS ──hoàn tất──► COMPLETED
                         ▲ FM gỡ người ┘   quá due_at → OVERDUE (job)    huỷ → CANCELLED
TICKET (support_requests): OPEN → IN_PROGRESS (staff nhận) → RESOLVED → CLOSED (KH "Đã ổn" / 3 ngày tự đóng)
                                                        └─ KH "Chưa xong" → OPEN + task mới
```

---

## 2. Luồng chính E2E (chạy đầu tiên, 1 mạch)

Dùng `khachhang1`, Tân Bình, Kho Mini M, **3 tháng**, ngày bắt đầu = **hôm nay**. Chọn hôm nay để check-in được ngay.

| # | Actor · Màn | Thao tác | Mong đợi (UI + DB) | Log ở `/admin/logs` | KQ |
|---|---|---|---|---|---|
| E1 | KH · `/tim-va-dat-kho` | Tìm TP.HCM, Kho Mini M | Thấy Tân Bình, số ô trống ≥ 1 | — | |
| E2 | KH · `/booking` | Chọn 3 tháng, ngày hôm nay, tick cam kết → Thanh toán | Tạo đơn `RES-xxxxxx` **PENDING**, `deposit_amount = 750.000`; chuyển sang VNPAY sandbox, số tiền **2.787.500** | — *(thiếu log tạo đơn)* | |
| E3 | KH · VNPAY | Trả bằng thẻ NCB | Về `/booking/confirmation` báo thành công; đơn **DEPOSIT_PAID**, `total_deposit_paid = 750.000`; 1 dòng `DEPOSIT / VNPAY / 2.787.500 / SUCCESS` | `[VNPAY] Thanh toán QKD… thành công` · người: khachhang1 · Đơn đặt chỗ #id | |
| E4 | KH · `/kho-cua-toi` | Xem đơn | Nhãn "Đã đặt cọc – chờ gán ô" | — | |
| E5 | FM Tân Bình · `/manager/pending` | Thấy đơn → Gán ô → chọn ô Mini M → Xác nhận | Đơn **UNIT_ASSIGNED** + `storage_unit_id`; ô **OCCUPIED**; HĐ `HD-xxxxxx` **PENDING_CHECK_IN**, `end_date = start + 3 tháng`, `deposit_held_amount = 750.000`; sinh task **CHECK_IN OPEN**, `due_at = hôm nay 21:00` | — *(thiếu log gán ô)* | |
| E6 | Staff1 · `/staff` | Thấy task Check-in → Nhận việc | Task **IN_PROGRESS**, `staff_id = 12` | `[TASK_CLAIM] … task #id (CHECK_IN)` · stafftanbinh1 | |
| E7 | Staff1 · `/staff/tasks/:id` | Tick đủ 5 mục (CCCD, ô trống, sạch, khoá, khách ký), PIN gợi ý 6 số, RFID `RFID-E2E-01` → Hoàn tất bàn giao | Task **COMPLETED**; 1 `handover_records` CHECK_IN; HĐ **ACTIVE** có PIN + RFID | `[CHECK_IN] Check-in HĐ HD-…, ô …` · stafftanbinh1 · Hợp đồng #id | |
| E8 | KH · `/kho-cua-toi/hop-dong/:id` | Xem HĐ | Trạng thái Đang thuê, thấy PIN, RFID, ngày bắt đầu–kết thúc | — | |
| E9 | KH · `/ho-tro` | Tạo ticket loại **LOCK_ISSUE**, mô tả "Không mở được khoá bằng PIN" | Ticket `SR-xxxxxx` **OPEN**, cờ khẩn; task **SUPPORT** note bắt đầu `[KHẨN]`, nổi đầu bảng việc | `[SUPPORT_CREATE] … (LOCK_ISSUE - KHẨN) …` · khachhang1 | |
| E10 | Staff1 | Nhận task SUPPORT | Task IN_PROGRESS, ticket **IN_PROGRESS** | `[TASK_CLAIM] … (SUPPORT)` | |
| E11 | Staff1 | Bấm "Cấp lại PIN" | HĐ có PIN mới 6 số, khác PIN cũ | `[PIN_RESET] …` | |
| E12 | Staff1 | Nhập kết quả "Đã cấp PIN mới, khách mở được" → Hoàn tất | Task COMPLETED; ticket **RESOLVED**, có `resolution_note`, `resolved_at` | `[SUPPORT_RESOLVE] …` | |
| E13 | KH · `/ho-tro` | Bấm "Đã ổn" | Ticket **CLOSED** | `[SUPPORT_CLOSE] …` | |
| E14 | KH · trang HĐ | Yêu cầu trả kho, ngày = hôm nay, chuyển khoản (ngân hàng, STK, chủ TK) | HĐ + đơn **TERMINATION_PENDING**; task **CHECK_OUT OPEN** có note chứa STK | — *(log không có mã)* "Yêu cầu trả kho và hẹn ngày checkout…" | |
| E15 | Staff2 | Nhận task CHECK_OUT | IN_PROGRESS | `[TASK_CLAIM] … (CHECK_OUT)` | |
| E16 | Staff2 | Nghiệm thu: tick CCCD, ô trống, khách ký; sạch = có, khoá = có; không sự cố → Hoàn tất | HĐ **TERMINATED**, PIN/RFID = NULL; đơn **COMPLETED**; ô **AVAILABLE**; `REFUND / BANK_TRANSFER / PENDING`; task **REFUND OPEN** gán sẵn FM | `[CHECK_OUT] Nghiệm thu HĐ …, (Nguyên vẹn), tổng hoàn: …` · stafftanbinh2 | |
| E17 | FM · `/manager/refunds` | Mở task hoàn tiền → nhập mã FT `FT2610001` → Xác nhận | Task **COMPLETED**; giao dịch REFUND → **SUCCESS** | `[REFUND] Quản lý … xác nhận hoàn tất hoàn tiền task #… (Chuyển khoản FT2610001)` · fmtanbinh | |
| E18 | Admin · `/admin/logs` | Lọc Đối tượng = Hợp đồng, mã = id HĐ | Thấy đủ CHECK_IN → PIN_RESET… → CHECK_OUT theo thứ tự thời gian | — | |
| E19 | BOM · `/bom/revenue` | Xem doanh thu hôm nay | Có khoản 2.787.500 của cơ sở Tân Bình | — | |

**$ E16 – số tiền hoàn mong đợi** (trả sớm ngay trong ngày bắt đầu, HĐ 3 tháng):
`rentPaid = 2.787.500 − 750.000 = 2.037.500`, đã dùng 1 tháng = 750.000, phí huỷ HĐ = 750.000 → hoàn tiền thuê = 537.500; cộng cọc 750.000 → **thực hoàn 1.287.500**.

---

## 3. Ca test theo giai đoạn

### A. Tìm kho & tạo đơn (UC-09, UC-10) — `POST /reservations`
| ID | Loại | Bước | Mong đợi | KQ |
|---|---|---|---|---|
| A01 | HP | Tìm không lọc | Chỉ cặp cơ sở × loại kho còn ô; loại kho `INACTIVE` không hiện | |
| A02 | HP | Lọc thành phố / quận / loại / giá / diện tích | Mọi kết quả thoả điều kiện | |
| A03 | NG | Từ khoá `xyz` | Màn rỗng, không lỗi | |
| A04 | $ | Kho Mini M 1 / 3 / 6 / 12 tháng | Tổng lần đầu **1.400.000 / 2.787.500 / 4.700.000 / 8.300.000** (= giá×tháng − giảm 0/5/10/15% + cọc − voucher 100.000) | |
| A05 | $ | Kho nhỏ 2m² (500.000) 1 tháng · Kho Tiêu Chuẩn (1.850.000) 1 tháng | **900.000** · **3.600.000** | |
| A06 | BD | Ngày bắt đầu = hôm nay | Tạo được (BE cho hôm nay) | |
| A07 | BD | Ngày bắt đầu = hôm qua (API) | 400 "Ngày bắt đầu không được ở quá khứ" | |
| A08 | BD | `durationMonths` = 0 / −1 | 400 "Thời gian thuê phải tối thiểu 1 tháng" | |
| A09 | BD | `durationMonths` = 2, 5 (không phải gói) | Tạo được, giảm giá 0% | |
| A10 | NG | Thiếu `facilityId` / `unitTypeId` | 400 "Vui lòng chọn cơ sở và loại kho" | |
| A11 | NG | `facilityId` = 9999 | 400 "Cơ sở không tồn tại" | |
| A12 | NG | Loại kho đang `INACTIVE` (BOM tắt ở `/bom/unit-types`) | 400 "Loại kho này hiện đang tạm ngưng…" | |
| A13 | NG | Khách có HĐ `OVERDUE` hoặc nợ `DAMAGE_FEE PENDING` (xem J07) | 409 `CUSTOMER_HAS_DEBT` | |
| A14 | NG | FE: bỏ tick cam kết / không chọn ngày / xoá tên–SĐT | Báo lỗi tại form, không gọi API | |
| A15 | 🐞 CC | Cặp còn **1** ô: KH1 và KH2 cùng đặt | Mong đợi: người thứ 2 bị chặn (PR-B1). Code không đếm suất → cả 2 tạo được đơn (L-13) | |
| A16 | PM | Chưa đăng nhập vào `/booking` | Bị đưa về đăng nhập, không đặt hộ user khác | |

### B. Thanh toán cọc VNPAY (UC-11, EX-01, EX-02) — `POST /api/payments/vnpay/create`
| ID | Loại | Bước | Mong đợi | KQ |
|---|---|---|---|---|
| B01 | HP | Như E2–E3 | Đơn DEPOSIT_PAID, 1 giao dịch SUCCESS, log `[VNPAY] … thành công` | |
| B02 | NG | Trên VNPAY bấm **Huỷ giao dịch** | Về trang báo thất bại; giao dịch **FAILED**; đơn vẫn **PENDING** (còn giữ chỗ); log `[VNPAY] Giao dịch … thất bại; đơn vẫn giữ chỗ…` | |
| B03 | HP | Sau B02, trong 15' bấm thanh toán lại | Link mới; giao dịch cũ vẫn FAILED, chỉ 1 giao dịch PENDING; trả thành công → DEPOSIT_PAID | |
| B04 | CC | Bấm "Thanh toán" 2 lần (2 link) rồi trả bằng link **đầu** | Link 1 đã bị FAILED khi tạo link 2 → tiền về sau: giao dịch 1 SUCCESS + sinh **REFUND PENDING** `REF-LATE-…` + task REFUND; đơn vẫn chờ link 2 (PR-R5) | |
| B05 | BD/JOB | Tạo đơn, **không trả**, tua `created_at` −16' | ≤ 1 phút: đơn **EXPIRED**, giao dịch PENDING → FAILED; ô trống lại hiện ở tìm kiếm | |
| B06 | BD | Đơn tạo được 14' → tạo link | Link VNPAY có `vnp_ExpireDate` ≤ mốc 15' của đơn (xem query string) | |
| B07 | BD | Tua `created_at` −16' rồi gọi `/vnpay/create` (chưa đợi job) | 409 "Đơn đã hết 15 phút giữ chỗ"; đơn → EXPIRED | |
| B08 | NG | Gọi `/vnpay/create` không có header Authorization | 401 "Vui lòng đăng nhập lại" | |
| B09 | PM | Token của KH2, `reservationId` của KH1 | 403 "Bạn không có quyền thanh toán đơn này" | |
| B10 | NG | `reservationId` của đơn đã DEPOSIT_PAID | 400 "Đơn đặt chỗ không hợp lệ" | |
| B11 | NG | Gọi `/return` hoặc `/ipn` với `vnp_SecureHash` sai | `/ipn` trả `RspCode 97`; `/return` 400 "Sai chữ ký bảo mật"; DB không đổi | |
| B12 | NG | IPN đúng chữ ký nhưng `vnp_Amount` lệch | `RspCode 04 Invalid amount`; DB không đổi | |
| B13 | CC | Gọi lại `/return` của giao dịch đã SUCCESS (F5 trang xác nhận) | `RspCode 02 Already confirmed`; **không** sinh giao dịch thứ 2 | |
| B14 | BD | Trả xong sau khi đơn đã EXPIRED (tua −16' **sau** khi tạo link, rồi mới trả) | Giao dịch SUCCESS + REFUND PENDING `REF-LATE-…`; đơn **REFUND_PENDING**; task REFUND cho FM | |

> Muốn giả lập IPN (B11, B12) mà không qua VNPAY: tạo chữ ký HMAC-SHA512 bằng `hash-secret` sandbox trong `application.yaml`. Đoạn Node mẫu ở **Phụ lục A**.

### C. Huỷ đơn (UC-12 / UC-15) — `GET /reservations/{id}/cancel-preview`, `POST /{id}/cancel`
| ID | Loại | Bước | Mong đợi | KQ |
|---|---|---|---|---|
| C01 | HP | Huỷ đơn **PENDING** | Đơn **CANCELLED**, không sinh REFUND | |
| C02 | $ | Đơn DEPOSIT_PAID (3 tháng, 2.787.500), giờ hẹn còn **> 24h** (ngày bắt đầu ≥ ngày kia) → preview | `penalty 0`, `refund 2.787.500` | |
| C03 | $ BD | Tua giờ hẹn còn **23h** → preview | `penalty 375.000` (50% cọc), `refund 2.412.500` | |
| C04 | BD | Tua giờ hẹn còn **25h** → preview | Hoàn 100% | |
| C05 | HP | Huỷ C02 kèm thông tin ngân hàng | Đơn **REFUND_PENDING**; `REFUND / BANK_TRANSFER / PENDING`; task REFUND note `[HOÀN CỌC CK] …STK…`, hạn 24h (bỏ Chủ Nhật) | |
| C06 | HP | Huỷ không nhập ngân hàng | Note `[HOÀN CỌC TIỀN MẶT]` | |
| C07 | NG | Huỷ đơn UNIT_ASSIGNED / CANCELLED / EXPIRED | 400 "Trạng thái đơn không hợp lệ để hủy" | |
| C08 | CC | Bấm huỷ 2 lần | Lần 2 lỗi trạng thái, chỉ 1 REFUND | |
| C09 | 🐞 PM | KH2 gọi `POST /reservations/{id KH1}/cancel` | Mong đợi 403; code không kiểm tra chủ đơn | |
| C10 | Log | | Log: "Người dùng ID … yêu cầu hủy đơn …" (**không có mã** `[...]`) | |

### D. Gán ô (UC-13, UC-14) — `/manager/pending`
| ID | Loại | Bước | Mong đợi | KQ |
|---|---|---|---|---|
| D01 | HP | Như E5 | Xem E5 | |
| D02 | PM | FM Bình Thạnh mở `/manager/pending` | Không thấy đơn Tân Bình | |
| D03 | NG | Gán đơn PENDING / đã UNIT_ASSIGNED | 400 "Đơn đặt chỗ chưa thanh toán cọc hoặc đã được gán ô" | |
| D04 | NG | Gán ô OCCUPIED / MAINTENANCE | 400 "Ô kho này hiện không khả dụng…" | |
| D05 | NG | Body `{}` | 400 "Vui lòng chọn ô kho thực tế" | |
| D06 | CC | 2 tab FM gán cùng 1 ô cho 2 đơn | Tab 2 báo ô không khả dụng | |
| D07 | 🐞 BD | Hết ô Mini M → mở danh sách ô | Mong đợi: rỗng (BR-41). Code gợi ý **ô loại khác** cùng cơ sở (L-11) | |
| D08 | 🐞 PM | API gán ô của **cơ sở 2** cho đơn cơ sở 1 | Mong đợi 400. Code không kiểm tra cơ sở / loại | |
| D09 | BD | Gán ô khi đã quá 21:00 ngày hẹn | Task CHECK_IN `due_at` = 21:00 hôm nay (nếu trước 21h) hoặc hôm sau (BR-61) | |

### E. Bảng việc · nhận việc · gỡ người (UC-16, UC-17)
| ID | Loại | Bước | Mong đợi | KQ |
|---|---|---|---|---|
| E01 | HP | Staff1 nhận task OPEN | IN_PROGRESS, log `[TASK_CLAIM]` | |
| E02 | CC | Staff1 và Staff2 bấm Nhận **cùng lúc** | 1 người thành công, người kia 409 `TASK_ALREADY_CLAIMED` | |
| E03 | NG | Nhận task đã IN_PROGRESS / COMPLETED / CANCELLED | 409 `TASK_ALREADY_CLAIMED` / `TASK_NOT_CLAIMABLE` | |
| E04 | BD/JOB | Tua `due_at` −1' cho task OPEN | ≤ 1': **OVERDUE**; nhận → 409 `TASK_OVERDUE` | |
| E05 | PM | FM nhận task CHECK_IN | 403 "Chỉ nhân viên mới được nhận việc này" | |
| E06 | PM | Staff cơ sở 2 nhận task cơ sở 1 (API) | 403 `FORBIDDEN_FACILITY` | |
| E07 | HP | FM gỡ Staff1 khỏi task IN_PROGRESS | Task OPEN, `staff_id` NULL; log `[TASK_UNASSIGN]` · fmtanbinh | |
| E08 | NG | Gỡ task OPEN / OVERDUE / COMPLETED | 409 `TASK_NOT_ASSIGNED` / `TASK_OVERDUE` / `TASK_NOT_UNASSIGNABLE` | |
| E09 | PM | Staff gọi unassign | 403 | |
| E10 | HP | Task SUPPORT bị gỡ người | Ticket IN_PROGRESS → **OPEN** | |
| E11 | HP | Lọc bảng việc theo trạng thái; task khẩn `[KHẨN]` nằm đầu | | |

### F. Check-in & biên bản bàn giao (UC-18) — `POST /staff-tasks/{id}/check-in?staffId=`
Body mẫu: `{"identityVerified":true,"unitEmpty":true,"unitClean":true,"lockIntact":true,"customerSignatureConfirmed":true,"accessPinCode":"123456","rfidCardCode":"RFID-01","notes":"ok"}`

| ID | Loại | Bước | Mong đợi | KQ |
|---|---|---|---|---|
| F01 | HP | Như E7 | Xem E7 | |
| F02 | NG | Bỏ 1 trong 5 mục | 400 `CHECKLIST_INCOMPLETE` "Phải hoàn thành đủ 5 mục…" | |
| F03 | BD | PIN `12345` / `1234567` / `12a456` | 400 "Mã PIN phải gồm đúng 6 chữ số" | |
| F04 | BD | PIN `000000` / `999999` | Hợp lệ | |
| F05 | BD | RFID rỗng · RFID 50 ký tự · 51 ký tự | 400 · OK · 400 "tối đa 50 ký tự" | |
| F06 | BD | Ghi chú 1000 · 1001 ký tự | OK · 400 | |
| F07 | NG | PIN trùng PIN của HĐ đang ACTIVE / OVERDUE / TERMINATION_PENDING khác | 409 `PIN_TAKEN` (không có gì bị lưu) | |
| F08 | NG | RFID trùng HĐ đang hiệu lực | 409 `RFID_TAKEN` | |
| F09 | NG | Check-in task chưa nhận (OPEN) | 409 "Bạn cần nhận việc trước khi lập biên bản" | |
| F10 | PM | Staff2 check-in task Staff1 đang giữ | 409 `TASK_NOT_YOURS` | |
| F11 | BD | Task đã quá `due_at` | 409 `TASK_OVERDUE` | |
| F12 | CC | Bấm Hoàn tất 2 lần | Lần 2 409 `TASK_ALREADY_COMPLETED`; chỉ 1 biên bản | |
| F13 | NG | Gọi check-in cho task CHECK_OUT / SUPPORT | 409 `TASK_NOT_CHECK_IN` | |
| F14 | PM | FM gọi check-in | 403 | |
| F15 | HP | `GET /staff-tasks/pin-suggestion` | Trả 6 số, không trùng PIN đang dùng | |
| F16 | 🐞 BD | Đơn có ngày bắt đầu = **ngày mai**, check-in **hôm nay** | Mong đợi: chặn (PR-C1). Code cho check-in trước ngày hẹn (L-17) | |

### G. No-Show & dời lịch (EX-03) — `/manager/pending` (tab No-Show)
Chuẩn bị: đơn UNIT_ASSIGNED, HĐ PENDING_CHECK_IN, **chưa** check-in. Tua giờ hẹn −49h (để đơn hiện ở danh sách No-Show).

| ID | Loại | Bước | Mong đợi | KQ |
|---|---|---|---|---|
| G01 | HP | Staff báo cáo liên hệ "Không nghe máy" | Log `[CONTACT][FAILED] …` (2 dòng: task + đơn) | |
| G02 | BD | Mới 1 lần liên hệ thất bại → bấm No-Show | 409 `NO_SHOW_NOT_ALLOWED_YET` "Cần tối thiểu 2 lần… (1/2)" | |
| G03 | BD | 2 lần cách nhau < 24h | 409 "…phải cách nhau tối thiểu 24 giờ" | |
| G04 | BD | 2 lần trong vòng 10 phút | Chỉ tính **1** lần | |
| G05 | BD | Đủ 2 lần cách ≥ 24h nhưng giờ hẹn mới qua 47h | 409 "Chưa đủ 48 giờ kể từ giờ hẹn…" | |
| G06 | HP $ | Đủ điều kiện → No-Show (không miễn phạt), đơn 3 tháng | Đơn **CANCELLED**; HĐ **TERMINATED**; ô **AVAILABLE**; task CHECK_IN **CANCELLED**; REFUND tiền thuê **2.037.500** (giữ cọc 750.000) | `[NO-SHOW] Hủy đơn …` · người: **fmtanbinh** | |
| G07 | $ | Như G06 nhưng tick **miễn phạt** + lý do | Hoàn **2.787.500** (100%) | |
| G08 | NG | Miễn phạt nhưng bỏ trống lý do (FE) | Báo lỗi tại modal | |
| G09 | NG | Gọi API No-Show thiếu `staffId` | 400 "Thiếu người thao tác (staffId)" | |
| G10 | HP | Liên hệ được khách → Dời lịch sang ngày mới | `start_date` đơn + HĐ đổi, `end_date` dời theo; task CHECK_IN OVERDUE → OPEN/IN_PROGRESS, `due_at` = 21:00 ngày mới | `[RESCHEDULE] Dời ngày hẹn …` · người: **fmtanbinh** (UC-31) | |
| G11 | BD | Dời lịch về ngày quá khứ | 400 "Ngày nhận kho mới không được ở trong quá khứ" | |
| G12 | NG | Dời lịch đơn CANCELLED / COMPLETED | 400 "Đơn ở trạng thái này không thể dời lịch hẹn" | |
| G13 | NG | API dời lịch thiếu `managerId` | 400 "Thiếu người thao tác (managerId)" | |

### H. Gia hạn (UC-21) — trang HĐ của khách, `POST /api/payments/vnpay/create-renewal`
| ID | Loại | Bước | Mong đợi | KQ |
|---|---|---|---|---|
| H01 | HP $ | HĐ ACTIVE Mini M, gia hạn **1 / 3 / 6 / 12** tháng | Số tiền **750.000 / 2.250.000 / 4.275.000 / 8.100.000** | |
| H02 | HP | Trả thành công 3 tháng | `end_date` + 3 tháng; `MONTHLY_RENT SUCCESS`, `renewal_months = 3` | `[RENEW] Gia hạn hợp đồng … thêm 3 tháng…` + `[VNPAY] … thành công` | |
| H03 | BD | `months` = 2 / 0 / null | 400 `INVALID_INPUT` "Chỉ chấp nhận các gói 1, 3, 6, 12 tháng" | |
| H04 | NG | HĐ PENDING_CHECK_IN / TERMINATED / LIQUIDATED | 409 `CONTRACT_NOT_RENEWABLE` | |
| H05 | PM | Token KH2 gia hạn HĐ KH1 | 403 | |
| H06 | $ | HĐ **OVERDUE** 3 ngày, cọc 750.000, gia hạn 1 tháng | Tiền thuê 750.000 + phí trễ **225.000** (10%/ngày × 3) = **975.000**; 2 dòng PENDING `QKR…` + `LFQKR…` | |
| H07 | $ BD | OVERDUE 7 ngày | Phí trễ chặn ở 5 ngày = **375.000** (trần 50% cọc) | |
| H08 | HP | Trả H06 | HĐ **ACTIVE**, `end_date` = hôm nay + 1 tháng; task CHECK_OUT đang mở → CANCELLED | |
| H09 | HP | Gia hạn khi TERMINATION_PENDING | HĐ ACTIVE, đơn UNIT_ASSIGNED, task CHECK_OUT + REFUND đang mở → CANCELLED | |
| H10 | CC | Tạo 2 link gia hạn, trả link đầu | Link đầu đã FAILED → tiền về: hoàn tiền `REF-LATE-…`, **không** cộng thêm tháng | |
| H11 | ⚠️ | So sánh giảm giá | Gia hạn giảm 0/0/5/10% ≠ đặt mới 0/5/10/15% → **hỏi lại nghiệp vụ** | |

### I. Yêu cầu / huỷ trả kho (UC-22) — trang HĐ, `POST /contracts/{id}/request-checkout`
| ID | Loại | Bước | Mong đợi | KQ |
|---|---|---|---|---|
| I01 | HP | HĐ ACTIVE, ngày = `end_date` | TERMINATION_PENDING, task CHECK_OUT `due_at` = 21:00 ngày đó | |
| I02 | BD | Ngày = `end_date + 5` | OK | |
| I03 | BD | Ngày = `end_date + 6` | 400 "…không được vượt quá 5 ngày ân hạn…" | |
| I04 | BD | Ngày = hôm qua | 400 "…không thể là ngày trong quá khứ" | |
| I05 | ⚠️ BD | Ngày = hôm nay | Code cho phép; PR-O1 ghi "từ ngày mai" → xác nhận nghiệp vụ | |
| I06 | BD | HĐ OVERDUE, ngày = hôm nay + 3 · + 4 | OK · 400 "…tối đa 3 ngày tới…" | |
| I07 | HP | Đang TERMINATION_PENDING, dời **sớm hơn** | OK, task dời hạn + đổi note | |
| I08 | BD | Dời **muộn hơn** ngày đã hẹn | 400 "Không thể dời ngày qua sau…" | |
| I09 | NG | HĐ PENDING_CHECK_IN / TERMINATED | 400 "Hợp đồng không ở trạng thái có thể trả kho" | |
| I10 | HP | Huỷ yêu cầu trả kho (chưa nghiệm thu) | HĐ về ACTIVE (hoặc OVERDUE nếu đã qua `end_date`); đơn UNIT_ASSIGNED; task CHECK_OUT CANCELLED | |
| I11 | NG | Huỷ sau khi đã nghiệm thu | 400 "…đã được nhân viên hoàn tất nghiệm thu…" | |
| I12 | 🐞 | Có ticket hỗ trợ đang mở → huỷ yêu cầu trả kho | Code gọi `closeOpenSupportTicketsAndTasks` → **ticket bị đóng** dù khách vẫn thuê. Kiểm tra lại | |
| I13 | 🐞 PM | KH2 gọi request-checkout / cancel-checkout HĐ của KH1 | Mong đợi 403; code không kiểm tra chủ HĐ | |
| I14 | Log | | "Yêu cầu trả kho…" / "Khách hàng hủy yêu cầu trả kho…" — **không có mã** | |
| I15 | JOB | TERMINATION_PENDING, tua `end_date` = hôm nay − 6 → restart BE | HĐ **OVERDUE**, đơn UNIT_ASSIGNED, task CHECK_OUT CANCELLED; log `[OVERDUE] … quá 5 ngày ân hạn…` · người **Hệ thống** | |

### J. Nghiệm thu trả kho & sự cố (UC-23, UC-24) — `POST /staff-tasks/{id}/check-out`
Số liệu mẫu: Mini M, cọc 750.000. Với J01–J03: tua `end_date` của HĐ (`= hôm nay`, `hôm nay − 1`, `hôm nay − 3`) **trước** khi khách yêu cầu trả kho với ngày = hôm nay, rồi nghiệm thu trong ngày.

| ID | Loại | Bước | Mong đợi | KQ |
|---|---|---|---|---|
| J01 | HP $ | Trả **đúng `end_date`**, không sự cố | Hoàn **750.000** (cọc); ô AVAILABLE | |
| J02 | $ BD | Trả `end_date + 1` (tua `end_date` −1) | Không phí, hoàn 750.000 | |
| J03 | $ BD | Trả `end_date + 3` | Phí ân hạn 25.000 × 2 = **50.000** → hoàn **700.000**; dòng `LATE_FEE / DEPOSIT_OFFSET` 50.000 | |
| J04 | $ | Trả sớm HĐ **12 tháng** ngay ngày đầu (không sự cố) | rentPaid 7.550.000 − dùng 750.000 − phí huỷ 750.000 = 6.050.000 + cọc 750.000 → **6.800.000** | |
| J05 | HP $ | Sạch = **không**, 1 sự cố "Bẩn sàn" 300.000 + ảnh | Ô **MAINTENANCE** + task **MAINTENANCE**; `damage_cases` 1 dòng; `DAMAGE_FEE / DEPOSIT_OFFSET` 300.000; hoàn **450.000** | |
| J06 | $ BD | Sự cố đúng 750.000 | Hoàn 0, không nợ; vẫn tạo task REFUND (để FM đóng hồ sơ) | |
| J07 | $ | Sự cố 1.000.000 | Hoàn 0; `DAMAGE_FEE / VNPAY / PENDING` **250.000** → khách đặt kho mới bị 409 `CUSTOMER_HAS_DEBT` (A13) | |
| J08 | NG | Bỏ tick CCCD / ô trống / khách ký | 400 `CHECKLIST_INCOMPLETE` (từng câu riêng) | |
| J09 | NG | Không chọn sạch / khoá (null) | 400 "…đánh giá đầy đủ tình trạng vệ sinh và khoá…" | |
| J10 | NG | Khoá = không, không thêm sự cố | 400 `DAMAGE_REPORT_REQUIRED` | |
| J11 | NG | Sự cố không ảnh | 400 `EVIDENCE_IMAGE_REQUIRED` | |
| J12 | BD | Tiêu đề 150 · 151 ký tự · chi phí −1 · chi phí 0 | OK · 400 · 400 · OK | |
| J13 | HP | Có ticket còn mở lúc nghiệm thu | Ticket **CLOSED**, task SUPPORT **CANCELLED** (PR-S8) | |
| J14 | NG/PM | Chưa nhận / người khác giữ / quá hạn / bấm 2 lần | 409 như F09–F12 | |
| J15 | HP | Log | `[CHECK_OUT] … (1 sự cố, phí 300.000đ), tổng hoàn: 450.000đ` | |

### K. Hoàn tiền (UC-25) — `/manager/refunds`, `POST /staff-tasks/{id}/complete-refund?managerId=`
| ID | Loại | Bước | Mong đợi | KQ |
|---|---|---|---|---|
| K01 | HP | Chuyển khoản + mã FT | Task COMPLETED, REFUND SUCCESS, log `[REFUND]` | |
| K02 | HP | Chuyển khoản, chỉ upload ảnh biên lai | OK, note ghi `UNC-IMAGE` | |
| K03 | NG | Chuyển khoản, không FT, không ảnh | 400 `REFUND_EVIDENCE_REQUIRED` | |
| K04 | HP | Task tiền mặt + tick "khách đã ký nhận" | OK, phương thức CASH | |
| K05 | NG | Tiền mặt, không tick, không ảnh, không ghi chú | 400 `REFUND_EVIDENCE_REQUIRED` | |
| K06 | NG | Hoàn tất task đã COMPLETED | 400 `TASK_ALREADY_CLOSED` | |
| K07 | PM | Staff gọi / FM cơ sở 2 gọi | 403 / 403 `FORBIDDEN_FACILITY` | |
| K08 | 🐞 | Tạo **2** đơn huỷ (C05) ở cùng cơ sở → hoàn tất task của đơn **thứ nhất** | Mong đợi: chỉ REFUND của đơn 1 SUCCESS. Code (task không gắn HĐ) update **mọi** REFUND PENDING của cơ sở → đơn 2 cũng SUCCESS dù chưa hoàn | |

### L. Quá hạn & thanh lý (UC-28) — `/manager/overdue`
| ID | Loại | Bước | Mong đợi | KQ |
|---|---|---|---|---|
| L01 | JOB | HĐ ACTIVE, `end_date` = hôm qua → restart BE | HĐ **OVERDUE**; log `[OVERDUE] Hợp đồng … chuyển sang QUÁ HẠN…` · **Hệ thống** | |
| L02 | JOB | Restart lần 2 cùng ngày | Không sinh log trùng | |
| L03 | HP | KH xem HĐ OVERDUE | PIN bị khoá (ẩn), có nút gia hạn kèm phí trễ | |
| L04 | HP | FM ghi nhật ký liên hệ | Log `[OVERDUE_CONTACT] HĐ …: …`; danh sách tăng `contactCount` | |
| L05 | BD | Ghi chú rỗng · 400 · 401 ký tự | 400 · OK · 400 | |
| L06 | NG | Ghi liên hệ cho HĐ ACTIVE | 409 `CONTRACT_NOT_OVERDUE` | |
| L07 | BD | Thanh lý khi quá hạn 29 ngày | 409 `LIQUIDATION_NOT_ALLOWED_YET` (ngưỡng 30) | |
| L08 | HP $ | Quá hạn 31 ngày → thanh lý (ghi chú bắt buộc) | HĐ **LIQUIDATED**, PIN/RFID NULL, `deposit_held_amount` = 750.000 − 375.000 = **375.000**; đơn COMPLETED; ô MAINTENANCE; log `[LIQUIDATION]` | |
| L09 | HP | Hoàn cọc còn lại | Task REFUND 375.000, log `[REFUND_REQUEST]` | |
| L10 | NG | Hoàn cọc lần 2 · HĐ chưa thanh lý | 409 `REFUND_ALREADY_REQUESTED` · 409 `CONTRACT_NOT_LIQUIDATED` | |
| L11 | PM | FM cơ sở 2 thanh lý HĐ cơ sở 1 · Staff gọi | 403 `FORBIDDEN_FACILITY` · 403 `FORBIDDEN_ROLE` | |

### M. Hỗ trợ (UC-26, UC-27) — `/ho-tro`, bảng việc
| ID | Loại | Bước | Mong đợi | KQ |
|---|---|---|---|---|
| M01 | HP | Danh sách HĐ chọn được khi tạo ticket | Chỉ HĐ ACTIVE / OVERDUE / TERMINATION_PENDING của chính khách | |
| M02 | BD | Mô tả 9 · 10 · 1000 · 1001 ký tự | 400 · OK · OK · 400 | |
| M03 | NG | Loại `ABC` | 400 "Loại yêu cầu hỗ trợ không hợp lệ…" | |
| M04 | NG | Ticket thứ 2 **cùng loại** trên cùng HĐ khi ticket 1 còn mở | 409 `DUPLICATE_ISSUE_TYPE` | |
| M05 | BD | Ticket mở thứ 4 trên 1 HĐ (3 loại khác nhau đang mở) | 409 `MAX_OPEN_TICKETS_REACHED` | |
| M06 | NG | HĐ PENDING_CHECK_IN / TERMINATED | 409 `CONTRACT_STATUS_INVALID` | |
| M07 | PM | KH2 tạo ticket trên HĐ KH1 | 403 `FORBIDDEN_CONTRACT` | |
| M08 | HP | Loại SECURITY / LOCK_ISSUE | Task note `[KHẨN]`, nổi đầu bảng; loại khác thì không | |
| M09 | HP | KH huỷ ticket OPEN | CLOSED, task CANCELLED, log `[SUPPORT_CANCEL]` | |
| M10 | NG | Huỷ ticket IN_PROGRESS | 409 `TICKET_NOT_CANCELLABLE` | |
| M11 | NG | Staff hoàn tất, kết quả rỗng · 1001 ký tự | 400 | |
| M12 | NG | Cấp lại PIN cho ticket **không** phải LOCK_ISSUE | 409 `INVALID_ISSUE_TYPE` | |
| M13 | NG | Cấp lại PIN khi HĐ OVERDUE | 409 `CONTRACT_OVERDUE` | |
| M14 | HP | KH bấm "Chưa xong" + lý do | Ticket OPEN, task SUPPORT **mới** note `[Yêu cầu xử lý lại] …`; log `[SUPPORT_REOPEN]` | |
| M15 | BD | "Chưa xong" lý do rỗng · 501 ký tự | 400 | |
| M16 | NG | Confirm / reopen ticket chưa RESOLVED | 409 `INVALID_TICKET_STATUS` | |
| M17 | JOB | Tua `resolved_at` −4 ngày | ≤ 1': CLOSED, log `[SUPPORT_AUTO_CLOSE]` · **Hệ thống** | |
| M18 | HP | Task SUPPORT quá hạn → FM gia hạn (ngày mới + lý do) | Task về OPEN/IN_PROGRESS (giữ người nhận), log `[SUPPORT_EXTEND]` | |
| M19 | NG | Gia hạn task chưa quá hạn · ngày quá khứ · thiếu lý do · lý do 501 ký tự | 409 `TASK_NOT_OVERDUE` · 400 · 400 · 400 | |
| M20 | NG | Staff hoàn tất task SUPPORT đã OVERDUE | 409 `TASK_OVERDUE` | |

### N. Nhật ký hoạt động (UC-31) — `/admin/logs`, đăng nhập admin
| ID | Loại | Bước | Mong đợi | KQ |
|---|---|---|---|---|
| N01 | HP | Sau mục 2, lọc **Hôm nay** | Đủ các dòng có mã ở cột Log của mục 2, mới nhất trên cùng | |
| N02 | HP | Bấm tên `stafftanbinh1` | Chỉ log của staff1 (TASK_CLAIM, CHECK_IN, PIN_RESET, SUPPORT_RESOLVE) | |
| N03 | HP | Bấm `#id` hợp đồng ở 1 dòng | Mọi log của HĐ đó (CHECK_IN, CHECK_OUT, RENEW, OVERDUE…) | |
| N04 | HP | Gõ `[CHECK_IN]` vào ô nội dung | Chỉ log check-in (ký tự `[` không bị hiểu là wildcard) | |
| N05 | HP | Lọc vai trò = Quản lý cơ sở | Chỉ NO-SHOW, RESCHEDULE, TASK_UNASSIGN, REFUND, OVERDUE_CONTACT, LIQUIDATION… | |
| N06 | HP | Log job (L01, I15, M17) | Người thao tác hiện **"Hệ thống · Tự động"** | |
| N07 | HP | Dashboard `/admin` | "Hoạt động hôm nay" = số dòng N01; 10 log gần nhất khớp | |
| N08 | PM | Đăng nhập FM vào `/admin/logs` · API `?actorUserId=6` | Bị đá khỏi portal · 403 `FORBIDDEN_ROLE` | |
| N09 | Log | Đăng nhập / đăng xuất | **Không** sinh log | |

### O. Phân quyền chéo màn hình
| ID | Loại | Bước | Mong đợi | KQ |
|---|---|---|---|---|
| O01 | PM | KH gõ `/manager/pending`, `/staff`, `/admin` | Bị chuyển về trang của role mình | |
| O02 | PM | Staff gõ `/manager/...` · FM gõ `/staff` | Bị chuyển | |
| O03 | PM | Tài khoản bị khoá (UC-08) đăng nhập | Bị chặn, báo khoá | |
| O04 | 🐞 | Menu KH "Thanh toán" (`/thanh-toan`), menu FM "Báo cáo cơ sở" (`/manager/reports`) | Chưa có route → link chết | |

---

## 4. Bảng log mong đợi theo bước (để đối chiếu nhanh ở `/admin/logs`)

| Sự kiện | Mã / nội dung | Người thao tác | Đối tượng |
|---|---|---|---|
| Đăng ký, đăng nhập | — | | |
| Tạo đơn | — *(thiếu, PR-A9)* | | |
| VNPAY thành công / thất bại / về muộn | `[VNPAY] …` | khách | reservations / rental_contracts |
| Hết 15' giữ chỗ | — *(thiếu, PR-A9)* | | |
| Huỷ đơn | không mã "Người dùng ID … yêu cầu hủy đơn …" | khách | reservations |
| Gán ô | — *(thiếu, PR-A9)* | | |
| Nhận việc / gỡ người | `[TASK_CLAIM]` / `[TASK_UNASSIGN]` | staff / FM | facility_tasks |
| Check-in | `[CHECK_IN]` | staff | rental_contracts |
| Báo cáo liên hệ | `[CONTACT][FAILED]` / `[CONTACT][SUCCESS]` (2 dòng) | staff | facility_tasks + reservations |
| No-Show / dời lịch | `[NO-SHOW]` / `[RESCHEDULE]` | **FM** | reservations |
| Gia hạn | `[RENEW]` + `[VNPAY]` | khách | rental_contracts |
| Yêu cầu / huỷ trả kho | không mã | khách | rental_contracts |
| Nghiệm thu | `[CHECK_OUT]` | staff | rental_contracts |
| Hoàn tiền | `[REFUND]` | FM | facility_tasks |
| Chuyển quá hạn | `[OVERDUE]` | **Hệ thống** | rental_contracts |
| Liên hệ quá hạn / thanh lý / lệnh hoàn cọc | `[OVERDUE_CONTACT]` / `[LIQUIDATION]` / `[REFUND_REQUEST]` | FM | rental_contracts |
| Ticket | `[SUPPORT_CREATE]` `[SUPPORT_CANCEL]` `[SUPPORT_CLOSE]` `[SUPPORT_REOPEN]` | khách | support_requests |
| Xử lý ticket | `[SUPPORT_RESOLVE]` `[PIN_RESET]` / `[SUPPORT_EXTEND]` | staff / FM | support_requests |
| Tự đóng ticket | `[SUPPORT_AUTO_CLOSE]` | **Hệ thống** | support_requests |

---

## 5. Thứ tự chạy đề xuất (1 buổi)
1. **Mục 2** (E2E) bằng UI, ghi lại id đơn / HĐ / task.
2. A → B → C với khách 2 (đơn mới, không đụng E2E).
3. D → E → F trên 1 đơn mới khác.
4. G (No-Show / dời lịch) trên đơn chưa check-in.
5. H → I → J → K trên HĐ đã check-in (nên tạo 3–4 HĐ để thử các mốc tiền J01–J07).
6. L (cần tua `end_date` + restart BE), M, cuối cùng N và O.

## 6. Lỗi nghi ngờ phát hiện khi đọc code (cần xác nhận bằng ca 🐞)

> **Cập nhật 26/10/2026**: đã sửa #1 (A15 → `409 NO_AVAILABILITY`), #2 (D07 rỗng, D08 → 400), #3 (F16 → `409 CHECK_IN_TOO_EARLY`), #4 (C09, I13 → 403 `FORBIDDEN_OWNER`), #5 (K08), #6 (I12), #9 (đã có `/thanh-toan`, `/manager/reports`), #10 một phần (thêm log tạo đơn, gán ô). #7 (H11): % ưu đãi đặt mới / gia hạn nay do BOM chỉnh trong chính sách. Còn mở: #8 (I05 — cần chốt nghiệp vụ). Quy trình chạy theo flow: [quy-trinh-test-he-thong.md](quy-trinh-test-he-thong.md).
| # | Ca | Mô tả | Chỗ |
|---|---|---|---|
| 1 | A15 | Không đếm suất khi tạo đơn → overbooking (L-13) | `ReservationService.createReservation` |
| 2 | D07, D08 | Gợi ý ô khác loại; gán ô không kiểm tra cơ sở / loại (L-11) | `getAvailableUnitsForReservation`, `assignStorageUnit` |
| 3 | F16 | Check-in trước ngày hẹn (L-17) | `StaffTaskRepository.completeCheckIn` |
| 4 | C09, I13 | Huỷ đơn / yêu cầu & huỷ trả kho không kiểm tra chủ sở hữu | `ReservationController`, `ContractController` |
| 5 | K08 | Hoàn tất 1 task hoàn cọc của đơn huỷ → đánh SUCCESS **mọi** REFUND PENDING của cơ sở | `StaffTaskService.completeRefundTask` (nhánh `contract == null`) |
| 6 | I12 | Huỷ yêu cầu trả kho đóng luôn ticket hỗ trợ đang mở | `ContractService.cancelCheckout` |
| 7 | H11 | Giảm giá gia hạn khác giảm giá đặt mới | `VnpayService.createRenewal` |
| 8 | I05 | Cho hẹn trả kho ngay hôm nay (PR-O1 ghi từ ngày mai) | `ContractService.requestCheckout` |
| 9 | O04 | Link menu chết `/thanh-toan`, `/manager/reports` | `CustomerLayout`, `ManagerLayout` |
| 10 | mục 4 | Thiếu log tạo đơn / hết hạn / gán ô; log huỷ đơn, trả kho chưa có mã | đã có thẻ task riêng "Bổ sung log PR-A9" |

## 7. Dọn dữ liệu sau test
```sql
-- Xoá theo khách test (con trước, cha sau). Đổi danh sách id khách nếu cần.
DECLARE @c TABLE (id INT); INSERT @c VALUES (1),(2);
DELETE FROM damage_cases      WHERE contract_id IN (SELECT id FROM rental_contracts WHERE customer_id IN (SELECT id FROM @c));
DELETE FROM handover_records  WHERE contract_id IN (SELECT id FROM rental_contracts WHERE customer_id IN (SELECT id FROM @c));
DELETE FROM facility_tasks    WHERE contract_id IN (SELECT id FROM rental_contracts WHERE customer_id IN (SELECT id FROM @c))
                                 OR support_request_id IN (SELECT id FROM support_requests WHERE customer_id IN (SELECT id FROM @c));
DELETE FROM support_requests  WHERE customer_id IN (SELECT id FROM @c);
DELETE FROM payment_transactions WHERE user_id IN (SELECT id FROM @c);
UPDATE storage_units SET status = 'AVAILABLE'
 WHERE id IN (SELECT storage_unit_id FROM rental_contracts WHERE customer_id IN (SELECT id FROM @c));
DELETE FROM rental_contracts  WHERE customer_id IN (SELECT id FROM @c);
DELETE FROM reservations      WHERE customer_id IN (SELECT id FROM @c);
-- Task REFUND của đơn huỷ (không gắn HĐ) và log: xoá tay nếu cần
-- SELECT * FROM facility_tasks WHERE task_type='REFUND' AND contract_id IS NULL;
```
> Đã chạy thử trong `BEGIN TRAN … ROLLBACK` trên DB local: chạy được. Trên SSMS chạy bình thường; nếu chạy bằng `sqlcmd` phải thêm `-I` (bảng `payment_transactions` có filtered index).

---

## Phụ lục A — Giả lập IPN VNPAY (B11, B12)
```bash
# Lấy ref (transaction_code) + amount của giao dịch PENDING trong DB, rồi:
node -e '
const c=require("crypto");
const secret="<vnpay.hash-secret trong application.yaml>";
const p={vnp_TxnRef:process.argv[1],vnp_Amount:String(process.argv[2]*100),vnp_ResponseCode:"00",vnp_TransactionStatus:"00",vnp_TmnCode:"83NI8FOK"};
const q=Object.keys(p).sort().map(k=>encodeURIComponent(k)+"="+encodeURIComponent(p[k]).replace(/%20/g,"+")).join("&");
console.log("http://localhost:8080/api/payments/vnpay/ipn?"+q+"&vnp_SecureHash="+c.createHmac("sha512",secret).update(q).digest("hex"));
' QKDXXXXXXXX 2787500
```
- Dán URL in ra vào trình duyệt → `{"RspCode":"00"}` (đúng) · sửa 1 ký tự hash → `97` · đổi `vnp_Amount` (rồi ký lại) → `04` · gọi lại lần 2 → `02`.
- `vnp_ResponseCode=24` (khách huỷ) → giao dịch FAILED, đơn vẫn PENDING.

# QueenKho — Kịch bản demo 7 flow, kèm exception và nghiệp vụ

> Soạn 08/11/2026. Dữ liệu: `sql_script/QueenKho_demo_data.sql`. Mã nghiệp vụ tra ở `docs/business-rules.md`.
> Mỗi ca ghi: **Tài khoản · Thao tác · Kết quả**, rồi `+ MÃ : nội dung` là nghiệp vụ để nói khi trình bày.
> ⚡ = nút "Giả lập" viền cam, tua thời gian rồi để nghiệp vụ thật chạy tiếp (BR-115).
> ⭐ = nên demo trên lớp. Ca không có ⭐ để dành khi giảng viên hỏi hoặc còn thời gian.

---

## 0. Chuẩn bị

### 0.1 Nạp dữ liệu (trong ngày demo, trước giờ demo tối đa 12 tiếng)

Tắt backend rồi chạy 2 lệnh ở thư mục gốc project. Lệnh đầu **xoá và tạo lại `QueenKhoDB`**.

```bash
sqlcmd -S localhost -U sa -P 12345 -C -I -f 65001 -i sql_script/QueenKho_setup_data.sql
```

```bash
sqlcmd -S localhost -U sa -P 12345 -C -I -f 65001 -i sql_script/QueenKho_demo_data.sql
```

Dùng SSMS thì mở từng file rồi F5, đúng thứ tự trên. Sau đó bật backend + frontend. Muốn demo lại từ đầu: nạp lại 2 file.

**Vì sao phải nạp trong ngày:** ngày trong dữ liệu tính theo lúc chạy script. Ca huỷ "còn 24–48h" chỉ đúng trong 12 tiếng sau khi nạp, ca "còn < 24h" đúng trong 20 tiếng, task trả kho của Flow 3 hết hạn 21:00 hôm nay.

### 0.2 Checklist trước giờ demo

| Việc | Ghi chú |
|---|---|
| Thử 1 lần thanh toán VNPAY sandbox trên đúng máy và mạng demo | NCB · `9704198526191432198` · `NGUYEN VAN A` · `07/15` · OTP `123456`. Đây là bước duy nhất phụ thuộc mạng ngoài. Thử xong nạp lại dữ liệu |
| Có nút ⚡ | `SIMULATION_ENABLED` mặc định bật |
| Mở sẵn 4 cửa sổ riêng (thường + ẩn danh hoặc profile khác) | Phiên lưu theo tab (`sessionStorage`): Khách · FM · Staff · BOM |
| Ghi sẵn tab đang dùng cho từng vai | Đừng đăng xuất giữa chừng |

**Nếu VNPAY lỗi lúc demo:** nói rõ đây là cổng ngoài, chuyển sang Flow 2 với đơn `RES-F2-01` đã cọc sẵn.

### 0.3 Tài khoản (mật khẩu đều `123456`)

| Vai | Tài khoản | Dùng cho |
|---|---|---|
| FM Tân Bình | `fmtanbinh@gmail.com` | Flow 2, 3, 5, 6, 7 |
| FM Bình Thạnh | `fmbinhthanh@gmail.com` | Ca sai cơ sở |
| Staff Tân Bình | `stafftanbinh1@gmail.com`, `stafftanbinh2@gmail.com` | Check-in, nghiệm thu, hỗ trợ |
| BOM | `bom@queenkho.com` | Flow 4 |
| Admin | `admin@queenkho.com` | Xem nhật ký cuối buổi |
| Khách | `an.khach@queenkho.local` | Flow 1 ca chính, khách chưa có gì |
| | `hai.khach@queenkho.local` | 5 mức huỷ đơn |
| | `duc.khach@queenkho.local` | Còn nợ, bị chặn đặt kho |
| | `binh.khach@queenkho.local` | Flow 2 ca chính |
| | `cuong.khach@queenkho.local` | Flow 3 ca chính |
| | `dung.khach@queenkho.local` | Trả sớm, đổi ý trả kho |
| | `minh.khach@queenkho.local` | Trả kho có sự cố (mở phía khách nếu cần) |
| | `nga.khach@queenkho.local` | Gia hạn |
| | `giang.khach@queenkho.local`, `son.khach@queenkho.local` | Quá hạn, kho tổng |
| | `phuc.khach@queenkho.local` | Hỗ trợ |
| | `quynh.khach@queenkho.local` | Bồi thường, cảm biến |

### 0.4 Phân bổ thời gian

| Phần | Thời lượng | Nội dung |
|---|---|---|
| Flow 1 | 6 phút | Ca chính + F1-X1, F1-X3, F1-X5 |
| Flow 2 | 8 phút | Ca chính + F2-X3, F2-X4, F2-X5, F2-X6 |
| Flow 3 | 6 phút | Ca chính + F3-X1, F3-X4 |
| Flow 4 | 4 phút | Ca chính + F4-X1 |
| Flow 5 | 4 phút | Ca chính + F5-X1, F5-X2 |
| Flow 6, 7 (nice to have) | 5 phút mỗi flow nếu còn giờ | F6-X2, F6-X3 · F7-H, F7-X4 |
| Chốt | 1 phút | Admin xem nhật ký: mọi thao tác vừa làm đều có log (PR-A9) |

**Thứ tự cần giữ:** F7-X7 làm trước F6-X3 (dùng chung `HD-F6-06`). Các ca còn lại dùng dữ liệu riêng, nhảy flow nào trước cũng được.

Nghiệp vụ nền, nói 1 lần đầu buổi:
+ `PR-90` : Người thao tác lấy từ token; khách chỉ thấy dữ liệu của mình, FM / Staff chỉ thấy cơ sở mình.
+ `PR-91` : Mọi thay đổi trạng thái trong 1 transaction và ghi `activity_logs`.
+ `D-01` : Trả trước theo kỳ: lúc đặt trả cọc + tiền thuê cả kỳ, không thu hằng tháng.

---

## Flow 1 — Storage Unit Reservation (tìm kho, đặt kho, thanh toán cọc)

### ⭐ F1-H. Ca chính
**Dữ liệu:** `an.khach`, voucher `HE2026`, ô Mini M trống.

**Bước 1. Khách tìm kho** — chưa cần đăng nhập, mở `/tim-va-dat-kho`, chọn TP.HCM, xem QueenKho Tân Bình.
Thấy: danh sách loại kho, giá, số ô còn trống. Khách **không thấy ô cụ thể**.
+ `BR-10` : Chỉ hiện cơ sở `ACTIVE`; lọc theo thành phố, loại kho, giá, diện tích.
+ `BR-11` : Số suất = ô trống − đơn đang giữ suất.
+ `BR-135` : Khách chỉ chọn loại kho, FM mới chỉ định ô cụ thể.

**Bước 2. Đăng nhập, vào trang đặt** — `an.khach`, chọn Kho Mini M → Đặt kho.
Chọn ngày nhận kho sau 7 ngày → trang báo "Còn N ô trống cho khoảng dd/MM – dd/MM".
+ `PR-B4` : Nhận kho từ ngày mai tới tối đa 90 ngày tới.
+ `BR-136` : Số ô tính theo đúng khoảng ngày thuê, không chỉ theo tình trạng hôm nay.

**Bước 3. Chọn gói, hàng, bảo hiểm, voucher** — gói 3 tháng · loại hàng Gia dụng · bảo hiểm Cơ bản · nhập `HE2026` → Áp dụng · tick 2 điều khoản.
Bảng tiền: thuê 2.250.000đ, ưu đãi 5% −112.500đ, cọc 750.000đ, voucher −150.000đ, **tổng 2.737.500đ**.
+ `D-08` : Ưu đãi gói 1/3/6/12 tháng là 0/5/10/15%, chốt vào đơn lúc đặt.
+ `PR-M6` : Cọc = giá niêm yết × hệ số cọc của chính sách hiện hành, không đổi về sau.
+ `BR-24` : Tổng = thuê sau ưu đãi + cọc − voucher + bảo hiểm.
+ `BR-25` : Mỗi đơn tối đa 1 mã, không cộng dồn, chỉ trừ vào tiền thuê; không nhập mã thì tự áp `NEWKHO` 100.000đ.
+ `BR-125` : Gói Cơ bản miễn phí, trần 20 triệu; không khai giá trị hàng thì tối đa 5 triệu.
+ `BR-131` : Bắt buộc khai loại hàng, Staff đối chiếu lúc nhận kho.
+ `BR-102` : Bắt buộc đồng ý điều khoản xử lý tài sản; lưu phiên bản `v4` và thời điểm đồng ý.

**Bước 4. Thanh toán** — bấm THANH TOÁN GIỮ KHO, trả bằng thẻ NCB ở 0.2.
Đơn tạo `PENDING`, giữ suất 15 phút. Quay về trang xác nhận: đơn `DEPOSIT_PAID`, có mã đơn.
+ `PR-B1` : Tạo đơn đếm lại suất trong transaction có khoá theo cơ sở.
+ `PR-B6` : Đơn `PENDING` giữ suất 15 phút.
+ `BR-27` : Kiểm tra chữ ký HMAC, khớp số tiền, mỗi giao dịch xử lý 1 lần.
+ `BR-111` / `BR-117` : FM nhận thông báo đơn mới; khách nhận thông báo + email.

**Bước 5. Xem đơn** — `Kho của tôi` → bấm HỦY ĐƠN để xem màn xem trước, **rồi đóng, không xác nhận**.
Thấy: huỷ trong 30 phút sau thanh toán hoàn 100%.
+ `BR-32a` : Ân hạn 30 phút sau thanh toán cho mọi đơn.

### ⭐ F1-X1. Nhập sai khi đặt kho
**Tài khoản:** `an.khach`, trang đặt Kho Mini M.

| Thao tác | Kết quả | Nghiệp vụ |
|---|---|---|
| Chọn loại hàng Thực phẩm | Bị khoá, ghi chỉ gửi kho lạnh / đông. Gọi thẳng API: 400 `GOODS_REQUIRES_COLD_STORAGE` | `BR-131` |
| Không chọn loại hàng → thanh toán | Lỗi hiện **ngay trên nút thanh toán**, trang cuộn tới mục thiếu, viền đỏ. API: `GOODS_CATEGORY_REQUIRED` | `BR-131` |
| Không tick điều khoản → thanh toán | Báo lỗi, viền đỏ mục cam kết. API: `TERMS_NOT_ACCEPTED` | `BR-102` |
| Chọn ngày quá 90 ngày | Ô ngày chặn. API: 400 `START_DATE_TOO_FAR` | `PR-B4` |
| Voucher `LANH50` | Báo mã không áp cho loại kho này (`VOUCHER_INVALID`) | `BR-133` |
| Voucher `HETHAN` / `HETLUOT` | Báo hết hạn / hết lượt (`VOUCHER_INVALID`) | `BR-25` |
| Voucher `DAIHAN10` với gói 1 tháng | Báo chưa đủ gói tối thiểu 3 tháng | `BR-25` |

### F1-X2. Hết ô nhưng có ô sắp trống (Kho Đặc Biệt XL)
**Dữ liệu:** `HD-F1-09` ở A106 đã hẹn trả sau 5 ngày, `HD-F1-10` ở B205 đang thuê.
- Tìm kho: Kho XL hiện **"Trống từ dd/MM"** (ngày hẹn trả + 1). Bấm đặt: ngày nhận tối thiểu là ngày đó.
- Đặt trước ngày đó qua API → 409 `NO_AVAILABILITY`, message báo ngày sớm nhất.

+ `PR-R11` : Ô của khách đã hẹn trả được bán trước cho đơn nhận kho từ ngày giao ô.
+ `PR-R12` : Tới ngày mà cơ sở chưa giao được ô thì khách huỷ được hoàn 100%.

### ⭐ F1-X3. Khách còn nợ bị chặn
**Tài khoản:** `duc.khach`. **Dữ liệu:** `HD-F1-06` đã kết thúc, nợ phí sự cố 650.000đ.
- Đặt kho bất kỳ → lỗi "đang có khoản nợ", nút dẫn tới hợp đồng. API: 409 `CUSTOMER_HAS_DEBT`.
- Vào `Thanh toán` → trả 650.000đ qua VNPAY → đặt kho lại được.

+ `PR-Q12` : Có hợp đồng `OVERDUE` hoặc nợ `DAMAGE_FEE` / `OVERSTAY_FEE` thì không đặt mới.
+ `PR-50` : Trả nợ qua VNPAY dùng lại chính dòng nợ, xong thì đặt kho lại được.

### F1-X4. Số ô trống theo khoảng ngày (Kho Gia Đình)
**Dữ liệu:** B201 đã gán khách nhận sau 60 ngày (`HD-F1-07`), B202 đang thuê (`HD-F1-08`).
- `an.khach`, Kho Gia Đình, nhận sau 7 ngày, gói 1 tháng → **Còn 1 ô**.
- Đổi sang gói 3 tháng → **Không còn ô**, gợi ý chọn ngày khác hoặc gói ngắn hơn.

+ `BR-136` : Khoảng thuê phải rảnh trọn vẹn; hợp đồng đang thuê còn quyền gia hạn coi như chưa biết ngày trả.

### ⭐ F1-X5. Năm mức huỷ đơn
**Tài khoản:** `hai.khach` → `Kho của tôi`. Bấm HỦY ĐƠN từng đơn, xem số tiền ở màn xem trước.

| Đơn | Tình huống | Giữ lại | Hoàn | Mức |
|---|---|---|---|---|
| `RES-F1-01` | Còn ≥ 48h | 0 | 3.600.000đ | `FULL_REFUND` |
| `RES-F1-02` | Còn 24–48h | 925.000đ (50% cọc) | 2.675.000đ | `HALF_DEPOSIT` |
| `RES-F1-03` | Còn < 24h | 1.850.000đ (100% cọc) | 1.750.000đ | `FULL_DEPOSIT` |
| `RES-F1-04` | Đã qua giờ hẹn, đã gán ô | Cọc + 1 tháng thuê = 3.574.167đ | 3.448.333đ | `AFTER_APPOINTMENT` |
| `RES-F1-05` | Tới ngày mà cơ sở chưa gán ô | 0 | 3.600.000đ | `FACILITY_FAULT` |

Xác nhận huỷ `RES-F1-02`: đơn `REFUND_PENDING`, FM có task hoàn tiền ở `/manager/refunds`.

+ `BR-32` : Mốc 48h / 24h / qua giờ hẹn, cố định toàn hệ thống.
+ `PR-R12` : Lỗi do cơ sở thì hoàn 100%.
+ `PR-O12` : Mỗi khoản hoàn sinh 1 task `REFUND` cho FM.

### F1-X6. Không truy cập được dữ liệu người khác
`an.khach` gọi xem trước huỷ đơn của Hải qua API → 403 `FORBIDDEN_OWNER`.
+ `PR-90` : Đơn theo id phải thuộc đúng khách.

### F1-X9. Hai khách tranh suất cuối (Kho Lạnh)
**Dữ liệu:** Kho Lạnh còn đúng 1 suất (L104).
- Mở trang đặt Kho Lạnh ở 2 tab: `an.khach` và `khanh.khach`, loại hàng Thực phẩm.
- Tab 1 bấm thanh toán → sang VNPAY, đơn giữ suất. Tab 2 bấm sau → 409 `NO_AVAILABILITY`, lỗi hiện trên nút.

+ `PR-B1` : Khoá dòng cơ sở trong transaction nên 2 khách phải xếp hàng, không bán vượt.

### F1-X10. Quá 15 phút chưa thanh toán
Đặt 1 đơn nhưng không trả → `Kho của tôi` → ⚡ **Quá 15p**. Đơn `EXPIRED`, suất được nhả, thanh toán lại bị từ chối.
+ `PR-B6` : Job mỗi phút huỷ đơn `PENDING` quá 15 phút.
+ `PR-B8` : Khách huỷ trên VNPAY thì đơn vẫn `PENDING`, trả lại được tới hết 15 phút.

---

## Flow 2 — Storage Check-in and Handover (gán ô, giao việc, bàn giao)

### ⭐ F2-H. Ca chính
**Dữ liệu:** `RES-F2-01` của `binh.khach`, Kho Tiêu Chuẩn, 3 tháng, nhận kho hôm nay.

**Bước 1. FM gán ô** — `fmtanbinh` → `/manager/pending` → dòng `RES-F2-01` → CHI TIẾT xem thông tin → GÁN Ô KHO.
Modal: thời gian thuê, danh sách ô trống suốt thời gian thuê, sơ đồ mặt bằng, nút **Xem lịch ô kho**. Chọn 1 ô → XÁC NHẬN GÁN PHÒNG.
Kết quả: đơn `UNIT_ASSIGNED`, hợp đồng `PENDING_CHECK_IN`, sinh task `CHECK_IN`, ô `OCCUPIED` vì nhận kho hôm nay.
+ `BR-40` / `BR-123` : Đơn xếp theo ưu tiên khách cũ + gói dài.
+ `BR-41` : Chỉ gợi ý ô cùng cơ sở, cùng loại, rảnh suốt thời gian thuê.
+ `BR-42` : Khoá dòng ô rồi kiểm tra lịch, 2 FM gán cùng ô thì người sau bị từ chối; 1 transaction tạo hợp đồng + task + thông báo.
+ `BR-43` : Hợp đồng gắn chính sách đang hiệu lực của cơ sở.
+ `BR-110` : Chọn được ô ngay trên mặt bằng.
+ Không nói gán ô là đã cấp PIN: PIN và RFID chỉ cấp lúc check-in.

**Bước 2. FM giao việc** — `/manager/tasks` → task Check-in vừa sinh → Giao việc → Nhân viên Tân Bình 1.
Task `IN_PROGRESS`, Staff nhận thông báo.
+ `PR-T1` : Task check-in chỉ giao / nhận trong 30 ngày trước ngày hẹn.
+ `BR-64` : Staff cùng cơ sở cũng tự nhận được; ai bấm trước người đó giữ.

**Bước 3. Staff bàn giao** — `stafftanbinh1` → `/staff` → mở task. Đối chiếu khách, CCCD, ô, vị trí trên sơ đồ, loại hàng khai báo.
Tick đủ 6 mục, giữ PIN gợi ý, nhập RFID `RFID-DEMO-01`, bấm **+ Ảnh mẫu (demo)** → XÁC NHẬN BÀN GIAO. (Nhanh: GIẢ LẬP HOÀN THIỆN.)
Kết quả: biên bản `CHECK_IN`, hợp đồng `ACTIVE`, task `COMPLETED`.
+ `BR-70` : Chỉ Staff đang giữ task, chưa quá hạn, hợp đồng còn chờ check-in.
+ `BR-71` / `BR-132` : Đủ 6 mục, gồm kiểm tra hàng mang vào.
+ `BR-121` : Bắt buộc 1–10 ảnh hiện trạng, làm căn cứ đối chiếu lúc trả kho.
+ `BR-72` / `BR-73` : PIN 6 số, RFID không trùng hợp đồng còn hiệu lực.
+ 🔸 SmartLock là mô phỏng, PIN quản lý trong hệ thống, chưa nối thiết bị.

**Bước 4. Khách kiểm tra** — `binh.khach` → `Kho của tôi` → XEM HĐ.
Thấy: `ACTIVE`, ô, vị trí trên mặt bằng, thời hạn, PIN, RFID, biên bản + ảnh.
+ `BR-80` : Khách xem PIN / RFID trong hợp đồng.
+ `BR-117` : Email không chứa mã PIN.
+ `BR-109` : Trên sơ đồ, ô khác chỉ là hình khối, không mã, không trạng thái.

### F2-X1. Sai dữ liệu khi bàn giao (làm ngay trong F2-H, bước 3, trước khi bấm thật)
| Thao tác | Kết quả |
|---|---|
| `stafftanbinh2` mở task của Staff 1 rồi xác nhận | 409 `TASK_NOT_YOURS` |
| Thiếu ảnh / thiếu mục checklist | Nút khoá. API: `HANDOVER_PHOTO_REQUIRED`, `CHECKLIST_INCOMPLETE`, `GOODS_CHECK_REQUIRED` |
| RFID `RFID-DEMO-F3-01` (đang dùng ở `HD-F3-01`) | 409 `RFID_TAKEN` |
| PIN `135001` (đang dùng ở `HD-F3-01`) | 409 `PIN_TAKEN` |
| Task `RES-F2-02`, hẹn sau 3 ngày | 409 `CHECK_IN_TOO_EARLY`. ⚡ GIẢ LẬP: KHÁCH TỚI HÔM NAY rồi làm lại được |

+ `PR-C1` : Không bàn giao trước ngày hẹn vì hợp đồng tính tiền từ ngày đó.

### ⭐ F2-X3. Khung 30 ngày giao việc
**Dữ liệu:** `HD-F2-03`, hẹn sau 45 ngày.
- `/manager/tasks`: nút giao bị khoá, ghi **"Giao từ dd/MM"**. API: 409 `TASK_NOT_IN_WINDOW`.
- FM mở task → ⚡ **Hẹn còn 30 ngày (mở giao việc)** → giao được. Staff không có nút này (403).

+ `PR-T1` : Không phân công quá xa khi chưa biết ai đi làm ngày đó.

### ⭐ F2-X4. Kịch bản giảng viên: lấp khoảng trống
**Dữ liệu:** Ô `KV-TB-C101` đã gán khách A (`HD-F2-04`, 12 tháng, nhận sau 60 ngày). Khách B: `RES-F2-05` (1 tháng, nhận sau 7 ngày). Khách C: `RES-F2-06` (3 tháng, nhận sau 7 ngày).

1. `/manager/storage` → **LỊCH Ô KHO** → Kho nhỏ 2m²: C101 có thanh xanh dương nét đứt từ ngày thứ 60, trước đó là nền xanh "Trống".
2. Gán `RES-F2-05`: C101 xếp đầu, nhãn **"Vừa khít"**, "Trống đến dd/MM". Xác nhận gán.
3. Gán `RES-F2-06`: **không có C101** trong danh sách vì 3 tháng đè ngày A nhận.
4. Mở lại lịch: C101 có 2 hợp đồng, khoảng trống ở giữa.

+ `D-18` / `BR-136` : Hợp đồng chỉ chiếm ô trong [ngày nhận, hết hạn + 2 ngày dọn ô); gán trước thì ô vẫn trống tới ngày nhận.
+ `BR-41` : Ô vừa khít xếp đầu, để dành ô trống dài cho đơn dài.
+ `BR-137` : Popup lịch hiện khoảng đã đặt và khoảng trống.

### ⭐ F2-X5. Ô hỏng trước ngày bàn giao
**Dữ liệu:** `HD-F2-07` của `binh.khach`, nhận hôm nay, ô D204 đang bảo trì, Staff 1 giữ task.
1. Staff xác nhận bàn giao → 409 **`UNIT_IN_MAINTENANCE`**.
2. `/manager/storage`: banner đỏ "ô có vấn đề lịch" → mở hợp đồng → **Chuyển sang ô khác** → chọn ô, lý do Ô có sự cố do cơ sở, mô tả.
3. Staff bàn giao lại → thành công ở ô mới. Khách nhận thông báo vị trí mới.

+ `BR-139` : Không bàn giao ô bảo trì / ô khách trước chưa trả.
+ `BR-122` : Chuyển sang ô cùng cơ sở, cùng loại, rảnh suốt thời gian còn lại; giá, PIN, ngày hết hạn không đổi.

### ⭐ F2-X6. No-Show: khách từ chối tới → huỷ ngay
**Dữ liệu:** `RES-F2-08`, quá hẹn 1 ngày, đã có báo cáo khách từ chối.
`/manager/pending` → tab QUÁ HẠN NHẬN KHO → KHÁCH VẮNG MẶT → xem số tiền → xác nhận. Đơn `CANCELLED`, hợp đồng `TERMINATED`, ô trống lại.
+ `PR-X3` : Khách từ chối thì huỷ ngay, không chờ 48h.
+ `PR-X1` : Giữ cọc + 1 tháng thuê, hoàn phần còn lại; FM chọn Miễn phạt (bắt buộc lý do) thì hoàn toàn bộ.

### F2-X7. No-Show: không liên lạc được
`RES-F2-09`: 2 lần thất bại + qua 48h → đủ điều kiện. Gói 3 tháng: giữ 3.574.167đ, hoàn 3.448.333đ qua task `REFUND`.
+ `PR-X3` : ≥ 2 lần liên hệ thất bại và qua 48h từ giờ hẹn.

### F2-X8. No-Show chưa đủ điều kiện, dời lịch
`RES-F2-10`: mới 1 lần, chưa 48h → nút khoá, ghi "Chưa đủ điều kiện". API: 409 `NO_SHOW_NOT_ALLOWED_YET`.
Khách xin dời → DỜI LỊCH về hôm nay → task mở lại, giao Staff, check-in được.
+ `BR-52` : Dời ngày nhận đồng bộ đơn, hợp đồng, hạn task, giờ hẹn.
+ `BR-136` : Lịch mới đè khách khác cùng ô → 409 `UNIT_SCHEDULE_CONFLICT`, phải đổi ô trước.
+ Khách đã nhận kho thì không còn trong danh sách, không huỷ No-Show / dời lịch được.

### F2-X9. Trùng lịch do khách trước gia hạn
**Dữ liệu:** Ô D208: `HD-F2-11` đang thuê, hết hạn sau khi `HD-F2-12` nhận.
Lịch ô kho: viền đỏ cả 2 thanh, ghi "Trùng lịch". ⚡ khách tới hôm nay rồi check-in → 409 `UNIT_STILL_OCCUPIED`. FM đổi ô cho `HD-F2-12`.
+ `BR-137` / `BR-139` : Gia hạn không bị chặn theo số ngày (nhóm chốt), lịch báo để FM xử lý.

### ⭐ F2-X10. Kịch bản giảng viên: ô hỏng khi khách B đang thuê trong khoảng trống của khách A
**Dữ liệu:** Ô D209: B đang thuê (`HD-F2-13`), A nhận sau 60 ngày (`HD-F2-14`).
1. Chuyển A trước kèm bảo trì → 409 `OLD_UNIT_IN_USE` vì B còn trong ô.
2. Mở `HD-F2-13` → Chuyển sang ô khác, lý do Ô có sự cố do cơ sở. Ô D209 vào bảo trì. **Trang báo còn khách đã gán trước, kèm link `HD-F2-14`.**
3. Bấm link → đổi ô cho A.

+ `BR-122` / `BR-139` : Ô vào bảo trì thì hệ thống liệt kê khách đã gán trước để đổi ô.

### F2-X11. Hết ô đúng loại, chỉ có ô sắp trống (Kho Lớn)
Gán `RES-F6-05`: danh sách trống, phần "Ô sắp trống cùng loại" hiện B203 + link hợp đồng; chưa gán được.
+ `BR-41` : Không gợi ý ô khác loại.
+ `BR-135` : FM thấy ô sắp trống và ngày giao.

### F2-X12. Sai loại, sai cơ sở (API)
Gán `KV-TB-A107` (Mini M) cho đơn Tiêu Chuẩn → 400. Gán ô Bình Thạnh → 400. `fmbinhthanh` gán đơn Tân Bình → 403.
+ `BR-42` · `PR-90`.

---

## Flow 3 — Rented Storage Unit Management (đang thuê, trả kho, nghiệm thu, hoàn tiền)

### ⭐ F3-H. Ca chính: trả trong tháng cuối
**Dữ liệu:** `HD-F3-01` của `cuong.khach`, gói 3 tháng, còn 10 ngày, ô D210.

**Bước 1. Khách xem hợp đồng** — XEM HĐ: PIN, RFID, thời hạn, tiền đã đóng, vị trí ô, biên bản + ảnh nhận kho, cảm biến.
+ `BR-80` · `BR-109` · `BR-121` · `BR-129`.

**Bước 2. Hẹn trả kho** — tab Trả kho → ngày mai → chuyển khoản (ngân hàng, STK, chủ TK).
Bảng dự tính: tháng cuối, chỉ hoàn cọc. Hợp đồng `TERMINATION_PENDING`, sinh task `CHECK_OUT`, PIN vẫn dùng được.
+ `PR-O1` : Ngày hẹn từ ngày mai tới hết `end_date`.
+ `PR-O3` : Bắt buộc chọn cách nhận tiền; chuyển khoản thiếu thông tin → 400 `INVALID_REFUND_METHOD`.
+ `PR-R11` : Ô thành "sắp trống" từ ngày hẹn + 1.

**Bước 3. Staff nghiệm thu** — `stafftanbinh1` mở task → ⚡ GIẢ LẬP: KHÁCH TỚI TRẢ KHO HÔM NAY → Nhận việc → GIẢ LẬP KHO TỐT → hoàn tất.
Hợp đồng `TERMINATED`, xoá PIN / RFID, đơn `COMPLETED`, ô `AVAILABLE`, sinh task `REFUND` 1.850.000đ.
+ `PR-O6` : Ô trống + xác minh danh tính bắt buộc đạt; bẩn / hỏng khoá bắt buộc lập sự cố.
+ `PR-O7` : 1 transaction đóng toàn bộ hồ sơ.
+ `PR-O2a` : Tháng cuối không hoàn tiền thuê, không phí phá hợp đồng.

**Bước 4. FM hoàn tiền** — `/manager/refunds` → mở task. Thử xác nhận thiếu ảnh ủy nhiệm chi → 400 `REFUND_EVIDENCE_REQUIRED`. Tải ảnh + mã FT → **Xác nhận hoàn tiền**.
Giao dịch `REFUND` `SUCCESS`, khách nhận thông báo.
+ `PR-O12` : Việc hoàn tiền là của FM, Staff không làm được.
+ `PR-O15` : Chuyển khoản bắt buộc ảnh UNC; tiền mặt bắt buộc tick khách ký nhận.

### ⭐ F3-X1. Trả sớm gói 6 tháng
**Dữ liệu:** `HD-F3-02` của `dung.khach`, đã dùng 40 ngày.
Tab Trả kho, ngày mai: bảng tính **hoàn tiền thuê 4.340.000đ + cọc 1.850.000đ = 6.190.000đ**.
Công thức: tiền thuê đã trả 9.890.000 − 2 tháng đã dùng × 1.850.000 − phí phá hợp đồng 1.850.000.
+ `PR-O2` : Tháng đã dùng tính giá niêm yết (mất ưu đãi gói) và làm tròn lên, cộng 1 tháng phí phá hợp đồng.

### F3-X2. Dời / huỷ yêu cầu trả kho
**Dữ liệu:** `HD-F3-03` của `dung.khach`, đã hẹn sau 5 ngày.
Dời sang sau 8 ngày → 400 "Không thể dời ngày qua sau ngày trả kho đã thực hiện trước đó". Dời sớm hơn → được. Huỷ yêu cầu → `ACTIVE`, task `CANCELLED`.
+ `PR-O1` : Chỉ dời sớm hơn, để ô đã bán trước cho khách sau không bị lỡ.
+ `PR-O4` : Huỷ được khi chưa quá `end_date`.

### F3-X3. Sự cố lỗi khách trong cọc
**Dữ liệu:** `HD-F3-04`, hẹn hôm nay, Staff 1 đang giữ task.
Bỏ chọn "sạch sẽ" → + Thêm hạng mục: chi phí 700.000đ, lỗi khách, kèm ảnh → hoàn tất.
Trừ cọc 700.000đ, **hoàn 1.150.000đ**, ô `MAINTENANCE`, sinh task bảo trì.
+ `PR-O8` : Mỗi sự cố bắt buộc ảnh (`EVIDENCE_IMAGE_REQUIRED`); không lập sự cố → `DAMAGE_REPORT_REQUIRED`.
+ `PR-O9` : Trừ vào cọc, ghi `DAMAGE_FEE` method `DEPOSIT_OFFSET`.

### ⭐ F3-X4. Sự cố vượt cọc → thành nợ
**Dữ liệu:** `HD-F3-05`. Nhập 2.150.000đ, lỗi khách (hoặc GIẢ LẬP LỖI KHÁCH).
Cọc 1.850.000đ bị trừ hết, **nợ 300.000đ** `PENDING`, task `REFUND` 0đ để FM đóng hồ sơ. `minh.khach` đặt kho mới → `CUSTOMER_HAS_DEBT`.
+ `PR-O9` · `PR-O11` · `PR-Q12`.

### F3-X5. Sự cố lỗi cơ sở
**Dữ liệu:** `HD-F3-06`. Chọn lỗi cơ sở (hoặc GIẢ LẬP LỖI CƠ SỞ): không trừ cọc, **hoàn đủ 1.850.000đ**, ô vẫn bảo trì.
+ `PR-O16` : Lỗi cơ sở chỉ ghi chi phí nội bộ.

### F3-X6. Sửa xong, mở bán lại
**Dữ liệu:** Ô D216 bảo trì, Staff 1 giữ task (`HD-F3-07`). Ghi chú < 10 ký tự → 400. Ghi đủ → **Sửa xong**, ô `AVAILABLE`.
+ `PR-O10` : Staff giữ task hoặc FM đóng được.

### F3-X7. Chuyển ô khi đang thuê
**Dữ liệu:** `HD-F3-08`, ô E202. FM → Chuyển sang ô khác → E203, lý do Khách yêu cầu. Khách xem lịch sử chuyển ô, PIN giữ nguyên. Chuyển sang ô khác loại → 400 `UNIT_TYPE_MISMATCH`.
+ `BR-122`.

---

## Flow 4 — Business Rules, Fee Management, Revenue Monitoring (BOM)

### ⭐ F4-H. Ca chính
**Tài khoản:** `bom@queenkho.com`.

**Bước 1. Doanh thu** — `/bom/revenue` → chọn **THEO NĂM**, xem Toàn bộ cơ sở, rồi lọc từng cơ sở.
Thấy: doanh thu thuê, thu phí phạt, đã hoàn, cọc đang giữ, xu hướng 12 tháng, theo cơ sở, theo loại kho, lấp đầy, danh sách đối soát có mã FT, XUẤT CSV.
+ `PR-M7` : Ghi theo ngày thực thu; phần cọc không tính doanh thu.
+ `PR-M8` : Phí trừ vào cọc tính vào "Thu phí phạt" nhưng không phải tiền mới.
+ `PR-O15` : Đối soát được mã FT và ảnh UNC.

**Bước 2. Đổi giá** — `/bom/unit-types` → Kho Đặc Biệt XL → đổi giá 6.800.000đ.
Hợp đồng `HD-F1-10` không đổi số tiền đã thu.
+ `PR-12` : Giá mới chỉ áp cho đơn mới và lần gia hạn sau.
+ `PR-M3` : Tên duy nhất, diện tích / giá > 0.

**Bước 3. Chính sách** — `/bom/policies` → Bình Thạnh → Cập nhật: hệ số cọc 2. Xem Lịch sử chính sách.
Phát hành phiên bản mới, hợp đồng cũ `HD-CS-1` giữ phiên bản cũ.
+ `PR-13` : Mỗi cơ sở 1 bản hiệu lực, không ghi đè, chọn lại bản cũ được.
+ `PR-14` : Cọc 1–3, phí trễ 0–50%/ngày, chiếm dụng 100–300%, lưu giữ 0–100%, di dời 0–100%.
+ `PR-15` : Riêng chính sách huỷ trước check-in cố định theo BR-32.

**Bước 4. Voucher** — `/bom/vouchers` → TẠO VOUCHER: `THU2026`, 80.000đ, chỉ Kho Mini M. Bảng sẵn có `HE2026`, `LANH50`, `HETHAN`, `HETLUOT`.
+ `BR-25` · `BR-133`.

**Bước 5. Quá hạn toàn chuỗi** — `/bom/overdue` → `HD-CS-7` (Gò Vấp) → MIỄN PHÍ TRỄ + lý do.
+ `BR-130` : BOM miễn cho mọi cơ sở, mỗi đợt 1 lần; thanh lý vẫn tính đủ.

### ⭐ F4-X1. BOM nhập sai
| Thao tác | Kết quả | Nghiệp vụ |
|---|---|---|
| Hệ số cọc 5 | 400 | `PR-14` |
| Phí chiếm dụng 50% | 400 | `PR-14` |
| Thêm loại kho tên `Kho Mini M` | 409 `UNIT_TYPE_NAME_EXISTS` | `PR-M3` |
| Giá âm | 400 | `PR-M3` |
| Xoá loại kho đã có ô | 409 `UNIT_TYPE_HAS_UNITS` | `PR-M4` |
| Mã cơ sở chữ thường | 400 | `PR-M1` |
| Mã cơ sở `TB` đã có | 409 `FACILITY_CODE_EXISTS` | `PR-M1` |
| Ngừng cơ sở Tân Bình còn hợp đồng | 409 | `PR-11` |
| Voucher `HE2026` trùng mã | 400 `DUPLICATE_CODE` | `BR-25` |
| Miễn phí trễ `HD-CS-7` lần 2 | 409 `LATE_FEE_ALREADY_WAIVED` | `BR-130` |

### F4-X2. Tắt quyền FM miễn phí trễ
Bình Thạnh: tắt "Cho phép FM miễn phí trễ" → `fmbinhthanh` miễn `HD-CS-8` → 403 `WAIVER_NOT_ALLOWED`. BOM vẫn miễn được.
**Chỉ làm ở Bình Thạnh**, để F6-X3 ở Tân Bình không bị ảnh hưởng.

### F4-X3. Sai vai trò
FM / Staff gõ `/bom/...` bị chuyển về trang của mình. API: 403.
+ `PR-90`.

---

## Flow 5 — Facility Storage and Staff Management (FM)

### ⭐ F5-H. Ca chính
**Tài khoản:** `fmtanbinh`.

**Bước 1. Dashboard** — `/manager`: ô theo trạng thái, lấp đầy theo khu, đơn chờ gán, hợp đồng quá hạn, việc cần xử lý. Mỗi thẻ dẫn tới màn tương ứng.
+ `PR-M14`.

**Bước 2. Danh mục ô + sơ đồ** — `/manager/storage`, chọn Tầng 2. Ô hiện: "Còn n ngày hết hạn · trống lại sau m ngày", "Đã có khách đặt từ dd/MM", nhãn "Sắp trống".
+ `BR-105` → `BR-107` : Mặt bằng theo tầng, lưới 0,5 m.
+ `BR-135` · `BR-137`.

**Bước 3. Lịch ô kho** — **LỊCH Ô KHO**: xem 1/3/6/12 tháng, lọc loại kho, bấm ô để xem khoảng trống, bấm hợp đồng để mở / đổi ô.
+ `BR-137`.

**Bước 4. Thêm ô, khoá bảo trì** — + THÊM Ô KHO MỚI, chọn loại, vị trí. Mã ô tự sinh. Khoá bảo trì `KV-TB-C105`, ghi lý do; Mở lại kho.
+ `PR-M9` : Mã `KV-<cơ sở>-<khu><phòng>`, FM chỉ đổi tay `AVAILABLE` ↔ `MAINTENANCE`, bắt buộc ghi chú 10–500 ký tự.

**Bước 5. Nhân viên** — `/manager/staff` → Thêm Nhân Viên. Tài khoản tự gán cơ sở mình. Danh sách hiện số việc đang làm, hoàn thành trong tháng.
+ `PR-22` · `PR-M12` · `PR-M13`.

**Bước 6. Bảng việc + báo cáo** — `/manager/tasks` lọc, giao, gỡ người nhận; `/manager/reports` doanh thu riêng cơ sở mình.
+ `BR-63` · `BR-65` · `PR-M7`.

### ⭐ F5-X1. Khoá vị trí ô đang có hợp đồng
Chỉnh sửa mặt bằng Tầng 2: ô có hợp đồng hiện icon khoá, không kéo / xoay / gỡ được. API: 409 `UNIT_IN_USE`. Ô trống vẫn kéo được; kéo chồng ô khác → báo đỏ, không lưu được (`MAP_CONFLICT`).
+ `BR-138` : Khách đã xem vị trí ô của mình nên không được dời.
+ `BR-107` : Lưu cả tầng trong 1 transaction.

### ⭐ F5-X2. Không làm âm số suất
Khoá bảo trì `KV-TB-L105` (Kho Đông): 409 **`SLOT_IN_USE`** vì ô trống cuối đang được `RES-F5-02` giữ suất.
+ `PR-M10`.

### F5-X3. Chặn khác
| Thao tác | Kết quả | Nghiệp vụ |
|---|---|---|
| Khoá bảo trì ghi chú "hong" | 400 | `PR-M9` |
| Đổi trạng thái ô đang thuê | 409 `UNIT_IN_USE` | `PR-M9` |
| Sửa thông tin ô đang có hợp đồng | 409 `UNIT_IN_USE` | `BR-138` |
| Xoá ô đã có hợp đồng | Không có nút. API: 409 `UNIT_HAS_CONTRACT_HISTORY` | `PR-21` |
| `fmbinhthanh` sửa ô Tân Bình | 403 `FORBIDDEN_FACILITY` | `PR-20` |
| Tạo Staff trùng email | 409 | `PR-M12` |
| Mật khẩu < 6 ký tự | 400 | `PR-M12` |
| Khoá `stafftanbinh1` (đang giữ task) | 409 | `PR-06` |
| Khoá Staff mới → người đó đăng nhập | 403 | `PR-L1` |
| Giao việc cho Staff bị khoá | 400 `STAFF_INACTIVE` | UC-16 |
| Xoá tầng còn ô | 409 `FLOOR_HAS_UNITS` | `BR-105` |

---

## Flow 6 — Renewal and Overdue Handling (nice to have)

### F6-H. Gia hạn ưu tiên
**Dữ liệu:** `HD-F6-01` của `nga.khach`, còn 10 ngày.
Hợp đồng → **Gia hạn**: dòng "Gia hạn ưu tiên đến hết ngày…", hạn mới từng gói. Chọn 3 tháng → VNPAY → `end_date` nối tiếp.
+ `BR-81` : Giá niêm yết hiện tại × số tháng × (1 − ưu đãi gia hạn).
+ `BR-82` : Còn hạn thì nối tiếp `end_date`.
+ `PR-R10` : Hạn chót ưu tiên = `end_date` − 3.
+ `PR-R9` : ⚡ Còn 15/10/7/3/1 ngày để demo nhắc gia hạn.

### F6-X1. Cửa sổ muộn, chưa ai cần ô
`HD-F6-02`, còn 2 ngày: banner vàng nhưng vẫn gia hạn được.
+ `PR-R10`.

### ⭐ F6-X2. Cửa sổ muộn, đã có khách giữ suất
**Dữ liệu:** `HD-F6-03` hẹn trả B203 sau 3 ngày; `RES-F6-05` đã cọc nhận sau 4 ngày, hết ô Kho Lớn khác.
`nga.khach` đổi ý mở Gia hạn: khoá nút thanh toán, gợi ý hẹn trả. API: 409 `RENEWAL_UNIT_RESERVED`.
+ `PR-R10` · `PR-R11`.

### ⭐ F6-X3. Quá hạn 3 ngày (điều khoản cũ)
**Dữ liệu:** `HD-F6-06` của `giang.khach`, cọc 1.850.000đ.
1. Khách: PIN khoá, phí trễ **555.000đ** + chiếm dụng khoảng **277.500đ**; đặt kho mới → `CUSTOMER_HAS_DEBT`.
2. FM `/manager/overdue`: THANH LÝ khoá (`LIQUIDATION_NOT_ALLOWED_YET`) → LIÊN HỆ ghi chú → MIỄN PHÍ TRỄ + lý do.
3. Khách **Gia hạn kèm phí trễ** → VNPAY → `ACTIVE`, PIN mở lại, kỳ mới tính từ hôm nay.

+ `PR-Q1` : Job 00:05 chuyển `OVERDUE`.
+ `PR-Q3` : Cọc × min(ngày, 5) × 10%, trần 50%.
+ `PR-Q14` : Giá ngày × 150% × số ngày, không trần; miễn phí trễ thì còn 100%.
+ `PR-Q5` · `PR-Q6` · `PR-R3` · `PR-Q11`.

### F6-X4. Thanh lý điều khoản cũ
**Dữ liệu:** `HD-F6-07` của `son.khach`, quá hạn 16 ngày, mới 2 lần liên hệ.
THANH LÝ khoá "(2/3 liên hệ)". API: `NOT_ENOUGH_CONTACTS`. Ghi lần 3 → thanh lý: `LIQUIDATED`, ô bảo trì, sinh task dọn ô. Staff **Dọn xong**: thiếu kiểm kê → `INVENTORY_REQUIRED`; đủ danh sách, người chứng kiến, kho tổng, vị trí kệ, ảnh → hàng vào kho tổng, ô `AVAILABLE`.
+ `PR-Q8` · `PR-Q9` · `PR-Q10` · `PR-Q16` · `BR-134`.

### ⭐ F6-X5. Điều khoản v4 tự thanh lý
`HD-F6-08` của `tam.khach`. FM mở hợp đồng → ⚡ **Quá hạn 1 ngày**: hợp đồng tự `LIQUIDATED`, sinh task chuyển hàng vào kho tổng. Khách thấy thẻ "Hàng của bạn đang ở kho tổng".
+ `D-15` : Bỏ ân hạn; hết hạn không gia hạn / không trả thì hôm sau thanh lý, chuyển kho tổng, không bán hàng.

### F6-X6. Khách nhận lại hàng
**Dữ liệu:** `HD-F6-09` của `giang.khach`, hàng ở kho tổng, nợ 225.000đ.
`/manager/held-goods` → KHÁCH NHẬN LẠI: còn nợ → `CUSTOMER_HAS_DEBT`. Khách trả nợ. Chưa tick thu phí → `STORAGE_FEE_UNPAID`. Tick "Đã thu tại quầy" → xong. API bán hàng → `GOODS_SALE_NOT_ALLOWED`.
+ `PR-Q15` : Phí lưu giữ theo ngày, khách phải hết nợ.
+ `PR-Q10` : Không bán, không tiêu huỷ.

---

## Flow 7 — Support Request and Issue Handling (nice to have)

### ⭐ F7-H. Báo lỗi khoá → cấp lại PIN
**Dữ liệu:** `HD-F7-01` của `phuc.khach`.
1. Khách `/ho-tro` → Gửi yêu cầu: Lỗi khoá, mô tả ≥ 10 ký tự. Ticket `OPEN`, sinh task `SUPPORT` khẩn.
2. Staff Nhận việc → **Cấp lại PIN** → nhập kết quả → hoàn tất. Ticket `RESOLVED`.
3. Khách **Đã ổn** → `CLOSED`.

+ `PR-51` · `PR-S1` · `PR-34` · `PR-S5` · `PR-S6` · `PR-52`.

### F7-X1. Giới hạn ticket
`HD-F7-02` đã có 3 ticket. Gửi thêm Vệ sinh → 409 `DUPLICATE_ISSUE_TYPE`. Bấm Chưa xong ở `SR-F7-03` để mở lại, rồi gửi loại khác → 409 `MAX_OPEN_TICKETS_REACHED`.
+ `PR-S2`.

### F7-X2. Chưa xong / tự đóng
`SR-F7-03` đã xử lý: Chưa xong (bắt buộc lý do) → `OPEN`, task mới. ⚡ Quá 3 ngày → tự `CLOSED`.
+ `PR-52`.

### F7-X3. Task hỗ trợ quá hạn
`SR-F7-02`, Staff 2 giữ, đã quá hạn: Staff không hoàn tất được. FM **Gia hạn xử lý** (tối đa 7 ngày, có lý do) → Staff làm tiếp.
+ `PR-S4`.

### ⭐ F7-X4. Hàng hư do cơ sở, có bảo hiểm
**Dữ liệu:** `BT-F7-04` của `quynh.khach`, Kho Lạnh L101, gói Nâng cao, khai giá 30 triệu, Staff đã kiểm tra.
`/manager/claims` → mở hồ sơ: ảnh khách, ảnh kiểm tra, biên bản nhận kho, cảm biến. Nhập lỗi cơ sở, giá trị 12.000.000đ, 100%, 2 ngày không dùng được → **Tính thử** → chốt `APPROVED`. Chi trả: thiếu UNC → `PAYMENT_EVIDENCE_REQUIRED`; đủ → `PAID`, sinh hồ sơ đòi bảo hiểm. ⚡ **Bảo hiểm duyệt & chi trả**.
+ `BR-127` : Lỗi cơ sở = tiền hàng (≤ trần) + phạt 1 tháng + hoàn thuê theo ngày.
+ `BR-125` : Trần = min(giá khai báo, trần gói).
+ `BR-128` : Cơ sở chi trước rồi đòi bảo hiểm; BOM xem chỉ đọc.

### F7-X5. Lỗi khách → từ chối
`BT-F7-05`: Staff nhận task, lập biên bản (thiếu ảnh → 400), nguyên nhân Lỗi khách → `INSPECTED`. FM chốt lỗi khách → `REJECTED`, bồi thường 0.
+ `BR-126` · `BR-127`.

### F7-X6. Lỗi cơ sở, khách chấm dứt hợp đồng
`BT-F7-06`: FM chốt hướng **TERMINATE** → bật `fault_termination`. `HD-F7-05` hẹn trả kho: không phí phá hợp đồng, hoàn tiền thuê theo số ngày còn lại.
+ `BR-127`.

### F7-X7. Hợp đồng quá hạn không cấp lại PIN
**Làm trước F6-X3.** `SR-F7-07` trên `HD-F6-06`: Staff bấm Cấp lại PIN → 409 `CONTRACT_OVERDUE`.
+ `PR-S6` · `PR-Q5`.

### F7-X8. Cảm biến vượt ngưỡng
`HD-F7-03` (Kho Lạnh): ⚡ **Cảm biến vượt ngưỡng** → biểu đồ tăng tới 14°C, báo khách + FM, sinh task bảo trì lý do `SENSOR`.
+ `BR-129` : Ngưỡng theo loại kho. 🔸 Chưa nối thiết bị thật.

---

## Chốt buổi: nhật ký

`admin@queenkho.com` → `/admin/logs`, lọc `[UNIT_ASSIGN]`, `[CHECK_IN]`, `[UNIT_TRANSFER]`.
+ `PR-A8` : Ghi đúng người thao tác.
+ `PR-A9` : Mọi nghiệp vụ đều có log.
+ `PR-07` : Chỉ xem, không sửa / xoá.

---

## Khi giảng viên hỏi

| Câu hỏi | Trả lời |
|---|---|
| SmartLock, RFID, cảm biến có thật không? | Mô phỏng, chưa nối thiết bị. Nghiệp vụ cấp / khoá / thu hồi PIN và cảnh báo đã chạy thật |
| Bảo hiểm có đối tác thật không? | Mô phỏng qua `InsuranceProviderClient`, nghiệp vụ chi trước rồi đòi lại đã chạy thật |
| Nút ⚡ có làm sai dữ liệu không? | Chỉ dời mốc thời gian rồi để nghiệp vụ thật chạy tiếp, vẫn kiểm tra quyền, có log `[SIMULATION]`, tắt bằng `SIMULATION_ENABLED=false` |
| Khách B gia hạn đè ngày khách A nhận thì sao? | Nhóm chốt không chặn theo số ngày. Lịch báo đỏ, check-in bị chặn `UNIT_STILL_OCCUPIED`, FM đổi ô |
| Sao không gán ô ngay khi khách đặt? | Khách đặt theo loại kho; FM gán để tối ưu, lấp khoảng trống |

**Không nên demo:**
- Nghiệm thu trả kho trước ngày hẹn: rule `PR-O5` ghi "trong ngày hẹn" nhưng code hiện chỉ chặn quá hạn, chưa chặn sớm.
- Số ô ở trang tìm kiếm khi loại kho có đơn gán tương lai: trang tìm kiếm đếm theo hôm nay, trang đặt kho mới tính đúng khoảng ngày.

---

## Dữ liệu demo theo mã

| Mã | Khách | Ô | Trạng thái lúc nạp | Dùng cho |
|---|---|---|---|---|
| `RES-F1-01` → `03` | Hải | — | Đã cọc | F1-X5 |
| `RES-F1-04` / `HD-F1-04` | Hải | A105 | Chờ nhận, qua giờ hẹn 5h | F1-X5 |
| `RES-F1-05` | Hải | — | Đã cọc, tới ngày chưa gán | F1-X5 |
| `HD-F1-06` | Đức | E211 | Kết thúc, nợ 650.000đ | F1-X3 |
| `HD-F1-07`, `HD-F1-08` | Khánh, Hoa Mai | B201, B202 | Chờ nhận +60 ngày, đang thuê | F1-X4 |
| `HD-F1-09`, `HD-F1-10` | Khánh, Vy | A106, B205 | Hẹn trả +5 ngày, đang thuê | F1-X2 |
| `HD-F1-11` | Tín | L102 | Đang thuê | F1-X9 |
| `RES-F2-01` | Bình | — | Đã cọc, nhận hôm nay | F2-H |
| `HD-F2-02` | Bình | D202 | Chờ nhận +3 ngày, Staff 1 giữ | F2-X1 |
| `HD-F2-03` | Khánh | D203 | Chờ nhận +45 ngày | F2-X3 |
| `HD-F2-04`, `RES-F2-05`, `RES-F2-06` | Khánh, Tâm | C101 | Chờ nhận +60, 2 đơn +7 ngày | F2-X4 |
| `HD-F2-07` | Bình | D204 (bảo trì) | Chờ nhận hôm nay | F2-X5 |
| `HD-F2-08`, `09`, `10` | Lan | D205, D206, D207 | Quá hẹn | F2-X6, X7, X8 |
| `HD-F2-11`, `HD-F2-12` | Hạnh, Khánh | D208 | Trùng lịch | F2-X9 |
| `HD-F2-13`, `HD-F2-14` | Tâm, Khánh | D209 | Đang thuê, chờ nhận +60 | F2-X10 |
| `HD-F3-01` | Cường | D210 | Đang thuê, còn 10 ngày | F3-H |
| `HD-F3-02`, `HD-F3-03` | Dung | D211, D212 | Đang thuê, hẹn trả +5 | F3-X1, X2 |
| `HD-F3-04`, `05`, `06` | Minh | D213, D214, D215 | Hẹn trả hôm nay | F3-X3, X4, X5 |
| `HD-F3-07` | Bảo | D216 (bảo trì) | Kết thúc, đang sửa | F3-X6 |
| `HD-F3-08` | Cường | E202 | Đang thuê | F3-X7 |
| `HD-F5-01`, `RES-F5-02` | Tín, Tâm | L103 | Đang thuê, giữ suất L105 | F5-X2 |
| `HD-F6-01`, `02` | Nga | E204, E205 | Còn 10 ngày, còn 2 ngày | F6-H, X1 |
| `HD-F6-03`, `HD-F6-04`, `RES-F6-05` | Nga, Vy, Tâm | B203, B204 | Hẹn trả +3, đang thuê, đơn +4 | F6-X2, F2-X11 |
| `HD-F6-06` | Giang | A104 | Quá hạn 3 ngày, v3 | F6-X3, F7-X7 |
| `HD-F6-07` | Sơn | A103 | Quá hạn 16 ngày, v3 | F6-X4 |
| `HD-F6-08` | Tâm | E207 | Đang thuê, v4 | F6-X5 |
| `HD-F6-09` | Giang | E208 | Thanh lý, hàng ở kho tổng | F6-X6 |
| `HD-F7-01`, `02` | Phúc | E209, E210 | Đang thuê | F7-H, X1–X3 |
| `HD-F7-03`, `04`, `05` | Quỳnh | L101, A102, A101 | Đang thuê, có hồ sơ bồi thường | F7-X4, X5, X6, X8 |
| `RES-LS-*`, `HD-LS-*` | Khách lịch sử | Nhiều cơ sở | 23 hợp đồng đã kết thúc, 12 tháng | F4 doanh thu |
| `HD-CS-1` → `8` | Khách lịch sử | BT, TD, GV | 6 đang thuê, 2 quá hạn | F4, lấp đầy |

Voucher: `NEWKHO` (mặc định) · `HE2026` 150.000đ · `DAIHAN10` 10% từ 3 tháng · `LANH50` chỉ Kho Lạnh · `HETHAN` · `HETLUOT`.
Ô còn trống cho ca chính: Mini M (A107, C103, C104, E-), Tiêu Chuẩn (D201, D217–D224).

## Kiểm tra lại toàn bộ bằng script

`docs/test-e2e/e2e-demo-7-flow.sh` chạy thật mọi ca ở trên qua API. **Nó dùng hết dữ liệu**, chạy xong phải nạp lại 2 file SQL.

```bash
bash docs/test-e2e/e2e-demo-7-flow.sh
```

# QueenKho — Kịch bản demo 7 flow

> Soạn 08/11/2026, dựng lại 10/11/2026 theo góp ý: **chạy hết happy path trước**, sau đó mới tới exception.
> Dữ liệu: `sql_script/QueenKho_setup_data.sql` + `sql_script/QueenKho_demo_data.sql`. Mã nghiệp vụ tra ở `docs/business-rules.md`.
>
> - **Phần A — Happy path:** 7 flow nối nhau, mỗi bước ghi *tài khoản · màn hình · thao tác · data nhập · kết quả*.
> - **Phần B — Exception:** mỗi ca theo đúng 4 mục **Tên exception · Các bước · Data mỗi bước · Lưu ý**.
> - ⚡ = nút "Giả lập" viền cam: tua thời gian rồi để nghiệp vụ thật chạy tiếp (BR-115).
> - ⭐ = nên demo trên lớp. Ca không có ⭐ để dành khi giảng viên hỏi hoặc còn giờ.

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
| Không mở tab mới trong cùng cửa sổ đã đăng nhập | Tab mới không có phiên → phải đăng nhập lại. Xem hợp đồng giờ mở **popup** ngay trên màn đang xem |
| Đừng đăng xuất giữa chừng | |

**Nếu VNPAY lỗi lúc demo:** nói rõ đây là cổng ngoài, chuyển sang Flow 2 với đơn `RES-F2-01` đã cọc sẵn.

### 0.3 Tài khoản (mật khẩu đều `123456`)

| Vai | Tài khoản | Dùng cho |
|---|---|---|
| FM Tân Bình | `fmtanbinh@gmail.com` | Flow 2, 3, 5, 6, 7 |
| FM Bình Thạnh | `fmbinhthanh@gmail.com` | Ca sai cơ sở |
| Staff Tân Bình | `stafftanbinh1@gmail.com`, `stafftanbinh2@gmail.com` | Check-in, nghiệm thu, hỗ trợ |
| BOM | `bom@queenkho.com` | Flow 4 |
| Admin | `admin@queenkho.com` | Xem nhật ký cuối buổi |
| Khách | `an.khach@queenkho.local` | Flow 1 happy path, khách chưa có gì |
| | `hai.khach@queenkho.local` | 5 mức huỷ đơn |
| | `duc.khach@queenkho.local` | Còn nợ, bị chặn đặt kho |
| | `binh.khach@queenkho.local` | Flow 2 happy path |
| | `cuong.khach@queenkho.local` | Flow 3 happy path |
| | `dung.khach@queenkho.local` | Trả sớm, đổi ý trả kho |
| | `minh.khach@queenkho.local` | Trả kho có sự cố |
| | `nga.khach@queenkho.local` | Gia hạn |
| | `giang.khach@queenkho.local`, `son.khach@queenkho.local`, `tam.khach@queenkho.local` | Quá hạn, kho tổng |
| | `phuc.khach@queenkho.local` | Hỗ trợ |
| | `quynh.khach@queenkho.local` | Bồi thường, cảm biến |

### 0.4 Phân bổ thời gian

| Phần | Thời lượng | Nội dung |
|---|---|---|
| Nghiệp vụ nền | 1 phút | `PR-90`, `PR-91`, `D-01` (bên dưới) |
| **Phần A — Happy path** | 25 phút | A1 → A7 liền mạch, chốt bằng nhật ký Admin |
| **Phần B — Exception ⭐** | 15 phút | F1-X1, F1-X3, F1-X5 · F2-X3, F2-X4, F2-X5, F2-X6, F2-X10 · F3-X1, F3-X4 · F4-X1 · F5-X1, F5-X2 · F6-X2, F6-X3, F6-X5 · F7-X4 |
| Exception không ⭐ | Còn giờ / khi được hỏi | Phần còn lại của Phần B |

**Thứ tự bắt buộc:** F7-X7 làm trước F6-X3 (dùng chung `HD-F6-06`). F4-X2 chỉ làm ở Bình Thạnh. Các ca còn lại dùng dữ liệu riêng, làm ca nào trước cũng được.

Nghiệp vụ nền, nói 1 lần đầu buổi:
+ `PR-90` : Người thao tác lấy từ token; khách chỉ thấy dữ liệu của mình, FM / Staff chỉ thấy cơ sở mình.
+ `PR-91` : Mọi thay đổi trạng thái trong 1 transaction và ghi `activity_logs`.
+ `D-01` : Trả trước theo kỳ: lúc đặt trả cọc + tiền thuê cả kỳ, không thu hằng tháng.

---

# PHẦN A — HAPPY PATH

Mỗi flow là 1 bảng: chạy từ trên xuống, không rẽ nhánh. Cột **Nghiệp vụ** là câu nói khi trình bày.

## ⭐ A1. Flow 1 — Storage Unit Reservation (tìm kho, đặt kho, thanh toán cọc)

**Dữ liệu dùng:** khách `an.khach` (chưa có đơn nào), voucher `HE2026`, Kho Mini M còn ô trống (A107, C103, C104...).

| Bước | Tài khoản · Màn hình | Thao tác | Data nhập | Kết quả | Nghiệp vụ |
|---|---|---|---|---|---|
| 1 | Chưa đăng nhập · `/tim-va-dat-kho` | Chọn thành phố, xem cơ sở | TP.HCM → QueenKho Tân Bình | Danh sách loại kho, giá, số ô còn trống. **Không thấy ô cụ thể** | `BR-10` chỉ hiện cơ sở `ACTIVE` · `BR-11` suất = ô trống − đơn giữ suất · `BR-135` khách chọn loại, FM chỉ định ô |
| 2 | `an.khach` · trang đặt kho | Đăng nhập, chọn loại kho → Đặt kho, chọn ngày nhận | Kho Mini M · ngày nhận = hôm nay + 7 | "Còn N ô trống cho khoảng dd/MM – dd/MM" | `PR-B4` nhận từ ngày mai tới tối đa 90 ngày · `BR-136` đếm theo khoảng ngày thuê |
| 3 | Như trên | Chọn gói, hàng, bảo hiểm, voucher, tick điều khoản | Gói 3 tháng · Gia dụng · bảo hiểm Cơ bản · `HE2026` → Áp dụng · tick 2 điều khoản | Thuê 2.250.000đ, ưu đãi 5% −112.500đ, cọc 750.000đ, voucher −150.000đ, **tổng 2.737.500đ** | `D-08` ưu đãi 0/5/10/15% · `PR-M6` cọc theo chính sách hiện hành · `BR-24` công thức tổng · `BR-25` 1 mã/đơn, không nhập thì tự áp `NEWKHO` · `BR-125` gói Cơ bản trần 20tr · `BR-131` bắt buộc khai loại hàng · `BR-102` lưu điều khoản `v4` + thời điểm |
| 4 | Như trên → VNPAY | THANH TOÁN GIỮ KHO, trả thẻ | Thẻ NCB ở 0.2 | Đơn `PENDING` giữ suất 15 phút → quay về trang xác nhận: **`DEPOSIT_PAID`**, có mã đơn | `PR-B1` đếm lại suất có khoá · `PR-B6` giữ 15 phút · `BR-27` HMAC, khớp tiền, xử lý 1 lần · `BR-111`/`BR-117` FM nhận thông báo, khách nhận thông báo + email |
| 5 | `an.khach` · `Kho của tôi` | Bấm HỦY ĐƠN để xem màn xem trước, **đóng, không xác nhận** | — | "Huỷ trong 30 phút sau thanh toán hoàn 100%" | `BR-32a` ân hạn 30 phút |

**Lưu ý:** danh sách `Kho của tôi` có thanh lọc thời gian (ngày đặt / nhận kho / hết hạn) — chỉ nhắc, không cần thao tác.

## ⭐ A2. Flow 2 — Storage Check-in and Handover (gán ô, giao việc, bàn giao)

**Dữ liệu dùng:** `RES-F2-01` của `binh.khach`, Kho Tiêu Chuẩn, 3 tháng, **nhận kho hôm nay** (đã cọc sẵn, không phụ thuộc VNPAY).

| Bước | Tài khoản · Màn hình | Thao tác | Data nhập | Kết quả | Nghiệp vụ |
|---|---|---|---|---|---|
| 1 | `fmtanbinh` · `/manager/pending` | Dòng `RES-F2-01` → CHI TIẾT → GÁN Ô KHO | Chọn 1 ô Tiêu Chuẩn trống (vd. `D201`) → XÁC NHẬN GÁN PHÒNG | Modal có thời gian thuê, ô trống suốt thời gian thuê, sơ đồ, nút Xem lịch ô kho. Sau gán: đơn `UNIT_ASSIGNED`, hợp đồng `PENDING_CHECK_IN`, sinh task `CHECK_IN`, ô `OCCUPIED` | `BR-40`/`BR-123` hàng đợi ưu tiên khách cũ + gói dài · `BR-41` chỉ ô cùng cơ sở, cùng loại, rảnh suốt kỳ · `BR-42` khoá ô, 1 transaction tạo HĐ + task + thông báo · `BR-43` HĐ gắn chính sách hiện hành · `BR-110` chọn trên mặt bằng |
| 2 | `fmtanbinh` · `/manager/tasks` | Task Check-in vừa sinh → Giao việc | Nhân viên Tân Bình 1 | Task `IN_PROGRESS`, Staff nhận thông báo | `PR-T1` giao trong 30 ngày trước hẹn · `BR-64` Staff tự nhận được, ai bấm trước giữ |
| 3 | `stafftanbinh1` · `/staff` → mở task | Đối chiếu khách, CCCD, ô, vị trí, loại hàng. Tick đủ 6 mục → XÁC NHẬN BÀN GIAO | Giữ PIN gợi ý · RFID `RFID-DEMO-01` · bấm **+ Ảnh mẫu (demo)** (nhanh: GIẢ LẬP HOÀN THIỆN) | Biên bản `CHECK_IN`, hợp đồng **`ACTIVE`**, task `COMPLETED` | `BR-70` chỉ Staff đang giữ task · `BR-71`/`BR-132` đủ 6 mục gồm kiểm tra hàng · `BR-121` 1–10 ảnh hiện trạng · `BR-72`/`BR-73` PIN 6 số, RFID không trùng |
| 4 | `binh.khach` · `Kho của tôi` → XEM HĐ | Xem hợp đồng | — | `ACTIVE`, ô, vị trí trên mặt bằng, thời hạn, PIN, RFID, biên bản + ảnh | `BR-80` khách xem PIN/RFID · `BR-117` email không chứa PIN · `BR-109` ô khác chỉ là hình khối |

**Lưu ý:** gán ô **chưa** cấp PIN; PIN + RFID chỉ cấp lúc check-in. 🔸 SmartLock là mô phỏng.

## ⭐ A3. Flow 3 — Rented Storage Unit Management (đang thuê → trả kho → hoàn cọc)

**Dữ liệu dùng:** `HD-F3-01` của `cuong.khach`, gói 3 tháng, còn 10 ngày, ô D210.

| Bước | Tài khoản · Màn hình | Thao tác | Data nhập | Kết quả | Nghiệp vụ |
|---|---|---|---|---|---|
| 1 | `cuong.khach` · `Kho của tôi` → XEM HĐ | Xem hợp đồng | — | PIN, RFID, thời hạn, tiền đã đóng, vị trí ô, biên bản + ảnh nhận kho, cảm biến | `BR-80` · `BR-109` · `BR-121` · `BR-129` |
| 2 | Như trên · tab **Trả kho** | Hẹn trả kho | Ngày = ngày mai · Chuyển khoản: ngân hàng, STK, chủ TK | Bảng dự tính "tháng cuối, chỉ hoàn cọc". HĐ `TERMINATION_PENDING`, sinh task `CHECK_OUT`, PIN vẫn dùng được | `PR-O1` hẹn từ mai tới hết `end_date` · `PR-O3` bắt buộc cách nhận tiền · `PR-R11` ô thành "sắp trống" từ ngày hẹn + 1 |
| 3 | `stafftanbinh1` · mở task Check-out | ⚡ GIẢ LẬP: KHÁCH TỚI TRẢ KHO HÔM NAY → Nhận việc → GIẢ LẬP KHO TỐT → hoàn tất | — | HĐ `TERMINATED`, xoá PIN/RFID, đơn `COMPLETED`, ô `AVAILABLE`, sinh task `REFUND` **1.850.000đ** | `PR-O6` ô trống + xác minh danh tính bắt buộc · `PR-O7` 1 transaction · `PR-O2a` tháng cuối không hoàn thuê, không phí phá HĐ |
| 4 | `fmtanbinh` · `/manager/refunds` | Mở task hoàn tiền → Xác nhận hoàn tiền | Ảnh ủy nhiệm chi + mã FT | Giao dịch `REFUND` `SUCCESS`, khách nhận thông báo | `PR-O12` hoàn tiền là việc của FM · `PR-O15` chuyển khoản bắt buộc ảnh UNC |

## ⭐ A4. Flow 4 — Business Rules, Fee Management, Revenue Monitoring (BOM)

**Dữ liệu dùng:** `bom@queenkho.com`; 23 hợp đồng lịch sử 12 tháng (`HD-LS-*`), `HD-CS-1` → `8`.

| Bước | Màn hình | Thao tác | Data nhập | Kết quả | Nghiệp vụ |
|---|---|---|---|---|---|
| 1 | `/bom/revenue` | Chọn THEO NĂM, xem Toàn bộ cơ sở rồi lọc từng cơ sở | — | Doanh thu thuê, thu phí phạt, đã hoàn, cọc đang giữ, xu hướng 12 tháng, theo cơ sở / loại kho, lấp đầy, đối soát có mã FT, XUẤT CSV | `PR-M7` ghi theo ngày thực thu, cọc không tính doanh thu · `PR-M8` phí trừ cọc tính vào "Thu phí phạt" · `PR-O15` đối soát mã FT + UNC |
| 2 | `/bom/unit-types` | Sửa giá loại kho | Kho Đặc Biệt XL → 6.800.000đ | `HD-F1-10` không đổi số tiền đã thu | `PR-12` giá mới chỉ cho đơn mới / lần gia hạn sau · `PR-M3` tên duy nhất, giá > 0 |
| 3 | `/bom/policies` | Bình Thạnh → Cập nhật → xem Lịch sử chính sách | Hệ số cọc `2` | Phát hành phiên bản mới; `HD-CS-1` giữ bản cũ | `PR-13` mỗi cơ sở 1 bản hiệu lực, không ghi đè · `PR-14` giới hạn tham số · `PR-15` huỷ trước check-in cố định theo BR-32 |
| 4 | `/bom/vouchers` | TẠO VOUCHER | `THU2026` · 80.000đ · chỉ Kho Mini M | Voucher mới trong bảng (cạnh `HE2026`, `LANH50`, `HETHAN`, `HETLUOT`) | `BR-25` · `BR-133` |
| 5 | `/bom/overdue` | `HD-CS-7` (Gò Vấp) → MIỄN PHÍ TRỄ | Lý do miễn | Phí trễ về 0 | `BR-130` BOM miễn mọi cơ sở, mỗi đợt 1 lần; thanh lý vẫn tính đủ |

## ⭐ A5. Flow 5 — Facility Storage and Staff Management (FM)

**Dữ liệu dùng:** `fmtanbinh`.

| Bước | Màn hình | Thao tác | Data nhập | Kết quả | Nghiệp vụ |
|---|---|---|---|---|---|
| 1 | `/manager` | Xem dashboard | — | Ô theo trạng thái, lấp đầy theo khu, đơn chờ gán, HĐ quá hạn, việc cần xử lý; mỗi thẻ dẫn tới màn tương ứng | `PR-M14` |
| 2 | `/manager/storage` | Chọn Tầng 2 | — | Ô hiện "Còn n ngày hết hạn · trống lại sau m ngày", "Đã có khách đặt từ dd/MM", nhãn "Sắp trống" | `BR-105`→`BR-107` mặt bằng theo tầng, lưới 0,5 m · `BR-135` · `BR-137` |
| 3 | `/manager/storage` → **LỊCH Ô KHO** | Đổi khoảng xem, lọc loại kho, bấm 1 ô, bấm 1 hợp đồng → **Mở hợp đồng** | 1/3/6/12 tháng | Thấy khoảng đã đặt / khoảng trống. Hợp đồng mở **popup** ngay trên lịch (không mở tab mới, không mất đăng nhập) | `BR-137` |
| 4 | `/manager/storage` | + THÊM Ô KHO MỚI · khoá bảo trì rồi Mở lại kho | Chọn loại + vị trí · khoá `KV-TB-C105`, lý do ≥ 10 ký tự | Mã ô tự sinh; ô `MAINTENANCE` rồi `AVAILABLE` | `PR-M9` mã `KV-<cơ sở>-<khu><phòng>`, chỉ đổi tay `AVAILABLE` ↔ `MAINTENANCE`, ghi chú 10–500 ký tự |
| 5 | `/manager/staff` | Thêm Nhân Viên | Họ tên, email mới, mật khẩu ≥ 6 ký tự | Tài khoản tự gán cơ sở mình; danh sách có số việc đang làm, hoàn thành trong tháng | `PR-22` · `PR-M12` · `PR-M13` |
| 6 | `/manager/tasks` | Lọc theo thời gian, giao việc, gỡ người nhận | Thanh lọc: **Hạn chót · Sớm nhất trước** · bấm **Hôm nay** | Việc hạn sớm nhất lên đầu (việc khẩn vẫn ghim trên cùng) | `BR-63` · `BR-65` · `PR-34` |
| 7 | `/manager/customers` | Lọc HĐ theo **Ngày kết thúc · Sớm nhất trước** → bấm mã HĐ | — | HĐ sắp hết hạn lên đầu; chi tiết mở popup, đóng popup vẫn giữ bộ lọc / trang | — |
| 8 | `/manager/reports` | Xem báo cáo | — | Doanh thu riêng cơ sở mình | `PR-M7` |

## A6. Flow 6 — Renewal and Overdue Handling (nice to have)

**Dữ liệu dùng:** `HD-F6-01` của `nga.khach`, còn 10 ngày.

| Bước | Tài khoản · Màn hình | Thao tác | Data nhập | Kết quả | Nghiệp vụ |
|---|---|---|---|---|---|
| 1 | `nga.khach` · hợp đồng `HD-F6-01` | Bấm **Gia hạn** | — | Dòng "Gia hạn ưu tiên đến hết ngày…", hạn mới của từng gói | `PR-R10` hạn chót ưu tiên = `end_date` − 3 |
| 2 | Như trên → VNPAY | Chọn gói, thanh toán | Gói 3 tháng · thẻ NCB | `end_date` nối tiếp kỳ cũ | `BR-81` giá niêm yết hiện tại × tháng × (1 − ưu đãi) · `BR-82` còn hạn thì nối tiếp |
| 3 (tuỳ chọn) | `fmtanbinh` · chi tiết 1 HĐ `ACTIVE` | ⚡ Còn 15/10/7/3/1 ngày hết hạn | — | Khách nhận nhắc gia hạn (chuông + email); FM nhận nhắc nếu khách chưa gia hạn | `PR-R9` |

## A7. Flow 7 — Support Request and Issue Handling (nice to have)

**Dữ liệu dùng:** `HD-F7-01` của `phuc.khach`.

| Bước | Tài khoản · Màn hình | Thao tác | Data nhập | Kết quả | Nghiệp vụ |
|---|---|---|---|---|---|
| 1 | `phuc.khach` · `/ho-tro` | Gửi yêu cầu | Hợp đồng `HD-F7-01` · Lỗi khoá · mô tả ≥ 10 ký tự | Ticket `OPEN`, sinh task `SUPPORT` **khẩn** | `PR-51` · `PR-S1` · `PR-34` task khẩn nổi lên đầu |
| 2 | `stafftanbinh1` · `/staff` | Nhận việc → **Cấp lại PIN** → nhập kết quả → hoàn tất | Kết quả xử lý | Ticket `RESOLVED`, khách có PIN mới | `PR-S5` · `PR-S6` |
| 3 | `phuc.khach` · `/ho-tro` | Bấm **Đã ổn** | — | Ticket `CLOSED` | `PR-52` |

## A8. Chốt happy path: nhật ký

| Bước | Tài khoản · Màn hình | Thao tác | Data nhập | Kết quả | Nghiệp vụ |
|---|---|---|---|---|---|
| 1 | `admin@queenkho.com` · `/admin/logs` | Lọc theo hành động | `[UNIT_ASSIGN]`, `[CHECK_IN]`, `[UNIT_TRANSFER]` | Mọi thao tác vừa demo đều có log, đúng người thao tác | `PR-A8` · `PR-A9` · `PR-07` chỉ xem, không sửa / xoá |

---

# PHẦN B — EXCEPTION

Mỗi ca: **Tên exception · Các bước · Data mỗi bước · Lưu ý**. Bảng gộp *các bước* và *data mỗi bước*; cột **Kết quả** là điều phải thấy được trên màn hình (hoặc mã lỗi khi gọi API).

## Flow 1 — Đặt kho

### ⭐ F1-X1. Nhập sai khi đặt kho

**Các bước + data mỗi bước** (`an.khach`, trang đặt Kho Mini M)

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Chọn loại hàng | Thực phẩm | Bị khoá, ghi chỉ gửi kho lạnh / đông. API: 400 `GOODS_REQUIRES_COLD_STORAGE` |
| 2 | Bấm thanh toán khi chưa chọn loại hàng | Loại hàng để trống | Lỗi hiện **ngay trên nút thanh toán**, trang cuộn tới mục thiếu, viền đỏ. API: `GOODS_CATEGORY_REQUIRED` |
| 3 | Bấm thanh toán khi chưa tick điều khoản | Bỏ tick 2 điều khoản | Báo lỗi, viền đỏ mục cam kết. API: `TERMS_NOT_ACCEPTED` |
| 4 | Chọn ngày nhận quá xa | Hôm nay + 91 ngày | Ô ngày chặn. API: 400 `START_DATE_TOO_FAR` |
| 5 | Áp voucher sai loại kho | `LANH50` | "Mã không áp cho loại kho này" (`VOUCHER_INVALID`) |
| 6 | Áp voucher hết hạn / hết lượt | `HETHAN`, `HETLUOT` | "Hết hạn" / "Hết lượt" (`VOUCHER_INVALID`) |
| 7 | Áp voucher chưa đủ gói | `DAIHAN10` + gói 1 tháng | "Chưa đủ gói tối thiểu 3 tháng" |

**Lưu ý**
- `BR-131` loại hàng bắt buộc, thực phẩm chỉ kho lạnh/đông · `BR-102` điều khoản bắt buộc · `PR-B4` tối đa 90 ngày · `BR-133` voucher theo loại kho · `BR-25` hạn / lượt / gói tối thiểu.
- Không tạo đơn nào, làm bao nhiêu lần cũng được.

### F1-X2. Hết ô nhưng có ô sắp trống (Kho Đặc Biệt XL)

**Các bước + data mỗi bước**

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Tìm kho, xem Kho Đặc Biệt XL | `/tim-va-dat-kho` · Tân Bình | Hiện **"Trống từ dd/MM"** (ngày hẹn trả của `HD-F1-09` + 1) |
| 2 | Bấm đặt | `an.khach` | Ngày nhận tối thiểu là ngày đó |
| 3 | Gọi API đặt trước ngày đó | `startDate` < ngày trống | 409 `NO_AVAILABILITY`, message báo ngày sớm nhất |

**Lưu ý**
- Dữ liệu: `HD-F1-09` ở A106 đã hẹn trả sau 5 ngày, `HD-F1-10` ở B205 đang thuê.
- `PR-R11` ô của khách đã hẹn trả được bán trước cho đơn nhận từ ngày giao ô · `PR-R12` tới ngày mà cơ sở chưa giao được ô thì khách huỷ được hoàn 100%.

### ⭐ F1-X3. Khách còn nợ bị chặn đặt kho

**Các bước + data mỗi bước** (`duc.khach`)

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Đặt kho bất kỳ | Loại kho bất kỳ, đủ thông tin | Lỗi "đang có khoản nợ" + nút dẫn tới hợp đồng. API: 409 `CUSTOMER_HAS_DEBT` |
| 2 | Vào `Thanh toán`, trả nợ | 650.000đ · thẻ NCB | Dòng nợ `SUCCESS` |
| 3 | Đặt kho lại | Như bước 1 | Tạo đơn bình thường |

**Lưu ý**
- Dữ liệu: `HD-F1-06` đã kết thúc, nợ phí sự cố 650.000đ.
- `PR-Q12` có HĐ `OVERDUE` hoặc nợ `DAMAGE_FEE` / `OVERSTAY_FEE` thì không đặt mới · `PR-50` trả nợ VNPAY dùng lại chính dòng nợ.
- Bước 2 cần VNPAY; mạng lỗi thì dừng ở bước 1.

### F1-X4. Số ô trống theo khoảng ngày (Kho Gia Đình)

**Các bước + data mỗi bước** (`an.khach`, trang đặt Kho Gia Đình)

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Chọn ngày + gói | Nhận sau 7 ngày · gói 1 tháng | **Còn 1 ô** |
| 2 | Đổi gói | Gói 3 tháng | **Không còn ô**, gợi ý chọn ngày khác hoặc gói ngắn hơn |

**Lưu ý**
- Dữ liệu: B201 đã gán khách nhận sau 60 ngày (`HD-F1-07`), B202 đang thuê (`HD-F1-08`).
- `BR-136` khoảng thuê phải rảnh trọn vẹn; HĐ đang thuê còn quyền gia hạn coi như chưa biết ngày trả.
- Trang **tìm kiếm** đếm ô theo hôm nay, chỉ trang **đặt kho** đếm theo khoảng ngày — demo ở trang đặt kho.

### ⭐ F1-X5. Năm mức huỷ đơn

**Các bước + data mỗi bước** (`hai.khach` → `Kho của tôi` → HỦY ĐƠN từng đơn, xem màn xem trước)

| # | Đơn | Tình huống | Kết quả trên màn xem trước |
|---|---|---|---|
| 1 | `RES-F1-01` | Còn ≥ 48h | Giữ 0 · hoàn 3.600.000đ · `FULL_REFUND` |
| 2 | `RES-F1-02` | Còn 24–48h | Giữ 925.000đ (50% cọc) · hoàn 2.675.000đ · `HALF_DEPOSIT` |
| 3 | `RES-F1-03` | Còn < 24h | Giữ 1.850.000đ (100% cọc) · hoàn 1.750.000đ · `FULL_DEPOSIT` |
| 4 | `RES-F1-04` | Đã qua giờ hẹn, đã gán ô | Giữ cọc + 1 tháng = 3.574.167đ · hoàn 3.448.333đ · `AFTER_APPOINTMENT` |
| 5 | `RES-F1-05` | Tới ngày mà cơ sở chưa gán ô | Giữ 0 · hoàn 3.600.000đ · `FACILITY_FAULT` |
| 6 | Xác nhận huỷ `RES-F1-02` | Lý do huỷ | Đơn `REFUND_PENDING`; FM thấy task hoàn tiền ở `/manager/refunds` |

**Lưu ý**
- `BR-32` mốc 48h / 24h / qua giờ hẹn cố định toàn hệ thống · `PR-R12` lỗi cơ sở hoàn 100% · `PR-O12` mỗi khoản hoàn sinh 1 task `REFUND`.
- Mốc 24–48h chỉ đúng trong 12 tiếng sau khi nạp dữ liệu (0.1).
- Chỉ xác nhận huỷ 1 đơn; các đơn khác chỉ xem rồi đóng để còn demo lại.

### F1-X6. Không truy cập được dữ liệu người khác

**Các bước + data mỗi bước**

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | `an.khach` gọi API xem trước huỷ đơn của Hải | id của `RES-F1-01` | 403 `FORBIDDEN_OWNER` |

**Lưu ý**
- `PR-90` bản ghi theo id phải thuộc đúng khách. Làm bằng Postman / DevTools.

### F1-X9. Hai khách tranh suất cuối (Kho Lạnh)

**Các bước + data mỗi bước**

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Mở trang đặt Kho Lạnh ở 2 cửa sổ | Cửa sổ 1 `an.khach`, cửa sổ 2 `khanh.khach` · loại hàng Thực phẩm | Cả 2 thấy còn 1 ô |
| 2 | Cửa sổ 1 bấm thanh toán | — | Sang VNPAY, đơn giữ suất |
| 3 | Cửa sổ 2 bấm thanh toán | — | 409 `NO_AVAILABILITY`, lỗi hiện trên nút |

**Lưu ý**
- Dữ liệu: Kho Lạnh còn đúng 1 suất (L104).
- `PR-B1` khoá dòng cơ sở trong transaction nên 2 khách xếp hàng, không bán vượt.

### F1-X10. Quá 15 phút chưa thanh toán

**Các bước + data mỗi bước**

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Đặt 1 đơn, không trả tiền | `an.khach` · loại kho bất kỳ | Đơn `PENDING` |
| 2 | `Kho của tôi` → ⚡ **Quá 15p** | — | Đơn `EXPIRED`, suất được nhả |
| 3 | Thanh toán lại đơn đó | — | Bị từ chối |

**Lưu ý**
- `PR-B6` job mỗi phút huỷ đơn `PENDING` quá 15 phút · `PR-B8` huỷ trên VNPAY thì đơn vẫn `PENDING`, trả lại được tới hết 15 phút.

## Flow 2 — Gán ô, giao việc, bàn giao

### F2-X1. Sai dữ liệu khi bàn giao

**Các bước + data mỗi bước** (làm ngay trong A2 bước 3, **trước** khi bấm bàn giao thật)

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Staff khác xác nhận bàn giao | `stafftanbinh2` mở task của Staff 1 | 409 `TASK_NOT_YOURS` |
| 2 | Bỏ ảnh / bỏ 1 mục checklist | 0 ảnh hoặc 5/6 mục | Nút khoá. API: `HANDOVER_PHOTO_REQUIRED`, `CHECKLIST_INCOMPLETE`, `GOODS_CHECK_REQUIRED` |
| 3 | Nhập RFID đang dùng | `RFID-DEMO-F3-01` (của `HD-F3-01`) | 409 `RFID_TAKEN` |
| 4 | Nhập PIN đang dùng | `135001` (của `HD-F3-01`) | 409 `PIN_TAKEN` |
| 5 | Bàn giao task hẹn sau 3 ngày | Task `RES-F2-02` (`HD-F2-02`, Staff 1 giữ) | 409 `CHECK_IN_TOO_EARLY` |
| 6 | ⚡ GIẢ LẬP: KHÁCH TỚI HÔM NAY rồi bàn giao lại | Task `RES-F2-02` | Bàn giao được |

**Lưu ý**
- `BR-70` · `BR-71` · `BR-121` · `BR-72`/`BR-73` · `PR-C1` không bàn giao trước ngày hẹn vì HĐ tính tiền từ ngày đó.

### ⭐ F2-X3. Khung 30 ngày giao việc

**Các bước + data mỗi bước** (`fmtanbinh`)

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | `/manager/tasks`, tìm task | `HD-F2-03` (hẹn sau 45 ngày) | Nút giao khoá, ghi **"Giao từ dd/MM"**. API: 409 `TASK_NOT_IN_WINDOW` |
| 2 | Mở task → ⚡ **Hẹn còn 30 ngày (mở giao việc)** | — | Nút giao mở |
| 3 | Giao việc | Nhân viên Tân Bình 1 | Task `IN_PROGRESS` |

**Lưu ý**
- `PR-T1` không phân công quá xa khi chưa biết ai đi làm ngày đó. Staff không có nút ⚡ này (403).
- Thanh lọc thời gian: chọn **Hạn chót**, khoảng ngày ~45 ngày tới để tìm nhanh task này.

### ⭐ F2-X4. Kịch bản giảng viên: lấp khoảng trống

**Các bước + data mỗi bước** (`fmtanbinh`)

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | `/manager/storage` → **LỊCH Ô KHO** | Lọc Kho nhỏ 2m² | C101: thanh xanh dương nét đứt từ ngày thứ 60, trước đó nền xanh "Trống" |
| 2 | `/manager/pending` → gán ô | `RES-F2-05` (1 tháng, nhận sau 7 ngày) | C101 xếp đầu, nhãn **"Vừa khít"**, "Trống đến dd/MM" → xác nhận gán |
| 3 | Gán ô tiếp | `RES-F2-06` (3 tháng, nhận sau 7 ngày) | **Không có C101** vì 3 tháng đè ngày khách A nhận |
| 4 | Mở lại lịch ô kho | — | C101 có 2 hợp đồng, khoảng trống ở giữa |

**Lưu ý**
- Dữ liệu: `KV-TB-C101` đã gán khách A (`HD-F2-04`, 12 tháng, nhận sau 60 ngày).
- `D-18`/`BR-136` HĐ chỉ chiếm ô trong [ngày nhận, hết hạn + 2 ngày dọn ô) · `BR-41` ô vừa khít xếp đầu · `BR-137` popup lịch.
- Hàng đợi gán ô mặc định theo **thứ tự ưu tiên**; bấm nút thứ tự để đổi sang ngày hẹn nhận sớm nhất.

### ⭐ F2-X5. Ô hỏng trước ngày bàn giao

**Các bước + data mỗi bước**

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | `stafftanbinh1` xác nhận bàn giao | Task `HD-F2-07` (ô D204 đang bảo trì) | 409 **`UNIT_IN_MAINTENANCE`** |
| 2 | `fmtanbinh` · `/manager/storage` | Banner đỏ "ô có vấn đề lịch" → mở hợp đồng | Popup / trang chi tiết `HD-F2-07` |
| 3 | **Chuyển sang ô khác** | Ô Tiêu Chuẩn trống · lý do Ô có sự cố do cơ sở · mô tả | HĐ sang ô mới; khách nhận thông báo vị trí mới |
| 4 | Staff bàn giao lại | Như A2 bước 3 | Thành công ở ô mới |

**Lưu ý**
- Dữ liệu: `HD-F2-07` của `binh.khach`, nhận hôm nay, Staff 1 giữ task.
- `BR-139` không bàn giao ô bảo trì / ô khách trước chưa trả · `BR-122` chuyển ô cùng cơ sở, cùng loại, rảnh suốt thời gian còn lại; giá, PIN, ngày hết hạn không đổi.

### ⭐ F2-X6. No-Show: khách từ chối tới → huỷ ngay

**Các bước + data mỗi bước** (`fmtanbinh`)

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | `/manager/pending` → tab **QUÁ HẠN NHẬN KHO** | `RES-F2-08` | Có báo cáo "khách từ chối" từ Staff |
| 2 | KHÁCH VẮNG MẶT → xem số tiền → xác nhận | — | Đơn `CANCELLED`, HĐ `TERMINATED`, ô trống lại |

**Lưu ý**
- `PR-X3` khách từ chối thì huỷ ngay, không chờ 48h · `PR-X1` giữ cọc + 1 tháng thuê, hoàn phần còn lại; chọn Miễn phạt (bắt buộc lý do) thì hoàn toàn bộ.

### F2-X7. No-Show: không liên lạc được

**Các bước + data mỗi bước**

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Tab QUÁ HẠN NHẬN KHO → KHÁCH VẮNG MẶT | `RES-F2-09` (2 lần liên hệ thất bại, quá 48h) | Đủ điều kiện |
| 2 | Xác nhận | Gói 3 tháng | Giữ 3.574.167đ, hoàn 3.448.333đ qua task `REFUND` |

**Lưu ý**
- `PR-X3` ≥ 2 lần liên hệ thất bại **và** qua 48h từ giờ hẹn.

### F2-X8. No-Show chưa đủ điều kiện → dời lịch

**Các bước + data mỗi bước**

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | KHÁCH VẮNG MẶT | `RES-F2-10` (mới 1 lần liên hệ, chưa 48h) | Nút khoá, ghi "Chưa đủ điều kiện". API: 409 `NO_SHOW_NOT_ALLOWED_YET` |
| 2 | DỜI LỊCH | Ngày mới = hôm nay | Task mở lại |
| 3 | Giao Staff → check-in | Như A2 bước 2–3 | HĐ `ACTIVE` |

**Lưu ý**
- `BR-52` dời ngày đồng bộ đơn, HĐ, hạn task, giờ hẹn · `BR-136` lịch mới đè khách khác cùng ô → 409 `UNIT_SCHEDULE_CONFLICT`, phải đổi ô trước.
- Khách đã nhận kho thì không còn trong danh sách.

### F2-X9. Trùng lịch do khách trước gia hạn

**Các bước + data mỗi bước**

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Lịch ô kho | Ô D208 | Viền đỏ cả 2 thanh, ghi "Trùng lịch" |
| 2 | ⚡ khách tới hôm nay rồi check-in | Task `HD-F2-12` | 409 `UNIT_STILL_OCCUPIED` |
| 3 | FM đổi ô cho `HD-F2-12` | Từ lịch: bấm thanh `HD-F2-12` → **Đổi ô cho khách** (popup) | HĐ sang ô khác, check-in được |

**Lưu ý**
- Dữ liệu: `HD-F2-11` đang thuê D208, hết hạn sau ngày `HD-F2-12` nhận.
- `BR-137`/`BR-139` gia hạn không bị chặn theo số ngày (nhóm chốt), lịch báo để FM xử lý.

### ⭐ F2-X10. Kịch bản giảng viên: ô hỏng khi khách B đang thuê trong khoảng trống của khách A

**Các bước + data mỗi bước** (`fmtanbinh`)

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Chuyển A trước kèm bảo trì | `HD-F2-14` → lý do Ô có sự cố do cơ sở | 409 `OLD_UNIT_IN_USE` vì B còn trong ô |
| 2 | Chuyển B | `HD-F2-13` → Chuyển sang ô khác, lý do Ô có sự cố do cơ sở | D209 vào bảo trì. Trang báo **còn khách đã gán trước**, kèm mã `HD-F2-14` |
| 3 | Bấm mã `HD-F2-14` | — | Mở hợp đồng A với hộp chuyển ô bật sẵn → đổi ô cho A |

**Lưu ý**
- Dữ liệu: ô D209: B đang thuê (`HD-F2-13`), A nhận sau 60 ngày (`HD-F2-14`).
- `BR-122`/`BR-139` ô vào bảo trì thì hệ thống liệt kê khách đã gán trước để đổi ô.
- Mở từ trang chi tiết: chuyển sang trang `HD-F2-14` cùng tab. Mở trong popup: popup đổi sang `HD-F2-14`, có nút **HĐ trước** để quay lại.

### F2-X11. Hết ô đúng loại, chỉ có ô sắp trống (Kho Lớn)

**Các bước + data mỗi bước**

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Gán ô | `RES-F6-05` | Danh sách ô trống rỗng; mục "Ô sắp trống cùng loại" có B203 |
| 2 | Bấm "HĐ ..." cạnh B203 | — | Hợp đồng đang giữ ô mở **popup** trên modal gán ô; chưa gán được |

**Lưu ý**
- `BR-41` không gợi ý ô khác loại · `BR-135` FM thấy ô sắp trống và ngày giao.

### F2-X12. Sai loại, sai cơ sở (API)

**Các bước + data mỗi bước**

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Gán ô khác loại | `KV-TB-A107` (Mini M) cho đơn Tiêu Chuẩn | 400 |
| 2 | Gán ô cơ sở khác | Ô Bình Thạnh cho đơn Tân Bình | 400 |
| 3 | FM cơ sở khác gán | `fmbinhthanh` gán đơn Tân Bình | 403 |

**Lưu ý**
- `BR-42` · `PR-90`. Làm bằng Postman.

## Flow 3 — Đang thuê, trả kho

### ⭐ F3-X1. Trả sớm gói 6 tháng

**Các bước + data mỗi bước** (`dung.khach`)

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Mở hợp đồng → tab Trả kho | `HD-F3-02` (đã dùng 40 ngày) | — |
| 2 | Chọn ngày hẹn | Ngày mai | Bảng tính: **hoàn tiền thuê 4.340.000đ + cọc 1.850.000đ = 6.190.000đ** |

**Lưu ý**
- Công thức: tiền thuê đã trả 9.890.000 − 2 tháng đã dùng × 1.850.000 − phí phá hợp đồng 1.850.000.
- `PR-O2` tháng đã dùng tính giá niêm yết (mất ưu đãi gói), làm tròn lên, cộng 1 tháng phí phá hợp đồng.
- Chỉ cần xem bảng tính, không bắt buộc xác nhận.

### F3-X2. Dời / huỷ yêu cầu trả kho

**Các bước + data mỗi bước** (`dung.khach`, `HD-F3-03` đã hẹn trả sau 5 ngày)

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Dời muộn hơn | Sau 8 ngày | 400 "Không thể dời ngày qua sau ngày trả kho đã thực hiện trước đó" |
| 2 | Dời sớm hơn | Sau 3 ngày | Được |
| 3 | Huỷ yêu cầu trả kho | — | HĐ `ACTIVE`, task `CANCELLED` |

**Lưu ý**
- `PR-O1` chỉ dời sớm hơn để ô đã bán trước không bị lỡ · `PR-O4` huỷ được khi chưa quá `end_date`.

### F3-X3. Sự cố lỗi khách trong cọc

**Các bước + data mỗi bước** (`stafftanbinh1`, task Check-out `HD-F3-04`, hẹn hôm nay)

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Bỏ chọn "sạch sẽ" → + Thêm hạng mục | Chi phí 700.000đ · lỗi khách · 1 ảnh | Hạng mục hợp lệ |
| 2 | Hoàn tất nghiệm thu | — | Trừ cọc 700.000đ, **hoàn 1.150.000đ**, ô `MAINTENANCE`, sinh task bảo trì |

**Lưu ý**
- `PR-O8` mỗi sự cố bắt buộc ảnh (`EVIDENCE_IMAGE_REQUIRED`); bẩn/hỏng mà không lập sự cố → `DAMAGE_REPORT_REQUIRED` · `PR-O9` trừ cọc, ghi `DAMAGE_FEE` method `DEPOSIT_OFFSET`.

### ⭐ F3-X4. Sự cố vượt cọc → thành nợ

**Các bước + data mỗi bước**

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Staff nghiệm thu, thêm sự cố | Task `HD-F3-05` · 2.150.000đ · lỗi khách (hoặc GIẢ LẬP LỖI KHÁCH) | Cọc 1.850.000đ trừ hết, **nợ 300.000đ** `PENDING`, task `REFUND` 0đ để FM đóng hồ sơ |
| 2 | `minh.khach` đặt kho mới | Loại kho bất kỳ | 409 `CUSTOMER_HAS_DEBT` |

**Lưu ý**
- `PR-O9` · `PR-O11` · `PR-Q12`.

### F3-X5. Sự cố lỗi cơ sở

**Các bước + data mỗi bước**

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Staff nghiệm thu, thêm sự cố lỗi cơ sở | Task `HD-F3-06` (hoặc GIẢ LẬP LỖI CƠ SỞ) | Không trừ cọc, **hoàn đủ 1.850.000đ**, ô vẫn bảo trì |

**Lưu ý**
- `PR-O16` lỗi cơ sở chỉ ghi chi phí nội bộ.

### F3-X6. Sửa xong, mở bán lại

**Các bước + data mỗi bước** (`stafftanbinh1`, task bảo trì ô D216 của `HD-F3-07`)

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | **Sửa xong** với ghi chú ngắn | "xong" (< 10 ký tự) | 400 |
| 2 | **Sửa xong** đủ ghi chú | ≥ 10 ký tự | Ô `AVAILABLE` |

**Lưu ý**
- `PR-O10` Staff giữ task hoặc FM đóng được.

### F3-X7. Chuyển ô khi đang thuê

**Các bước + data mỗi bước** (`fmtanbinh`, `HD-F3-08` ô E202)

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Chuyển sang ô khác | E203 · lý do Khách yêu cầu | HĐ sang E203, PIN giữ nguyên; khách xem được lịch sử chuyển ô |
| 2 | Chuyển sang ô khác loại (API) | Ô khác loại | 400 `UNIT_TYPE_MISMATCH` |

**Lưu ý**
- `BR-122`.

## Flow 4 — BOM

### ⭐ F4-X1. BOM nhập sai

**Các bước + data mỗi bước** (`bom@queenkho.com`)

| # | Màn hình | Data | Kết quả |
|---|---|---|---|
| 1 | `/bom/policies` | Hệ số cọc `5` | 400 (`PR-14`) |
| 2 | `/bom/policies` | Phí chiếm dụng `50%` | 400 (`PR-14`) |
| 3 | `/bom/unit-types` → thêm | Tên `Kho Mini M` | 409 `UNIT_TYPE_NAME_EXISTS` (`PR-M3`) |
| 4 | `/bom/unit-types` | Giá âm | 400 (`PR-M3`) |
| 5 | `/bom/unit-types` | Xoá loại kho đã có ô | 409 `UNIT_TYPE_HAS_UNITS` (`PR-M4`) |
| 6 | `/bom/facilities` → thêm | Mã cơ sở chữ thường | 400 (`PR-M1`) |
| 7 | `/bom/facilities` → thêm | Mã `TB` | 409 `FACILITY_CODE_EXISTS` (`PR-M1`) |
| 8 | `/bom/facilities` | Ngừng Tân Bình (còn HĐ) | 409 (`PR-11`) |
| 9 | `/bom/vouchers` | Tạo trùng `HE2026` | 400 `DUPLICATE_CODE` (`BR-25`) |
| 10 | `/bom/overdue` | Miễn phí trễ `HD-CS-7` lần 2 | 409 `LATE_FEE_ALREADY_WAIVED` (`BR-130`) |

**Lưu ý**
- Bước 10 phải làm sau A4 bước 5.

### F4-X2. Tắt quyền FM miễn phí trễ

**Các bước + data mỗi bước**

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | BOM `/bom/policies` → Bình Thạnh | Tắt "Cho phép FM miễn phí trễ" | Lưu phiên bản mới |
| 2 | `fmbinhthanh` miễn phí trễ | `HD-CS-8` | 403 `WAIVER_NOT_ALLOWED` |
| 3 | BOM miễn phí trễ | `HD-CS-8` | Được |

**Lưu ý**
- **Chỉ làm ở Bình Thạnh**, để F6-X3 ở Tân Bình không bị ảnh hưởng.

### F4-X3. Sai vai trò

**Các bước + data mỗi bước**

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | FM / Staff gõ URL BOM | `/bom/revenue` | Bị chuyển về trang của mình |
| 2 | Gọi API BOM bằng token FM | — | 403 |

**Lưu ý**
- `PR-90`.

## Flow 5 — FM quản lý cơ sở

### ⭐ F5-X1. Khoá vị trí ô đang có hợp đồng

**Các bước + data mỗi bước** (`fmtanbinh`, chỉnh sửa mặt bằng Tầng 2)

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Kéo / xoay / gỡ ô đang có HĐ | Ô có icon khoá | Không thao tác được. API: 409 `UNIT_IN_USE` |
| 2 | Kéo ô trống | Ô không icon khoá | Kéo được |
| 3 | Kéo ô trống chồng lên ô khác | — | Báo đỏ, không lưu được (`MAP_CONFLICT`) |

**Lưu ý**
- `BR-138` khách đã xem vị trí ô nên không được dời · `BR-107` lưu cả tầng trong 1 transaction.
- Không bấm Lưu sau bước 2 nếu muốn giữ nguyên sơ đồ cho lần demo sau.

### ⭐ F5-X2. Không làm âm số suất

**Các bước + data mỗi bước**

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Khoá bảo trì | `KV-TB-L105` (Kho Đông) + lý do ≥ 10 ký tự | 409 **`SLOT_IN_USE`** |

**Lưu ý**
- Ô trống cuối của Kho Đông đang được `RES-F5-02` giữ suất. `PR-M10`.

### F5-X3. Chặn khác

**Các bước + data mỗi bước**

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Khoá bảo trì ghi chú ngắn | "hong" | 400 (`PR-M9`) |
| 2 | Đổi trạng thái ô đang thuê | Ô có HĐ `ACTIVE` | 409 `UNIT_IN_USE` (`PR-M9`) |
| 3 | Sửa thông tin ô đang có HĐ | — | 409 `UNIT_IN_USE` (`BR-138`) |
| 4 | Xoá ô đã có HĐ | — | Không có nút. API: 409 `UNIT_HAS_CONTRACT_HISTORY` (`PR-21`) |
| 5 | `fmbinhthanh` sửa ô Tân Bình | API | 403 `FORBIDDEN_FACILITY` (`PR-20`) |
| 6 | Tạo Staff trùng email | `stafftanbinh1@gmail.com` | 409 (`PR-M12`) |
| 7 | Tạo Staff mật khẩu ngắn | < 6 ký tự | 400 (`PR-M12`) |
| 8 | Khoá Staff đang giữ task | `stafftanbinh1` | 409 (`PR-06`) |
| 9 | Khoá Staff mới tạo → người đó đăng nhập | Tài khoản ở A5 bước 5 | 403 (`PR-L1`) |
| 10 | Giao việc cho Staff bị khoá | Staff ở bước 9 | 400 `STAFF_INACTIVE` (UC-16) |
| 11 | Xoá tầng còn ô | Tầng 2 | 409 `FLOOR_HAS_UNITS` (`BR-105`) |

**Lưu ý**
- Bước 9–10 cần tạo Staff mới trước (A5 bước 5).

## Flow 6 — Gia hạn, quá hạn

### F6-X1. Cửa sổ muộn, chưa ai cần ô

**Các bước + data mỗi bước** (`nga.khach`)

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Mở hợp đồng → Gia hạn | `HD-F6-02` (còn 2 ngày) | Banner vàng nhưng vẫn gia hạn được |

**Lưu ý**
- `PR-R10`.

### ⭐ F6-X2. Cửa sổ muộn, đã có khách giữ suất

**Các bước + data mỗi bước** (`nga.khach`)

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Mở hợp đồng → Gia hạn | `HD-F6-03` (đã hẹn trả B203 sau 3 ngày) | Nút thanh toán khoá, gợi ý giữ lịch hẹn trả. API: 409 `RENEWAL_UNIT_RESERVED` |

**Lưu ý**
- Dữ liệu: `RES-F6-05` đã cọc Kho Lớn nhận sau 4 ngày, hết ô Kho Lớn khác.
- `PR-R10` · `PR-R11`.

### ⭐ F6-X3. Quá hạn 3 ngày (điều khoản cũ)

**Các bước + data mỗi bước**

| # | Tài khoản | Thao tác | Data | Kết quả |
|---|---|---|---|---|
| 1 | `giang.khach` | Xem hợp đồng | `HD-F6-06` | PIN khoá, phí trễ **555.000đ** + chiếm dụng khoảng **277.500đ** |
| 2 | `giang.khach` | Đặt kho mới | Loại kho bất kỳ | `CUSTOMER_HAS_DEBT` |
| 3 | `fmtanbinh` · `/manager/overdue` | Bấm THANH LÝ | `HD-F6-06` | Nút khoá (`LIQUIDATION_NOT_ALLOWED_YET`) |
| 4 | Như trên | LIÊN HỆ → ghi chú | Nội dung cuộc gọi | Số lần liên hệ tăng, dòng HĐ hiện ghi chú + giờ liên hệ mới nhất |
| 5 | Như trên | MIỄN PHÍ TRỄ | Lý do | Phí trễ về 0 |
| 6 | `giang.khach` | **Gia hạn kèm phí trễ** → VNPAY | Thẻ NCB | HĐ `ACTIVE`, PIN mở lại, kỳ mới tính từ hôm nay |

**Lưu ý**
- **Làm F7-X7 trước** (cùng `HD-F6-06`).
- `PR-Q1` job 00:05 chuyển `OVERDUE` · `PR-Q3` cọc × min(ngày, 5) × 10%, trần 50% · `PR-Q14` giá ngày × 150% × số ngày, không trần; miễn phí trễ thì còn 100% · `PR-Q5` · `PR-Q6` · `PR-R3` · `PR-Q11`.
- Danh sách quá hạn có thanh lọc: **Ngày hết hạn · Sớm nhất trước** để quá hạn lâu nhất lên đầu.

### F6-X4. Thanh lý điều khoản cũ

**Các bước + data mỗi bước**

| # | Tài khoản | Thao tác | Data | Kết quả |
|---|---|---|---|---|
| 1 | `fmtanbinh` · `/manager/overdue` | THANH LÝ | `HD-F6-07` (quá hạn 16 ngày, 2 lần liên hệ) | Nút khoá "(2/3 liên hệ)". API: `NOT_ENOUGH_CONTACTS` |
| 2 | Như trên | LIÊN HỆ lần 3 → THANH LÝ | Ghi chú | `LIQUIDATED`, ô bảo trì, sinh task dọn ô |
| 3 | Staff · task dọn ô | **Dọn xong** thiếu kiểm kê | — | `INVENTORY_REQUIRED` |
| 4 | Như trên | **Dọn xong** đủ | Danh sách hàng, người chứng kiến, kho tổng, vị trí kệ, ảnh | Hàng vào kho tổng, ô `AVAILABLE` |

**Lưu ý**
- `PR-Q8` · `PR-Q9` · `PR-Q10` · `PR-Q16` · `BR-134`.

### ⭐ F6-X5. Điều khoản v4 tự thanh lý

**Các bước + data mỗi bước**

| # | Tài khoản | Thao tác | Data | Kết quả |
|---|---|---|---|---|
| 1 | `fmtanbinh` | Mở hợp đồng → ⚡ **Quá hạn 1 ngày** | `HD-F6-08` của `tam.khach` | HĐ tự `LIQUIDATED`, sinh task chuyển hàng vào kho tổng |
| 2 | `tam.khach` | Xem `Kho của tôi` | — | Thẻ "Hàng của bạn đang ở kho tổng" |

**Lưu ý**
- `D-15` bỏ ân hạn; hết hạn không gia hạn / không trả thì hôm sau thanh lý, chuyển kho tổng, không bán hàng.

### F6-X6. Khách nhận lại hàng

**Các bước + data mỗi bước** (`fmtanbinh` · `/manager/held-goods`)

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | KHÁCH NHẬN LẠI | `HD-F6-09` (nợ 225.000đ) | `CUSTOMER_HAS_DEBT` |
| 2 | `giang.khach` trả nợ | VNPAY | Hết nợ |
| 3 | KHÁCH NHẬN LẠI, không tick thu phí | — | `STORAGE_FEE_UNPAID` |
| 4 | Tick "Đã thu tại quầy" | Ghi chú ≥ 10 ký tự | Xong |
| 5 | API bán hàng | — | `GOODS_SALE_NOT_ALLOWED` |

**Lưu ý**
- `PR-Q15` phí lưu giữ theo ngày, khách phải hết nợ · `PR-Q10` không bán, không tiêu huỷ.
- Danh sách hàng tạm giữ lọc được theo **Hạn lưu giữ** (sắp tới hạn lên đầu).

## Flow 7 — Hỗ trợ, sự cố

### F7-X1. Giới hạn ticket

**Các bước + data mỗi bước** (`phuc.khach` · `/ho-tro`)

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Gửi thêm ticket | `HD-F7-02` (đã có 3 ticket) · Vệ sinh | 409 `DUPLICATE_ISSUE_TYPE` |
| 2 | Bấm **Chưa xong** | `SR-F7-03` + lý do | Ticket mở lại |
| 3 | Gửi loại khác | `HD-F7-02` · loại khác | 409 `MAX_OPEN_TICKETS_REACHED` |

**Lưu ý**
- `PR-S2`.

### F7-X2. Chưa xong / tự đóng

**Các bước + data mỗi bước**

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | **Chưa xong** | `SR-F7-03` · lý do bắt buộc | `OPEN`, sinh task mới |
| 2 | ⚡ Quá 3 ngày | Ticket đã `RESOLVED` | Tự `CLOSED` |

**Lưu ý**
- `PR-52`.

### F7-X3. Task hỗ trợ quá hạn

**Các bước + data mỗi bước**

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | `stafftanbinh2` hoàn tất task | `SR-F7-02` (đã quá hạn) | Không hoàn tất được |
| 2 | FM **Gia hạn xử lý** | ≤ 7 ngày + lý do | Task mở lại |
| 3 | Staff làm tiếp | — | Hoàn tất |

**Lưu ý**
- `PR-S4`.

### ⭐ F7-X4. Hàng hư do cơ sở, có bảo hiểm

**Các bước + data mỗi bước** (`fmtanbinh` · `/manager/claims`)

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Mở hồ sơ | `BT-F7-04` | Ảnh khách, ảnh kiểm tra, biên bản nhận kho, cảm biến |
| 2 | Nhập thẩm định → **Tính thử** | Lỗi cơ sở · giá trị 12.000.000đ · 100% · 2 ngày không dùng được | Bảng tính bồi thường |
| 3 | Chốt | — | `APPROVED` |
| 4 | Chi trả thiếu UNC | — | `PAYMENT_EVIDENCE_REQUIRED` |
| 5 | Chi trả đủ | Ảnh UNC | `PAID`, sinh hồ sơ đòi bảo hiểm |
| 6 | ⚡ **Bảo hiểm duyệt & chi trả** | — | Bảo hiểm trả lại |

**Lưu ý**
- Dữ liệu: `quynh.khach`, Kho Lạnh L101, gói Nâng cao, khai giá 30 triệu, Staff đã kiểm tra.
- `BR-127` lỗi cơ sở = tiền hàng (≤ trần) + phạt 1 tháng + hoàn thuê theo ngày · `BR-125` trần = min(giá khai báo, trần gói) · `BR-128` cơ sở chi trước rồi đòi bảo hiểm; BOM xem chỉ đọc.

### F7-X5. Lỗi khách → từ chối bồi thường

**Các bước + data mỗi bước**

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Staff nhận task, lập biên bản thiếu ảnh | `BT-F7-05` | 400 |
| 2 | Lập biên bản đủ | Nguyên nhân Lỗi khách + ảnh | `INSPECTED` |
| 3 | FM chốt | Lỗi khách | `REJECTED`, bồi thường 0 |

**Lưu ý**
- `BR-126` · `BR-127`.

### F7-X6. Lỗi cơ sở, khách chấm dứt hợp đồng

**Các bước + data mỗi bước**

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | FM chốt hướng **TERMINATE** | `BT-F7-06` | Bật `fault_termination` |
| 2 | Khách hẹn trả kho | `HD-F7-05` | Không phí phá hợp đồng, hoàn tiền thuê theo số ngày còn lại |

**Lưu ý**
- `BR-127`.

### F7-X7. Hợp đồng quá hạn không cấp lại PIN

**Các bước + data mỗi bước**

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | Staff bấm Cấp lại PIN | `SR-F7-07` trên `HD-F6-06` | 409 `CONTRACT_OVERDUE` |

**Lưu ý**
- **Làm trước F6-X3.** `PR-S6` · `PR-Q5`.

### F7-X8. Cảm biến vượt ngưỡng

**Các bước + data mỗi bước**

| # | Thao tác | Data | Kết quả |
|---|---|---|---|
| 1 | ⚡ **Cảm biến vượt ngưỡng** | `HD-F7-03` (Kho Lạnh) | Biểu đồ tăng tới 14°C, báo khách + FM, sinh task bảo trì lý do `SENSOR` |

**Lưu ý**
- `BR-129` ngưỡng theo loại kho. 🔸 Chưa nối thiết bị thật.

---

## Khi giảng viên hỏi

| Câu hỏi | Trả lời |
|---|---|
| SmartLock, RFID, cảm biến có thật không? | Mô phỏng, chưa nối thiết bị. Nghiệp vụ cấp / khoá / thu hồi PIN và cảnh báo đã chạy thật |
| Bảo hiểm có đối tác thật không? | Mô phỏng qua `InsuranceProviderClient`, nghiệp vụ chi trước rồi đòi lại đã chạy thật |
| Nút ⚡ có làm sai dữ liệu không? | Chỉ dời mốc thời gian rồi để nghiệp vụ thật chạy tiếp, vẫn kiểm tra quyền, có log `[SIMULATION]`, tắt bằng `SIMULATION_ENABLED=false` |
| Khách B gia hạn đè ngày khách A nhận thì sao? | Nhóm chốt không chặn theo số ngày. Lịch báo đỏ, check-in bị chặn `UNIT_STILL_OCCUPIED`, FM đổi ô |
| Sao không gán ô ngay khi khách đặt? | Khách đặt theo loại kho; FM gán để tối ưu, lấp khoảng trống |
| Sao xem hợp đồng không mở tab mới? | Phiên đăng nhập lưu theo tab (`sessionStorage`), tab mới phải đăng nhập lại. Nên mở popup ngay trên màn đang xem |

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
| `HD-F1-09`, `HD-F1-10` | Khánh, Vy | A106, B205 | Hẹn trả +5 ngày, đang thuê | F1-X2, A4 |
| `HD-F1-11` | Tín | L102 | Đang thuê | F1-X9 |
| `RES-F2-01` | Bình | — | Đã cọc, nhận hôm nay | A2 |
| `HD-F2-02` | Bình | D202 | Chờ nhận +3 ngày, Staff 1 giữ | F2-X1 |
| `HD-F2-03` | Khánh | D203 | Chờ nhận +45 ngày | F2-X3 |
| `HD-F2-04`, `RES-F2-05`, `RES-F2-06` | Khánh, Tâm | C101 | Chờ nhận +60, 2 đơn +7 ngày | F2-X4 |
| `HD-F2-07` | Bình | D204 (bảo trì) | Chờ nhận hôm nay | F2-X5 |
| `HD-F2-08`, `09`, `10` | Lan | D205, D206, D207 | Quá hẹn | F2-X6, X7, X8 |
| `HD-F2-11`, `HD-F2-12` | Hạnh, Khánh | D208 | Trùng lịch | F2-X9 |
| `HD-F2-13`, `HD-F2-14` | Tâm, Khánh | D209 | Đang thuê, chờ nhận +60 | F2-X10 |
| `HD-F3-01` | Cường | D210 | Đang thuê, còn 10 ngày | A3 |
| `HD-F3-02`, `HD-F3-03` | Dung | D211, D212 | Đang thuê, hẹn trả +5 | F3-X1, X2 |
| `HD-F3-04`, `05`, `06` | Minh | D213, D214, D215 | Hẹn trả hôm nay | F3-X3, X4, X5 |
| `HD-F3-07` | Bảo | D216 (bảo trì) | Kết thúc, đang sửa | F3-X6 |
| `HD-F3-08` | Cường | E202 | Đang thuê | F3-X7 |
| `HD-F5-01`, `RES-F5-02` | Tín, Tâm | L103 | Đang thuê, giữ suất L105 | F5-X2 |
| `HD-F6-01`, `02` | Nga | E204, E205 | Còn 10 ngày, còn 2 ngày | A6, F6-X1 |
| `HD-F6-03`, `HD-F6-04`, `RES-F6-05` | Nga, Vy, Tâm | B203, B204 | Hẹn trả +3, đang thuê, đơn +4 | F6-X2, F2-X11 |
| `HD-F6-06` | Giang | A104 | Quá hạn 3 ngày, v3 | F6-X3, F7-X7 |
| `HD-F6-07` | Sơn | A103 | Quá hạn 16 ngày, v3 | F6-X4 |
| `HD-F6-08` | Tâm | E207 | Đang thuê, v4 | F6-X5 |
| `HD-F6-09` | Giang | E208 | Thanh lý, hàng ở kho tổng | F6-X6 |
| `HD-F7-01`, `02` | Phúc | E209, E210 | Đang thuê | A7, F7-X1–X3 |
| `HD-F7-03`, `04`, `05` | Quỳnh | L101, A102, A101 | Đang thuê, có hồ sơ bồi thường | F7-X4, X5, X6, X8 |
| `RES-LS-*`, `HD-LS-*` | Khách lịch sử | Nhiều cơ sở | 23 hợp đồng đã kết thúc, 12 tháng | A4 doanh thu |
| `HD-CS-1` → `8` | Khách lịch sử | BT, TD, GV | 6 đang thuê, 2 quá hạn | A4, F4-X1, F4-X2 |

Voucher: `NEWKHO` (mặc định) · `HE2026` 150.000đ · `DAIHAN10` 10% từ 3 tháng · `LANH50` chỉ Kho Lạnh · `HETHAN` · `HETLUOT`.
Ô còn trống cho happy path: Mini M (A107, C103, C104, E-), Tiêu Chuẩn (D201, D217–D224).

## Kiểm tra lại toàn bộ bằng script

`docs/test-e2e/e2e-demo-7-flow.sh` chạy thật mọi ca ở trên qua API. **Nó dùng hết dữ liệu**, chạy xong phải nạp lại 2 file SQL.

```bash
bash docs/test-e2e/e2e-demo-7-flow.sh
```

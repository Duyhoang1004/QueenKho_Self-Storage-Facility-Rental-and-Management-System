# QueenKho — Kịch bản happy path (1 khách, đi hết vòng đời thuê kho)

> Soạn 22/11/2026, theo code sau #135 → #142 và D-23 (PR #143).
> Một khách đi liền mạch: **Đặt kho → Gán ô → Check-in → Bàn giao → Hỗ trợ → Gia hạn → Trả kho (tất toán + hoàn tiền)**.
> Mỗi bước ghi *vai · màn hình · thao tác · data nhập · kết quả mong đợi*. Mã nghiệp vụ tra ở `docs/business-rules.md`.
> ⚡ = nút "Giả lập" viền cam: tua thời gian để không phải chờ đúng ngày (BR-115).

---

## 0. Chuẩn bị

### 0.1 Môi trường

| Việc | Ghi chú |
|---|---|
| Chạy hệ thống | Docker: `docker compose up -d` (web `http://localhost:5173`). Hoặc chạy local: backend `:8080` + frontend `:5173` |
| Bản code | Có **PR #143** (D-23 + sửa URL VNPAY). Bản Docker thiếu PR này thì bước thanh toán báo `API_NOT_DECLARED` |
| Giờ chạy | Làm **trước 21:00**. Nút ⚡ "Khách tới hôm nay" / "Khách tới trả đúng ngày hẹn" đặt hạn 21:00 cùng ngày; quá giờ thì khách không xác nhận được biên bản |
| Cửa sổ trình duyệt | Mở 3 cửa sổ riêng (thường / ẩn danh / profile khác): **Khách · FM · Staff**. Phiên lưu theo tab nên đừng mở tab mới trong cùng cửa sổ |
| Thẻ VNPAY sandbox | Ngân hàng NCB · số thẻ `9704198526191432198` · tên `NGUYEN VAN A` · ngày phát hành `07/15` · OTP `123456` |

### 0.2 Tài khoản (mật khẩu đều `123456`)

| Vai | Tài khoản | Ghi chú |
|---|---|---|
| Khách | `khachhang2@gmail.com` | Chọn khách **chưa có đơn đang chạy**. Hồ sơ cần đủ họ tên, SĐT 10 số, CCCD, email, địa chỉ (thiếu thì điền ngay trên trang đặt kho) |
| FM Tân Bình | `fmtanbinh@gmail.com` | Gán ô, giao việc, hoàn tiền |
| Staff Tân Bình | `stafftanbinh1@gmail.com` | Check-in, hỗ trợ, nghiệm thu trả kho |
| Admin (tuỳ chọn) | `admin@queenkho.com` | Xem nhật ký cuối buổi |

### 0.3 Chuẩn bị file

- 1 ảnh bất kỳ (JPG/PNG) làm **chứng từ giá trị hàng** lúc đặt kho (#138: bắt buộc).
- 1 ảnh bất kỳ làm **biên lai chuyển khoản** lúc FM hoàn tiền.

### 0.4 Chọn gói để bước trả kho rơi đúng hạn

Đặt **gói 1 tháng** và **gia hạn 1 tháng**. Trước khi hẹn trả kho bấm ⚡ "Còn 1 ngày hết hạn" để ngày trả kho là ngày cuối hợp đồng. Khi đó bước trả kho là **tháng cuối kỳ: hoàn đủ cọc, không phí phá hợp đồng** (PR-O2a). Nếu không tua thì thành trả sớm, bị trừ phí phá hợp đồng (PR-O2), không còn là happy path.

---

## 1. Đặt kho (khách)

| Bước | Vai · Màn hình | Thao tác | Data nhập | Kết quả mong đợi | Nghiệp vụ |
|---|---|---|---|---|---|
| 1.1 | Khách · `/tim-va-dat-kho` | Đăng nhập, chọn thành phố → cơ sở → loại kho → **Đặt kho** | TP.HCM → QueenKho Tân Bình → **Kho Mini M** | Thấy giá, số ô còn trống; không thấy ô cụ thể | BR-10, BR-11, BR-135 |
| 1.2 | Khách · `/booking` | Chọn ngày nhận kho | **Ngày mai** (sớm nhất cho phép) | "Còn N ô trống cho khoảng dd/MM – dd/MM" | PR-B4 nhận từ ngày mai, tối đa 90 ngày · BR-136 |
| 1.3 | Như trên | Chọn gói + bảo hiểm | Gói **1 tháng** · bảo hiểm **Cơ bản** | Tóm tắt tiền bên phải cập nhật | D-08, BR-125 |
| 1.4 | Như trên | Khai **giá trị hàng** + tải chứng từ | Giá trị `20000000` · tải 1 ảnh | Hiện "Trần bồi thường dự kiến" | #138: giá trị > 0, ≤ 10 tỷ, ≥ 1 ảnh chứng từ |
| 1.5 | Như trên | Chọn loại hàng | Đồ gia dụng | — | BR-131 bắt buộc khai loại hàng |
| 1.6 | Như trên | Kiểm tra thông tin khách, tick **cam kết không lưu hàng cấm** + **Điều khoản (v6)** | — | Voucher `NEWKHO` tự áp (−100.000đ). Ghi lại **TỔNG CỘNG THANH TOÁN ĐỢT 1** | BR-24, BR-25, BR-102, BR-142 |
| 1.7 | Như trên → VNPAY | **THANH TOÁN GIỮ KHO**, trả bằng thẻ ở 0.1 | Thẻ NCB | Quay về trang xác nhận: đơn **`DEPOSIT_PAID`**, có mã đơn `RES-…`. Chuông khách + FM có thông báo | PR-B1, PR-B6 giữ suất 15 phút · BR-27 · BR-111 |
| 1.8 | Khách · `/kho-cua-toi` | Xem đơn vừa đặt | — | Đơn ở trạng thái chờ phân bổ ô | — |

## 2. Gán ô (FM)

| Bước | Vai · Màn hình | Thao tác | Data nhập | Kết quả mong đợi | Nghiệp vụ |
|---|---|---|---|---|---|
| 2.1 | FM · `/manager/pending` | Tìm đơn `RES-…` của khách → **GÁN Ô KHO** | — | Modal gán ô: thời gian thuê, sơ đồ mặt bằng, chỉ hiện ô Mini M rảnh suốt kỳ thuê | BR-40, BR-41, BR-110 |
| 2.2 | Như trên | Chọn 1 ô trống → **XÁC NHẬN GÁN PHÒNG** | Ô Mini M bất kỳ còn trống | "Gán ô kho thành công!". Đơn **`UNIT_ASSIGNED`**, hợp đồng **`PENDING_CHECK_IN`** (chưa có PIN), sinh task **Check-in** | BR-42, BR-43 |
| 2.3 | Khách · `/kho-cua-toi` | Xem đơn | — | Thấy ô được gán, vị trí trên mặt bằng, chờ nhận kho | BR-109 |

## 3. Check-in (FM giao việc → Staff lập biên bản)

| Bước | Vai · Màn hình | Thao tác | Data nhập | Kết quả mong đợi | Nghiệp vụ |
|---|---|---|---|---|---|
| 3.1 | FM · `/manager/tasks` | Mở task Check-in vừa sinh → **Giao việc** | Nhân viên `stafftanbinh1` | Task **`IN_PROGRESS`**, Staff nhận thông báo | PR-T1 khung 30 ngày · BR-64 |
| 3.2 | Staff · `/staff` → mở task Check-in | ⚡ **Khách tới hôm nay** | — | Lịch hẹn dời về hôm nay, hạn 21:00 (không phải chờ tới ngày mai) | BR-115 |
| 3.3 | Như trên | Đối chiếu khách, CCCD, ô, loại hàng khai báo, chứng từ khách tải lên. Tick đủ **6 mục**, mỗi mục 1 ảnh (nhanh: **Giả lập hoàn thiện**) | 6 mục: CCCD · ô trống · ô sạch · khoá nguyên vẹn · đã kiểm tra hàng · đã đối chiếu giá trị và chứng từ | Nút gửi sáng lên | BR-71, BR-132, BR-121, #136 |
| 3.4 | Như trên | Phần giá trị hàng chọn **Khớp giá trị khách khai** → **Gửi biên bản cho khách xác nhận** | — | Biên bản ở trạng thái **chờ khách xác nhận**; khách nhận thông báo | #139 chốt giá trị hàng hai bên |

## 4. Bàn giao (khách xác nhận → Staff cấp quyền truy cập)

| Bước | Vai · Màn hình | Thao tác | Data nhập | Kết quả mong đợi | Nghiệp vụ |
|---|---|---|---|---|---|
| 4.1 | Khách · `/kho-cua-toi` → mở hợp đồng | Xem biên bản bàn giao: ảnh từng mục, giá trị hàng đã chốt → **Tôi đã kiểm tra và đồng ý nhận ô này** | — | Biên bản **đã chấp nhận** | #136 check-in chéo với khách |
| 4.2 | Staff · mở lại task Check-in | Tiêu đề đổi thành **Hoàn tất bàn giao**. Giữ PIN gợi ý, nhập RFID → **Hoàn tất check-in và cấp quyền truy cập** | PIN 6 số (gợi ý sẵn) · RFID `RFID-` + 5 số, vd `12345` | Hợp đồng **`ACTIVE`**, task **`COMPLETED`** | BR-70, BR-72, BR-73 |
| 4.3 | Khách · trang hợp đồng | Xem hợp đồng → **LỊCH SỬ SỬ DỤNG** → **GIẢ LẬP NHẬP MÃ PIN** | — | Thấy PIN, RFID, biên bản + ảnh; lịch sử có 1 lượt mở kho | BR-80 · 🔸 SmartLock mô phỏng |

## 5. Hỗ trợ (khách gửi → Staff xử lý → khách đóng)

| Bước | Vai · Màn hình | Thao tác | Data nhập | Kết quả mong đợi | Nghiệp vụ |
|---|---|---|---|---|---|
| 5.1 | Khách · `/ho-tro` | **Gửi yêu cầu hỗ trợ mới** | Hợp đồng vừa nhận · loại **Vệ sinh kho bãi** · mô tả `Hanh lang truoc o kho con nhieu thung carton, nho don giup` | Ticket **`OPEN`**, sinh task **Hỗ trợ** tại cơ sở | PR-51, PR-S1, PR-S2 (tối đa 3 ticket mở / HĐ, 1 ticket / loại), PR-34 |
| 5.2 | Staff · `/staff` | Thẻ task Hỗ trợ → **Nhận việc** → mở task | — | Task **`IN_PROGRESS`** | BR-64 |
| 5.3 | Như trên | Nhập phản hồi → **Xác nhận & Gửi phản hồi** | `Da don sach hanh lang va khu vuc truoc o kho` | Ticket **`RESOLVED`**, khách nhận thông báo | — |
| 5.4 | Khách · `/ho-tro` | Ticket vừa xử lý → **Đã ổn (Đóng yêu cầu)** | — | Ticket **`CLOSED`** | PR-52 |

> Phải đóng xong ticket ở bước này: còn ticket mở thì Staff không nghiệm thu trả kho được (PR-O17).

## 6. Gia hạn (khách)

| Bước | Vai · Màn hình | Thao tác | Data nhập | Kết quả mong đợi | Nghiệp vụ |
|---|---|---|---|---|---|
| 6.1 | Khách · trang hợp đồng | ⚡ **Còn 3 ngày hết hạn** | — | Hợp đồng còn 3 ngày; chuông có nhắc gia hạn, trang hợp đồng hiện khung nhắc + nút **Gia hạn ngay** | PR-R9 |
| 6.2 | Như trên | **Gia hạn ngay** → tab Gia hạn → chọn số tháng → **Thanh Toán & Gia Hạn Ngay** | **1 tháng** | Chuyển sang VNPAY | UC-21: gói 1 / 3 / 6 / 12 tháng |
| 6.3 | VNPAY → trang hợp đồng | Trả bằng thẻ ở 0.1 | Thẻ NCB | Ngày hết hạn **lùi thêm 1 tháng**; giao dịch gia hạn **thành công** ở `/thanh-toan` | — |

## 7. Trả kho (hẹn → nghiệm thu → tất toán → hoàn tiền)

| Bước | Vai · Màn hình | Thao tác | Data nhập | Kết quả mong đợi | Nghiệp vụ |
|---|---|---|---|---|---|
| 7.1 | Khách · trang hợp đồng | ⚡ **Còn 1 ngày hết hạn** | — | Ngày hết hạn = ngày mai (xem 0.4) | — |
| 7.2 | Như trên | **TÙY CHỌN HỢP ĐỒNG** → tab **Trả kho**: chọn ngày, cách nhận tiền → xác nhận | Ngày = **ngày mai** · Chuyển khoản: `Vietcombank` · STK `0123456789` · chủ TK `KHACH HANG 2` | Bảng **"Đã đóng − Giữ lại = Dự kiến hoàn"** ≈ hoàn đủ cọc. Hợp đồng **`TERMINATION_PENDING`**, sinh task **Check-out**, PIN vẫn dùng được | PR-O1, PR-O3, PR-O28 (D-22) |
| 7.3 | FM · `/manager/tasks` | Task Check-out → **Giao việc** | `stafftanbinh1` | Task **`IN_PROGRESS`** | — |
| 7.4 | Staff · mở task Check-out | ⚡ **Khách tới trả đúng ngày hẹn (dd/MM)** | — | Nghiệm thu được ngay (hạn 21:00 hôm nay); quyết toán chốt theo ngày khách hẹn → số tiền khớp màn hẹn trả kho | BR-115, PR-O31a |
| 7.5 | Như trên | Tick **5 mục** (CCCD · ô đã dọn trống · khách ký biên bản & trả thẻ RFID · ô sạch · khoá & vách nguyên vẹn), thêm ảnh hiện trạng (**+ Ảnh mẫu (demo)**) → **Xác nhận hoàn tất nghiệm thu trả kho** | Không ghi sự cố | Hợp đồng **`SETTLEMENT_PENDING`**, thu hồi PIN/RFID, có **bảng quyết toán vòng 1** chờ khách xác nhận | PR-O6, PR-O17, PR-O18, PR-O19 |
| 7.6 | Khách · trang hợp đồng → khung **Quyết toán trả kho** | Đọc bảng tiền + khối **Đối chiếu với lúc hẹn trả kho** → **Xác nhận quyết toán** | — | Quyết toán **Chờ hoàn tiền** (`REFUNDING`). Hợp đồng **chưa kết thúc**. FM nhận thông báo + task hoàn tiền | PR-O20, PR-O29, PR-O31 (D-23) |
| 7.7 | FM · `/manager/refunds` (hoặc `/manager/settlements` tab **Chờ hoàn tiền**) | Mở task hoàn tiền → tải ảnh biên lai, nhập mã FT → **Xác nhận đã hoàn tiền** | Ảnh ở 0.3 · mã FT `FT26112201` | Task **`COMPLETED`**; quyết toán **Chờ khách nhận tiền** (`REFUND_SENT`) | PR-O12, PR-O15, PR-O29 |
| 7.8 | Khách · trang hợp đồng | Khung quyết toán → **Đã nhận được** | — | Quyết toán **Đã tất toán** (`COMPLETED`), hợp đồng **`TERMINATED`**, đơn **`COMPLETED`** | PR-O25, PR-O29 |

---

## 8. Kiểm tra cuối

| Chỗ xem | Kỳ vọng |
|---|---|
| Khách · `/kho-cua-toi` | Hợp đồng **Đã kết thúc**; khung quyết toán ghi "Khách đã nhận tiền hoàn. Hợp đồng đã kết thúc." |
| Khách · `/thanh-toan` | Đủ giao dịch: cọc + thuê lúc đặt, gia hạn, hoàn tiền trả kho (thành công) |
| FM · `/manager/settlements` tab **Đã tất toán** | Có hợp đồng vừa xong |
| FM · `/manager/storage` | Ô đã trống lại, sẵn sàng cho khách mới |
| Admin · `/admin/logs` (tuỳ chọn) | Nhật ký đủ các bước: đặt cọc, gán ô, check-in, ticket, gia hạn, nghiệm thu, xác nhận quyết toán, hoàn tiền, khách nhận tiền |

## 9. Lưu ý khi chạy

- **Email:** thông báo đều có ở chuông. Email không gửi tới hộp thư của khách: hiện code dồn mọi email về một địa chỉ cố định, và bản Docker chưa cấu hình SMTP nên chỉ in ra log backend.
- **Đơn hết 15 phút giữ suất** nếu thoát VNPAY giữa chừng → đặt lại từ bước 1.2.
- **Bước 3.4 bị khoá nút gửi:** đọc dòng chữ xám dưới nút (thiếu tick, thiếu ảnh, hoặc thiếu giá trị hàng).
- **Bước 4.1 báo biên bản không còn chờ xác nhận:** đã quá 21:00 hoặc Staff vừa lập lại biên bản; bấm lại ⚡ "Khách tới hôm nay" rồi Staff gửi lại.
- **Bước 7.5 báo còn yêu cầu hỗ trợ chưa xử lý:** quay lại bước 5.4 đóng ticket.
- **Chạy lại từ đầu:** dùng khách khác (`khachhang3..5`), hoặc tạo lại DB (`docker compose down -v` rồi `docker compose up -d` — **xoá toàn bộ dữ liệu Docker**).

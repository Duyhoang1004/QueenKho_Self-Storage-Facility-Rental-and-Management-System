# QueenKho — Kịch bản test / demo kèm nghiệp vụ

> Soạn 02/11/2026, mã và nội dung nghiệp vụ lấy từ `docs/business-rules.md` (bản đồng bộ code `main` @ `d8e21b3`).
> Mỗi bước ghi: **Ai làm · Thao tác · Kết quả mong đợi**, rồi liệt kê nghiệp vụ dạng `+ MÃ : nội dung`.
> ⚡ = dùng nút "Giả lập" (tua thời gian, BR-114 → BR-116). ⚠️ = rule đang lệch / chưa code — **tránh demo**, chỉ nói khi được hỏi.

---

## 0. Chuẩn bị trước buổi demo

| Việc | Ghi chú |
|---|---|
| DB chạy lại `QueenKho.sql` + dữ liệu mẫu, backend + frontend chạy | Đăng nhập thử đủ 5 vai trò (khách, FM, Staff **cùng cơ sở**, BOM, Admin) |
| `SIMULATION_ENABLED` đang bật | Không có nút ⚡ thì không demo được check-in, No-Show, quá hạn |
| Thử 1 lần thanh toán VNPAY sandbox | Đơn phải chuyển `DEPOSIT_PAID`; chuẩn bị thẻ test |
| Mở 3 cửa sổ: Khách / FM / Staff | Phiên lưu ở `sessionStorage` nên mỗi tab giữ một tài khoản (BR-05) |
| Chuẩn bị sẵn 3–4 hợp đồng ở trạng thái khác nhau | `ACTIVE`, sắp hết hạn, `OVERDUE`, `TERMINATION_PENDING` — để demo ngoại lệ không phải chạy lại từ đầu |
| Không bấm thông báo mẫu viết cứng | ⚠️ L-31 (BR-113) |

Nghiệp vụ nền dùng xuyên suốt:
+ `PR-90` : Mọi API lấy người thao tác từ token; khách chỉ thấy đơn / hợp đồng của mình, FM / Staff chỉ thấy dữ liệu cơ sở mình.
+ `PR-91` : Mọi thay đổi trạng thái nằm trong 1 transaction và ghi `activity_logs`.
+ `PR-92` : Giờ quầy đóng 21:00 là hạn của mọi task; khách ra vào kho 24/7 bằng PIN / RFID.
+ `BR-04` : Đăng nhập xong điều hướng theo role: khách `/`, Staff `/staff`, FM `/manager`, BOM `/bom`, Admin `/admin`.

---

## A. Luồng chính

### TC-01. Khách tìm kho
- **Ai làm:** Khách (chưa cần đăng nhập)
- **Thao tác:** Mở trang tìm kho, lọc theo thành phố / loại kho / khoảng giá, xem số suất còn trống từng loại.
- **Kết quả:** Chỉ hiện cơ sở và loại kho đang hoạt động; loại hết suất bị ẩn, trừ khi có ô sắp trống (hiện "Trống từ dd/MM").

+ `BR-10` : Chỉ hiện cơ sở `ACTIVE`; lọc theo từ khoá, thành phố, loại kho, khoảng giá, khoảng diện tích.
+ `BR-11` : Số suất của (cơ sở × loại kho) = ô `AVAILABLE` − đơn `PENDING` − đơn `DEPOSIT_PAID`; suất = 0 thì ẩn, nhưng nếu có ô sắp trống thì vẫn hiện nhãn "Trống từ dd/MM".
+ `PR-M4` : Loại kho `INACTIVE` không hiện trong tìm kiếm.
+ `D-02` : Chỉ đặt được khi còn suất đúng loại + cơ sở; đặt chỗ giữ tạm 1 suất, gán ô mới trừ thật.

### TC-02. Khách đặt kho
- **Ai làm:** Khách (đã đăng nhập)
- **Thao tác:** Chọn cơ sở, loại kho, gói 3 tháng, ngày nhận kho; kiểm tra SĐT / CCCD tự điền; tick đồng ý điều khoản; xem bảng giá rồi bấm Đặt kho.
- **Kết quả:** Tạo đơn `RES-xxxxxx` trạng thái `PENDING`, chưa có ô; màn hình hiện tổng tiền đã trừ ưu đãi gói và voucher 100.000đ.

+ `BR-21` : Gói thuê 1 / 3 / 6 / 12 tháng.
+ `BR-22` : Mã đơn `RES-xxxxxx`; đơn mới `PENDING`, chưa có ô.
+ `D-01` : Trả trước theo kỳ: lúc đặt trả cọc + tiền thuê cả kỳ; không thu hằng tháng.
+ `D-08` : Ưu đãi đặt mới 1/3/6/12 tháng mặc định 0/5/10/15% (BOM chỉnh được); đơn chốt % vào `rent_discount_percent`.
+ `PR-M6` : Cọc = giá niêm yết × hệ số cọc của chính sách hiện hành lúc đặt; lưu vào đơn, không đổi về sau.
+ `BR-24` : Tổng trả = giá × số tháng × (1 − ưu đãi gói) + cọc − 100.000đ ưu đãi đặt trực tuyến.
+ `BR-25` / `D-06` : Mỗi đơn đặt mới giảm cố định 100.000đ, mã `NEWKHO` áp sẵn, không áp cho gia hạn.
+ `BR-102` : Bắt buộc đồng ý điều khoản xử lý tài sản (thiếu → `TERMS_NOT_ACCEPTED`); lưu phiên bản điều khoản `v2` và thời điểm đồng ý.
+ `PR-B5` : Họ tên, email chỉ đọc; SĐT, CCCD tự điền và sửa được, CCCD bắt buộc; khi tạo đơn lưu lại vào tài khoản.
+ `PR-B1` : Tạo đơn đếm lại số suất trong transaction có khoá; hết → 409 `NO_AVAILABILITY`.
+ `PR-B3` : Chỉ khách `ACTIVE` được đặt; cơ sở, loại kho phải `ACTIVE`; khách đang quá hạn / còn nợ bị chặn (PR-Q12).
+ `PR-B10` : Giờ nhận kho mặc định 09:00 ngày bắt đầu, lưu vào `expected_appointment_time`.
+ ⚠️ `PR-B4` : Ngày nhận từ ngày mai đến tối đa 30 ngày — BE chưa chặn đủ (L-09). Form còn bắt nhập địa chỉ (L-35), nhập gì cũng được.

### TC-03. Khách thanh toán cọc qua VNPAY
- **Ai làm:** Khách
- **Thao tác:** Bấm thanh toán, trả bằng thẻ test VNPAY sandbox, quay về trang đơn.
- **Kết quả:** Đơn `DEPOSIT_PAID`, giao dịch `SUCCESS` có mã giao dịch ngân hàng; FM nhận thông báo "Đơn đặt kho mới chờ gán ô".

+ `PR-B6` : Đơn `PENDING` giữ suất 15 phút; IPN thành công về cho đơn đã hết hạn / huỷ → giao dịch vẫn `SUCCESS` + tự tạo yêu cầu hoàn tiền.
+ `BR-27` : IPN kiểm tra chữ ký HMAC, khớp số tiền, mỗi giao dịch chỉ xử lý 1 lần (khoá dòng).
+ `BR-103` : IPN thành công lưu mã giao dịch ngân hàng (`vnp_BankTranNo`, không có thì `vnp_TransactionNo`).
+ `PR-B8` : VNPAY lỗi / khách huỷ trên VNPAY → đơn vẫn `PENDING`, có nút "Thanh toán lại" đến hết 15 phút.
+ `BR-111` : Thanh toán cọc thành công → thông báo cho FM cơ sở.
+ `BR-12` : Trang "Đơn của tôi" hiện số đã thanh toán thực tế = tổng giao dịch `SUCCESS`.

### TC-04. FM gán ô kho cho đơn
- **Ai làm:** FM
- **Thao tác:** Vào "Đơn chờ gán ô", mở đơn vừa cọc, chọn ô trên **sơ đồ mặt bằng** (hoặc danh sách), ghi chú bàn giao, xác nhận.
- **Kết quả:** Ô `OCCUPIED`, đơn `UNIT_ASSIGNED`, hợp đồng `HD-xxxxxx` `PENDING_CHECK_IN`, sinh task `CHECK_IN`; khách nhận thông báo đã gán ô.

+ `BR-40` : FM thấy đơn `DEPOSIT_PAID`, chưa có ô, thuộc cơ sở mình, cũ nhất trước.
+ `BR-41` : Chỉ gợi ý ô `AVAILABLE` cùng cơ sở, cùng loại; hết thì không gợi ý ô khác loại.
+ `BR-110` : Trên mặt bằng chỉ ô gán được bấm được, ô khác làm mờ; ô chưa đặt lên mặt bằng vẫn chọn ở danh sách.
+ `BR-42` : Gán khi đơn `DEPOSIT_PAID` và ô `AVAILABLE`, đúng loại & cơ sở; chiếm ô bằng UPDATE có điều kiện để hai FM không gán trùng; 1 transaction tạo hợp đồng + task `CHECK_IN` + thông báo khách.
+ `BR-43` : Hợp đồng: start = ngày bắt đầu đơn; end = start + số tháng; cọc giữ = cọc; gắn chính sách đang hiệu lực của cơ sở.
+ `BR-60` : Task sinh tự động; mỗi hợp đồng chỉ có 1 task `CHECK_IN` đang mở.
+ `BR-61` : Hạn task = 21:00 ngày hẹn.

### TC-05. Giao việc cho nhân viên
- **Ai làm:** FM (hoặc Staff tự nhận)
- **Thao tác:** Cách 1 — FM mở task `CHECK_IN`, giao cho một Staff. Cách 2 — Staff vào bảng công việc, bấm Nhận việc.
- **Kết quả:** Task `IN_PROGRESS`, có người nhận; Staff được giao nhận thông báo "Phân công task mới".

+ `BR-63` : Staff + FM cùng cơ sở xem bảng công việc; lọc trạng thái, loại, "Việc của tôi".
+ `BR-64` : Chỉ Staff cùng cơ sở nhận task `OPEN` chưa quá hạn; ai bấm trước người đó nhận; không tự trả việc.
+ `BR-65` : Chỉ FM cùng cơ sở gỡ người nhận của task `IN_PROGRESS` → `OPEN`.
+ Giao việc (UC-16, 26/10) : FM giao task `CHECK_IN` / `CHECK_OUT` / `SUPPORT` / `MAINTENANCE` chưa quá hạn cho Staff `ACTIVE` cùng cơ sở; sai người → `INVALID_STAFF` / `STAFF_INACTIVE`; task `REFUND` là việc của FM; log `[TASK_ASSIGN]`.
+ `BR-111` : FM giao task → thông báo cho Staff được giao.
+ ⚠️ `PR-C6` : Giới hạn chỉ nhận task trong 3 ngày tới — chưa code (L-29).

### TC-06. ⚡ Khách tới nhận kho hôm nay
- **Ai làm:** Staff / FM
- **Thao tác:** Trên task `CHECK_IN`, bấm ⚡ "Khách tới hôm nay".
- **Kết quả:** Ngày bắt đầu đơn + hợp đồng dời về hôm nay (giữ số tháng), task mở lại nếu đã quá hạn; nhật ký có dòng `[SIMULATION]`.

+ `PR-C1` : Chỉ check-in trong ngày hẹn (trước 21:00); làm sớm → 409 `CHECK_IN_TOO_EARLY`. *(Vì form chỉ cho đặt từ ngày mai nên demo phải dùng ⚡.)*
+ `BR-115` : Giả lập chỉ dời mốc thời gian rồi để nghiệp vụ thật xử lý tiếp; vẫn kiểm tra quyền và phạm vi cơ sở.
+ `BR-116` : Mỗi lần giả lập ghi log `[SIMULATION]` kèm người bấm.

### TC-07. Nhân viên check-in & bàn giao kho
- **Ai làm:** Staff đang giữ task
- **Thao tác:** Mở task, đối chiếu họ tên / SĐT / CCCD của khách, tick đủ checklist, bấm "Sinh lại" lấy PIN 6 số, nhập mã thẻ RFID, hoàn tất (có thể dùng "Giả lập hoàn thiện" để điền nhanh).
- **Kết quả:** Lập biên bản `CHECK_IN`; hợp đồng `ACTIVE` kèm PIN + RFID; task `COMPLETED`.

+ `BR-70` : Chỉ Staff đang giữ task `CHECK_IN` `IN_PROGRESS`, chưa quá hạn, hợp đồng `PENDING_CHECK_IN`.
+ `PR-C2` : Chi tiết task hiện họ tên + SĐT + CCCD; "xác minh danh tính" = CCCD khớp CCCD đã lưu.
+ `BR-71` : Checklist bắt buộc đủ: xác minh danh tính, ô trống, ô sạch, khoá nguyên vẹn, khách xác nhận ký.
+ `BR-72` : PIN đúng 6 chữ số do hệ thống gợi ý; RFID bắt buộc, ≤ 50 ký tự; ghi chú ≤ 1000 ký tự.
+ `BR-73` : PIN và RFID không trùng với hợp đồng `ACTIVE` / `OVERDUE` / `TERMINATION_PENDING`.
+ `BR-74` : 1 transaction: biên bản `CHECK_IN`; hợp đồng `ACTIVE` + PIN + RFID; task `COMPLETED`; log; không đổi ngày bắt đầu / kết thúc.
+ `PR-C4` : Có nút "Giả lập hoàn thiện" (sản phẩm môn học).
+ 🔸 SmartLock là mô phỏng — PIN được quản lý trong hệ thống, chưa nối thiết bị.
+ ⚠️ `PR-C5` (Staff không thấy PIN sau check-in) và `PR-C7` (mục 6 cam kết hàng cấm) chưa làm (L-30, L-26).

### TC-08. Khách xem hợp đồng trong "Kho của tôi"
- **Ai làm:** Khách
- **Thao tác:** Mở "Kho của tôi" → hợp đồng vừa nhận.
- **Kết quả:** Thấy PIN, mã RFID, thời hạn, các khoản đã đóng, vị trí ô trên mặt bằng, điều khoản đã đồng ý.

+ `BR-80` : "Tổng đã đóng" = tổng giao dịch `SUCCESS` (cọc + tiền thuê); "tiền thuê đã đóng" = tổng − cọc đang giữ; hiện PIN / RFID cho khách.
+ `BR-109` : Khách xem vị trí ô của hợp đồng mình khi hợp đồng `PENDING_CHECK_IN` / `ACTIVE` / `OVERDUE` / `TERMINATION_PENDING`; ô khác trên tầng chỉ hiện hình khối, không mã, không trạng thái.
+ `BR-102` : Khách xem lại bản điều khoản đã đồng ý.
+ `PR-R9` : Còn ≤ 7 ngày đến ngày hết hạn → banner nhắc gia hạn.

### TC-09. Khách gửi yêu cầu hỗ trợ → nhân viên xử lý → đóng ticket
- **Ai làm:** Khách → Staff → Khách
- **Thao tác:**
  1. Khách vào `/ho-tro`, chọn hợp đồng, loại "Sự cố khoá" (`LOCK_ISSUE`), mô tả ≥ 10 ký tự, gửi.
  2. Staff thấy task `SUPPORT` nổi lên đầu bảng (khẩn), nhận việc, ghi kết quả xử lý; nếu là sự cố khoá thì bấm "Cấp lại PIN".
  3. Khách bấm "Đã ổn" (đóng) hoặc "Chưa xong" (mở lại, bắt buộc lý do).
- **Kết quả:** Ticket `SR-xxxxxx` đi `OPEN` → `IN_PROGRESS` → `RESOLVED` → `CLOSED` (hoặc quay lại `OPEN` với task mới).

+ `PR-51` : Ticket bắt buộc gắn hợp đồng `ACTIVE` / `OVERDUE` / `TERMINATION_PENDING` của chính khách.
+ `PR-S1` : Loại `LOCK_ISSUE`, `SECURITY` (khẩn), `FACILITY_DAMAGE`, `CLEANING`, `OTHER`; mô tả 10–1000 ký tự; mã `SR-xxxxxx`.
+ `PR-S2` : Mỗi hợp đồng 1 ticket mở / loại (→ `DUPLICATE_ISSUE_TYPE`), tối đa 3 ticket mở (→ `MAX_OPEN_TICKETS_REACHED`).
+ `PR-34` : Tạo ticket → task `SUPPORT` tại cơ sở của hợp đồng; ticket khẩn nổi đầu bảng; task `IN_PROGRESS` → ticket `IN_PROGRESS`.
+ `PR-S5` : Chỉ Staff giữ task, chưa quá hạn, mới hoàn tất; bắt buộc ghi kết quả xử lý; ticket → `RESOLVED`.
+ `PR-S6` : Ticket `LOCK_ISSUE` có nút "Cấp lại PIN" (6 số, không trùng); hợp đồng `OVERDUE` không cấp lại.
+ `PR-52` : `RESOLVED`: "Đã ổn" → `CLOSED`; "Chưa xong" → `OPEN` + task `SUPPORT` mới; 3 ngày không phản hồi → tự `CLOSED` (⚡ "ticket quá 3 ngày").
+ `PR-S3` : Khách huỷ ticket còn `OPEN` → `CLOSED`, task huỷ.
+ `PR-S7` : Hỗ trợ không phát sinh phí.
+ `PR-S4` : Task `SUPPORT` quá hạn: Staff không làm tiếp, FM gia hạn task.

### TC-10. Khách gia hạn hợp đồng
- **Ai làm:** Khách
- **Thao tác:** Mở hợp đồng → Tuỳ chọn hợp đồng → Gia hạn; xem hạn chót gia hạn ưu tiên, giá từng gói; chọn gói, thanh toán VNPAY.
- **Kết quả:** Giao dịch `MONTHLY_RENT` `SUCCESS`; ngày hết hạn nối tiếp; trang hợp đồng báo gia hạn thành công.

+ `PR-R1` : Chỉ gia hạn khi hợp đồng `ACTIVE` / `TERMINATION_PENDING` / `OVERDUE`; khác → 409 `CONTRACT_NOT_RENEWABLE`.
+ `PR-R2` : Chỉ nhận gói 1 / 3 / 6 / 12 tháng; số tháng lưu tường minh.
+ `BR-81` : Giá = giá niêm yết hiện tại × số tháng × (1 − ưu đãi gia hạn 0/0/5/10%).
+ `BR-82` : Còn hạn → nối tiếp ngày hết hạn; đã quá hạn → tính từ hôm nay.
+ `PR-R10` : Hạn chót gia hạn ưu tiên = hết ngày `end_date − 3`; sau mốc chỉ gia hạn khi ô chưa ai đặt trước, ngược lại 409 `RENEWAL_UNIT_RESERVED`.
+ `PR-R5` : Mỗi hợp đồng 1 giao dịch gia hạn `PENDING`; tạo link mới thì link cũ `FAILED`.
+ `PR-R8` : Trang hợp đồng đọc kết quả VNPAY và báo thành công / thất bại.
+ `PR-12` : Đổi giá chỉ áp cho đơn mới và lần gia hạn sau.

### TC-11. Khách hẹn trả kho
- **Ai làm:** Khách
- **Thao tác:** Tuỳ chọn hợp đồng → Trả kho; chọn ngày hẹn, chọn cách nhận lại cọc (chuyển khoản + thông tin tài khoản, hoặc tiền mặt); xem bảng tính tiền hoàn dự kiến; xác nhận.
- **Kết quả:** Hợp đồng + đơn `TERMINATION_PENDING`; sinh task `CHECK_OUT`; PIN vẫn dùng được để dọn đồ.

+ `BR-84` : Hợp đồng `ACTIVE` / `OVERDUE`; hợp đồng + đơn → `TERMINATION_PENDING`; sinh task `CHECK_OUT` (ghi chú chứa thông tin hoàn cọc).
+ `PR-O1` : Ngày hẹn từ ngày mai đến `end_date + 5`; hợp đồng `OVERDUE` chỉ hẹn trong 3 ngày tới.
+ `PR-O3` : Bắt buộc chọn cách nhận cọc: chuyển khoản (ngân hàng, số TK, chủ TK) hoặc tiền mặt tại quầy.
+ `PR-O14` : Ngày `end_date + 1` miễn phí; ngày +2 → +5 tính tiền thuê theo ngày, trừ vào cọc.
+ `PR-O2` : Trả sớm được hoàn tiền thuê = tiền kỳ hiện tại đã trả − số tháng đã dùng × giá niêm yết − phí phá hợp đồng 1 tháng (≥ 0).
+ `PR-O4` : Khách huỷ yêu cầu trả kho được trước ngày hẹn nếu chưa quá hạn → hợp đồng `ACTIVE`, task huỷ.
+ `PR-R7` : Gia hạn khi đang chờ trả kho → huỷ task trả kho, báo "Yêu cầu trả kho đã được huỷ".

### TC-12. ⚡ + Nhân viên nghiệm thu trả kho (có sự cố)
- **Ai làm:** Staff
- **Thao tác:** ⚡ "Khách tới trả kho hôm nay" → nhận task `CHECK_OUT` → làm checklist; bỏ tick "Sạch" → lập sự cố "Vỡ vách ngăn", chọn **lỗi do khách**, nhập chi phí, đính kèm ảnh → hoàn tất.
- **Kết quả:** Biên bản `CHECK_OUT`; hợp đồng `TERMINATED`, đơn `COMPLETED`, xoá PIN / RFID; ô `MAINTENANCE` + task bảo trì; sinh task `REFUND` cho FM; FM nhận thông báo sự cố.

+ `PR-O5` : Staff giữ task `CHECK_OUT`, trong ngày hẹn, hợp đồng `TERMINATION_PENDING`.
+ `PR-O6` : "Ô trống" + "Xác minh danh tính" bắt buộc đạt; "Sạch" / "Khoá nguyên vẹn" được không đạt nhưng bắt buộc lập sự cố (`DAMAGE_REPORT_REQUIRED`).
+ `PR-O8` : Một lần nghiệm thu có thể nhiều sự cố; mỗi sự cố có chi phí ≥ 0 và bắt buộc ≥ 1 ảnh (`EVIDENCE_IMAGE_REQUIRED`).
+ `PR-O16` : Mỗi sự cố bắt buộc chọn lỗi: khách → trừ cọc; cơ sở → chỉ ghi chi phí nội bộ; cả hai đều đưa ô vào bảo trì.
+ `PR-O9` : Phí sự cố trừ vào cọc; vượt cọc → khoản nợ `DAMAGE_FEE`, khách trả ở trang Thanh toán, chưa trả bị chặn đặt kho.
+ `PR-O7` : 1 transaction: biên bản `CHECK_OUT`; hợp đồng `TERMINATED`; đơn `COMPLETED`; xoá PIN / RFID; ô `AVAILABLE` hoặc `MAINTENANCE`; tạo yêu cầu hoàn cọc; đóng ticket còn mở.
+ `BR-111` : Staff ghi sự cố → thông báo cho FM.

### TC-13. Nhân viên bảo trì ô
- **Ai làm:** Staff (hoặc FM đóng thẳng)
- **Thao tác:** Nhận task `MAINTENANCE`, bấm "Sửa xong", ghi chú ≥ 10 ký tự.
- **Kết quả:** Task `COMPLETED`, ô `AVAILABLE` cho thuê lại.

+ `PR-O10` : Ô bảo trì do sự cố → task `MAINTENANCE` (hạn 21:00 sau 3 ngày); Staff giữ task hoặc FM bấm "Sửa xong" → ô `AVAILABLE`; task quá hạn vẫn đóng được.

### TC-14. FM hoàn cọc
- **Ai làm:** FM
- **Thao tác:** Mở task `REFUND`, xem bảng quyết toán cọc; chuyển khoản → tải ảnh ủy nhiệm chi + nhập mã FT; hoàn tất.
- **Kết quả:** Giao dịch `REFUND` `SUCCESS` có mã FT; task `COMPLETED`.

+ `PR-O11` : Hoàn cọc = cọc giữ − phí sự cố − phí ân hạn / phí trễ − phí chiếm dụng (≥ 0), trừ theo thứ tự sự cố → ân hạn / phí trễ → phí chiếm dụng; bằng 0 vẫn tạo task để đóng hồ sơ.
+ `PR-O12` / `D-04` : Mỗi khoản cần hoàn sinh 1 task `REFUND` do FM xử lý (không giao Staff).
+ `PR-O15` : Chuyển khoản bắt buộc ảnh / link ủy nhiệm chi; mã FT nhập nếu có; tiền mặt bắt buộc tick "Khách đã ký nhận"; thiếu → 400 `REFUND_EVIDENCE_REQUIRED`.
+ `PR-93` : Hạn xử lý hoàn tiền 24h, không tính Chủ Nhật.
+ `PR-M8` : Phí trừ vào cọc ghi method `DEPOSIT_OFFSET`, không phải tiền mới thu vào.

---

## B. Trường hợp ngoại lệ

### TC-15. Đơn hết 15 phút giữ chỗ
- **Ai làm:** Khách tạo đơn, không thanh toán → ⚡ "Quá 15 phút"
- **Kết quả:** Đơn `EXPIRED`, giao dịch `PENDING` → `FAILED`, suất được trả lại.

+ `PR-B6` : Đơn `PENDING` giữ suất 15 phút.
+ `PR-B7` : Hết hạn → đơn `EXPIRED`, giao dịch `PENDING` → `FAILED`.
+ `PR-B6` (tiếp) : Nếu IPN thành công về sau đó → giao dịch `SUCCESS` + đơn `REFUND_PENDING` + task hoàn tiền.

### TC-16. Khách huỷ đơn đã cọc
- **Ai làm:** Khách → FM
- **Thao tác:** "Đơn của tôi" → Huỷ đơn `DEPOSIT_PAID`, chọn lý do; xem số tiền hoàn trước khi xác nhận. FM hoàn tiền qua task `REFUND`.
- **Kết quả:** Đơn `REFUND_PENDING` → FM hoàn xong → `REFUNDED`.

+ `BR-30` : Chỉ huỷ đơn `PENDING` hoặc `DEPOSIT_PAID` (đã gán ô thì không).
+ `BR-31` : Mốc tính phí = giờ hẹn nhận kho (mặc định 09:00 ngày bắt đầu).
+ `BR-32` : Trước mốc hơn `cancel_free_hours` (mặc định 24h) → hoàn 100%; trong khoảng đó → phạt `cancel_fee_percent` (mặc định 50%) × cọc.
+ `BR-33` : Bắt buộc lý do (4 lý do có sẵn hoặc "Lý do khác").
+ `BR-34` : Đơn đã thanh toán → `REFUND_PENDING` + giao dịch `REFUND` + task `REFUND` cho FM; FM hoàn xong → `REFUNDED`.
+ `BR-35` : Mọi lần huỷ ghi nhật ký.
+ `PR-M5` : Dùng chính sách hiện hành của cơ sở lúc huỷ.
+ `PR-R12` : Đã tới ngày nhận mà cơ sở chưa gán được ô → lỗi cơ sở, khách huỷ được hoàn 100%.

### TC-17. Khách không tới check-in (No-Show)
- **Ai làm:** Staff → FM
- **Thao tác:**
  1. Task `CHECK_IN` quá hạn → hiện ở danh sách No-Show.
  2. Staff ghi "Báo cáo liên hệ" thất bại (⚡ "đủ điều kiện No-Show" để có 2 lần cách 24h + lùi giờ hẹn 49h).
  3. FM chọn: **Dời lịch** (liên lạc được) hoặc **No-Show** (tịch thu cọc, hoàn tiền thuê) hoặc No-Show **Miễn phạt** (hoàn cả cọc, bắt buộc lý do).
- **Kết quả:** No-Show → đơn `CANCELLED`, ô `AVAILABLE`, hợp đồng `TERMINATED`, task check-in huỷ, tạo task `REFUND`.

+ `BR-50` : Danh sách No-Show = đơn đã gán ô mà ngày bắt đầu đã qua (task check-in `OVERDUE`).
+ `BR-53` : Staff ghi kết quả cuộc gọi trên task `CHECK_IN` quá hạn, lưu vào task và nhật ký.
+ `PR-X3` : Chỉ bấm No-Show khi có ≥ 2 lần liên hệ thất bại cách nhau ≥ 24h **và** đã qua 48h từ giờ hẹn; chưa đủ → 409 `NO_SHOW_NOT_ALLOWED_YET`.
+ `PR-X1` / `D-07` : No-Show tịch thu 100% cọc, hoàn toàn bộ tiền thuê; "Miễn phạt" (bắt buộc lý do) → hoàn cả cọc.
+ `PR-X2` : API tự kiểm tra ngày; nhật ký ghi người thao tác là FM.
+ `BR-51` : No-Show: đơn `CANCELLED`; ô `AVAILABLE`; hợp đồng `TERMINATED`; huỷ task `CHECK_IN`; còn tiền hoàn → task `REFUND`.
+ `BR-52` : Dời lịch: ngày mới không ở quá khứ; dời start / end hợp đồng (giữ số tháng); task quá hạn được mở lại.
+ `PR-C3` : Đây là lối duy nhất xử lý task `CHECK_IN` quá hạn.

### TC-18. Khách đã hẹn trả nhưng tới trễ (trong ân hạn)
- **Ai làm:** Khách hẹn trả sau `end_date` → Staff nghiệm thu
- **Kết quả:** Ngày +1 miễn phí, ngày +2 → +5 tính tiền thuê theo ngày, trừ vào cọc. Quá `end_date + 5` chưa nghiệm thu → hợp đồng `OVERDUE`.

+ `D-11` / `PR-O14` : Ân hạn dọn đồ: miễn phí 1 ngày sau `end_date`; ngày 2 → 5 tính tiền thuê theo ngày (giá / 30), trừ vào cọc.
+ `PR-O13` : Task `CHECK_OUT` quá hạn → FM dời ngày trả kho hoặc để nguyên; qua `end_date + 5` → hợp đồng `OVERDUE`.
+ `PR-Q1` : `TERMINATION_PENDING` có `end_date + 5` < hôm nay → job chuyển `OVERDUE`, huỷ task `CHECK_OUT`.
+ `PR-Q2` : Lỡ ân hạn thì số ngày quá hạn tính từ `end_date + 1` (mất quyền miễn phí).

### TC-19. Khách quá hạn không hẹn trả — và các hướng xử lý
- **Ai làm:** ⚡ "Hợp đồng quá hạn N ngày" (thử N = 3 và N = 16)
- **Kết quả chung:** Hợp đồng `OVERDUE`; khách thấy "PIN đã khoá", số ngày quá hạn, phí trễ + phí chiếm dụng; FM thấy hợp đồng ở màn "Hợp đồng quá hạn"; khách bị chặn đặt kho mới.

+ `PR-Q1` : Job 00:05 hằng ngày: `ACTIVE` có `end_date` < hôm nay → `OVERDUE` (không hẹn trả thì không có ân hạn).
+ `PR-Q3` : Phí trễ = cọc × min(số ngày quá hạn, 5) × 10% — trần 50% cọc.
+ `PR-Q14` : Phí chiếm dụng mỗi ngày = giá niêm yết / 30 × 150%, không trần (chỉ áp điều khoản v2).
+ `PR-Q4` : Phí tính động, chỉ ghi giao dịch khi khách trả hoặc khi trừ vào cọc.
+ 🔸 `PR-Q5` : `OVERDUE` → PIN hiển thị bị khoá (mô phỏng).
+ `PR-Q11` : Màn FM "Hợp đồng quá hạn": số ngày quá hạn, phí trễ + phí chiếm dụng, ghi chú liên hệ, nút Thanh lý.
+ `PR-Q12` : Khách có hợp đồng `OVERDUE` hoặc còn nợ → không đặt kho mới (409 `CUSTOMER_HAS_DEBT`).

**Hướng 1 — Khách gia hạn để ở tiếp**
+ `PR-Q6` : Một lần VNPAY = phí trễ + phí chiếm dụng + tiền kỳ mới; PIN mở lại.
+ `BR-83` : Gia hạn khi `OVERDUE` → hợp đồng `ACTIVE`, đơn `UNIT_ASSIGNED`.
+ `PR-R3` : Kỳ mới tính từ hôm nay; ngày quá hạn trước đó thu bằng phí trễ + phí chiếm dụng.
+ `PR-R10` : Đã qua hạn chót ưu tiên → chỉ gia hạn khi ô chưa ai đặt trước.

**Hướng 2 — Khách hẹn trả kho**
+ `PR-O1` / `PR-Q7` : Hợp đồng quá hạn chỉ hẹn trả trong 3 ngày tới; phí trễ tính đến ngày nghiệm thu, trừ vào cọc.
+ `PR-O11` : Trừ cọc theo thứ tự; phí chiếm dụng vượt cọc → nợ `OVERSTAY_FEE`.

**Hướng 3 — FM miễn phí trễ**
+ Miễn phí trễ (26/10) : FM miễn cho hợp đồng `OVERDUE` của cơ sở mình, lý do 5–400 ký tự, chỉ áp đợt quá hạn hiện tại; chính sách tắt quyền → 403 `WAIVER_NOT_ALLOWED`; miễn lần 2 → 409 `LATE_FEE_ALREADY_WAIVED`.
+ `PR-Q14` (tiếp) : Đã miễn → phí trễ = 0, phí chiếm dụng chỉ còn 100% giá ngày.

**Hướng 4 — FM thanh lý (N = 16)**
+ `PR-Q8` : Quá `liquidation_days` (15 ngày) → FM bấm Thanh lý, bắt buộc ghi chú liên hệ; chưa đủ ngày → 409 `LIQUIDATION_NOT_ALLOWED_YET`.
+ `PR-Q10` : Cần ≥ 3 lần liên hệ (409 `NOT_ENOUGH_CONTACTS`); thanh lý sinh task "Dọn ô sau thanh lý", bắt buộc biên bản kiểm kê.
+ `PR-Q9` / `D-09` : Hợp đồng `LIQUIDATED`; đơn `COMPLETED`; xoá PIN / RFID; ô `MAINTENANCE`; trừ cọc phí trễ rồi phí chiếm dụng; vượt cọc → nợ; cọc còn lại tạm giữ đến khi khách đến làm việc.

**Hướng 5 — Xử lý hàng lưu giữ (sau thanh lý)**
+ `PR-Q10` : Hàng lưu giữ 60 ngày ở trang "Hàng đang lưu giữ": khách nhận lại (phải hết nợ) · bán thanh lý (hết hạn + đã đồng ý điều khoản; tiền bán trừ nợ, dư hoàn khách) · tiêu huỷ (hết hạn) · giao cơ quan chức năng (bất cứ lúc nào). Chưa hết hạn mà bán / tiêu huỷ → 409 `HOLD_NOT_EXPIRED`. ⚡ "hàng lưu giữ hết hạn".
+ `PR-Q15` : Phí lưu giữ mỗi ngày = giá ngày của ô × 20%; thu từ tiền bán → cọc còn giữ → tại quầy khi khách nhận lại.

**Khoản nợ & trả nợ**
+ `PR-50` : Trang Thanh toán: xem mọi giao dịch + trả nợ `DAMAGE_FEE` / `OVERSTAY_FEE` qua VNPAY; huỷ trên VNPAY thì nợ vẫn còn; trả xong thì đặt kho lại được.

### TC-20. Ô "sắp trống" được bán trước (tối ưu doanh thu)
- **Thao tác:** Hợp đồng A đã qua `end_date − 3` mà chưa gia hạn → khách B đặt cùng loại kho tại cơ sở hết suất → tìm kho hiện "Trống từ dd/MM", B đặt với ngày nhận ≥ ngày đó → khách A thử gia hạn.
- **Kết quả:** B đặt được; A bị chặn gia hạn (409 `RENEWAL_UNIT_RESERVED`), được gợi ý hẹn trả kho.

+ `D-12` : Khách cũ không được giữ ô "miễn phí" khi không thuê tiếp: gia hạn báo trước 3 ngày, phí chiếm dụng, thanh lý 15 ngày, phí lưu giữ.
+ `PR-R10` : Sau hạn chót ưu tiên chỉ gia hạn khi ô chưa ai cần.
+ `PR-R11` : Ô của hợp đồng ở cửa sổ muộn được tính là suất cho đơn mới có ngày nhận ≥ ngày giao ô.
+ `PR-R12` : Tới ngày nhận mà ô chưa trống → khách B huỷ được hoàn 100%.

---

## C. Quản trị & phân quyền

### TC-21. BOM sửa chính sách thuê
- **Thao tác:** BOM đổi % phí huỷ hoặc ưu đãi gói của một cơ sở → lưu.
- **Kết quả:** Tạo phiên bản chính sách mới và kích hoạt; hợp đồng cũ vẫn giữ phiên bản lúc ký.

+ `PR-13` : Mỗi cơ sở đúng 1 chính sách hiệu lực; sửa = phát hành phiên bản mới; hợp đồng giữ chính sách lúc ký; xem được lịch sử phiên bản.
+ `PR-14` : Miền giá trị: hệ số cọc 1–3; % phí huỷ 0–100; % phí trễ / ngày 0–50; % phí chiếm dụng 100–300; % phí lưu giữ 0–100.
+ `PR-M5` : Huỷ đơn dùng chính sách hiện hành; phí trễ / thanh lý dùng chính sách gắn hợp đồng; chỉ BOM sửa, FM chỉ xem.
+ `PR-12` : Đổi giá chỉ áp cho đơn mới và lần gia hạn sau.

### TC-22. BOM / FM xem doanh thu
+ `PR-M7` : Ghi nhận theo ngày thực thu; doanh thu thuê = (cọc − phần cọc) + gia hạn + phí chiếm dụng; thu phí phạt = phí trễ + phí sự cố; đã hoàn; cọc đang giữ; tỉ lệ lấp đầy.
+ `PR-M8` : Khoản trừ cọc không tính là tiền mới thu vào.
+ `BR-103` / `PR-O15` : Danh sách đối soát hiện mã giao dịch ngân hàng / mã FT.
+ `PR-M14` : Dashboard FM là số thật của cơ sở: ô theo trạng thái, đơn chờ gán, No-Show, task hôm nay, hợp đồng sắp hết hạn / quá hạn, hoàn tiền chờ xử lý.

### TC-23. Admin xem nhật ký & lịch sử đăng nhập
- **Thao tác:** Admin mở `/admin/logs`, lọc theo mã nghiệp vụ `[CHECK_IN]`, `[SIMULATION]`; mở lịch sử đăng nhập, thử một lần đăng nhập sai.
+ `PR-A8` : Nhật ký ghi đúng người thao tác; job ghi bằng tài khoản `system`.
+ `PR-A9` / `PR-A10` : Các thao tác nghiệp vụ bắt buộc ghi log, nội dung mở đầu bằng mã nghiệp vụ.
+ `BR-97` / `BR-98` : Màn nhật ký chỉ Admin; lọc theo người, role, đối tượng, nội dung, khoảng ngày.
+ `BR-101` : Lịch sử đăng nhập ghi thành công / thất bại (kèm lý do) / đăng xuất, IP, trình duyệt.
+ `BR-116` : Thao tác giả lập hiện log `[SIMULATION]`.

### TC-24. Phân quyền
- **Thao tác:** Khách gõ URL `/manager` hoặc gọi API bảng việc; FM xem dữ liệu cơ sở khác.
- **Kết quả:** Bị chặn (403); FM chỉ thấy cơ sở của mình.
+ `PR-90` : Lấy người thao tác từ token, khoá phạm vi cơ sở.
+ `BR-04` : Mỗi layout tự kiểm tra role.
+ `PR-L1` / `PR-L2` : Tài khoản bị khoá không đăng nhập được; sai email / mật khẩu đều báo chung một lỗi.

---

## D. Không nên demo (rule chưa code / đang lệch)

| Rule | Tình trạng | Nếu bị hỏi |
|---|---|---|
| `PR-B2` 1 đơn `PENDING` / khách | chưa code (L-28) | Đã chốt, chưa kịp làm |
| `PR-B4` giới hạn 30 ngày | BE chưa chặn (L-09) | — |
| `PR-C5` ẩn PIN với Staff sau check-in | chưa làm (L-30) | — |
| `PR-C6` chỉ nhận task trong 3 ngày | chưa code (L-29) | — |
| `PR-C7` cam kết hàng cấm | chưa code (L-26) | — |
| Ô địa chỉ ở form đặt kho | thừa (L-35) | — |
| Quảng cáo voucher "cho đơn đầu tiên" | lệch BR-25 (L-04) | Voucher áp cho mọi đơn đặt mới |
| Thông báo | lưu bộ nhớ, có mẫu viết cứng (L-31) | Hạn chế đã ghi nhận |
| SmartLock | 🔸 mô phỏng (PR-Q5) | Chưa nối thiết bị |

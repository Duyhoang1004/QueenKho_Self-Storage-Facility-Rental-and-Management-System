# Tóm tắt, Phân tích & Đề xuất Cải tiến Business Rules — QueenKho

Tài liệu này tổng hợp bức tranh Business Rules hiện tại của hệ thống **QueenKho**, phân tích mức độ phù hợp với vận hành thực tế của ngành **Kho tự quản (Self-Storage)** và đề xuất các cải tiến nghiệp vụ.

---

## PHẦN 1: TÓM TẮT BUSINESS RULES HIỆN TẠI

Quy tắc nghiệp vụ của QueenKho được xây dựng xoay quanh 4 trụ cột chính:

### 1. Mô hình Tài chính & Đặt chỗ (Customer & Billing)
* **Trả trước theo kỳ (D-01):** Khách thanh toán trọn gói ngay lúc đặt: **Tiền cọc** (mặc định 1 tháng) + **Tiền thuê cả kỳ** (1, 3, 6, 12 tháng). Không thu lặt vặt hằng tháng. Hết kỳ muốn thuê tiếp thì làm thủ tục gia hạn kỳ mới.
* **Chiết khấu gói thuê (D-08):** Đặt mới giảm `0% / 5% / 10% / 15%` tương ứng cho các gói 1, 3, 6, 12 tháng; Gia hạn giảm `0% / 0% / 5% / 10%`. Bỏ voucher (D-06).
* **Cơ chế giữ chỗ tạm thời (D-02 & PR-B6):** Đơn `PENDING` giữ chỗ trong **15 phút**. Suất khả dụng được tính theo công thức:
  $$\text{Suất trống} = \text{Ô AVAILABLE} - \text{Đơn PENDING} - \text{Đơn DEPOSIT\_PAID}$$
* **Cổng thanh toán:** Tích hợp VNPAY Sandbox kèm Webhook (IPN) tự động chốt đơn sang `DEPOSIT_PAID`.

### 2. Vòng đời đơn đặt & Hợp đồng thuê
* **Đơn đặt chỗ (`reservations`):**
  `PENDING` $\xrightarrow{\text{VNPAY}}$ `DEPOSIT_PAID` $\xrightarrow{\text{Gán ô}}$ `UNIT_ASSIGNED` $\xrightarrow{\text{Báo trả}}$ `TERMINATION_PENDING` $\xrightarrow{\text{Nghiệm thu}}$ `COMPLETED`.
* **Hợp đồng (`rental_contracts`):**
  Sinh tự động khi Quản lý gán ô (`PENDING_CHECK_IN`) $\xrightarrow{\text{Staff Check-in}}$ `ACTIVE` $\xrightarrow{\text{Quá hạn}}$ `OVERDUE` $\xrightarrow{\text{Thanh lý}}$ `LIQUIDATED`.
* **Mã khóa PIN & Thẻ RFID:** Chỉ được cấp khi Staff hoàn tất biên bản Check-in (5 tiêu chí checklist: CCCD, ô trống, sạch sẽ, khóa nguyên vẹn, chữ ký).

### 3. Vận hành cơ sở & Bảng công việc (`facility_tasks`)
* **Phân quyền tại cơ sở:** Nhân viên (`STAFF`) và Quản lý (`FACILITY_MANAGER`) chỉ xem và thao tác trên dữ liệu thuộc cơ sở mình.
* **Task Board cơ sở:** Tự động sinh các loại công việc chính:
  - `CHECK_IN`: Sinh khi Quản lý gán ô kho (hạn chót 21:00 ngày hẹn).
  - `CHECK_OUT`: Sinh khi khách yêu cầu trả kho (UC-22), Staff thực hiện nghiệm thu (UC-23) & ghi nhận sự cố nếu có (UC-24).
  - `REFUND`: Sinh khi đơn cọc bị hủy hoặc sau khi trả kho có hoàn cọc $\rightarrow$ **Gán trực tiếp cho Facility Manager** xử lý chuyển khoản.
  - `SUPPORT`: Khi khách gửi ticket hỗ trợ.
  - `MAINTENANCE`: Sinh khi ô kho có sự cố hư hỏng cần bảo trì sau khi trả kho.
* **Hạn chót (Deadline):** Mặc định mọi task tại quầy hết hạn vào **21:00** (giờ đóng cửa). Quá hạn tự động chuyển `OVERDUE`.

### 4. Xử lý Ngoại lệ, Nghiệm thu Trả kho & Hoàn tiền
* **Hủy đơn (UC-15):** Hủy trước giờ hẹn $> \text{cancel\_free\_hours}$ $\rightarrow$ Hoàn 100% số đã trả; Trong khoảng đó $\rightarrow$ Phạt `cancel_fee_percent` $\times$ cọc, hoàn phần còn lại.
* **Khách không đến nhận kho (No-Show - EX-03):** Task Check-in bị `OVERDUE`. Staff gọi điện liên hệ ghi log. Nếu khách bỏ $\rightarrow$ Tịch thu 100% cọc, hoàn lại 100% tiền thuê. Quản lý có quyền "Miễn phạt".
* **Hẹn ngày trả kho (UC-22):** Khách hẹn ngày trả trong khoảng từ ngày mai đến `end_date + 5 ngày` (ân hạn 5 ngày miễn phí).
* **Nghiệm thu trả kho & Sự cố (UC-23 & UC-24):**
  - 2 mục bắt buộc đạt (Blocking): **Xác minh danh tính CCCD** và **Ô kho trống hoàn toàn**.
  - 2 mục tình trạng tài sản (Non-blocking): **Ô kho sạch sẽ** và **Khóa SmartLock nguyên vẹn**. Nếu không đạt $\rightarrow$ Bắt buộc lập biên bản sự cố (`damage_cases`) kèm chi phí dự kiến và **hình ảnh bằng chứng hiện trường**.
  - Khấu trừ tiền cọc (`DEPOSIT_OFFSET`): $\text{Tiền hoàn} = \text{Cọc đang giữ} - \text{Tổng phí sự cố} - \text{Phí trễ}$. Nếu vượt cọc $\rightarrow$ Ghi nhận khoản nợ `DAMAGE_FEE` (`PENDING`).

---

## PHẦN 2: PHÂN TÍCH & ĐÁNH GIÁ MỨC ĐỘ PHÙ HỢP THỰC TẾ

| Tiêu chí | Ưu điểm của Rules hiện tại | Hạn chế khi so sánh với thực tế bên ngoài |
|---|---|---|
| **Dòng tiền & Kế toán** | Thu trước cả kỳ giúp doanh nghiệp nắm chắc dòng tiền, không sợ rủi ro bùng tiền thuê tháng sau. | Khách thuê dài hạn (6–12 tháng) trả trước số tiền lớn sẽ e ngại nếu chính sách trả kho sớm quá cứng nhắc. |
| **Bảo mật & Trách nhiệm** | Bắt buộc đối chiếu CCCD và lập biên bản 5 bước lúc check-in/check-out giúp tránh tranh chấp tài sản. | Cần bổ sung cam kết pháp lý về **hàng cấm / phòng cháy chữa cháy** và **bằng chứng hình ảnh** khi khấu trừ cọc. |
| **Vận hành Task cơ sở** | Gán task `REFUND` cho Manager là rất chuẩn vì nhân viên ca trực không giữ tài khoản ngân hàng cơ sở. | Cần lưu ảnh chụp ủy nhiệm chi / biên lai chuyển tiền (`evidence_image_url`) để đối soát kế toán. |

---

## PHẦN 3: 6 ĐỀ XUẤT ĐIỀU CHỈNH & BỔ SUNG CHO SÁT VỚI THỰC TẾ

### 1. Chính sách Trả kho sớm (Early Termination) — Tránh xung đột với khách hàng
* **Hiện trạng (PR-O2):** *"Trả sớm không hoàn tiền thuê còn lại, chỉ hoàn cọc"*.
* **Vấn đề thực tế:** Nếu khách ký gói 12 tháng (được giảm 15%), nhưng mới dùng 2 tháng đã chuyển công tác. Nếu tịch thu toàn bộ 10 tháng tiền thuê còn lại sẽ gây bức xúc lớn cho khách.
* **Đề xuất cải tiến:**
  Áp dụng nguyên tắc **"Hồi tố ưu đãi & Phí phá vỡ hợp đồng" (Clawback & Break Fee)**:
  $$\text{Tiền thuê hoàn lại} = \text{Tổng tiền thuê đã đóng} - (\text{Số tháng thực tế đã dùng} \times \text{Giá gốc 1 tháng không giảm}) - \text{Phí hủy sớm (1 tháng tiền cọc)}$$
  *(Đảm bảo kho không bị thiệt khoản chiết khấu dài hạn, vừa công bằng với khách hàng).*

### 2. Rút ngắn hoặc tính phí thời gian ân hạn dọn đồ (Grace Period 5 ngày)
* **Hiện trạng (PR-O1):** Khách được hẹn trả kho trễ tới `end_date + 5 ngày` mà hoàn toàn miễn phí.
* **Vấn đề thực tế:** Trong ngành kho tự quản, **tỷ lệ lấp đầy (Occupancy Rate)** quyết định doanh thu. Giữ ô kho miễn phí 5 ngày khiến ô kho bị "đóng băng", không thể gán cho khách mới.
* **Đề xuất cải tiến:**
  - **Miễn phí 24–48 giờ đầu:** Cho phép khách dọn đồ miễn phí trong 1–2 ngày sau `end_date`.
  - **Từ ngày thứ 3 đến ngày thứ 5:** Tính phí lưu kho theo ngày (Prorated Daily Rate):
    $$\text{Phí lưu kho/ngày} = \frac{\text{Giá niêm yết tháng}}{30} \times 1.5$$
    Phí này tự động khấu trừ vào tiền cọc khi hoàn tất trả kho (`DEPOSIT_OFFSET`).

### 3. Phân định rõ "Giờ làm việc của quầy (21:00)" vs "Quyền ra vào kho 24/7"
* **Hiện trạng (PR-92):** Quy định *"Giờ đóng cửa 21:00 là hạn của mọi task"*.
* **Vấn đề thực tế:** Lợi thế cạnh tranh lớn nhất của Kho Tự Quản (Self-Storage) là khách hàng có mã PIN / thẻ RFID để tự mở kho lấy đồ 24/7.
* **Đề xuất cải tiến:**
  - **Giờ làm việc của Nhân viên (Staff Desk Hours: 08:00 – 21:00):** Áp dụng cho các thủ tục cần nhân viên trực tiếp (Check-in nhận thẻ RFID, Check-out nghiệm thu kho, Hỗ trợ tại chỗ).
  - **Giờ truy cập kho của Khách (Customer SmartLock Access: 24/7):** Hoạt động xuyên suốt cho mọi hợp đồng đang `ACTIVE`.

### 4. Bắt buộc "Ảnh bằng chứng (Photo Evidence)" cho Sự cố Hư hỏng (UC-24) & Hoàn Cọc (UC-25)
* **Hiện trạng:** Nếu chỉ nhập số tiền phạt hư hỏng hoặc bấm nút hoàn tiền dạng chữ (text) thì dễ dẫn đến tranh chấp với khách hàng hoặc thiếu minh bạch nội bộ.
* **Đề xuất cải tiến (Áp dụng ngay trong UC-23/UC-24):**
  - **Khi ghi nhận sự cố (UC-24):** Bắt buộc nhân viên đính kèm **ảnh chụp hiện trường hư hỏng** (`evidence_image_urls` trong bảng `damage_cases`) làm căn cứ khấu trừ tiền cọc.
  - **Khi hoàn tất chuyển khoản hoàn cọc (UC-25):** Lưu ảnh chụp màn hình giao dịch chuyển khoản ngân hàng vào cột `evidence_image_url` của `facility_tasks`.

### 5. Cam kết "An toàn PCCC & Hàng cấm" trong quy trình Bàn giao kho (UC-18)
* **Hiện trạng:** Checklist bàn giao gồm 5 mục kiểm tra vật lý (CCCD, trống, sạch, khóa, chữ ký).
* **Vấn đề thực tế:** Rủi ro pháp lý và hỏa hoạn cao nếu khách lén lưu trữ chất dễ cháy nổ (xăng dầu, bình gas, hóa chất), hàng quốc cấm, thực phẩm tươi sống gây mùi/chuột bọ.
* **Đề xuất cải tiến:**
  - Bổ sung điều khoản cam kết PCCC & Không lưu trữ hàng cấm vào biên bản bàn giao và hợp đồng thuê kho.

### 6. Quy trình No-Show (EX-03): Yêu cầu số lần liên hệ tối thiểu trước khi hủy đơn
* **Hiện trạng:** Khi task Check-in quá hạn (`OVERDUE`), Quản lý có thể bấm No-Show ngay.
* **Vấn đề thực tế:** Khách có thể gặp sự cố đột xuất (kẹt xe, hoãn lịch trình). Hủy đơn và phạt cọc ngay lập tức dễ gây trải nghiệm xấu.
* **Đề xuất cải tiến:**
  - Nhân viên cần thực hiện và ghi nhận tối thiểu **2 lần liên hệ** (`submitContactReport`) ở các khung giờ khác nhau trước khi Quản lý cơ sở chốt hủy No-Show.

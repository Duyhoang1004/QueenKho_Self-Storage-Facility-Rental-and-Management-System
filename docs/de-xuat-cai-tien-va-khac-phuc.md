# 📋 KẾ HOẠCH CẢI TIẾN & KHẮC PHỤC HỆ THỐNG (QUEENKHO)

> **Tài liệu tham chiếu:** `docs/business-rules.md`, `docs/bug-log.md`  
> **Cập nhật:** 26/10/2026  
> **Mục tiêu:** Khắc phục các điểm lệch kỹ thuật còn tồn đọng và nâng cấp trải nghiệm người dùng theo nghiệp vụ thực tế của mô hình kho lưu trữ tự quản (Self-Storage).

---

## PHẦN I: CÁC ĐIỂM LỆCH NGHIỆP VỤ & RỦI RO KỸ THUẬT CẦN KHẮC PHỤC

### 1. Bổ sung mục "Cam kết không lưu trữ hàng cấm" vào quy trình Check-in (`L-26` / `PR-C7`)

* **Hiện trạng:**
  - Form kiểm tra và lập biên bản bàn giao check-in của nhân viên (`StaffTaskDetailPage.jsx`) hiện chỉ gồm 5 mục: Xác minh CCCD, Ô kho trống, Ô kho sạch sẽ, Khóa nguyên vẹn, Khách ký biên bản.
* **Rủi ro thực tế:**
  - Mô hình kho tự quản (Self-Storage) cho phép khách tự do ra vào 24/7. Về mặt pháp lý và an toàn phòng cháy chữa cháy, việc khách hàng cam kết không cất giấu hàng lậu, vũ khí, chất dễ cháy nổ, chất độc hại là điều kiện tiên quyết bắt buộc trước khi giao quyền mở khóa khoang.
* **Giải pháp kỹ thuật đề xuất:**
  - **Database & Entity:** Thêm cột `is_prohibited_goods_committed BIT NOT NULL DEFAULT 0` vào bảng `handover_records` (Entity `HandoverRecord`).
  - **Backend DTO & Service:** Cập nhật `CheckInRequest`: bổ sung trường boolean `isProhibitedGoodsCommitted`, kiểm tra bắt buộc phải là `true` mới cho phép hoàn tất check-in.
  - **Frontend:** Thêm mục kiểm tra số 6 vào checklist tại `CHECKIN_CHECKLIST`:
    > *"Khách đã ký cam kết không lưu trữ hàng cấm, vũ khí, chất cháy nổ, hàng hóa vi phạm pháp luật."*

---

### 2. Đồng bộ thông tin CCCD và Địa chỉ của khách hàng khi Đặt chỗ kho (`L-14` / `PR-B5`)

* **Hiện trạng:**
  - Ở màn hình Đặt chỗ (`CreateReservationPage.jsx`), form yêu cầu khách hàng nhập Số CCCD và Địa chỉ thường trú.
  - Tuy nhiên, payload gửi lên API backend chỉ lưu Họ tên, SĐT, Email mà chưa cập nhật CCCD và Địa chỉ vào hồ sơ người dùng trong bảng `users`.
* **Rủi ro thực tế:**
  - Khi khách đến quầy nhận kho, nhân viên phải nhập lại số CCCD hoặc hỏi lại địa chỉ bằng tay, làm giảm tính tự động hóa và dễ sai sót dữ liệu đối chiếu.
* **Giải pháp kỹ thuật đề xuất:**
  - **Frontend:** Đảm bảo `CreateReservationRequest` đóng gói đầy đủ `customerCccd` và `customerAddress`.
  - **Backend (`ReservationService.java`):** Khi tạo đơn đặt chỗ hoặc khi thanh toán cọc thành công, tự động cập nhật `users.cccd` và `users.address` (nếu trước đó tài khoản chưa có hoặc có sự thay đổi).

---

### 3. Bắt buộc nhập thông tin tài khoản ngân hàng khi Hẹn ngày trả kho (`L-18` / `PR-O3`)

* **Hiện trạng:**
  - Khi khách hàng tạo yêu cầu trả kho (`ContractOptionsModal.jsx`), khách có thể chọn phương thức nhận lại tiền cọc là *"Chuyển khoản ngân hàng"* hoặc *"Tiền mặt tại quầy"*.
  - Tuy nhiên, form chưa bắt buộc khách nhập Số tài khoản, Ngân hàng và Tên chủ tài khoản thụ hưởng.
* **Rủi ro thực tế:**
  - Quản lý cơ sở (FM) khi nhận task `REFUND` để chuyển khoản hoàn cọc không có thông tin thụ hưởng của khách trong hệ thống, buộc phải gọi điện thoại hỏi lại thông tin, gây chậm trễ thời hạn hoàn tiền 24h (**PR-93**).
* **Giải pháp kỹ thuật đề xuất:**
  - **Frontend:** Khi khách chọn phương thức *"Chuyển khoản ngân hàng"*, hiển thị các trường bắt buộc:
    - Ngân hàng thụ hưởng (Danh sách ngân hàng hoặc nhập tên).
    - Số tài khoản ngân hàng.
    - Tên chủ tài khoản (Mặc định tự điền tên khách hàng, cho phép chỉnh sửa).
  - **Backend (`ContractService.java`):** Lưu trữ thông tin ngân hàng thụ hưởng vào trường `bank_account_info` hoặc gán trực tiếp vào ghi chú của Task `REFUND` để Quản lý cơ sở thực hiện chuyển khoản ngay lập tức.

---

### 4. Xử lý Timeout thanh toán VNPAY vs Tự động hủy đơn quá hạn (`L-15` / `PR-B6`)

* **Hiện trạng:**
  - Hệ thống có Job quét đơn hết hạn thanh toán (`ReservationCleanupService`) tự động hủy đơn sau 15 phút kể từ lúc tạo đơn.
  - Cổng thanh toán VNPAY cũng có thời hạn sống của link thanh toán (khoảng 15 phút).
* **Rủi ro thực tế:**
  - Nếu khách hàng thao tác thanh toán ở phút 14, việc trừ tiền qua ngân hàng có thể trễ vài phút. Khi tín hiệu IPN từ VNPAY gửi về backend thì đơn đặt chỗ đã bị job quét chuyển sang trạng thái `EXPIRED` / `CANCELLED`.
  - Hậu quả: Khách đã bị trừ tiền trong tài khoản nhưng hệ thống báo đơn đã bị hủy, gây khiếu nại.
* **Giải pháp kỹ thuật đề xuất:**
  - **Đồng hồ đếm ngược trên UI:** Bổ sung bộ đếm thời gian thực (Countdown Timer 15:00) trên màn hình thanh toán để cảnh báo khách hàng không thanh toán khi thời gian sắp hết.
  - **Cơ chế IPN an toàn (Backend `VnpayService.java`):** Nếu nhận được IPN thanh toán thành công cho đơn đã bị chuyển sang `EXPIRED`:
    - *Phương án A:* Nếu khoang vẫn còn suất trống, tự động phục hồi đơn về trạng thái `DEPOSIT_PAID` và giữ lại suất kho.
    - *Phương án B:* Nếu khoang đã hết suất, tự động tạo một giao dịch `REFUND` với trạng thái `PENDING` và sinh Task cho Quản lý cơ sở để hoàn trả lại 100% tiền cho khách kèm ghi chú: *"Thanh toán về trễ sau khi đơn hết hạn"*.

---

## PHẦN II: CẢI TIẾN TRẢI NGHIỆM NGƯỜI DÙNG & VẬN HÀNH THỰC TẾ

### 5. Minh bạch dự toán tài chính khi Trả kho sớm (Early Checkout Financial Preview - `PR-O2`)

* **Mục tiêu:**
  - Giúp khách hàng hiểu rõ chính sách tài chính trước khi xác nhận trả kho, tránh thắc mắc hoặc tranh cãi với nhân viên tại quầy.
* **Nguyên tắc nghiệp vụ (**`PR-O2`**):**
  - Trả kho trước thời hạn hợp đồng (`end_date`) được hoàn lại tiền thuê các tháng chưa sử dụng, nhưng phải thu hồi ưu đãi đã hưởng (tính lại các tháng đã dùng theo giá niêm yết gốc) và thu phí phá hợp đồng tương đương 1 tháng giá gốc.
* **Giải pháp thiết kế UI/UX đề xuất:**
  - Trong Modal Hẹn ngày trả kho (`ContractOptionsModal.jsx`), ngay khi khách chọn ngày trả kho dự kiến, hệ thống tự động hiển thị **Bảng dự toán quyết toán hoàn tiền thời gian thực**:
    ```text
    ┌─────────────────────────────────────────────────────────────┐
    │  BẢNG DỰ TOÁN QUYẾT TOÁN HOÀN TIỀN TRẢ KHO SỚM (PR-O2)       │
    ├─────────────────────────────────────────────────────────────┤
    │  (+) Tiền cọc hợp đồng ban đầu:            1.500.000 đ      │
    │  (+) Tiền thuê khách đã đóng trước:        6.000.000 đ      │
    │  (-) Tiền thuê thời gian đã dùng (2 tháng):-3.000.000 đ     │
    │  (-) Phí phạt vi phạm trả sớm (1 tháng):   -1.500.000 đ     │
    ├─────────────────────────────────────────────────────────────┤
    │  (=) TỔNG TIỀN DỰ KIẾN HOÀN TRẢ KHÁCH:     3.000.000 đ      │
    └─────────────────────────────────────────────────────────────┘
    (*) Số tiền thực tế có thể thay đổi nếu phát sinh hư hỏng ô kho
        hoặc trả trễ so với ngày hẹn.
    ```

---

### 6. Nâng cấp Sơ đồ Ô kho dạng Bản đồ mặt bằng trực quan (Visual Floor Plan / Grid Matrix - `UC-06`, `UC-14`)

* **Mục tiêu:**
  - Thay thế danh sách phẳng dropdown truyền thống bằng sơ đồ mặt bằng trực quan, giúp Quản lý cơ sở (FM) dễ dàng bao quát tình trạng kho và gán ô kho nhanh chóng.
* **Giải pháp thiết kế UI/UX đề xuất:**
  - Tại trang Quản lý ô kho (`StorageManagementPage.jsx`) và Modal Gán ô kho (`UC-14`), xây dựng giao diện **Lưới ma trận (Grid Matrix)** chia theo Tầng (Floor 1, Floor 2) và Dãy (Dãy A, Dãy B, Dãy C):
  - **Quy chuẩn mã màu trạng thái tiêu chuẩn:**
    - 🟩 **Màu xanh lá (`AVAILABLE`):** Ô trống sẵn sàng cho thuê.
    - 🟦 **Màu xanh dương (`OCCUPIED`):** Ô đang có khách thuê và hợp đồng đang hoạt động (`ACTIVE`).
    - 🟨 **Màu vàng (`PENDING_CHECK_IN`):** Ô đã gán cho khách, đang chờ khách đến làm thủ tục check-in.
    - 🟥 **Màu đỏ (`OVERDUE`):** Ô có hợp đồng đang bị quá hạn thanh toán.
    - ⬛ **Màu xám (`MAINTENANCE`):** Ô đang tạm dừng sử dụng để sửa chữa, bảo trì hoặc dọn dẹp vệ sinh.
  - **Tương tác thông minh:**
    - Di chuột (Hover) qua từng ô hiển thị Tooltip: Loại kho, Diện tích, Mã hợp đồng, Tên khách hàng (nếu đang thuê).
    - Khi Quản lý bấm duyệt đơn cần gán ô, click trực tiếp vào ô màu xanh trên bản đồ để chọn gán ngay lập tức.

---

## PHẦN III: BẢNG THEO DÕI TRIỂN KHAI (CHECKLIST)

- [ ] **Mục 1:** Bổ sung cột & checklist *"Cam kết hàng cấm"* vào quy trình Check-in (`PR-C7`).
- [ ] **Mục 2:** Lưu số CCCD và Địa chỉ vào hồ sơ người dùng khi đặt chỗ kho (`PR-B5`).
- [ ] **Mục 3:** Bắt buộc nhập thông tin tài khoản ngân hàng khi hẹn trả kho chuyển khoản (`PR-O3`).
- [ ] **Mục 4:** Bổ sung đồng hồ đếm ngược 15 phút tại màn hình thanh toán VNPAY (`PR-B6`).
- [ ] **Mục 5:** Hiển thị Bảng dự toán hoàn cọc chi tiết khi khách chọn ngày trả kho sớm (`PR-O2`).
- [ ] **Mục 6:** Triển khai Sơ đồ mặt bằng kho trực quan dạng lưới ma trận màu (`UC-06`, `UC-14`).

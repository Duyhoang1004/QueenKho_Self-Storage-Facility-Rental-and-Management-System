# QUEENKHO — CẨM NANG TOÀN DIỆN BẢO VỆ ĐỒ ÁN TỐT NGHIỆP SWP391
> **Dành riêng cho thành viên bảo vệ đồ án:** Bản tổng hợp đầy đủ từ A–Z về Kiến trúc hệ thống, Database 25 bảng, 5 Flow cốt lõi, Kịch bản Demo thực chiến, và Bộ câu hỏi phản biện của Giảng viên / Hội đồng.

---

# MỤC LỤC
1. [PHẦN 1: BỨC TRANH TOÀN CẢNH DỰ ÁN QUEENKHO](#phần-1-bức-tranh-toàn-cảnh-dự-án-queenkho)
2. [PHẦN 2: KIẾN TRÚC KỸ THUẬT & CÔNG NGHỆ](#phần-2-kiến-trúc-kỹ-thuật--công-nghệ)
3. [PHẦN 3: DATABASE SCHEMA & 25 THỰC THỂ (ENTITIES)](#phần-3-database-schema--25-thực-thể-entities)
4. [PHẦN 4: 5 FLOW CỐT LÕI + 2 FLOW PHỤ (VÒNG ĐỜI DỮ LIỆU)](#phần-4-5-flow-cốt-lõi--2-flow-phụ-vòng-đời-dữ-liệu)
5. [PHẦN 5: KỊCH BẢN DEMO THỰC CHIẾN TỪNG BƯỚC (STEP-BY-STEP)](#phần-5-kịch-bản-demo-thực-chiến-từng-bước-step-by-step)
6. [PHẦN 6: BỘ CÂU HỎI PHẢN BIỆN HỘI ĐỒNG & CÁCH TRẢ LỜI ĐIỂM 10](#phần-6-bộ-câu-hỏi-phản-biện-hội-đồng--cách-trả-lời-điểm-10)
7. [PHẦN 7: BÍ QUYẾT TỰ TIN KHI BẢO VỆ](#phần-7-bí-quyết-tự-tin-khi-bảo-vệ)

---

# PHẦN 1: BỨC TRANH TOÀN CẢNH DỰ ÁN QUEENKHO

### 1.1 Hệ thống này là gì?
* **Tên đề tài:** QueenKho — Self-Storage Facility Rental and Management System (Hệ thống quản lý và cho thuê ô kho tự quản đa cơ sở).
* **Bài toán thực tế:** Mô hình kho tự quản (Self-storage) rất phổ biến ở nước ngoài và đang nở rộ tại TP.HCM/Hà Nội. Khách hàng thuê ô kho cá nhân để chứa đồ dọn nhà, văn phòng phẩm, hoặc hàng thương mại điện tử.
* **Vấn đề giải quyết:**
  * **Với Khách hàng (Customer):** Không cần tới tận nơi; có thể tìm kiếm, chọn loại kho (thường / lạnh / đông), tính giá theo gói ưu đãi, áp voucher, khai báo hàng hóa, mua bảo hiểm và đặt cọc online qua VNPAY.
  * **Với Nhân viên (Staff) & Quản lý (FM):** Tự động hóa gán ô theo sơ đồ mặt bằng (Grid Layout), cấp mã PIN / thẻ RFID thông minh, quản lý công việc check-in / check-out bằng hình ảnh bằng chứng, nghiệm thu hư hỏng, quyết toán cọc.
  * **Với Ban điều hành (BOM):** Quản lý tập trung toàn bộ danh mục chi nhánh, loại kho, cấu hình chính sách giá / phạt cọc, và theo dõi doanh thu thực thu theo thời gian thực.

### 1.2 Phân quyền người dùng (5 Actor)
1. **CUSTOMER (Khách hàng):** Tìm kho, đặt đơn, thanh toán cọc, nhận mã PIN mở kho, yêu cầu trả kho, khiếu nại bồi thường, gia hạn hợp đồng.
2. **STAFF (Nhân viên cơ sở):** Nhận task bàn giao (Check-in), task nghiệm thu (Check-out), kiểm tra hiện trạng ô kho (trống/sạch/khóa), lập biên bản sự cố hư hỏng (Damage Case), gọi điện liên hệ khách bùng hẹn.
3. **FACILITY_MANAGER - FM (Quản lý cơ sở):** Duyệt đơn cọc, gán ô kho vật lý, phân công việc cho Staff, duyệt No-Show phạt cọc, chuyển ô kho khi có sự cố, duyệt chi tiền hoàn cọc (Refund), bảo trì ô kho.
4. **BOM (Business Operations Manager - Giám đốc vận hành):** Tạo chi nhánh cơ sở mới, tạo loại kho (kèm kho lạnh/đông), ban hành phiên bản chính sách thuê kho (`rental_policy`), phát hành voucher toàn hệ thống, xem báo cáo doanh thu & tỷ lệ lấp đầy.
5. **ADMIN (Quản trị hệ thống):** Quản lý tài khoản, phân quyền, xem nhật ký kiểm toán hệ thống (`activity_logs`) và lịch sử đăng nhập (`login_history`).

---

# PHẦN 2: KIẾN TRÚC KỸ THUẬT & CÔNG NGHỆ

### 2.1 Tech Stack
* **Frontend:** React 18, Vite, TailwindCSS (phong cách Gamification / Duolingo UI), React Router v6, Axios, Lucide / Material Symbols Icons.
* **Backend:** Java 17, Spring Boot 3.x, Spring Data JPA (Hibernate), Spring Security (Token Bearer Stateless lưu trong RAM / Database).
* **Database:** Microsoft SQL Server 2019/2022 (`QueenKhoDB`).
* **Cổng thanh toán:** Cổng Sandbox VNPAY (xác thực HMAC-SHA512, hỗ trợ cả IPN Webhook và Return URL Confirm tự động trên localhost).
* **Tự động hóa:** Spring `@Scheduled` background cron job (quét đơn hết hạn 15 phút, quét task quá hạn lúc 21:00, quét hợp đồng quá hạn lúc 00:05).
* **Mô phỏng IoT:** Hệ thống cảm biến giả lập nhiệt độ / độ ẩm cho kho lạnh & đông, tự động cảnh báo còi chuông khi vượt ngưỡng an toàn.

### 2.2 Luồng giao tiếp Frontend - Backend
```
[React Frontend]
     │
     ▼ (REST API: JSON over HTTP)
[Spring Boot Filter: AccessControlFilter / JwtToken]
     │── Xác thực danh tính & Gắn UserInfo vào ThreadLocal Context
     ▼
[Controller Layer] (Validation @Valid, bắt DTO đầu vào)
     │
     ▼
[Service Layer] (Business Rules, Tính tiền, Trạng thái đơn, @Transactional)
     │
     ▼
[Repository / JdbcTemplate Layer] (Spring Data JPA + Native SQL Server)
     │
     ▼
[SQL Server Database: QueenKhoDB]
```

---

# PHẦN 3: DATABASE SCHEMA & 25 THỰC THỂ (ENTITIES)

Hệ thống quản lý chặt chẽ thông qua **25 bảng quan hệ**:

### Nhóm 1: Hệ thống & Danh mục nền
1. `roles`: Bảng quyền (CUSTOMER, STAFF, FACILITY_MANAGER, BOM, ADMIN).
2. `facilities`: Danh sách chi nhánh cơ sở kho (Tân Bình, Bình Thạnh, Thủ Đức...).
3. `users`: Tài khoản người dùng (ràng buộc `facility_id` cho Staff/FM).
4. `unit_types`: Danh mục loại kho (Mini M, Tiêu Chuẩn, Gia Đình; diện tích, thể tích, nhiệt độ: NORMAL/COLD/FROZEN).
5. `goods_categories`: Danh mục nhóm hàng hóa khách khai báo (Đồ gia dụng, Văn phòng phẩm, Thực phẩm đông lạnh, Hàng dễ vỡ...).
6. `central_warehouses`: Kho tổng lưu trữ hàng quá hạn thanh lý (chính sách nhân văn giữ hàng không bán đấu giá).

### Nhóm 2: Mặt bằng & Ô kho vật lý
7. `storage_units`: Ô kho vật lý (PK kiểu chuỗi `KV-TB-A101`; tọa độ lưới `map_x`, `map_y`; trạng thái `AVAILABLE`, `OCCUPIED`, `MAINTENANCE`).
8. `facility_floors`: Quản lý tầng của cơ sở và kích thước lưới mặt bằng.
9. `floor_fixtures`: Vật cản/tiện ích trên mặt bằng (Cửa ra vào, thang máy, lối đi, văn phòng).
10. `unit_sensor_readings`: Lịch sử chỉ số cảm biến IoT (Nhiệt độ, Độ ẩm, Cờ cảnh báo `is_alert`).

### Nhóm 3: Chính sách, Voucher & Đặt chỗ
11. `rental_policy`: Chính sách thuê kho (hệ số cọc 1–3 tháng, % phạt hủy, % ưu đãi gói 3/6/12 tháng, thời hạn thanh lý 15 ngày, quản lý theo version).
12. `vouchers`: Mã giảm giá (Mã code, giảm %, giảm cố định tiền, giới hạn lượt dùng, áp theo loại kho).
13. `reservations`: Đơn đặt chỗ (Mã đơn `RES-...`, ngày hẹn, gói bảo hiểm, nhóm hàng, voucher áp dụng, % ưu đãi chốt cứng).

### Nhóm 4: Hợp đồng & Vận hành
14. `rental_contracts`: Hợp đồng thuê chính thức (Mã HĐ `HD-...`, ngày bắt đầu/kết thúc, mã PIN 6 số, mã RFID, tiền cọc đang giữ, cờ hủy do lỗi cơ sở `fault_termination`).
15. `payment_transactions`: Giao dịch tài chính (Mã GD, loại: DEPOSIT, MONTHLY_RENT, REFUND, LATE_FEE; trạng thái: PENDING, SUCCESS, FAILED).
16. `handover_records`: Biên bản bàn giao kho (Check-in / Check-out, xác minh CCCD, link ảnh hiện trạng, cam kết không chứa hàng cấm).
17. `facility_tasks`: Bảng công việc cơ sở (Task: CHECK_IN, CHECK_OUT, REFUND, MAINTENANCE, SUPPORT; hạn chót `due_at`).
18. `unit_transfers`: Nhật ký đổi / chuyển ô kho khi ô cũ gặp sự cố (chuyển hợp đồng từ ô A sang ô B, cập nhật lý do).

### Nhóm 5: Sự cố, Bồi thường & Kiểm toán
19. `support_requests`: Ticket yêu cầu hỗ trợ khiếu nại của khách.
20. `compensation_claims`: Hồ sơ yêu cầu bồi thường thiệt hại hàng hóa (giám định nguyên nhân, % đền bù, tiền bồi thường, đối tác bảo hiểm).
21. `damage_cases`: Biên bản sự cố hư hại ô kho lúc trả phòng (chi phí sửa chữa khấu trừ vào tiền cọc).
22. `held_goods`: Quản lý tài sản lưu giữ của khách quá hạn thanh lý đưa về kho tổng.
23. `activity_logs`: Nhật ký kiểm toán hành động toàn hệ thống.
24. `login_history`: Lịch sử đăng nhập (IP, trình duyệt, trạng thái đăng nhập, lý do thất bại).
25. `notifications`: Thông báo quả chuông lưu DB theo thời gian thực cho từng người dùng.

---

# PHẦN 4: 5 FLOW CỐT LÕI + 2 FLOW PHỤ (VÒNG ĐỜI DỮ LIỆU)

### 🟢 Flow 1: Đặt kho & Thanh toán cọc (Booking & Deposit)
* **Luồng chính:** Customer tìm kiếm $\rightarrow$ Chọn loại kho, ngày bắt đầu, kỳ hạn 1/3/6/12T $\rightarrow$ Khai báo hàng hóa, chọn bảo hiểm $\rightarrow$ Áp voucher $\rightarrow$ Chuyển sang VNPAY thanh toán cọc $\rightarrow$ Đơn chuyển sang `DEPOSIT_PAID` (Chờ gán ô).
* **Ngoại lệ & Quy tắc vàng:**
  * Khách chọn thực phẩm đông lạnh cho kho thường $\rightarrow$ Bị chặn.
  * Ân hạn 30 phút (`BR-32a`): Hủy đơn trong vòng 30 phút sau khi cọc $\rightarrow$ Hoàn 100% tiền cọc.
  * Hủy trước giờ hẹn $\ge 48h \rightarrow$ Hoàn 100% cọc.
  * Hủy trong vòng $24h - 48h \rightarrow$ Giữ lại 50% cọc (Phạt 50%).
  * Hủy $< 24h$ hoặc sau giờ hẹn $\rightarrow$ Giữ lại 100% cọc + 1 tháng tiền thuê (tính như No-Show).

### 🟢 Flow 2: Gán ô, Giao việc & Bàn giao Check-in
* **Luồng chính:** FM thấy đơn `DEPOSIT_PAID` $\rightarrow$ Mở danh sách ô kho trống, gán ô đúng loại $\rightarrow$ Hợp đồng sinh ra ở `PENDING_CHECK_IN`, sinh task `CHECK_IN` $\rightarrow$ FM giao task cho Staff (trong khung 30 ngày) $\rightarrow$ Khách đến, Staff kiểm tra CCCD, ô trống/sạch/khóa, chụp ảnh hiện trạng, cấp mã PIN & thẻ RFID $\rightarrow$ Hợp đồng kích hoạt `ACTIVE`.
* **Ngoại lệ No-Show (Khách bùng hẹn):**
  * Quá giờ hẹn, task chuyển `OVERDUE`. Staff gọi điện:
    * Nếu khách nói *"Từ chối tới nhận"* $\rightarrow$ FM hủy No-Show ngay lập tức.
    * Nếu khách thuê bao/cúp máy $\rightarrow$ Cần đủ tối thiểu 2 cuộc gọi và qua 48h mới được hủy.
  * Phạt tiền No-Show: **Giữ 100% cọc + 1 tháng tiền thuê**. Ô kho lập tức giải phóng về `AVAILABLE`.

### 🟢 Flow 3: Vận hành kho đang thuê, Trả kho & Nghiệm thu Check-out
* **Luồng chính:** Khách vào "Kho của tôi" $\rightarrow$ Chọn Hợp đồng `ACTIVE` $\rightarrow$ Bấm "Yêu cầu trả kho", nhập STK nhận cọc $\rightarrow$ HĐ chuyển `TERMINATION_PENDING`, sinh task `CHECK_OUT` $\rightarrow$ Staff đón khách, kiểm tra ô đã dọn sạch, chụp ảnh nghiệm thu $\rightarrow$ Không có hư hỏng $\rightarrow$ HĐ thành `TERMINATED`, ô về `AVAILABLE`, mã PIN bị thu hồi $\rightarrow$ FM thực hiện hoàn tiền cọc (`REFUND`).
* **Ngoại lệ Damage Case:** Nếu phát hiện hỏng khóa, thủng vách $\rightarrow$ Staff lập biên bản sự cố `damage_cases` (nhập chi phí đền bù) $\rightarrow$ Chi phí này tự động khấu trừ vào tiền cọc hoàn lại. Ô chuyển sang `MAINTENANCE` để sửa chữa.

### 🟢 Flow 4: BOM Quản trị chiến lược toàn hệ thống
* Quản lý tập trung các chi nhánh kho bãi, cập nhật thông tin hotline, địa chỉ.
* Quản lý danh mục loại kho và phân lớp nhiệt độ (Kho thường / Kho lạnh / Kho đông).
* Quản lý Chính sách thuê kho (`rental_policy`): Cho phép BOM cấu hình động % ưu đãi gói dài hạn (5/10/15%), % phạt trễ, số ngày thanh lý (15 ngày).
* Báo cáo Doanh thu & Tỷ lệ lấp đầy: Chỉ hạch toán các giao dịch `SUCCESS`, bóc tách rành mạch tiền thuê, tiền cọc đang giữ và tiền đã hoàn.

### 🟢 Flow 5: Quản lý ô kho & Điều phối nội bộ cơ sở (FM)
* Sơ đồ mặt bằng tương tác (Floor Plan Grid Layout): Phân biệt rõ các trạng thái ô qua màu sắc: Trống (`AVAILABLE` - Xanh), Đang thuê (`OCCUPIED` - Đỏ), Bảo trì (`MAINTENANCE` - Vàng), Sắp trống (`RELEASING` - Cam).
* Ràng buộc an toàn: Ô đang có hợp đồng hoạt động thì khóa cứng, cấm sửa tọa độ hay xóa.
* Điều phối giao việc cho Staff cơ sở theo dõi qua Bảng công việc tập trung.

---

# PHẦN 5: KỊCH BẢN DEMO THỰC CHIẾN TỪNG BƯỚC (STEP-BY-STEP)

> **Mẹo chuẩn bị trước khi lên thuyết trình:**
> * Mở trình duyệt Chrome ở chế độ Ẩn danh (hoặc mở 3 profile khác nhau để không phải đăng xuất đăng nhập nhiều lần):
>   * Cửa sổ 1: Khách hàng (`khachhang1@gmail.com`)
>   * Cửa sổ 2: Quản lý cơ sở (`fmtanbinh@gmail.com`)
>   * Cửa sổ 3: Nhân viên cơ sở (`stafftanbinh1@gmail.com`)

---

### BƯỚC 1: DEMO FLOW 1 — KHÁCH HÀNG ĐẶT KHO
* **Người thực hiện:** Khách hàng (`khachhang1@gmail.com` / `123456`).
1. Truy cập trang chủ $\rightarrow$ Bấm **Tìm & đặt kho**.
2. Chọn cơ sở **QueenKho Tân Bình** $\rightarrow$ Chọn loại kho **Kho Mini M** (giá 750.000đ/tháng).
3. Tại trang Đặt kho:
   * Chọn kỳ hạn: **3 tháng** *(Nói với hội đồng: Hệ thống tự động tính ưu đãi giảm 5% tiền thuê gói 3 tháng)*.
   * Khai báo hàng hóa: Chọn **Gia dụng**.
   * Nhập mã voucher: Gõ `NEWKHO` $\rightarrow$ Giảm ngay 100.000đ.
   * Tick chọn: *"Tôi đồng ý với điều khoản xử lý tài sản"*.
4. Bấm **Thanh toán VNPAY** $\rightarrow$ Nhập thông tin thẻ test NCB:
   * Số thẻ: `9704198526191432198` | Tên: `NGUYEN VAN A` | Ngày: `07/15` | OTP: `123456`.
5. Thanh toán thành công $\rightarrow$ Quay về web QueenKho $\rightarrow$ Đơn hàng có mã `RES-...`, trạng thái **`DEPOSIT_PAID`**.
6. **Điểm nhấn ăn điểm:** Bấm trực tiếp vào mã đơn màu xanh `RES-...` $\rightarrow$ Hệ thống mở popup tóm tắt chi tiết đơn hàng.

---

### BƯỚC 2: DEMO FLOW 2 — GÁN Ô & CHECK-IN BÀN GIAO
* **Chuyển sang Cửa sổ Quản lý:** (`fmtanbinh@gmail.com` / `123456`).
1. Vào menu **Đơn đặt kho / Đơn chờ gán** (`/manager/pending`).
2. Thấy đơn `RES-...` của Khách hàng 1 vừa cọc. Bấm nút **Gán ô kho**.
3. **Điểm nhấn ăn điểm:** Chỉ cho hội đồng thấy: Modal chỉ hiện các ô trống cùng loại Mini M, kèm nhãn màu cam **"Sắp trống" (Releasing)** hiển thị ngày trả dự kiến của khách cũ để FM tính toán gối đầu.
4. Chọn 1 ô trống $\rightarrow$ Bấm **Xác nhận gán ô** $\rightarrow$ Đơn chuyển `UNIT_ASSIGNED`, hợp đồng sinh ra ở `PENDING_CHECK_IN`.
5. Vào **Bảng công việc (Task Board)** $\rightarrow$ Mở task `CHECK_IN` $\rightarrow$ Bấm **Giao việc** cho `stafftanbinh1@gmail.com`.

* **Chuyển sang Cửa sổ Nhân viên:** (`stafftanbinh1@gmail.com` / `123456`).
1. Vào **Bảng công việc của tôi** $\rightarrow$ Thấy task `CHECK_IN` được giao $\rightarrow$ Bấm **Nhận việc** (`IN_PROGRESS`).
2. Mở chi tiết task $\rightarrow$ Tick chọn: *Đã xác minh CCCD, Ô trống, Ô sạch, Khóa nguyên vẹn, Đã ký biên bản*.
3. Bấm nút **Gợi ý mã PIN** (sinh ngẫu nhiên 6 chữ số) và nhập mã thẻ RFID (vd: `RFID-TB-01`).
4. Bấm nút **Tải ảnh biên bản bàn giao** (hoặc dùng ảnh mẫu).
5. Bấm nút **Hoàn tất bàn giao** $\rightarrow$ Task thành `COMPLETED`, Hợp đồng chính thức chuyển sang **`ACTIVE`**. Khách hàng đã có thể mở app xem mã PIN để vào mở khóa kho.

---

### BƯỚC 3: DEMO NGOẠI LỆ ĐỈNH CAO — KHÁCH BÙNG HẸN (NO-SHOW)
> *"Thưa thầy cô, nếu đến ngày hẹn mà khách đổi ý không đến nhận kho thì hệ thống giải quyết thế nào?"*

1. Vẫn ở tài khoản Quản lý `fmtanbinh@gmail.com`, vào chi tiết một task `CHECK_IN`.
2. Cuộn xuống đáy trang, bấm nút demo: **`Khách bùng hẹn (đủ No-Show)`** *(Hệ thống tự động lùi giờ hẹn 49h và tạo 2 cuộc gọi liên hệ thất bại)*.
3. Vào lại menu **Đơn đặt kho** (`/manager/pending`) $\rightarrow$ Click sang Tab 2: **"Quá hạn nhận kho (Vắng mặt)"**.
4. Thấy đơn hiện nhãn xanh lá: **`Đủ ĐK vắng mặt`**.
5. Bấm nút đỏ **`Khách vắng mặt`** $\rightarrow$ Modal hiện rõ quy định phạt: **Giữ 100% cọc + 1 tháng tiền thuê**.
6. Bấm **Xác nhận** $\rightarrow$ Đơn hủy ngay, hợp đồng chấm dứt, ô kho lập tức giải phóng về màu xanh `AVAILABLE` để đón khách mới!

---

### BƯỚC 4: DEMO FLOW 3 — KHÁCH TRẢ KHO & NGHIỆM THU
* **Người thực hiện:** Khách hàng 1 (`khachhang1@gmail.com`).
1. Vào **Kho của tôi** $\rightarrow$ Mở Hợp đồng đang `ACTIVE`.
2. Bấm nút **Yêu cầu trả kho (Check-out)** $\rightarrow$ Chọn ngày hẹn và nhập STK ngân hàng nhận lại cọc $\rightarrow$ HĐ chuyển `TERMINATION_PENDING`.

* **Chuyển sang Nhân viên:** (`stafftanbinh1@gmail.com`).
1. Nhận task `CHECK_OUT` $\rightarrow$ Kiểm tra ô kho $\rightarrow$ Xác nhận không có hư hại, tải ảnh ô sạch $\rightarrow$ Bấm **Hoàn tất nghiệm thu**.
2. Hợp đồng chuyển sang `TERMINATED`, thu hồi mã PIN, ô kho trở lại `AVAILABLE`.

* **Chuyển sang Quản lý:** (`fmtanbinh@gmail.com`).
1. Vào mục **Hoàn tiền** (`/manager/refunds`) $\rightarrow$ Mở task hoàn cọc $\rightarrow$ Nhập mã giao dịch ngân hàng / upload UNC $\rightarrow$ Bấm **Xác nhận hoàn tiền** $\rightarrow$ Đơn hàng hoàn tất chu kỳ sống 100%.

---

### BƯỚC 5: DEMO FLOW 4 & 5 — BOM QUẢN TRỊ & SƠ ĐỒ MẶT BẰNG
1. **Đăng nhập BOM:** `bom@queenkho.com`.
   * Mở mục **Cơ sở kho bãi** & **Loại kho**: Giới thiệu phân lớp kho lạnh/kho đông và tính năng đo nhiệt độ cảm biến IoT.
   * Mở **Chính sách thuê**: Giải thích cơ chế versioning chính sách thuê động.
   * Mở **Báo cáo doanh thu**: Khoe biểu đồ doanh thu theo cơ sở lọc theo thời gian thực.
2. **Đăng nhập FM:** `fmtanbinh@gmail.com`.
   * Mở **Sơ đồ mặt bằng kho bãi**: Thao tác zoom, đổi tầng, giải thích các ô màu xanh (trống), đỏ (đang thuê), vàng (bảo trì), cam (sắp trống).

---

# PHẦN 6: BỘ CÂU HỎI PHẢN BIỆN HỘI ĐỒNG & CÁCH TRẢ LỜI ĐIỂM 10

### ❓ Nhóm câu hỏi 1: Về Nghiệp vụ & Logic bài toán

**Câu 1: "Tại sao lại có quy tắc phạt No-Show giữ 100% cọc + 1 tháng tiền thuê mà không phải chỉ giữ cọc?"**
* **Trả lời:** *"Dạ thưa thầy/cô, mô hình kho tự quản khác với phòng trọ thông thường. Khi khách đặt cọc và được gán ô, cơ sở đã phải từ chối nhiều khách hàng khác và chuẩn bị mặt bằng. Nếu khách bùng hẹn, ô kho đó đã bị đóng băng ít nhất 1 tháng. Do đó, quy tắc giữ cọc + 1 tháng thuê là chuẩn mực thực tế của các doanh nghiệp Self-storage để bù đắp chi phí cơ hội và công suất phòng trống."*

**Câu 2: "Nếu khách đặt kho ở tương lai (vd: 2 tháng nữa mới nhận), hệ thống giải quyết việc khóa ô thế nào để không bị lãng phí ô trống hiện tại?"**
* **Trả lời:** *"Dạ thưa thầy/cô, trong phiên bản mới nhất, hệ thống đã bổ sung tính năng **'Ô sắp trống' (Releasing)** và **Khung 30 ngày giao việc**. FM sẽ nhìn thấy ngày giải phóng dự kiến của khách cũ để gán nối tiếp cho khách mới. Trong tương lai, nhóm dự kiến phát triển thêm thuật toán Timeline Booking theo khoảng ngày giống như hệ thống đặt phòng khách sạn."*

**Câu 3: "Khi khách trả kho phát hiện hư hỏng thì trừ tiền ra sao? Nếu tiền sửa chữa vượt quá tiền cọc thì xử lý thế nào?"**
* **Trả lời:** *"Dạ, khi Staff phát hiện hư hỏng sẽ lập biên bản sự cố `Damage Case`. Số tiền này sẽ tự động khấu trừ vào tiền cọc khi hoàn. Nếu chi phí vượt tiền cọc, cọc hoàn về 0đ và phần chênh lệch trở thành khoản nợ phải thu ghi nhận vào hồ sơ khách hàng, đồng thời hệ thống chặn không cho khách hàng đó đặt đơn mới cho đến khi hoàn tất thanh toán khoản nợ (`CUSTOMER_HAS_DEBT`)."*

---

### ❓ Nhóm câu hỏi 2: Về Database & Thiết kế Dữ liệu

**Câu 4: "Tại sao bảng `storage_units` lại dùng ID là kiểu chuỗi (String/VARCHAR) mà không dùng số nguyên tự tăng (INT IDENTITY)?"**
* **Trả lời:** *"Dạ thưa thầy/cô, mã ô kho là mã định danh nghiệp vụ gắn liền với vị trí thực tế ngoài đời, ví dụ `KV-TB-A101` (Khu Vực - Tân Bình - Tầng A Phòng 101). Việc dùng String làm khóa chính giúp nhân viên, khách hàng và hệ thống tra cứu trực tiếp vị trí mà không cần phải JOIN nhiều bảng, đồng thời in lên tem mã vạch và thẻ RFID rất thuận tiện."*

**Câu 5: "Khi BOM sửa chính sách thuê kho (ví dụ tăng tiền cọc hoặc giảm ưu đãi), các hợp đồng cũ đang chạy có bị ảnh hưởng sai số tiền không?"**
* **Trả lời:** *"Dạ hoàn toàn không bị ảnh hưởng. Bảng `rental_policy` được thiết kế theo cơ chế **Snapshot Versioning**. Khi BOM sửa, hệ thống sẽ tạo ra một phiên bản mới với `version` tăng lên. Hợp đồng cũ ký ở thời điểm nào sẽ lưu cứng khóa ngoại `rental_policy_id` của phiên bản tại thời điểm đó, đảm bảo tính bất biến của hợp đồng pháp lý."*

**Câu 6: "Làm thế nào để hệ thống ngăn chặn tình trạng 2 khách hàng cùng tranh nhau đặt 1 ô kho duy nhất còn lại (Concurrency)?"**
* **Trả lời:** *"Dạ, hệ thống áp dụng cơ chế **Giữ chỗ tạm thời 15 phút (Hold Slot)**. Khi khách hàng bấm tạo đơn, hệ thống kiểm tra số lượng ô khả dụng trong DB. Nếu chỉ còn 1 ô, đơn đầu tiên tạo thành công sẽ giữ chỗ trong 15 phút, khách thứ hai gửi request sẽ nhận mã lỗi `409 Conflict - NO_AVAILABILITY`. Nếu quá 15 phút khách đầu không thanh toán, Spring Boot Scheduler sẽ tự động giải phóng ô."*

---

### ❓ Nhóm câu hỏi 3: Về Backend & API

**Câu 7: "Làm sao hệ thống đảm bảo bảo mật không cho Khách hàng A xem hoặc hủy đơn hàng của Khách hàng B (Lỗi IDOR)?"**
* **Trả lời:** *"Dạ, hệ thống sử dụng cơ chế **OwnershipGuard** trong Spring Security. Khi có request gửi lên, Filter sẽ trích xuất `userId` từ Token JWT đã giải mã, sau đó Service sẽ kiểm tra quyền sở hữu `reservation.getCustomerId().equals(currentUserId)`. Nếu không khớp, API lập tức trả về `403 Forbidden`."*

**Câu 8: "Cơ chế xử lý thanh toán VNPAY hoạt động thế nào? Nếu người dùng bấm F5 hoặc mạng lag gửi callback nhiều lần thì có bị cộng tiền 2 lần không?"**
* **Trả lời:** *"Dạ, backend áp dụng nguyên lý **Idempotent API**:
1. Bảng `payment_transactions` có Unique Index đảm bảo chỉ có duy nhất 1 giao dịch `DEPOSIT` ở trạng thái `PENDING` cho mỗi đơn.
2. Khi VNPAY gọi IPN về, backend kiểm tra chữ ký HMAC-SHA512. Nếu chữ ký hợp lệ và trạng thái đơn đang là `PENDING`, backend mới cập nhật sang `DEPOSIT_PAID` trong 1 Transaction (`@Transactional`). Nếu callback gửi lại lần 2, hệ thống kiểm tra thấy đơn đã `DEPOSIT_PAID` thì chỉ trả về kết quả thành công mà không trừ tiền hay cộng tiền thêm."*

---

### ❓ Nhóm câu hỏi 4: Về Frontend & Trải nghiệm người dùng

**Câu 9: "Giao diện được thiết kế theo nguyên tắc nào?"**
* **Trả lời:** *"Dạ, Frontend được xây dựng bằng React 18 và TailwindCSS theo phong cách **Gamification UI (tương tự Duolingo)** với viền nổi 3D, nút bấm có độ nảy rõ ràng, màu sắc phân định trạng thái trực quan (Xanh: Khả dụng/Thành công, Vàng: Chờ xử lý, Đỏ: Cảnh báo/Hủy). Mọi thao tác đều có Toast thông báo, Loading Skeleton và Modal xác nhận để giảm thiểu sai sót của người dùng."*

---

# PHẦN 7: BÍ QUYẾT TỰ TIN KHI BẢO VỆ DÀNH CHO BẠN

1. **Nguyên tắc trả lời "Tại sao code như thế này?":**
   * *Đừng bao giờ nói:* "Do AI viết ra" hoặc "Em thấy trên mạng làm thế".
   * *Hãy luôn trả lời:* **"Dạ thưa thầy/cô, nhóm em chọn giải pháp này vì nó giải quyết tốt bài toán [tên bài toán], tối ưu thời gian xử lý và đảm bảo tính nhất quán dữ liệu."**
2. **Khi gặp câu hỏi khó không biết trả lời:**
   * Hãy bình tĩnh và nói: *"Dạ đây là một góc nhìn nghiệp vụ rất hay mà nhóm em đã thảo luận nhưng chưa kịp tối ưu trong phạm vi môn học SWP391. Hiện tại nhóm em xử lý theo hướng [nêu hướng hiện tại], và ở đồ án tốt nghiệp tiếp theo nhóm em sẽ phát triển giải pháp như thầy/cô vừa gợi ý ạ!"*
3. **Luôn nhớ câu thần chú:** Hệ thống QueenKho là hệ thống **quản lý vòng đời khép kín từ Đặt chỗ $\rightarrow$ Hợp đồng $\rightarrow$ Bàn giao $\rightarrow$ Trả kho $\rightarrow$ Nghiệm thu & Quyết toán cọc**. Nắm chắc 5 mắt xích này là bạn đã nắm chắc điểm A trong tay!

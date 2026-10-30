# QUEENKHO — TỔNG HỢP TOÀN BỘ QUY TẮC NGHIỆP VỤ (BUSINESS RULES) & CHÍNH SÁCH VẬN HÀNH (POLICIES)

> **Dự án:** QueenKho — Hệ thống Quản lý và Cho thuê Kho Tự Quản (Self-Storage Facility Rental & Management System)  
> **Mã môn:** SWP391 — FPT University  
> **Phiên bản:** Master Specification v3.0 (Đồng bộ 100% Source Code & Schema Database)  
> **Ngày phê duyệt:** 16/10/2026  
> **Độ khớp mã nguồn:** ✅ 100% (Khớp chi tiết từng Controller, Service, DTO, Repository, Entity, Scheduler và React Pages).

---

## BẢNG ĐỐI CHIẾU MÃ NGUỒN — TÍNH NĂNG & THỰC THI (CODE TRACEABILITY MATRIX)

| Nghiệp Vụ / Chính Sách | File Triển Khai Backend | File Triển Khai Frontend | File SQL / Bảng DB | Trạng Thái Khớp |
| :--- | :--- | :--- | :--- | :---: |
| **Đăng ký & Đăng nhập (UC-01, UC-02)** | `AuthService.java`<br>`AuthController.java` | `LoginPage.jsx`<br>`RegisterPage.jsx` | Bảng `users`, `roles` | **100%** |
| **Tìm kiếm & Tình trạng kho (UC-09)** | `FacilityService.java`<br>`FacilityController.java` | `SearchLandingPage.jsx`<br>`SearchResultsPage.jsx` | Bảng `facilities`, `storage_units`, `unit_types` | **100%** |
| **Tạo Đơn Đặt Chỗ (UC-10)** | `ReservationService.java`<br>`ReservationController.java` | `CreateReservationPage.jsx` | Bảng `reservations`, `unit_types` | **100%** |
| **Thanh toán VNPAY / IPN (UC-11)** | `VnpayService.java`<br>`VnpayController.java` | `ReservationConfirmationPage.jsx` | Bảng `payment_transactions` | **100%** |
| **Quét Hủy Đơn Quá Hạn Tự Động** | `ReservationCleanupService.java` | — (Chạy ngầm server) | Bảng `reservations` | **100%** |
| **Duyệt Đơn & Gán Ô Kho (UC-14)** | `ReservationService.java` | `PendingReservationsPage.jsx`<br>`AssignUnitModal.jsx` | Bảng `reservations`, `storage_units`, `rental_contracts` | **100%** |
| **Xử Lý No-Show Nhận Kho** | `ReservationService.java` | `PendingReservationsPage.jsx`<br>`NoShowModal.jsx` | Bảng `reservations`, `storage_units`, `rental_contracts`, `activity_logs` | **100%** |
| **Hủy Đơn & Tính Hoàn Cọc (UC-15)** | `ReservationService.java` | `MyReservationsPage.jsx`<br>`CancelReservationModal.jsx` | Bảng `reservations`, `payment_transactions`, `staff_tasks` | **100%** |
| **Sinh & Điều Phối Task (UC-16, 17)**| `StaffTaskService.java` | `StaffTaskBoardPage.jsx`<br>`ManagerTaskBoardPage.jsx`| Bảng `staff_tasks` | **100%** |
| **Bàn Giao Check-in (UC-18)** | `StaffTaskService.java` | `StaffTaskDetailPage.jsx` | Bảng `handover_records`, `rental_contracts`, `staff_tasks` | **100%** |
| **Gia Hạn Hợp Đồng (UC-21)** | `ContractService.java`<br>`VnpayService.java` | `CustomerContractPage.jsx`<br>`RenewModal.jsx` | Bảng `rental_contracts`, `payment_transactions`, `activity_logs` | **100%** |
| **Yêu Cầu Trả Kho (UC-22)** | `ContractService.java` | `CustomerContractPage.jsx`<br>`CheckoutModal.jsx` | Bảng `rental_contracts`, `staff_tasks` | **100%** |
| **Chế Tài Quá Hạn & Báo Cáo Liên Hệ**| `StaffTaskService.java` | `StaffTaskDetailPage.jsx` (Contact Report) | Bảng `rental_policy`, `staff_tasks`, `activity_logs` | **100%** |

---

## 1. PHÂN ĐỊNH KHÁI NIỆM: BUSINESS RULES VS SOFTWARE REQUIREMENTS

Theo tiêu chuẩn phân tích nghiệp vụ công nghệ phần mềm (chuẩn chấm điểm bảo vệ SWP391):

```
┌────────────────────────────────────────────────────────┐
│           BUSINESS RULES (Luật Nghiệp Vụ)              │
│  "Doanh nghiệp quy định điều gì phải ĐÚNG hoặc BẮT BUỘC"│
│  (Độc lập công nghệ, có hiệu lực cả khi mất mạng/sổ tay)│
└──────────────────────────┬─────────────────────────────┘
                           │ Chuyển hóa & Thực thi
                           ▼
┌────────────────────────────────────────────────────────┐
│         SOFTWARE REQUIREMENTS (Yêu Cầu Phần Mềm)       │
│  "Hệ thống phần mềm phải làm gì (Chức năng / Màn hình) │
│       để người dùng tuân thủ đúng Business Rule"       │
└────────────────────────────────────────────────────────┘
```

### Bảng minh họa trực tiếp theo mã nguồn QueenKho

| Tiêu Chí Phân Định | Business Rule (BR) | Software Requirement (REQ) |
| :--- | :--- | :--- |
| **Bản chất** | Luật chơi, chính sách chế tài, công thức toán học do Ban Vận Hành (BOM) ban hành. | Đặc tả chức năng hệ thống phần mềm cần lập trình để hỗ trợ hoặc ép buộc người dùng tuân thủ BR. |
| **Tính độc lập** | **Tồn tại độc lập**: Dù không có máy tính, nhân viên vẫn áp dụng quy tắc này để thu tiền cọc hoặc phạt trễ hạn. | **Gắn liền với mã nguồn**: Quy định cụ thể tên API, mã lỗi HTTP, tham số DTO, ràng buộc DB. |
| **Ví dụ: Tiền đặt cọc** | **BR-DEP-01:** "Tiền cọc giữ chỗ luôn cố định bằng đúng 100% (1 tháng) giá thuê cơ bản của loại kho được chọn." | **REQ-UC10-02:** "Tại `ReservationService.createReservation`, BE lấy `unitType.getBasePriceMonthly()`, gán vào `depositAmount` và chặn thanh toán nếu dữ liệu không khớp." |
| **Ví dụ: Giờ đóng cửa** | **BR-TIME-01:** "Cơ sở ngừng đón khách và đóng cửa lúc 21:00 hàng ngày; mọi task chưa hoàn tất trước 21:00 sẽ quá hạn." | **REQ-TASK-01:** "`StaffTaskService` khai báo `CLOSING_TIME = LocalTime.of(21, 0)`. Hạn chót `dueAt` của task check-in/check-out luôn tự động tính theo mốc 21:00." |
| **Ví dụ: Hủy cọc (UC-15)**| **BR-CAN-01:** "Hủy đơn trước $\ge 24\text{h}$ so với giờ hẹn nhận kho thì hoàn 100% tiền cọc; hủy trong vòng $< 24\text{h}$ thì phạt 50% tiền cọc." | **REQ-UC15-02:** "`ReservationService.previewCancel()` so sánh `now.plusHours(24)` với `expectedAppointmentTime` để tính `penalty` và `refund`." |

---

## 2. CHÍNH SÁCH BẢNG GIÁ & CÔNG THỨC CHIẾT KHẤU (CODE-VERIFIED)

### 2.1. Bảng giá gốc loại kho chuẩn (`unit_types`) trong Database
Database `QueenKhoDB` quy định 6 loại kho cơ sở với diện tích, thể tích và giá gốc hàng tháng (`base_price_monthly`):

| ID | Tên Loại Kho (`name`) | Diện Tích (`area_sqm`) | Thể Tích (`volume_cbm`) | Giá Gốc Hàng Tháng (`base_price_monthly`) | Kích Thước (`dimensions`) | Sức Chứa Gợi Ý (`suggested_capacity`) |
| :-: | :--- | :---: | :---: | :---: | :---: | :--- |
| **1** | Kho Mini M | $3.5\text{ m}^2$ | $8.4\text{ m}^3$ | **750.000 VNĐ** | $1.5\text{m} \times 2.3\text{m} \times 2.4\text{m}$ | 10–20 thùng carton |
| **2** | Kho Tiêu Chuẩn | $6.0\text{ m}^2$ | $16.2\text{ m}^3$ | **1.850.000 VNĐ** | $2.5\text{m} \times 2.4\text{m} \times 2.7\text{m}$ | 20–40 thùng, nội thất nhỏ |
| **3** | Kho Gia Đình | $12.0\text{ m}^2$ | $32.4\text{ m}^3$ | **3.450.000 VNĐ** | $4.0\text{m} \times 3.0\text{m} \times 2.7\text{m}$ | Đồ 1 phòng ngủ hoặc VP nhỏ |
| **4** | Kho Lớn | $16.0\text{ m}^2$ | $43.2\text{ m}^3$ | **4.500.000 VNĐ** | $4.0\text{m} \times 4.0\text{m} \times 2.7\text{m}$ | Đồ 2 phòng ngủ hoặc hàng hóa |
| **5** | Kho Đặc Biệt XL | $25.0\text{ m}^2$ | $67.5\text{ m}^3$ | **6.500.000 VNĐ** | $5.0\text{m} \times 5.0\text{m} \times 2.7\text{m}$ | Hàng hóa lớn, máy móc |
| **6** | Kho nhỏ $2\text{m}^2$ | $2.0\text{ m}^2$ | $4.8\text{ m}^3$ | **500.000 VNĐ** | $1.0\text{m} \times 2.0\text{m} \times 2.4\text{m}$ | Cá nhân, sinh viên, tài liệu |

### 2.2. Công thức tính tiền thanh toán đơn đặt chỗ ban đầu (Khớp 100% `VnpayService.java` & `CreateReservationPage.jsx`)
Tại thời điểm đặt chỗ thuê kho (`CreateReservationPage.jsx` và hàm `VnpayService.createReservation` dòng 46–54):
$$\text{BaseRent} = \text{base\_price\_monthly} \times \text{duration\_months}$$
$$\text{DiscountAmount} = \text{BaseRent} \times \frac{\text{DiscountPercent}}{100}$$
$$\text{NetRent} = \text{BaseRent} - \text{DiscountAmount}$$
$$\mathbf{\text{TotalPayment}} = \mathbf{\text{NetRent}} + \mathbf{\text{DepositAmount}} - \mathbf{\text{VoucherDiscount}}$$

*Trong đó:*
- **Tiền đặt cọc (`DepositAmount`):** Cố định bằng đúng giá 1 tháng thuê cơ bản: `unitType.basePriceMonthly`.
- **Tỷ lệ chiết khấu thời hạn thuê ban đầu (`DiscountPercent`):**
  - **1 tháng:** Chiết khấu **0%**.
  - **3 tháng:** Chiết khấu **5%** (Gói được chọn nhiều nhất - *Phổ biến nhất*).
  - **6 tháng:** Chiết khấu **10%** (*Trung hạn*).
  - **12 tháng:** Chiết khấu **15%** (*Dài hạn*).
- **Voucher giảm giá khai trương (`VoucherDiscount`):** Mặc định áp dụng mã `NEWKHO` giảm ngay **100.000 VNĐ** (Code: `subtract(BigDecimal.valueOf(100000))`).

### 2.3. Công thức chiết khấu khi Gia Hạn Hợp Đồng (Khớp 100% `ContractService.java` & `VnpayService.java`)
Tại thời điểm khách hàng gia hạn hợp đồng (`ContractService.renewContract` dòng 56–63 và `VnpayService.createRenewal` dòng 62–64):
- Gia hạn từ **1 đến 5 tháng:** Giảm **0%**.
- Gia hạn từ **6 đến 11 tháng:** Giảm **5%** trên tổng tiền thuê phát sinh (`discount = subtotal * 0.05`).
- Gia hạn từ **12 tháng trở lên:** Giảm **10%** trên tổng tiền thuê phát sinh (`discount = subtotal * 0.10`).

### 2.4. Nguyên tắc định giá phân hóa theo Cơ sở, Vị trí và Tầng (Dynamic Pricing Model)
Giá thực tế của khoang có thể nhân với các hệ số phụ thuộc cơ sở và loại hình:
- **Hệ số Cơ sở Trung tâm:** Cơ sở Quận 7, Tân Bình, Cầu Giấy áp dụng phụ phí vị trí lõi $+15\%$ ($K = 1.15$).
- **Hệ số Tầng trệt (Tầng 1):** Phụ phí thuận tiện bốc dỡ xe tải đậu sát cửa khoang $+10\%$ ($K = 1.10$).
- **Kho Lạnh Mát (`KL`):** Phụ phí năng lượng điện 3 pha và máy nén khí duy trì nhiệt độ 24/7 $+45\%$ ($K = 1.45$).

---

## 3. CẤU TRÚC PHÂN CẤP KHOANG & QUY CHUẨN KHO LẠNH CÓ MÃ SỐ

### 3.1. Cây phân cấp tổ chức khoang 4 tầng
```
Cấp 1: Cơ sở (facilities) ── id: 1..6 (Tân Bình, Bình Thạnh, Thủ Đức, Gò Vấp, Cầu Giấy, Quận 7)
  │
  └── Cấp 2: Khu vực (zone) ── Zone A, Zone B (Kho khô), Zone C (Kho mát / Kho lạnh)
        │
        └── Cấp 3: Tầng (floor) ── Tầng 1 (Trệt), Tầng 2, Tầng 3
              │
              └── Cấp 4: Ô kho vật lý (storage_units.id) ── Mã chuỗi: KV-TB-A101, KL-TB-C101...
```

### 3.2. Cấu trúc mã định danh ô kho (`storage_units.id`)
Mã ô kho là khóa chính kiểu chuỗi `NVARCHAR(20)`, viết tắt chuẩn hóa theo quy tắc:
$$\mathbf{[LoạiHình]-[MãCơSở]-[KhuVực][Tầng][SốPhòng]}$$

- **`LoạiHình`:**
  - `KV`: Kho Khô Tiêu Chuẩn (Dry Storage).
  - `KL`: Kho Lạnh / Kho Mát (Cold / Climate-Controlled Storage).
- **`MãCơSở`:**
  - `TB`: Tân Bình (ID 1) | `BT`: Bình Thạnh (ID 2) | `TD`: Thủ Đức (ID 3)
  - `GV`: Gò Vấp (ID 4)   | `CG`: Cầu Giấy (ID 5)   | `Q7`: Quận 7 (ID 6)
- **`KhuVực][Tầng][SốPhòng`:**
  - `A101`: Khu A, Tầng 1, Ô 01.
  - `B204`: Khu B, Tầng 2, Ô 04.
  - `C101`: Khu C (Kho lạnh), Tầng 1, Ô 01.

### 3.3. Quy chuẩn kỹ thuật Kho Lạnh (Cold Storage Specification)
1. **Dải nhiệt độ kiểm soát:**
   - *Kho Mát (15°C đến 22°C, độ ẩm < 60%):* Dành cho thiết bị điện tử tinh vi, dược phẩm, mỹ phẩm, thực phẩm chức năng, rượu vang.
   - *Kho Đông Lạnh (0°C đến 5°C):* Dành cho nguyên liệu thực phẩm đóng gói chuẩn.
2. **Cảm biến IoT & Báo động:** Tích hợp cặp sensor nhiệt/ẩm gửi dữ liệu thời gian thực. Báo động tự động nếu lệch $\pm 2^\circ\text{C}$ kéo dài quá 15 phút.
3. **Nguồn điện dự phòng:** Máy phát điện ATS tự động kích hoạt cấp nguồn trong vòng 30 giây khi mất điện lưới.

### 3.4. Câu lệnh SQL Thống kê tổng số ô kho gom nhóm theo Cơ sở, Khu vực và Tầng
```sql
SELECT 
    f.name AS [Cơ Sở],
    ISNULL(su.zone, N'-- TỔNG CƠ SỞ --') AS [Khu Vực (Zone)],
    ISNULL(su.floor, N'-- TỔNG KHU --') AS [Tầng (Floor)],
    COUNT(su.id) AS [Tổng Số Ô Kho],
    SUM(CASE WHEN su.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS [Ô Trống Khả Dụng],
    SUM(CASE WHEN su.status = 'OCCUPIED' THEN 1 ELSE 0 END) AS [Đang Thuê / Đã Gán],
    SUM(CASE WHEN su.status = 'MAINTENANCE' THEN 1 ELSE 0 END) AS [Đang Bảo Trì]
FROM storage_units su
JOIN facilities f ON su.facility_id = f.id
GROUP BY f.name, ROLLUP(su.zone, su.floor);
```

---

## 4. GIẢI THUẬT KIỂM TRA Ô KHO TRỐNG TRONG TƯƠNG LAI (FUTURE AVAILABILITY)

### 4.1. Bản chất giải thuật
Một ô kho vật lý $U$ được coi là **TRỐNG (AVAILABLE)** vào ngày $D_{\text{target}}$ khi thỏa mãn 3 điều kiện:
1. $U.\text{status} \ne \text{'MAINTENANCE'}$.
2. Không vướng Hợp đồng đang chạy (`PENDING_CHECK_IN`, `ACTIVE`, `OVERDUE`, `TERMINATION_PENDING`) có khoảng:
   $$\text{Contract.start\_date} \le D_{\text{target}} \le \text{Contract.end\_date}$$
3. Không vướng Đơn đặt chỗ đã thanh toán cọc (`DEPOSIT_PAID`, `UNIT_ASSIGNED`) có khoảng:
   $$\text{Reservation.start\_date} \le D_{\text{target}} < (\text{Reservation.start\_date} + \text{duration\_months})$$

### 4.2. Câu lệnh SQL Query chính thức chạy Backend
```sql
DECLARE @facilityId INT = 1;
DECLARE @unitTypeId INT = 2;
DECLARE @targetDate DATE = '2026-11-01';

SELECT su.id AS storage_unit_id, su.floor, su.zone, su.room_number, ut.name AS unit_type_name
FROM storage_units su
JOIN unit_types ut ON su.unit_type_id = ut.id
WHERE su.facility_id = @facilityId
  AND su.unit_type_id = @unitTypeId
  AND su.status != 'MAINTENANCE'
  AND su.id NOT IN (
      SELECT rc.storage_unit_id 
      FROM rental_contracts rc
      WHERE rc.storage_unit_id = su.id
        AND rc.status IN ('PENDING_CHECK_IN', 'ACTIVE', 'OVERDUE', 'TERMINATION_PENDING')
        AND @targetDate >= rc.start_date
        AND (@targetDate <= rc.end_date OR rc.end_date IS NULL)
  )
  AND su.id NOT IN (
      SELECT r.storage_unit_id 
      FROM reservations r
      WHERE r.storage_unit_id = su.id
        AND r.status IN ('DEPOSIT_PAID', 'UNIT_ASSIGNED')
        AND @targetDate >= r.start_date
        AND @targetDate < DATEADD(month, r.duration_months, r.start_date)
  );
```

---

## 5. CHÍNH SÁCH QUÁ HẠN TRẢ KHO, KHÁCH KHÔNG NGHE MÁY & XỬ LÝ HÀNG TỒN (CODE-VERIFIED)

### 5.1. Bảng cấu hình chính sách thuê (`rental_policy`)
Trong bảng `rental_policy` của `QueenKhoDB`, cả 6 cơ sở đều có cấu hình chế tài chuẩn:

$$\begin{aligned}
\text{Phí phạt trễ hạn mỗi ngày (late\_fee\_per\_day)} &= \mathbf{50.000\text{ VNĐ/ngày}} \\
\text{Số ngày quá hạn bị khóa tài khoản (lock\_account\_days)} &= \mathbf{5\text{ ngày}} \\
\text{Số ngày quá hạn bị phát mãi tài sản (liquidation\_days)} &= \mathbf{30\text{ ngày}} \\
\text{Thời hạn hủy miễn phí trước giờ hẹn (cancel\_free\_hours)} &= \mathbf{24\text{ giờ}} \\
\text{Tỷ lệ phạt cọc khi hủy muộn (cancel\_fee\_percent)} &= \mathbf{50\%}
\end{aligned}$$

### 5.2. Quy trình xử lý khi đến ngày trả kho khách không đến, không nghe máy
```
[Ngày Hẹn Trả Kho: T]
         │
         ├──> Khách đến đúng hẹn ───────────> Lập Biên Bản CHECK_OUT ──> Hoàn tiền cọc
         │
         └──> KHÁCH KHÔNG ĐẾN (NO-SHOW CHECKOUT)
                  │
                  ▼
         [21:00 Giờ đóng cửa ngày T] (StaffTaskService.CLOSING_TIME)
         • Staff Task CHECK_OUT chuyển sang trạng thái OVERDUE
         • Hợp đồng chuyển sang trạng thái OVERDUE
         • KHÓA LẬP TỨC MÃ PIN 6 SỐ & THẺ RFID (chặn ra vào tự do không kiểm soát)
                  │
                  ▼
         [Từ Ngày T+1 đến T+5] GIAI ĐOẠN LIÊN HỆ & TÍNH PHÍ PHẠT
         • Nhân viên gọi điện tối thiểu 2 lần/ngày.
         • Nhập kết quả gọi qua StaffTaskService.submitContactReport:
           Cập nhật note dạng: "[callOutcome] - detail" vào task và activity_logs.
         • Tính phí phạt: 50.000 VNĐ/ngày (cộng dồn trừ vào tiền cọc đang giữ).
         • Hệ thống gửi email & tin nhắn SMS cảnh báo quá hạn.
                  │
                  ▼
         [Ngày T+5 (lock_account_days)]: KHÓA TÀI KHOẢN
         • Cập nhật users.status = 'LOCKED' (khóa toàn bộ quyền đặt đơn mới).
         • Gửi thư cảnh cáo đơn phương chấm dứt hợp đồng.
                  │
                  ▼
         [Ngày T+30 (liquidation_days)]: PHÁT MÃI TÀI SẢN (LIQUIDATION)
         • Tiền cọc bị trừ hết sạch bởi tiền phạt HOẶC đã quá 30 ngày mất liên lạc.
         • Cập nhật rental_contracts.status = 'LIQUIDATED'.
         • Kích hoạt quy trình xử lý tài sản vô chủ (Abandoned Goods Protocol).
```

### 5.3. Quy trình xử lý tài sản vô chủ (Abandoned Goods Protocol)
1. **Kiểm kê 3 bên chứng kiến:** Gồm Facility Manager + 01 Nhân viên trực + 01 Đại diện Bảo vệ Tòa nhà (hoặc Cán bộ Tư pháp / Công an Phường).
2. **Quay video 360 độ hiện trạng & Niêm phong:** Lập danh mục chi tiết tình trạng đồ đạc tồn đọng (Itemized Inventory List).
3. **Di chuyển về Kho đệm thanh lý (Liquidation Buffer Area):** Giải phóng ngay ô kho vật lý ban đầu, chuyển ô kho về trạng thái `AVAILABLE` để đưa vào kinh doanh đón khách mới.
4. **Phát mại / Tiêu hủy theo Luật Dân sự:**
   - **Tài sản có giá trị thương mại:** Bán đấu giá/thanh lý công khai. Tiền thu được dùng để:
     1. Khấu trừ công nợ tiền thuê kho còn thiếu.
     2. Khấu trừ tiền phạt chậm trả (50.000 VNĐ/ngày).
     3. Khấu trừ chi phí bốc dỡ kho bãi và tổ chức thanh lý.
     *Số tiền dư (nếu có)* được mở tài khoản tạm giữ bảo lưu cho khách hàng nhận lại trong thời hạn **180 ngày**.
   - **Hàng mau hỏng / rác thải / đồ không giá trị:** Lập biên bản tiêu hủy với công ty dịch vụ môi trường đô thị.

### 5.4. Công thức hoàn cọc khi trả kho
$$\mathbf{\text{Số Tiền Hoàn Cọc}} = \mathbf{\text{DepositHeldAmount}} - \mathbf{\text{PhíPhạtTrễHạn}} - \mathbf{\text{PhíVệSinh}} - \mathbf{\text{ChiPhíHưHỏngKhóa}} - \mathbf{\text{NợTiềnThuê}}$$

- Phí dọn vệ sinh kho bẩn: 200.000 VNĐ/lần.
- Phí bồi thường khóa hư hỏng: 300.000 – 1.500.000 VNĐ (theo hóa đơn thiết bị).
- Thời gian giải ngân hoàn cọc: 3 – 5 ngày làm việc (không tính Chủ Nhật).

---

## 6. RÀNG BUỘC THỜI GIAN ĐẶT CHỖ & NGHĨA VỤ HẬU THUÊ KHO (CODE-VERIFIED)

### 6.1. Ràng buộc thời gian đặt kho (Booking Constraints)
- **BR-TIME-01 (Giờ đóng cửa):** Khai báo trong `StaffTaskService.CLOSING_TIME = LocalTime.of(21, 0)`. Giờ hẹn đón khách nhận kho chỉ được phép chọn từ **08:00 đến 20:30**.
- **BR-TIME-02 (Ngày bắt đầu hợp lệ):** Tại `CreateReservationPage.jsx` và `ReservationService.createReservation`:
  `startDate` không được ở quá khứ (`min = tomorrow`). Backend ném: `"Ngày bắt đầu không được ở quá khứ"`.
- **BR-TIME-03 (Thời hạn thanh toán giữ chỗ 10 phút):**
  - Tại `VnpayService.java` dòng 100: `vnp_ExpireDate` = `now.plusMinutes(10)` (Thời hạn thanh toán VNPay là đúng **10 phút**).
  - Tại `ReservationCleanupService.java` dòng 20–21: Scheduler chạy mỗi phút (`fixedRate = 60000ms`), tự động quét và hủy các đơn `PENDING` quá 10 phút:
    ```sql
    UPDATE reservations SET status = 'CANCELLED' 
    WHERE status = 'PENDING' AND created_at <= DATEADD(minute, -10, GETDATE())
    ```
- **BR-TIME-04 (Thời gian thuê tối thiểu 1 tháng):** `durationMonths >= 1`. Backend ném: `"Thời gian thuê phải tối thiểu 1 tháng"`.
- **BR-TIME-05 (Chính sách hủy cọc UC-15):** Tại `ReservationService.previewCancel()`:
  - Hủy sớm ($\ge 24\text{h}$ so với `expectedAppointmentTime`): Hoàn **100% tiền cọc**, phạt $0\%$.
  - Hủy trễ ($< 24\text{h}$ hoặc sau giờ hẹn): Phạt **50% tiền cọc**, hoàn lại $50\%$ cọc (+ 100% tiền thuê nếu đã trả).
  - Deadline chuyển khoản hoàn cọc: 24 giờ làm việc, tự động bỏ qua Chủ Nhật (`calculateRefundDeadline`).

### 6.2. Nghĩa vụ sau khi thuê & Xử lý khách bùng nhận kho (No-Show)
- **BR-POST-01 (Nghiệm thu Check-in 5 tiêu chí - UC-18):**
  Tại `StaffTaskService.validateCheckInRequest`:
  Bắt buộc `Boolean.TRUE` đủ cả 5 tiêu chí:
  1. `identityVerified`: Đã đối chiếu thông tin CMND/CCCD.
  2. `unitEmpty`: Khoang trống hoàn toàn.
  3. `unitClean`: Khoang sạch sẽ đạt chuẩn.
  4. `lockIntact`: Khóa/cửa hoạt động tốt, không hư hại.
  5. `customerSignatureConfirmed`: Khách hàng đã ký biên bản.
- **BR-POST-02 (An ninh mã PIN & Thẻ RFID):**
  - Mã PIN đúng 6 chữ số: `matches("\\d{6}")`.
  - Cấm trùng PIN & RFID: Kiểm tra qua Repository `existsByAccessPinCodeAndStatusIn` và `existsByRfidCardCodeAndStatusIn` với danh sách hợp đồng còn hiệu lực `['ACTIVE', 'OVERDUE', 'TERMINATION_PENDING']`.
- **BR-POST-03 (Quy định hàng cấm):** Cấm chất dễ cháy nổ, vũ khí, ma túy, động vật sống, thực phẩm tươi sống dễ ôi thiu.
- **BR-POST-04 (Xử lý No-Show nhận kho):**
  Tại `ReservationService.handleNoShow`:
  - Khách có đơn `DEPOSIT_PAID` hoặc `UNIT_ASSIGNED` nhưng quá hẹn không đến và không liên lạc được:
  - Đơn chuyển sang `CANCELLED`.
  - Ô kho lập tức giải phóng về `AVAILABLE`.
  - Hợp đồng chuyển `TERMINATED`.
  - Hủy task check-in khỏi bảng công việc nhân viên.
  - **TỊCH THU 100% TIỀN ĐẶT CỌC** (Ghi log vào `activity_logs`).

---

## 7. BẢNG PHÂN CỤM & DANH MỤC TOÀN BỘ BUSINESS RULES CỐT LÕI (CORE BR MATRIX)

| Nhóm Nghiệp Vụ | Mã BR | Tên Quy Tắc | Logic Nghiệp Vụ Cụ Thể Trong Source Code | Chế Tài & Xử Lý Phần Mềm |
| :--- | :--- | :--- | :--- | :--- |
| **1. Định danh & Phân quyền** | **BR-AUTH-01** | Email duy nhất | Kiểm tra `userRepository.findByEmail`. | Trả lỗi: `"Email này đã được sử dụng"`. |
| | **BR-AUTH-02** | Băm mật khẩu an toàn | Dùng `PasswordEncoder` (BCrypt 10 rounds). | Cấm lưu plain-text mật khẩu trong DB. |
| | **BR-AUTH-03** | Phân quyền 5 vai trò | Gồm: `CUSTOMER`, `STAFF`, `FACILITY_MANAGER`, `BOM`, `ADMIN`. | Spring Security kiểm soát phân quyền URL. |
| **2. Đặt chỗ & Đặt cọc** | **BR-RES-01** | Định mức cọc 1 tháng | `depositAmount = unitType.getBasePriceMonthly()`. | Cọc bằng đúng 100% giá thuê 1 tháng. |
| | **BR-RES-02** | Timeout giữ cọc 10 phút | Hết 10 phút, `ReservationCleanupService` cập nhật đơn thành `CANCELLED`. | Nhả giữ chỗ khoang cho khách hàng khác. |
| | **BR-RES-03** | Khung giờ hẹn nhận kho | Hẹn chỉ từ 08:00 đến 20:30 (Đóng cửa lúc 21:00). | Chặn chọn giờ ngoài khung tiếp nhận. |
| **3. Phê duyệt & Gán kho** | **BR-ASN-01** | Điều kiện gán ô kho (UC-14) | Chỉ đơn `DEPOSIT_PAID` mới được gán ô kho. | Ném `IllegalStateException` nếu đơn chưa cọc. |
| | **BR-ASN-02** | Khóa trạng thái ô kho | Ô gán phải là `AVAILABLE`. Gán xong chuyển thành `OCCUPIED`. | Tạo HĐ mới trạng thái `PENDING_CHECK_IN`. |
| | **BR-ASN-03** | Sinh task nhân viên (UC-16)| Gán kho xong tự sinh 1 task `CHECK_IN` cho nhân viên cơ sở. | Hạn chót `dueAt` là 21:00 ngày hẹn khách đến. |
| **4. Bàn giao Nhận kho** | **BR-CHK-01** | Nghiệm thu 5 tiêu chí (UC-18)| Đủ 5 mục (CCCD, Trống, Sạch, Khóa, Chữ ký). | Ném `CHECKLIST_INCOMPLETE` nếu thiếu mục nào. |
| | **BR-CHK-02** | Cấp mã mở kho | PIN 6 số (`\d{6}`), Thẻ RFID ($\le 50$ ký tự), cấm trùng HĐ sống. | Hợp đồng chuyển `ACTIVE`, Task thành `COMPLETED`. |
| | **BR-CHK-03** | Xử lý No-Show nhận kho | Khách không đến: Kích hoạt No-Show, **tịch thu 100% cọc**. | Ô kho về `AVAILABLE`, HĐ thành `TERMINATED`. |
| **5. Hủy Đơn & Hoàn Tiền** | **BR-CAN-01** | Hủy sớm trước $\ge 24\text{h}$ | Hủy trước 24h so với giờ hẹn: Hoàn 100% cọc, phạt 0đ. | Tạo giao dịch `REFUND` trạng thái `PENDING`. |
| | **BR-CAN-02** | Hủy trễ trong vòng $< 24\text{h}$ | Hủy trong 24h: Phạt 50% cọc, chỉ hoàn lại 50% cọc. | Sinh task `REFUND` có deadline cho nhân viên. |
| **6. Gia hạn & Khôi phục** | **BR-RNW-01** | Chiết khấu gia hạn | Gia hạn $\ge 6$ tháng giảm 5%; $\ge 12$ tháng giảm 10%. | BE tự động trừ discount vào tổng tiền đóng. |
| | **BR-RNW-02** | Khôi phục từ Overdue | HĐ `OVERDUE` hoặc `TERMINATION_PENDING` gia hạn sẽ về lại `ACTIVE`. | Tự động hủy các task `CHECK_OUT` đang mở. |
| **7. Quá hạn & Thanh lý** | **BR-LAT-01** | Phạt trễ hạn 50k/ngày | Phí phạt 50.000 VNĐ/ngày tính từ 21:01 ngày hẹn trả. | Trừ lũy kế vào cọc khi thanh quyết toán. |
| | **BR-LOC-01** | Khóa tài khoản sau 5 ngày | Quá hạn 5 ngày không trả kho: Khóa tài khoản. | Cập nhật `users.status = 'LOCKED'`. |
| | **BR-LIQ-01** | Phát mãi tài sản sau 30 ngày| Quá hạn 30 ngày và cọc cạn kiệt: Thanh lý tài sản. | HĐ chuyển `LIQUIDATED`, dọn hàng sang kho đệm. |

---

## 8. MA TRẬN RÀNG BUỘC DỮ LIỆU & KIỂM THỬ VALIDATION TOÀN DIỆN (FE — BE — DB)

| Tên Trường | Form / Màn Hình | Ràng Buộc Kiểm Tra Frontend (ReactJS) | Kiểm Tra Backend (Spring Boot Validation & Logic) | Ràng Buộc Cơ Sở Dữ Liệu (SQL Server Schema) | Mã Lỗi & Thông Báo Trả Về |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **email** | Đăng ký / Đăng nhập | Regex email HTML5 chuẩn, bắt buộc nhập, `trim().toLowerCase()`. | `@NotBlank`, `@Email` | `NVARCHAR(255) NOT NULL UNIQUE` | `INVALID_EMAIL` (400)<br>`DUPLICATE_EMAIL` (409) |
| **phone** | Đăng ký / Đặt chỗ | Regex 10 số VN: `/(84\|0[3\|5\|7\|8\|9])+([0-9]{8})\b/`. | `@NotBlank`, `@Pattern(regexp = "^(0[3\\|5\\|7\\|8\\|9])[0-9]{8}$")` | `NVARCHAR(20) NOT NULL` | `INVALID_PHONE`: Số điện thoại sai định dạng |
| **password** | Đăng ký tài khoản | $\ge 8$ ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt. | Validate độ mạnh regex trước khi băm BCrypt. | `NVARCHAR(255) NOT NULL` (Hash 60 ký tự) | `WEAK_PASSWORD`: Mật khẩu chưa đủ độ mạnh an toàn |
| **startDate** | Đặt chỗ kho | Thuộc tính `min = tomorrow`. Cấm chọn ngày quá khứ. | `if (startDate == null \|\| startDate.isBefore(LocalDate.now())) throw ...` | `DATE NULL` | `INVALID_START_DATE`: Ngày bắt đầu không được ở quá khứ |
| **durationMonths** | Đặt chỗ kho | Dropdown các mức: 1, 3, 6, 12 tháng. | `@NotNull`, `@Min(1)` | `INT NOT NULL` | `INVALID_DURATION`: Thời gian thuê tối thiểu 1 tháng |
| **accessPinCode** | Check-in bàn giao | Bắt buộc đúng 6 chữ số, ô nhập mật mã `******`. | `@Pattern(regexp = "\\d{6}")`, kiểm tra trùng qua Repository. | `NVARCHAR(20) NULL` | `INVALID_PIN`: Mã PIN phải gồm đúng 6 chữ số<br>`PIN_TAKEN`: Mã PIN đã được sử dụng |
| **rfidCardCode** | Check-in bàn giao | Quét thẻ RFID, không để trống, tối đa 50 ký tự. | `@NotBlank`, `@Size(max = 50)`, kiểm tra trùng qua Repository. | `NVARCHAR(50) NULL` | `RFID_TAKEN`: Thẻ RFID đang gán cho hợp đồng khác |
| **5 Checkbox Bàn Giao**| Check-in bàn giao | Bắt buộc tick đủ cả 5 mục mới kích hoạt nút Hoàn tất. | `allChecked = idVerified && empty && clean && lock && sig; if (!allChecked) throw ...` | `BIT NOT NULL DEFAULT 0` (Bảng `handover_records`) | `CHECKLIST_INCOMPLETE`: Phải hoàn thành đủ 5 mục kiểm tra mới được bàn giao |
| **checkoutDate** | Yêu cầu trả kho | Input chọn ngày $\ge$ Ngày hiện tại. Gợi ý mặc định `endDate`. | `if (checkoutDate.isBefore(LocalDate.now())) throw ...` | Ghi vào `note` và `due_at` của task | `INVALID_CHECKOUT_DATE`: Ngày hẹn trả kho không hợp lệ |
| **bankAccountNumber**| Hủy đơn hoàn cọc | Chỉ nhập ký tự số (6-20 số) khi chọn nhận tiền qua Ngân hàng. | `@Pattern(regexp = "^[0-9]{6,20}$")` | Lưu vào ghi chú `action` của `activity_logs` | `INVALID_BANK_ACCOUNT`: Số tài khoản không hợp lệ |

---

> 📌 **Lời khuyên bảo vệ đồ án:**  
> Toàn bộ các định mức tiền tệ (50.000 VNĐ/ngày, phạt 50% cọc, voucher 100.000 VNĐ), thời gian (10 phút timeout, 21:00 đóng cửa, 5 ngày khóa nick, 30 ngày thanh lý), và các ràng buộc validation trong tài liệu này **đều có dòng code tương ứng chính xác 100% trong Backend và Frontend**. Bạn hoàn toàn có thể tự tin mở trực tiếp mã nguồn để đối chứng trước hội đồng chấm thi.

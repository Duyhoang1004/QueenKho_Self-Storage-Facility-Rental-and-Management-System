# Test flow Đặt chỗ → Gán kho → Sinh hợp đồng (UC-09 → UC-14)

Ngày test: 2026-10-02 · Nhánh `main` (commit `ecf1386`) · Test qua API (curl) trên DB local `QueenKhoDB`.
FE **không test được UI**: `MyReservationsPage.jsx` (đang sửa dở, chưa commit) import `components/CancelReservationModal` chưa tồn tại → Vite build lỗi `UNRESOLVED_IMPORT`, cả app không chạy.

## 1. Kết quả các bước

| # | Actor | Bước | API | Kết quả |
|---|-------|------|-----|---------|
| C0 | Customer | Đăng nhập `khachhang@gmail.com` / `123456` | `POST /api/v1/auth/login` | ✅ userId=8, role CUSTOMER |
| C1 | Customer | Tìm kiếm kho | `GET /api/v1/facilities/search?city=TP.HCM&unitTypeId=2` | ✅ (xem bug B6 về phân trang) |
| C2 | Customer | Chọn kho, xem slot | `GET /api/v1/facilities/1/availability` | ✅ Kho Mini M: total 3, available 1 |
| C3 | Customer | Chọn duration 3 tháng, tạo đơn | `POST /api/v1/reservations` | ✅ id=3, `RES-411040`, PENDING, cọc 750.000 |
| C4 | Customer | Tạo link thanh toán SePay | `POST /api/payments/sepay-pg/create` | ✅ payUrl sandbox, amount **2.787.500** (đúng công thức) |
| C5 | Customer | Xác nhận thanh toán (trang confirmation) | `POST /api/payments/sepay-pg/confirm-dev` | ✅ DEPOSIT_PAID + 1 dòng payment_transactions |
| C6 | Customer | Chờ gán kho | `GET /api/v1/reservations/my?customerId=8` | ✅ DEPOSIT_PAID, storageUnitId null |
| M0 | Manager | Đăng nhập `fm1@gmail.com` / `123456` | `POST /api/v1/auth/login` | ✅ userId=6, FACILITY_MANAGER, facility 1 |
| M1 | Manager | Xem đơn chờ gán | `GET /api/v1/reservations/pending?managerId=6` | ✅ thấy đơn id=3 |
| M2 | Manager | Xem ô trống phù hợp | `GET /api/v1/reservations/3/available-units` | ✅ `KV-TB-A102` |
| M3 | Manager | Gán ô | `POST /api/v1/reservations/3/assign` `{"storageUnitId":"KV-TB-A102"}` | ✅ "Gán kho và tạo hợp đồng thành công" |
| M4 | Hệ thống | Tự sinh hợp đồng | `GET /api/v1/contracts?reservationId=3` | ✅ `HD-477069`, ACTIVE, 2026-10-05 → 2027-01-05, cọc giữ 750.000 |
| M5 | Customer | Thấy đơn đã gán | `GET /api/v1/reservations/my?customerId=8` | ✅ UNIT_ASSIGNED, KV-TB-A102 |

Kiểm tra số tiền lần đầu: `750.000 × 3 = 2.250.000` − giảm 5% (112.500) + cọc 750.000 − voucher 100.000 = **2.787.500** ✅

### Case biên

| # | Case | Kết quả |
|---|------|---------|
| E1 | startDate ở quá khứ | ✅ 400 "Ngày bắt đầu không được ở quá khứ" |
| E2 | durationMonths = 0 | ✅ 400 "Thời gian thuê phải tối thiểu 1 tháng" |
| E3 | Thiếu customerId | ⚠️ 400 nhưng message lộ lỗi nội bộ: "The given id must not be null" |
| E4 | Đặt khi availableCount = 0 | ❌ Vẫn tạo được đơn (id=4) → overbooking |
| E5 | Gọi confirm-dev không qua SePay | ❌ Đơn thành DEPOSIT_PAID dù chưa trả tiền |
| E6 | available-units khi hết ô | ✅ trả `[]` |
| E7 | Gán ô của **cơ sở khác + loại khác** (`KV-BT-A101`, facility 2, Kho Tiêu Chuẩn) cho đơn facility 1, Kho Mini M | ❌ Thành công, sinh HĐ `HD-283709` sai |
| N1 | Gán lại đơn đã UNIT_ASSIGNED | ✅ 400 "...đã được gán ô" |
| N2 | Pending sau khi gán | ✅ `[]` |

## 2. Bug / rủi ro phát hiện

| ID | Mức | Vị trí | Mô tả |
|----|-----|--------|-------|
| B1 | Cao | `ReservationService.assignStorageUnit` | Không kiểm tra ô kho có cùng `facility` và `unitType` với đơn → gán được ô cơ sở khác/loại khác (E7). Cũng không kiểm tra manager có quản lý cơ sở đó. |
| B2 | Cao | `ReservationService.createReservation` | Không kiểm tra còn slot (physical AVAILABLE − đơn PENDING/DEPOSIT_PAID) → overbooking (E4). |
| B3 | Cao | `SepayPGController.confirmDevPayment` + `sepayService.js` | Endpoint dev cho phép đánh dấu đã trả tiền mà không qua cổng (E5). FE còn hard-code `X-Secret-Key` để tự gọi `/ipn`. |
| B4 | TB | `confirm-dev` + `ReservationConfirmationPage` (useEffect) | Gọi 2 lần liền → 2 dòng DEPOSIT cho cùng đơn (đơn #1: `DEV-TXN-1-…550` và `…558`, cách nhau 8ms). Không có chống trùng. |
| B5 | TB | FE `MyReservationsPage.jsx` (WIP) | Import component chưa tồn tại → cả FE build lỗi. |
| B6 | Thấp | `FacilityService.searchFacilities` | Phân trang theo facility nhưng kết quả là cặp (facility × unitType) → `size=3` trả 2 item, `totalElements` không khớp số item. |
| B7 | Thấp | `assignStorageUnit` | `rentalPolicyId` hard-code = 1; bảng `rental_policy` **không có seed** trong `sql_script/` (DB local có do tự thêm tay) → máy khác chạy script sạch sẽ lỗi FK khi gán. |
| B8 | Thấp | `assignStorageUnit` | `payment_transactions.contract_id` của giao dịch cọc không được cập nhật sau khi có HĐ. |
| B9 | Thấp | `createReservation` | Thiếu customerId → message lỗi kỹ thuật (E3); `customer` không kiểm tra role CUSTOMER / status ACTIVE. |

## 3. Dữ liệu sử dụng (theo entity, đầy đủ field)

### roles
| id | name | description |
|----|------|-------------|
| 1 | CUSTOMER | Khách hàng thuê kho |
| 3 | FACILITY_MANAGER | Quản lý cơ sở |

### users
| id | facility_id | role_id | email | password (plain) | full_name | phone | cccd | status |
|----|-------------|---------|-------|------------------|-----------|-------|------|--------|
| 8 | NULL | 1 (CUSTOMER) | khachhang@gmail.com | 123456 | Khách Hàng Test | 0900000000 | NULL | ACTIVE |
| 6 | 1 | 3 (FACILITY_MANAGER) | fm1@gmail.com | 123456 | Quản lý Tân Bình | 0901234567 | NULL | ACTIVE |

### facilities
| id | name | city | district | address | hotline | status |
|----|------|------|----------|---------|---------|--------|
| 1 | QueenKho Tân Bình | TP.HCM | Tân Bình | 142 Cộng Hòa, P.13 | 028-3811-0001 | ACTIVE |
| 2 | QueenKho Bình Thạnh | TP.HCM | Bình Thạnh | 456 Điện Biên Phủ, P.22 | 028-3811-0003 | ACTIVE |

### unit_types
| id | name | area_sqm | volume_cbm | base_price_monthly | suggested_capacity | dimensions | features |
|----|------|----------|------------|--------------------|--------------------|------------|----------|
| 1 | Kho Mini M | 3.50 | 8.40 | 750000.00 | 10–20 thùng carton | 1.5m × 2.3m × 2.4m | Cá nhân, đồ theo mùa |
| 2 | Kho Tiêu Chuẩn | 6.00 | 16.20 | 1850000.00 | 20–40 thùng, nội thất nhỏ | 2.5m × 2.4m × 2.7m | Phổ biến nhất, phù hợp chuyển nhà |
| 6 | Kho nhỏ 2m² | 2.00 | 4.80 | 500000.00 | 5–10 thùng carton | 1.0m × 2.0m × 2.4m | Cá nhân, sinh viên, giấy tờ |

### storage_units
| id | facility_id | unit_type_id | floor | zone | room_number | status trước → sau |
|----|-------------|--------------|-------|------|-------------|--------------------|
| KV-TB-A102 | 1 | 1 | 1 | A | 102 | AVAILABLE → **OCCUPIED** (happy path) |
| KV-BT-A101 | 2 | 2 | Tầng 1 | A | 101 | AVAILABLE → **OCCUPIED** (do bug E7) |

### rental_policy
| id | facility_id | policy_name | deposit_month_multiplier | cancel_fee_percent | cancel_free_hours | lock_account_days | late_fee_per_day | liquidation_days |
|----|-------------|-------------|--------------------------|--------------------|-------------------|-------------------|------------------|------------------|
| 1 | 1 | Default Policy | 1 | 0 | 0 | 0 | 0.00 | 0 |

### reservations (request + kết quả)
Request happy path: `{"customerId":8,"facilityId":1,"unitTypeId":1,"startDate":"2026-10-05","durationMonths":3}`

| id | reservation_code | customer_id | facility_id | unit_type_id | storage_unit_id | status | duration_months | deposit_amount | total_deposit_paid | expected_appointment_time | start_date | created_at |
|----|------------------|-------------|-------------|--------------|-----------------|--------|-----------------|----------------|--------------------|---------------------------|------------|------------|
| 3 | RES-411040 | 8 | 1 | 1 | KV-TB-A102 | UNIT_ASSIGNED | 3 | 750000.00 | 750000.00 | NULL | 2026-10-05 | 2026-10-02 08:28:25 |
| 4 | RES-500002 | 8 | 1 | 1 | KV-BT-A101 | UNIT_ASSIGNED | 1 | 750000.00 | 750000.00 | NULL | 2026-10-05 | 2026-10-02 08:28:46 |
| 5 | RES-476976 | 8 | 2 | 6 | NULL | PENDING | 2 | 500000.00 | 0.00 | NULL | 2026-10-05 | 2026-10-02 08:28:46 |

Trạng thái đơn #3: `PENDING` → `DEPOSIT_PAID` → `UNIT_ASSIGNED`.

### payment_transactions
| id | transaction_code | user_id | reservation_id | contract_id | payment_type | payment_method | amount | status | paid_at |
|----|------------------|---------|----------------|-------------|--------------|----------------|--------|--------|---------|
| 3 | DEV-TXN-3-1790904507091 | 8 | 3 | NULL | DEPOSIT | VIETQR | 2787500.00 | SUCCESS | 2026-10-02 08:28:27 |
| 4 | DEV-TXN-4-1790904526546 | 8 | 4 | NULL | DEPOSIT | VIETQR | 1400000.00 | SUCCESS | 2026-10-02 08:28:46 |

### rental_contracts
| id | contract_code | reservation_id | customer_id | storage_unit_id | rental_policy_id | status | start_date | end_date | billing_cycle_months | deposit_held_amount | access_pin_code | rfid_card_code |
|----|---------------|----------------|-------------|-----------------|------------------|--------|------------|----------|----------------------|---------------------|-----------------|----------------|
| 1 | HD-477069 | 3 | 8 | KV-TB-A102 | 1 | ACTIVE | 2026-10-05 | 2027-01-05 | 1 | 750000.00 | NULL | NULL |
| 2 | HD-283709 | 4 | 8 | KV-BT-A101 | 1 | ACTIVE | 2026-10-05 | 2026-11-05 | 1 | 750000.00 | NULL | NULL |

## 4. Dọn dữ liệu test (tuỳ chọn, chạy trên SSMS)

```sql
USE QueenKhoDB;
DELETE FROM rental_contracts     WHERE reservation_id IN (3,4,5);
DELETE FROM payment_transactions WHERE reservation_id IN (3,4,5);
DELETE FROM reservations         WHERE id IN (3,4,5);
UPDATE storage_units SET status = 'AVAILABLE' WHERE id IN ('KV-TB-A102','KV-BT-A101');
```

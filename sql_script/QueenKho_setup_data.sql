/* ============================================================
   QueenKho — SCRIPT SETUP DATA (SQL Server) — 06/11/2026
   Schema mới nhất (= QueenKho_TongHop.sql) + DỮ LIỆU NỀN xuất từ QueenKhoDB local của nhóm.

   GIỮ dữ liệu: roles, facilities, users, unit_types, goods_categories, central_warehouses, storage_units, facility_floors, floor_fixtures, rental_policy, vouchers.
   ĐỂ TRỐNG   : reservations, rental_contracts, payment_transactions, facility_tasks, handover_records, support_requests, compensation_claims, unit_sensor_readings, held_goods, notifications, activity_logs, login_history, damage_cases, unit_transfers.
     (damage_cases, unit_transfers trỏ tới hợp đồng / task nên cũng để trống.)
   Chỉnh lại sau khi bỏ dữ liệu giao dịch:
     - Ô kho OCCUPIED / RESERVED → AVAILABLE (không còn hợp đồng / đơn giữ ô); ô MAINTENANCE giữ nguyên.
     - vouchers.used_count = 0 (không còn đơn nào dùng voucher).
   Thêm kho lạnh / kho đông (D-16, = Update_kho_lanh.sql) nếu DB nguồn chưa có.

   ⚠️ XOÁ VÀ TẠO LẠI TOÀN BỘ QueenKhoDB — mất hết dữ liệu local (đơn, hợp đồng, task, thông báo...)
   Chạy 1 lần trên SSMS (F5) hoặc: sqlcmd -S localhost -U sa -P 12345 -C -I -f 65001 -i sql_script/QueenKho_setup_data.sql
   Chạy xong nhớ đăng xuất / đăng nhập lại trên FE.

   Tài khoản (mật khẩu giữ nguyên như DB nguồn; tài khoản seed là 123456):
     - CUSTOMER          e2e.khach@queenkho.local
     - CUSTOMER          nguyenduyhoang100406@gmail.com
     - CUSTOMER          nhieusiluan2006@gmail.com
     - STAFF             stafftanbinh1@gmail.com  (TB)
     - STAFF             stafftanbinh2@gmail.com  (TB)
     - STAFF             stafftanbinh3@gmail.com  (TB)
     - STAFF             staffbinhthanh1@gmail.com  (BT)
     - STAFF             staffbinhthanh2@gmail.com  (BT)
     - STAFF             staffbinhthanh3@gmail.com  (BT)
     - STAFF             staffthuduc1@gmail.com  (TD)
     - STAFF             staffthuduc2@gmail.com  (TD)
     - STAFF             staffthuduc3@gmail.com  (TD)
     - STAFF             staffgovap1@gmail.com  (GV)
     - STAFF             staffgovap2@gmail.com  (GV)
     - STAFF             staffgovap3@gmail.com  (GV)
     - STAFF             staffcaugiay1@gmail.com  (CG)
     - STAFF             staffcaugiay2@gmail.com  (CG)
     - STAFF             staffcaugiay3@gmail.com  (CG)
     - STAFF             staffquan71@gmail.com  (Q7)
     - STAFF             staffquan72@gmail.com  (Q7)
     - STAFF             staffquan73@gmail.com  (Q7)
     - FACILITY_MANAGER  fmtanbinh@gmail.com  (TB)
     - FACILITY_MANAGER  fmbinhthanh@gmail.com  (BT)
     - FACILITY_MANAGER  fmthuduc@gmail.com  (TD)
     - FACILITY_MANAGER  fmgovap@gmail.com  (GV)
     - FACILITY_MANAGER  fmcaugiay@gmail.com  (CG)
     - FACILITY_MANAGER  fmquan7@gmail.com  (Q7)
     - BOM               bom@queenkho.com
     - ADMIN             admin@queenkho.com
     - ADMIN             admin2@queenkho.com
     - ADMIN             system@queenkho.local  [DISABLED]
   ============================================================ */

USE master;
GO

IF DB_ID('QueenKhoDB') IS NOT NULL
BEGIN
    ALTER DATABASE QueenKhoDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE QueenKhoDB;
END
GO

CREATE DATABASE QueenKhoDB;
GO

USE QueenKhoDB;
GO

/* ============================================================
   PHẦN 1 — SCHEMA (thứ tự theo khoá ngoại: bảng cha trước)
   ============================================================ */

/* ---------- 1. roles ---------- */
CREATE TABLE roles (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    name            NVARCHAR(50)  NOT NULL UNIQUE,   -- CUSTOMER, STAFF, FACILITY_MANAGER, BOM, ADMIN
    description     NVARCHAR(255) NULL
);
GO

/* ---------- 2. facilities ---------- */
CREATE TABLE facilities (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    code            NVARCHAR(4)   NOT NULL UNIQUE,            -- Mã cơ sở (2-4 ký tự hoa, UC-04, PR-M1)
    name            NVARCHAR(150) NOT NULL,
    city            NVARCHAR(100) NOT NULL,
    district        NVARCHAR(100) NOT NULL,
    address         NVARCHAR(255) NOT NULL,
    hotline         NVARCHAR(20)  NULL,
    status          NVARCHAR(30)  NOT NULL DEFAULT 'ACTIVE'   -- ACTIVE / INACTIVE
);
GO

/* ---------- 3. users ---------- */
CREATE TABLE users (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    facility_id     INT NULL,             -- chỉ Facility Manager / Staff mới gán cơ sở
    role_id         INT NOT NULL,
    email           NVARCHAR(255) NOT NULL UNIQUE,
    password_hash   NVARCHAR(255) NOT NULL,
    full_name       NVARCHAR(100) NOT NULL,
    phone           NVARCHAR(20)  NOT NULL,
    cccd            NVARCHAR(20)  NULL,
    status          NVARCHAR(30)  NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE / LOCKED / DISABLED
    created_at      DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_users_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT FK_users_role     FOREIGN KEY (role_id)     REFERENCES roles(id)
);
GO
CREATE INDEX IX_users_facility ON users(facility_id);
CREATE INDEX IX_users_role     ON users(role_id);
GO

/* ---------- 4. unit_types ---------- */
CREATE TABLE unit_types (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    name                NVARCHAR(100)  NOT NULL,
    area_sqm            DECIMAL(8,2)   NOT NULL,
    volume_cbm          DECIMAL(8,2)   NOT NULL,
    base_price_monthly  DECIMAL(12,2)  NOT NULL,
    suggested_capacity  NVARCHAR(150)  NULL,
    dimensions          NVARCHAR(100)  NULL,
    features            NVARCHAR(500)  NULL,
    status              NVARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE / INACTIVE (UC-05, PR-M4)
    temperature_class   NVARCHAR(10)   NOT NULL DEFAULT 'NORMAL',  -- NORMAL / COLD (kho lạnh) / FROZEN (kho đông)
    CONSTRAINT UQ_unit_types_name UNIQUE (name),
    CONSTRAINT CK_unit_types_temperature CHECK (temperature_class IN ('NORMAL', 'COLD', 'FROZEN'))                    -- PR-M3
);
GO

/* ---------- 4b. goods_categories (BR-131: loại hàng khách khai báo khi đặt kho, BOM quản lý) ---------- */
CREATE TABLE goods_categories (
    id                    INT IDENTITY(1,1) PRIMARY KEY,
    code                  NVARCHAR(30)  NOT NULL UNIQUE,
    name                  NVARCHAR(100) NOT NULL,
    description           NVARCHAR(300) NULL,
    requires_cold_storage BIT NOT NULL DEFAULT 0,          -- chỉ gửi được ở kho lạnh / kho đông (vd thực phẩm)
    requires_note         BIT NOT NULL DEFAULT 0,          -- bắt buộc mô tả thêm (vd "Khác")
    sort_order            INT NOT NULL DEFAULT 0,
    status                NVARCHAR(20)  NOT NULL DEFAULT 'ACTIVE', -- ACTIVE / INACTIVE
    created_at            DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO
INSERT INTO goods_categories (code, name, description, requires_cold_storage, requires_note, sort_order) VALUES
(N'HOUSEHOLD',  N'Gia dụng',        N'Đồ dùng gia đình, dụng cụ nhà bếp, thiết bị nhỏ', 0, 0, 1),
(N'STATIONERY', N'Văn phòng phẩm',  N'Giấy tờ, hồ sơ, sách vở, dụng cụ văn phòng',     0, 0, 2),
(N'FOOD',       N'Thực phẩm',       N'Chỉ gửi ở kho lạnh hoặc kho đông',                1, 0, 3),
(N'CLOTHING',   N'Quần áo',         N'Quần áo, chăn màn, giày dép',                      0, 0, 4),
(N'FURNITURE',  N'Nội thất',        N'Bàn ghế, tủ, giường, đồ gỗ',                       0, 0, 5),
(N'ELECTRONICS',N'Điện tử',         N'Thiết bị điện, điện tử, máy tính',                 0, 0, 6),
(N'OTHER',      N'Khác',            N'Ghi rõ loại hàng',                                 0, 1, 7);
GO

/* ---------- 4c. central_warehouses (BR-134: kho tổng giữ hàng của khách quá hạn — không bán) ---------- */
CREATE TABLE central_warehouses (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    name       NVARCHAR(150) NOT NULL,
    address    NVARCHAR(300) NOT NULL,
    hotline    NVARCHAR(20)  NULL,
    note       NVARCHAR(500) NULL,
    status     NVARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE / INACTIVE
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO
INSERT INTO central_warehouses (name, address, hotline, note) VALUES
(N'Kho tổng QueenKho', N'Lô C3, KCN Tân Bình, P. Tây Thạnh, Q. Tân Phú, TP.HCM', N'0281234567',
 N'Giữ hàng của khách quá hạn hợp đồng — không bán, khách đến nhận lại sau khi thanh toán');
GO

/* ---------- 5. storage_units ---------- */
-- id là mã ô kho dạng chuỗi (vd: "KV-TB-A101"), không dùng IDENTITY
CREATE TABLE storage_units (
    id              NVARCHAR(20) PRIMARY KEY,
    facility_id     INT NOT NULL,
    unit_type_id    INT NOT NULL,
    floor           NVARCHAR(20) NULL,
    zone            NVARCHAR(20) NULL,
    room_number     NVARCHAR(20) NULL,
    status          NVARCHAR(30) NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE / RESERVED / OCCUPIED / MAINTENANCE
    -- UC-06 mặt bằng: vị trí + kích thước theo ô lưới (1 ô = 0.5m), NULL = chưa đặt trên mặt bằng
    map_x           INT NULL,
    map_y           INT NULL,
    map_w           INT NULL,
    map_h           INT NULL,
    map_door        NVARCHAR(10) NULL,                         -- phía cửa: TOP / BOTTOM / LEFT / RIGHT
    maintenance_note  NVARCHAR(500) NULL,                      -- lý do FM chuyển ô sang MAINTENANCE (xoá khi mở lại)
    maintenance_since DATETIME2 NULL,
    CONSTRAINT FK_storageunits_facility FOREIGN KEY (facility_id)  REFERENCES facilities(id),
    CONSTRAINT FK_storageunits_unittype FOREIGN KEY (unit_type_id) REFERENCES unit_types(id),
    CONSTRAINT CK_storageunits_map CHECK (
        (map_x IS NULL AND map_y IS NULL AND map_w IS NULL AND map_h IS NULL)
        OR (map_x >= 0 AND map_y >= 0 AND map_w > 0 AND map_h > 0)),
    CONSTRAINT CK_storageunits_mapdoor CHECK (map_door IS NULL OR map_door IN ('TOP', 'BOTTOM', 'LEFT', 'RIGHT'))
);
GO
CREATE INDEX IX_storageunits_facility ON storage_units(facility_id);
CREATE INDEX IX_storageunits_unittype ON storage_units(unit_type_id);
GO

/* ---------- 5b. facility_floors (UC-06: mặt bằng từng tầng, tên khớp storage_units.floor) ---------- */
CREATE TABLE facility_floors (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    facility_id     INT NOT NULL,
    name            NVARCHAR(20) NOT NULL,
    grid_width      INT NOT NULL DEFAULT 56,   -- số ô lưới ngang (56 = 28m)
    grid_height     INT NOT NULL DEFAULT 40,   -- số ô lưới dọc  (40 = 20m)
    sort_order      INT NOT NULL DEFAULT 0,
    CONSTRAINT FK_facilityfloors_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT UQ_facilityfloors_name UNIQUE (facility_id, name),
    CONSTRAINT CK_facilityfloors_grid CHECK (grid_width BETWEEN 10 AND 200 AND grid_height BETWEEN 10 AND 200)
);
GO

/* ---------- 5c. floor_fixtures (UC-06: lối đi, cửa, thang, văn phòng trên mặt bằng) ---------- */
CREATE TABLE floor_fixtures (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    floor_id        INT NOT NULL,
    fixture_type    NVARCHAR(20) NOT NULL,     -- AISLE / ENTRANCE / STAIRS / ELEVATOR / OFFICE
    label           NVARCHAR(50) NULL,
    map_x           INT NOT NULL,
    map_y           INT NOT NULL,
    map_w           INT NOT NULL,
    map_h           INT NOT NULL,
    CONSTRAINT FK_floorfixtures_floor FOREIGN KEY (floor_id) REFERENCES facility_floors(id) ON DELETE CASCADE,
    CONSTRAINT CK_floorfixtures_type CHECK (fixture_type IN ('AISLE', 'ENTRANCE', 'STAIRS', 'ELEVATOR', 'OFFICE')),
    CONSTRAINT CK_floorfixtures_rect CHECK (map_x >= 0 AND map_y >= 0 AND map_w > 0 AND map_h > 0)
);
GO
CREATE INDEX IX_floorfixtures_floor ON floor_fixtures(floor_id);
GO

/* ---------- 6. rental_policy ---------- */
CREATE TABLE rental_policy (
    id                          INT IDENTITY(1,1) PRIMARY KEY,
    facility_id                 INT NOT NULL,
    policy_name                 NVARCHAR(150) NOT NULL,
    deposit_month_multiplier    INT NOT NULL DEFAULT 1,
    cancel_fee_percent          INT NOT NULL DEFAULT 50,
    cancel_free_hours           INT NOT NULL DEFAULT 24,
    late_fee_percent_per_day    INT NOT NULL DEFAULT 10,
    late_fee_max_percent        INT NOT NULL DEFAULT 50,
    liquidation_days            INT NOT NULL DEFAULT 15,   -- PR-Q8 (27/10/2026): quá hạn quá 15 ngày thì FM được thanh lý (bản cũ 30)
    booking_discount_3m        INT NOT NULL DEFAULT 5,    -- % ưu đãi gói đặt mới 3/6/12 tháng (Flow 4)
    booking_discount_6m         INT NOT NULL DEFAULT 10,
    booking_discount_12m        INT NOT NULL DEFAULT 15,
    renewal_discount_3m         INT NOT NULL DEFAULT 0,    -- % ưu đãi gói gia hạn 3/6/12 tháng
    renewal_discount_6m         INT NOT NULL DEFAULT 5,
    renewal_discount_12m        INT NOT NULL DEFAULT 10,
    allow_late_fee_waiver       BIT NOT NULL DEFAULT 1,    -- FM được miễn phí trễ cho khách
    overstay_percent            INT NOT NULL DEFAULT 150,  -- PR-Q14: phí chiếm dụng mỗi ngày quá hạn = giá ngày × % (không trần)
    held_goods_fee_percent      INT NOT NULL DEFAULT 20,   -- PR-Q15: phí lưu giữ hàng sau thanh lý mỗi ngày = giá ngày × %
    goods_moving_fee_percent    INT NOT NULL DEFAULT 30,   -- PR-Q16: phí dọn & di dời hàng khi thanh lý = giá tháng × % (1 lần)
    version                    INT NOT NULL DEFAULT 1,
    is_active                   BIT NOT NULL DEFAULT 0,
    created_at                  DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    created_by_user_id          INT NULL,
    CONSTRAINT UQ_rentalpolicy_facility_version UNIQUE (facility_id, version),
    CONSTRAINT CK_rentalpolicy_values CHECK (deposit_month_multiplier BETWEEN 1 AND 3 AND cancel_fee_percent BETWEEN 0 AND 100 AND cancel_free_hours >= 0 AND late_fee_percent_per_day BETWEEN 0 AND 100 AND late_fee_max_percent BETWEEN late_fee_percent_per_day AND 100 AND liquidation_days >= 1),
    CONSTRAINT CK_rentalpolicy_discounts CHECK (booking_discount_3m BETWEEN 0 AND 50 AND booking_discount_6m BETWEEN 0 AND 50 AND booking_discount_12m BETWEEN 0 AND 50 AND renewal_discount_3m BETWEEN 0 AND 50 AND renewal_discount_6m BETWEEN 0 AND 50 AND renewal_discount_12m BETWEEN 0 AND 50),
    CONSTRAINT CK_rentalpolicy_overstay CHECK (overstay_percent BETWEEN 100 AND 300 AND held_goods_fee_percent BETWEEN 0 AND 100 AND goods_moving_fee_percent BETWEEN 0 AND 100),
    CONSTRAINT FK_rentalpolicy_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id),
    CONSTRAINT FK_rentalpolicy_facility FOREIGN KEY (facility_id) REFERENCES facilities(id)
);
GO
CREATE INDEX IX_rentalpolicy_facility ON rental_policy(facility_id);
GO
SET QUOTED_IDENTIFIER ON;
GO
CREATE UNIQUE INDEX UX_rentalpolicy_active_facility ON rental_policy(facility_id) WHERE is_active = 1;
GO

/* ---------- 6b. vouchers (BR-25: voucher đặt kho do BOM quản lý; NEWKHO là mã mặc định) ---------- */
CREATE TABLE vouchers (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    code            NVARCHAR(30)  NOT NULL UNIQUE,   -- luôn viết HOA
    name            NVARCHAR(150) NOT NULL,
    discount_type   NVARCHAR(10)  NOT NULL,          -- FIXED (số tiền) / PERCENT (% tiền thuê)
    discount_value  DECIMAL(12,2) NOT NULL,
    max_discount    DECIMAL(12,2) NULL,              -- trần giảm cho PERCENT (NULL = không trần)
    min_months      INT NOT NULL DEFAULT 1,          -- gói thuê tối thiểu được áp
    facility_id     INT NULL,                        -- NULL = mọi cơ sở
    unit_type_id    INT NULL,                        -- NULL = mọi loại kho (05/11/2026)
    start_at        DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    end_at          DATETIME2 NULL,                  -- NULL = không hết hạn
    usage_limit     INT NULL,                        -- tổng lượt (NULL = không giới hạn)
    per_user_limit  INT NULL,                        -- lượt / khách (NULL = không giới hạn)
    used_count      INT NOT NULL DEFAULT 0,          -- cộng khi VNPAY báo cọc thành công
    is_default      BIT NOT NULL DEFAULT 0,          -- tự áp khi khách không nhập mã (NEWKHO)
    status          NVARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE / INACTIVE
    created_by      INT NULL,
    created_at      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_vouchers_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT FK_vouchers_unit_type FOREIGN KEY (unit_type_id) REFERENCES unit_types(id),
    CONSTRAINT FK_vouchers_creator  FOREIGN KEY (created_by)  REFERENCES users(id),
    CONSTRAINT CK_vouchers_type     CHECK (discount_type IN ('FIXED', 'PERCENT')),
    CONSTRAINT CK_vouchers_status   CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT CK_vouchers_value    CHECK (discount_value > 0 AND (discount_type <> 'PERCENT' OR discount_value <= 100)),
    CONSTRAINT CK_vouchers_months   CHECK (min_months IN (1, 3, 6, 12))
);
GO

/* ---------- 7. reservations ---------- */
CREATE TABLE reservations (
    id                          INT IDENTITY(1,1) PRIMARY KEY,
    reservation_code            NVARCHAR(50) NOT NULL UNIQUE,
    customer_id                 INT NOT NULL,
    facility_id                 INT NOT NULL,
    unit_type_id                INT NOT NULL,
    storage_unit_id             NVARCHAR(20) NULL,   -- FM gán ô sau khi duyệt (UC-14)
    status                      NVARCHAR(30) NOT NULL DEFAULT 'PENDING',
                                -- PENDING / DEPOSIT_PAID / UNIT_ASSIGNED / CANCELLED / EXPIRED / COMPLETED
    duration_months             INT NOT NULL,
    deposit_amount              DECIMAL(12,2) NOT NULL,
    total_deposit_paid          DECIMAL(12,2) NOT NULL DEFAULT 0,
    expected_appointment_time   DATETIME2 NULL,
    start_date                  DATE NULL,
    rent_discount_percent       INT NULL,            -- % ưu đãi tiền thuê chốt lúc tạo đơn (giống deposit_amount)
    terms_version               NVARCHAR(20) NULL,   -- Phiên bản điều khoản xử lý tài sản khách đã đồng ý (NULL = đơn cũ, chưa đồng ý)
    terms_accepted_at           DATETIME2 NULL,      -- Thời điểm khách tick đồng ý điều khoản khi đặt kho
    insurance_plan              NVARCHAR(20) NOT NULL DEFAULT 'BASIC', -- BR-125: BASIC / ADVANCED / PREMIUM
    insurance_premium_monthly   DECIMAL(15,2) NOT NULL DEFAULT 0,       -- phí bảo hiểm / tháng chốt lúc đặt
    declared_goods_value        DECIMAL(15,2) NULL,                     -- giá trị hàng khách khai báo (trần bồi thường)
    goods_category_codes        NVARCHAR(300) NULL,                     -- BR-131: mã loại hàng khai báo, ngăn bởi dấu phẩy
    goods_description           NVARCHAR(500) NULL,                     -- mô tả hàng (bắt buộc khi chọn \"Khác\")
    voucher_id                  INT NULL,            -- BR-25: voucher áp cho đơn (chốt lúc tạo đơn)
    voucher_code                NVARCHAR(30) NULL,
    voucher_discount            DECIMAL(12,2) NULL,  -- số tiền giảm đã chốt (NULL = đơn cũ, BE coi như NEWKHO 100.000đ)
    created_at                  DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_reservations_customer    FOREIGN KEY (customer_id)     REFERENCES users(id),
    CONSTRAINT FK_reservations_facility    FOREIGN KEY (facility_id)     REFERENCES facilities(id),
    CONSTRAINT FK_reservations_unittype    FOREIGN KEY (unit_type_id)    REFERENCES unit_types(id),
    CONSTRAINT FK_reservations_storageunit FOREIGN KEY (storage_unit_id) REFERENCES storage_units(id),
    CONSTRAINT FK_reservations_voucher     FOREIGN KEY (voucher_id)      REFERENCES vouchers(id)
);
GO
CREATE INDEX IX_reservations_customer    ON reservations(customer_id);
CREATE INDEX IX_reservations_facility    ON reservations(facility_id);
CREATE INDEX IX_reservations_storageunit ON reservations(storage_unit_id);
GO

/* ---------- 8. rental_contracts ---------- */
CREATE TABLE rental_contracts (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    contract_code           NVARCHAR(50) NOT NULL UNIQUE,
    reservation_id          INT NOT NULL,
    customer_id             INT NOT NULL,
    storage_unit_id         NVARCHAR(20) NOT NULL,
    rental_policy_id        INT NOT NULL,
    status                  NVARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
                            -- PENDING_CHECK_IN / ACTIVE / OVERDUE / TERMINATION_PENDING / TERMINATED / LIQUIDATED
    start_date              DATE NOT NULL,
    end_date                DATE NULL,
    billing_cycle_months    INT NOT NULL DEFAULT 1,
    deposit_held_amount     DECIMAL(12,2) NOT NULL DEFAULT 0,
    access_pin_code         NVARCHAR(20) NULL,
    rfid_card_code          NVARCHAR(50) NULL,
    late_fee_waived         BIT NOT NULL DEFAULT 0,       -- FM miễn phí trễ cho đợt quá hạn hiện tại
    late_fee_waiver_note    NVARCHAR(500) NULL,
    fault_termination       BIT NOT NULL DEFAULT 0,      -- BR-127: chấm dứt do lỗi cơ sở (không phí phá HĐ)
    CONSTRAINT FK_contracts_reservation FOREIGN KEY (reservation_id)   REFERENCES reservations(id),
    CONSTRAINT FK_contracts_customer    FOREIGN KEY (customer_id)      REFERENCES users(id),
    CONSTRAINT FK_contracts_storageunit FOREIGN KEY (storage_unit_id)  REFERENCES storage_units(id),
    CONSTRAINT FK_contracts_policy      FOREIGN KEY (rental_policy_id) REFERENCES rental_policy(id)
);
GO
CREATE INDEX IX_contracts_customer    ON rental_contracts(customer_id);
CREATE INDEX IX_contracts_storageunit ON rental_contracts(storage_unit_id);
GO

/* ---------- 9. payment_transactions ---------- */
CREATE TABLE payment_transactions (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    transaction_code    NVARCHAR(50) NOT NULL UNIQUE,
    user_id             INT NOT NULL,
    reservation_id      INT NULL,        -- đặt cọc gắn với reservation
    contract_id         INT NULL,        -- tiền thuê / gia hạn gắn với contract
    payment_type        NVARCHAR(30) NOT NULL,   -- DEPOSIT / MONTHLY_RENT / REFUND / LATE_FEE / DAMAGE_FEE / OVERSTAY_FEE (phí chiếm dụng + phí lưu giữ hàng + phí di dời MV-) / COMPENSATION (cơ sở bồi thường cho khách)
    payment_method      NVARCHAR(30) NOT NULL,   -- VNPAY / MOMO / BANK_TRANSFER / CASH
    amount              DECIMAL(12,2) NOT NULL,
    renewal_months      INT NULL,                -- gói gia hạn 1 / 3 / 6 / 12 tháng; không suy ra từ transaction_code
    status              NVARCHAR(30) NOT NULL DEFAULT 'PENDING', -- PENDING / SUCCESS / FAILED / REFUNDED
    paid_at             DATETIME2 NULL,
    bank_transaction_code NVARCHAR(100) NULL,    -- Mã giao dịch từ ngân hàng (FT... hoặc vnp_BankTranNo / vnp_TransactionNo) — Update_payment_bank_transaction_code.sql
    CONSTRAINT FK_payments_user        FOREIGN KEY (user_id)        REFERENCES users(id),
    CONSTRAINT FK_payments_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id),
    CONSTRAINT FK_payments_contract    FOREIGN KEY (contract_id)    REFERENCES rental_contracts(id),
    CONSTRAINT CK_payments_renewal_months CHECK (renewal_months IS NULL OR renewal_months IN (1, 3, 6, 12))
);
GO
CREATE INDEX IX_payments_user        ON payment_transactions(user_id);
CREATE INDEX IX_payments_reservation ON payment_transactions(reservation_id);
CREATE INDEX IX_payments_contract    ON payment_transactions(contract_id);
CREATE UNIQUE INDEX UX_payments_pending_deposit
    ON payment_transactions(reservation_id)
    WHERE payment_type = 'DEPOSIT' AND payment_method = 'VNPAY' AND status = 'PENDING';
CREATE UNIQUE INDEX UX_payments_pending_renewal
    ON payment_transactions(contract_id)
    WHERE payment_type = 'MONTHLY_RENT' AND payment_method = 'VNPAY' AND status = 'PENDING';
GO

/* ---------- 10. handover_records ---------- */
CREATE TABLE handover_records (
    id                              INT IDENTITY(1,1) PRIMARY KEY,
    contract_id                     INT NOT NULL,
    staff_id                        INT NULL,                  -- NULL = khách tự check-in online (BR-124)
    record_type                     NVARCHAR(30) NOT NULL,  -- CHECK_IN / CHECK_OUT
    is_identity_verified            BIT NOT NULL DEFAULT 0,
    is_empty                        BIT NOT NULL DEFAULT 1,
    is_clean                        BIT NOT NULL DEFAULT 1,
    is_lock_intact                  BIT NOT NULL DEFAULT 1,
    customer_signature_confirmed    BIT NOT NULL DEFAULT 0,
    is_prohibited_goods_committed   BIT NOT NULL DEFAULT 0,  -- PR-C7 / BR-132: đã kiểm tra hàng khớp khai báo, không có hàng cấm
    notes                           NVARCHAR(MAX) NULL,
    evidence_image_urls             NVARCHAR(MAX) NULL,     -- BR-121: ảnh hiện trạng ô lúc bàn giao, ngăn bởi |||
    check_in_method                 NVARCHAR(10) NOT NULL DEFAULT 'COUNTER', -- BR-124: COUNTER (Staff) / ONLINE (khách)
    created_at                      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_handover_contract FOREIGN KEY (contract_id) REFERENCES rental_contracts(id),
    CONSTRAINT FK_handover_staff    FOREIGN KEY (staff_id)    REFERENCES users(id)
);
GO
CREATE INDEX IX_handover_contract ON handover_records(contract_id);
GO

/* ---------- 10b. unit_transfers (BR-122: FM chuyển hợp đồng sang ô khác) ---------- */
CREATE TABLE unit_transfers (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    contract_id     INT NOT NULL,
    from_unit_id    NVARCHAR(20) NOT NULL,
    to_unit_id      NVARCHAR(20) NOT NULL,
    reason_type     NVARCHAR(20) NOT NULL,       -- FACILITY_ISSUE / CUSTOMER_REQUEST / REARRANGE
    reason          NVARCHAR(500) NOT NULL,
    old_unit_status NVARCHAR(20) NOT NULL,       -- ô cũ sau khi chuyển: AVAILABLE / MAINTENANCE
    moved_by        INT NOT NULL,
    created_at      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_unit_transfers_contract FOREIGN KEY (contract_id) REFERENCES rental_contracts(id),
    CONSTRAINT FK_unit_transfers_from     FOREIGN KEY (from_unit_id) REFERENCES storage_units(id),
    CONSTRAINT FK_unit_transfers_to       FOREIGN KEY (to_unit_id)   REFERENCES storage_units(id),
    CONSTRAINT FK_unit_transfers_user     FOREIGN KEY (moved_by)     REFERENCES users(id),
    CONSTRAINT CK_unit_transfers_reason CHECK (reason_type IN ('FACILITY_ISSUE', 'CUSTOMER_REQUEST', 'REARRANGE'))
);
GO
CREATE INDEX IX_unit_transfers_contract ON unit_transfers(contract_id);
GO

/* ---------- 11. support_requests ---------- */
CREATE TABLE support_requests (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    ticket_code     NVARCHAR(50) NOT NULL UNIQUE,
    contract_id     INT NULL,
    customer_id     INT NOT NULL,
    issue_type      NVARCHAR(50) NOT NULL,
    description     NVARCHAR(MAX) NULL,
    status          NVARCHAR(30) NOT NULL DEFAULT 'OPEN',  -- OPEN / IN_PROGRESS / RESOLVED / CLOSED
    resolution_note NVARCHAR(1000) NULL,
    resolved_at     DATETIME2 NULL,
    closed_at       DATETIME2 NULL,
    created_at      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_support_contract FOREIGN KEY (contract_id) REFERENCES rental_contracts(id),
    CONSTRAINT FK_support_customer FOREIGN KEY (customer_id) REFERENCES users(id)
);
GO
CREATE INDEX IX_support_customer ON support_requests(customer_id);
GO

/* ---------- 11a. compensation_claims (BR-126 → BR-128: bồi thường hàng hư / mất) ---------- */
CREATE TABLE compensation_claims (
    id                   INT IDENTITY(1,1) PRIMARY KEY,
    claim_code           NVARCHAR(20)   NOT NULL UNIQUE,            -- BT-xxxxxx
    support_request_id   INT            NOT NULL UNIQUE,            -- ticket hỗ trợ GOODS_DAMAGE / GOODS_LOSS
    contract_id          INT            NOT NULL,
    customer_id          INT            NOT NULL,
    facility_id          INT            NOT NULL,
    claim_type           NVARCHAR(20)   NOT NULL,                   -- GOODS_DAMAGE / GOODS_LOSS
    incident_date        DATE           NULL,
    items_description    NVARCHAR(2000) NOT NULL,
    claimed_amount       DECIMAL(15, 2) NOT NULL,
    customer_images      NVARCHAR(MAX)  NULL,
    status               NVARCHAR(20)   NOT NULL DEFAULT 'SUBMITTED', -- SUBMITTED / INSPECTED / APPROVED / PAID / REJECTED / WITHDRAWN
    inspected_by         INT            NULL,
    inspected_at         DATETIME2      NULL,
    inspection_note      NVARCHAR(1000) NULL,
    inspection_images    NVARCHAR(MAX)  NULL,
    preliminary_cause    NVARCHAR(20)   NULL,                       -- CUSTOMER / FACILITY / FORCE_MAJEURE / UNKNOWN
    liable_party         NVARCHAR(20)   NULL,                       -- CUSTOMER / FACILITY / FORCE_MAJEURE
    assessed_value       DECIMAL(15, 2) NULL,
    damage_percent       INT            NULL,
    unusable_days        INT            NULL,
    coverage_cap         DECIMAL(15, 2) NULL,
    goods_compensation   DECIMAL(15, 2) NULL,
    penalty_amount       DECIMAL(15, 2) NULL,
    rent_refund_amount   DECIMAL(15, 2) NULL,
    total_compensation   DECIMAL(15, 2) NULL,
    resolution           NVARCHAR(20)   NULL,                       -- CONTINUE / TERMINATE
    decision_note        NVARCHAR(1000) NULL,
    decided_by           INT            NULL,
    decided_at           DATETIME2      NULL,
    payment_method       NVARCHAR(20)   NULL,
    payment_evidence     NVARCHAR(MAX)  NULL,
    bank_transaction_code NVARCHAR(100) NULL,
    paid_by              INT            NULL,
    paid_at              DATETIME2      NULL,
    insurance_status     NVARCHAR(20)   NULL,                       -- NOT_APPLICABLE / SUBMITTED / APPROVED / PAID / REJECTED
    insurance_ref        NVARCHAR(50)   NULL,
    insurance_amount     DECIMAL(15, 2) NULL,
    insurance_updated_at DATETIME2      NULL,
    created_at           DATETIME2      NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_claims_ticket   FOREIGN KEY (support_request_id) REFERENCES support_requests(id),
    CONSTRAINT FK_claims_contract FOREIGN KEY (contract_id)        REFERENCES rental_contracts(id),
    CONSTRAINT FK_claims_customer FOREIGN KEY (customer_id)        REFERENCES users(id),
    CONSTRAINT FK_claims_facility FOREIGN KEY (facility_id)        REFERENCES facilities(id),
    CONSTRAINT FK_claims_inspector FOREIGN KEY (inspected_by)      REFERENCES users(id),
    CONSTRAINT FK_claims_decider  FOREIGN KEY (decided_by)         REFERENCES users(id),
    CONSTRAINT FK_claims_payer    FOREIGN KEY (paid_by)            REFERENCES users(id),
    CONSTRAINT CK_claims_type     CHECK (claim_type IN ('GOODS_DAMAGE', 'GOODS_LOSS')),
    CONSTRAINT CK_claims_status   CHECK (status IN ('SUBMITTED', 'INSPECTED', 'APPROVED', 'PAID', 'REJECTED', 'WITHDRAWN'))
);
GO
CREATE INDEX IX_claims_facility_status ON compensation_claims(facility_id, status);
CREATE INDEX IX_claims_contract ON compensation_claims(contract_id);
GO

/* ---------- 11c. unit_sensor_readings (BR-129: nhiệt độ / độ ẩm từng ô — IoT mô phỏng) ---------- */
CREATE TABLE unit_sensor_readings (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    storage_unit_id NVARCHAR(20)  NOT NULL,
    temperature     DECIMAL(5, 2) NOT NULL,
    humidity        DECIMAL(5, 2) NOT NULL,
    is_alert        BIT           NOT NULL DEFAULT 0,
    recorded_at     DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_sensor_unit FOREIGN KEY (storage_unit_id) REFERENCES storage_units(id)
);
GO
CREATE INDEX IX_sensor_unit_time ON unit_sensor_readings(storage_unit_id, recorded_at DESC);
GO

/* ---------- 12. facility_tasks (UC-16, UC-17, UC-18, REFUND) ----------
   Bảng công việc tại cơ sở, sinh tự động:
   - CHECK_IN : khi Manager gán ô (UC-14)
   - CHECK_OUT: khi khách yêu cầu trả kho (UC-22)
   - REFUND   : khi khách hủy đơn cọc (UC-15) - Manager thực hiện hoàn cọc
   - SUPPORT  : khi khách gửi yêu cầu hỗ trợ (làm sau)
   - MAINTENANCE: bảo trì ô kho */
CREATE TABLE facility_tasks (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    facility_id         INT NOT NULL,
    task_type           NVARCHAR(50) NOT NULL,                -- CHECK_IN, CHECK_OUT, SUPPORT, REFUND, MAINTENANCE
    contract_id         INT NULL,                             -- bắt buộc với CHECK_IN / CHECK_OUT
    support_request_id  INT NULL,                             -- bắt buộc với SUPPORT
    status              NVARCHAR(30) NOT NULL DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, OVERDUE, COMPLETED, CANCELLED
    staff_id            INT NULL,                             -- ID người phụ trách (Staff hoặc Facility Manager)
    due_at              DATETIME2 NOT NULL,                   -- deadline hoàn thành
    evidence_image_url  NVARCHAR(MAX) NULL,
    maintenance_reason  NVARCHAR(20) NULL,
    note                NVARCHAR(1000) NULL,                  -- chi tiết STK, thông tin hoàn cọc
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    claimed_at          DATETIME2 NULL,
    completed_at        DATETIME2 NULL,
    CONSTRAINT FK_facilitytasks_facility FOREIGN KEY (facility_id)        REFERENCES facilities(id),
    CONSTRAINT FK_facilitytasks_contract FOREIGN KEY (contract_id)        REFERENCES rental_contracts(id),
    CONSTRAINT FK_facilitytasks_support  FOREIGN KEY (support_request_id) REFERENCES support_requests(id),
    CONSTRAINT FK_facilitytasks_user     FOREIGN KEY (staff_id)           REFERENCES users(id),
    CONSTRAINT CK_facilitytasks_type     CHECK (task_type IN ('CHECK_IN', 'CHECK_OUT', 'SUPPORT', 'REFUND', 'MAINTENANCE')),
    CONSTRAINT CK_facilitytasks_status   CHECK (status IN ('OPEN', 'IN_PROGRESS', 'OVERDUE', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT CK_facilitytasks_target   CHECK (
        (task_type IN ('CHECK_IN', 'CHECK_OUT') AND contract_id IS NOT NULL)
        OR (task_type = 'SUPPORT' AND support_request_id IS NOT NULL)
        OR (task_type IN ('REFUND', 'MAINTENANCE'))
    )
);
GO
CREATE INDEX IX_facilitytasks_facility_status ON facility_tasks(facility_id, status);
CREATE INDEX IX_facilitytasks_contract        ON facility_tasks(contract_id);
CREATE INDEX IX_facilitytasks_staff           ON facility_tasks(staff_id);
GO

/* ---------- 12b. damage_cases (UC-23, UC-24) ---------- */
CREATE TABLE damage_cases (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    contract_id         INT NOT NULL,
    task_id             INT NOT NULL,                             -- ID task CHECK_OUT ở facility_tasks
    title               NVARCHAR(150) NOT NULL,                   -- Ví dụ: 'Vệ sinh rác', 'Hỏng khóa', 'Vỡ vách ngăn'
    description         NVARCHAR(1000) NULL,                      -- Mô tả chi tiết mức độ hư hại
    estimated_cost      DECIMAL(12,2) NOT NULL DEFAULT 0,         -- Chi phí đền bù (>= 0)
    liable_party        NVARCHAR(20) NOT NULL DEFAULT 'CUSTOMER', -- CUSTOMER: lỗi khách, trừ cọc / FACILITY: lỗi cơ sở, không tính khách
    evidence_image_urls NVARCHAR(MAX) NULL,                       -- Danh sách link ảnh (JSON array hoặc dấu phẩy phân tách)
    created_at          DATETIME2(7) NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_damagecases_contract FOREIGN KEY (contract_id) REFERENCES rental_contracts(id),
    CONSTRAINT FK_damagecases_task     FOREIGN KEY (task_id) REFERENCES facility_tasks(id),
    CONSTRAINT CK_damagecases_liable   CHECK (liable_party IN ('CUSTOMER', 'FACILITY'))
);
GO
CREATE INDEX IX_damagecases_contract ON damage_cases(contract_id);
CREATE INDEX IX_damagecases_task ON damage_cases(task_id);
GO

/* ---------- 12b. held_goods (PR-Q10: hàng của khách lưu giữ sau thanh lý) ----------
   Tạo khi Staff / FM bấm "Dọn xong" task dọn kho sau thanh lý (kèm biên bản kiểm kê).
   HOLDING 60 ngày → RETURNED / SOLD / DESTROYED / HANDED_TO_AUTHORITY. */
CREATE TABLE held_goods (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    contract_id         INT NOT NULL,
    facility_id         INT NOT NULL,
    task_id             INT NULL,                                 -- task MAINTENANCE dọn kho đã tạo bản ghi
    inventory_note      NVARCHAR(2000) NOT NULL,                  -- Danh sách hàng kiểm kê
    evidence_image_urls NVARCHAR(MAX) NULL,                       -- Ảnh kiểm kê (link, phân tách bằng |||)
    witness_note        NVARCHAR(500) NOT NULL,                   -- Người mở kho / chứng kiến
    storage_location    NVARCHAR(100) NOT NULL,                   -- Khu lưu giữ (VD: Kho K2 - kệ 3)
    central_warehouse_id INT NULL,                             -- BR-134: kho tổng đang giữ hàng
    status              NVARCHAR(30) NOT NULL DEFAULT 'HOLDING',
    hold_until          DATE NOT NULL,                            -- Hết hạn lưu giữ (ngày thanh lý + 60)
    proceeds_amount     DECIMAL(12,2) NULL,                       -- Tiền bán thanh lý (SOLD)
    debt_offset_amount  DECIMAL(12,2) NULL,                       -- Phần tiền bán dùng trừ nợ của khách
    refund_amount       DECIMAL(12,2) NULL,                       -- Phần hoàn khách (dư tiền bán + cọc còn giữ)
    storage_fee_amount  DECIMAL(12,2) NULL,                       -- PR-Q15: phí lưu giữ hàng đã tính khi chốt hồ sơ
    resolved_note       NVARCHAR(1000) NULL,
    resolved_by         INT NULL,
    resolved_at         DATETIME2 NULL,
    created_by          INT NOT NULL,
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_heldgoods_contract FOREIGN KEY (contract_id) REFERENCES rental_contracts(id),
    CONSTRAINT FK_heldgoods_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT FK_heldgoods_task     FOREIGN KEY (task_id)     REFERENCES facility_tasks(id),
    CONSTRAINT FK_heldgoods_warehouse FOREIGN KEY (central_warehouse_id) REFERENCES central_warehouses(id),
    CONSTRAINT FK_heldgoods_resolver FOREIGN KEY (resolved_by) REFERENCES users(id),
    CONSTRAINT FK_heldgoods_creator  FOREIGN KEY (created_by)  REFERENCES users(id),
    CONSTRAINT CK_heldgoods_status   CHECK (status IN ('HOLDING', 'RETURNED', 'SOLD', 'DESTROYED', 'HANDED_TO_AUTHORITY'))
);
CREATE INDEX IX_heldgoods_facility_status ON held_goods(facility_id, status);
CREATE INDEX IX_heldgoods_contract ON held_goods(contract_id);
GO

/* ---------- 13. activity_logs ---------- */
CREATE TABLE activity_logs (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    user_id         INT NOT NULL,
    action          NVARCHAR(500) NOT NULL,   -- 500 (đã gộp Update_activity_logs.sql)
    target_entity   NVARCHAR(50)  NULL,       -- vd: "reservation", "contract"
    target_id       NVARCHAR(50)  NULL,       -- string để chứa cả PK int lẫn PK string (storage_units)
    created_at      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_activitylogs_user FOREIGN KEY (user_id) REFERENCES users(id)
);
GO
CREATE INDEX IX_activitylogs_user ON activity_logs(user_id);
-- UC-31: màn nhật ký sắp xếp / lọc theo thời gian
CREATE INDEX IX_activitylogs_created_at ON activity_logs(created_at DESC);
GO

/* ---------- 14. login_history (Admin: lịch sử đăng nhập) ---------- */
CREATE TABLE login_history (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    user_id         INT NULL,                 -- NULL khi gõ email không tồn tại
    email           NVARCHAR(255) NOT NULL,
    event_type      NVARCHAR(20)  NOT NULL,   -- LOGIN_SUCCESS / LOGIN_FAILED / LOGOUT
    failure_reason  NVARCHAR(50)  NULL,       -- INVALID_CREDENTIALS / ACCOUNT_LOCKED / ACCOUNT_DISABLED
    ip_address      NVARCHAR(64)  NULL,
    user_agent      NVARCHAR(300) NULL,
    created_at      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_loginhistory_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT CK_loginhistory_event CHECK (event_type IN ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT'))
);
GO
CREATE INDEX IX_loginhistory_created_at ON login_history(created_at DESC);
CREATE INDEX IX_loginhistory_user ON login_history(user_id);
GO

/* ---------- 15. notifications (thông báo trong chuông, lưu DB) ---------- */
CREATE TABLE notifications (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    user_id         INT NOT NULL,
    title           NVARCHAR(200)  NOT NULL,
    message         NVARCHAR(1000) NOT NULL,
    type            NVARCHAR(30)   NOT NULL,   -- BOOKING / REFUND / TASK / SUPPORT / RENEWAL / OVERDUE / CHECKOUT ...
    target_url      NVARCHAR(300)  NULL,
    ref_key         NVARCHAR(150)  NULL,       -- chống gửi trùng (vd nhắc gia hạn RENEWAL:12:2026-11-30:3)
    is_read         BIT NOT NULL DEFAULT 0,
    created_at      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_notifications_user FOREIGN KEY (user_id) REFERENCES users(id)
);
GO
CREATE INDEX IX_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE UNIQUE INDEX UX_notifications_user_ref ON notifications(user_id, ref_key) WHERE ref_key IS NOT NULL;
GO


/* CHECK có trên DB đang chạy nhưng chưa có trong QueenKho_TongHop.sql (gói bảo hiểm BR-125) */
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('reservations') AND definition LIKE '%insurance_plan%')
    ALTER TABLE reservations ADD CONSTRAINT CK_reservations_insurance_plan CHECK (insurance_plan IN ('BASIC', 'ADVANCED', 'PREMIUM'));
GO

/* ============================================================
   DỮ LIỆU NỀN (xuất từ QueenKhoDB local)
   ============================================================ */

/* ---------- roles (5 dòng) ---------- */
DELETE FROM [roles];
SET IDENTITY_INSERT [roles] ON;
INSERT INTO [roles] ([id], [name], [description]) VALUES
    (1, N'CUSTOMER', N'Khách hàng thuê kho'),
    (2, N'STAFF', N'Nhân viên tại cơ sở'),
    (3, N'FACILITY_MANAGER', N'Quản lý cơ sở'),
    (4, N'BOM', N'Business Operations Manager'),
    (5, N'ADMIN', N'Quản trị hệ thống');
SET IDENTITY_INSERT [roles] OFF;
GO

/* ---------- facilities (6 dòng) ---------- */
DELETE FROM [facilities];
SET IDENTITY_INSERT [facilities] ON;
INSERT INTO [facilities] ([id], [code], [name], [city], [district], [address], [hotline], [status]) VALUES
    (1, N'TB', N'QueenKho Tân Bình', N'TP.HCM', N'Tân Bình', N'142 Cộng Hòa, P.13', N'028-3811-0001', N'ACTIVE'),
    (2, N'BT', N'QueenKho Bình Thạnh', N'TP.HCM', N'Bình Thạnh', N'456 Điện Biên Phủ, P.22', N'028-3811-0003', N'ACTIVE'),
    (3, N'TD', N'QueenKho Thủ Đức', N'TP.HCM', N'Thủ Đức', N'789 Võ Văn Ngân, P.Linh Chiểu', N'028-3811-0004', N'ACTIVE'),
    (4, N'GV', N'QueenKho Gò Vấp', N'TP.HCM', N'Gò Vấp', N'321 Quang Trung, P.10', N'028-3811-0005', N'ACTIVE'),
    (5, N'CG', N'QueenKho Cầu Giấy', N'Hà Nội', N'Cầu Giấy', N'56 Duy Tân, P.Dịch Vọng Hậu', N'024-3511-0001', N'ACTIVE'),
    (6, N'Q7', N'QueenKho Quận 7', N'TP.HCM', N'Quận 7', N'123 Nguyễn Văn Linh, P.Tân Phong', N'028-3811-0002', N'ACTIVE');
SET IDENTITY_INSERT [facilities] OFF;
GO

/* ---------- users (31 dòng) ---------- */
DELETE FROM [users];
SET IDENTITY_INSERT [users] ON;
INSERT INTO [users] ([id], [facility_id], [role_id], [email], [password_hash], [full_name], [phone], [cccd], [status], [created_at]) VALUES
    (1, 1, 3, N'fmtanbinh@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Quản lý Tân Bình', N'0901000001', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2157687'),
    (2, 2, 3, N'fmbinhthanh@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Quản lý Bình Thạnh', N'0901000002', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2157687'),
    (3, 3, 3, N'fmthuduc@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Quản lý Thủ Đức', N'0901000003', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2157687'),
    (4, 4, 3, N'fmgovap@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Quản lý Gò Vấp', N'0901000004', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2157687'),
    (5, 5, 3, N'fmcaugiay@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Quản lý Cầu Giấy', N'0901000005', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2157687'),
    (6, 6, 3, N'fmquan7@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Quản lý Quận 7', N'0901000006', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2157687'),
    (7, 1, 2, N'stafftanbinh1@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Nhân viên Tân Bình 1', N'09020011', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2295257'),
    (8, 1, 2, N'stafftanbinh2@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Nhân viên Tân Bình 2', N'09020012', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2295257'),
    (9, 1, 2, N'stafftanbinh3@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Nhân viên Tân Bình 3', N'09020013', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2295257'),
    (10, 2, 2, N'staffbinhthanh1@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Nhân viên Bình Thạnh 1', N'09020021', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2295257'),
    (11, 2, 2, N'staffbinhthanh2@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Nhân viên Bình Thạnh 2', N'09020022', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2295257'),
    (12, 2, 2, N'staffbinhthanh3@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Nhân viên Bình Thạnh 3', N'09020023', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2295257'),
    (13, 3, 2, N'staffthuduc1@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Nhân viên Thủ Đức 1', N'09020031', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2295257'),
    (14, 3, 2, N'staffthuduc2@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Nhân viên Thủ Đức 2', N'09020032', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2295257'),
    (15, 3, 2, N'staffthuduc3@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Nhân viên Thủ Đức 3', N'09020033', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2295257'),
    (16, 4, 2, N'staffgovap1@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Nhân viên Gò Vấp 1', N'09020041', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2295257'),
    (17, 4, 2, N'staffgovap2@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Nhân viên Gò Vấp 2', N'09020042', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2295257'),
    (18, 4, 2, N'staffgovap3@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Nhân viên Gò Vấp 3', N'09020043', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2295257'),
    (19, 5, 2, N'staffcaugiay1@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Nhân viên Cầu Giấy 1', N'09020051', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2295257'),
    (20, 5, 2, N'staffcaugiay2@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Nhân viên Cầu Giấy 2', N'09020052', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2295257'),
    (21, 5, 2, N'staffcaugiay3@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Nhân viên Cầu Giấy 3', N'09020053', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2295257'),
    (22, 6, 2, N'staffquan71@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Nhân viên Quận 7 1', N'09020061', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2295257'),
    (23, 6, 2, N'staffquan72@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Nhân viên Quận 7 2', N'09020062', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2295257'),
    (24, 6, 2, N'staffquan73@gmail.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Nhân viên Quận 7 3', N'09020063', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2295257'),
    (25, NULL, 4, N'bom@queenkho.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Business Operations Manager', N'0908889999', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2315235'),
    (26, NULL, 5, N'admin@queenkho.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Quản trị viên', N'0903000001', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2315235'),
    (27, NULL, 5, N'admin2@queenkho.com', N'$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu', N'Quản trị viên 2', N'0903000002', NULL, N'ACTIVE', N'2026-10-29T19:48:48.2315235'),
    (28, NULL, 5, N'system@queenkho.local', N'NO_LOGIN', N'Hệ thống', N'0000000000', NULL, N'DISABLED', N'2026-10-29T19:48:48.2325249'),
    (31, NULL, 1, N'nguyenduyhoang100406@gmail.com', N'$2a$10$Rn0Fg8QIRFa.6.3l46nuNOblK5j/n47Q6gSWywxzvevDmR/h2ohqe', N'Nguyễn Duy Hoàng', N'0354401156', N'066206013123', N'ACTIVE', N'2026-10-30T07:35:39.9318208'),
    (33, NULL, 1, N'nhieusiluan2006@gmail.com', N'$2a$10$X1yZf6tPVmnpDN8BrkWMSuc4OJqg0Dd.8lO.39.auAwqB49.jc7Ye', N'Nguyễn Luân', N'0987654321', N'068206099999', N'ACTIVE', N'2026-11-02T10:09:27.1073712'),
    (34, NULL, 1, N'e2e.khach@queenkho.local', N'$2a$10$kzOPeey/eojbL1QSifrYLOTLd2nw/16X/eOjZgY99YI16Ybi.Cyy2', N'Khach E2E', N'0900000211', N'079200000123', N'ACTIVE', N'2026-11-02T15:08:02.6148239');
SET IDENTITY_INSERT [users] OFF;
GO

/* ---------- unit_types (8 dòng) ---------- */
DELETE FROM [unit_types];
SET IDENTITY_INSERT [unit_types] ON;
INSERT INTO [unit_types] ([id], [name], [area_sqm], [volume_cbm], [base_price_monthly], [suggested_capacity], [dimensions], [features], [status], [temperature_class]) VALUES
    (1, N'Kho Mini M', 3.50, 8.40, 750000.00, N'10–20 thùng carton', N'1.5m × 2.3m × 2.4m', N'Cá nhân, đồ theo mùa', N'ACTIVE', N'NORMAL'),
    (2, N'Kho Tiêu Chuẩn', 6.00, 16.20, 1850000.00, N'20–40 thùng, nội thất nhỏ', N'2.5m × 2.4m × 2.7m', N'Phổ biến nhất, phù hợp chuyển nhà', N'ACTIVE', N'NORMAL'),
    (3, N'Kho Gia Đình', 12.00, 32.40, 3450000.00, N'Đồ 1 phòng ngủ hoặc VP nhỏ', N'4.0m × 3.0m × 2.7m', N'Gia đình, doanh nghiệp nhỏ', N'ACTIVE', N'NORMAL'),
    (4, N'Kho Lớn', 16.00, 43.20, 4500000.00, N'Đồ 2 phòng ngủ hoặc hàng hóa', N'4.0m × 4.0m × 2.7m', N'Doanh nghiệp, kho hàng', N'ACTIVE', N'NORMAL'),
    (5, N'Kho Đặc Biệt XL', 25.00, 67.50, 6500000.00, N'Hàng hóa lớn, máy móc', N'5.0m × 5.0m × 2.7m', N'Doanh nghiệp, sản xuất', N'ACTIVE', N'NORMAL'),
    (6, N'Kho nhỏ 2m²', 2.00, 4.80, 500000.00, N'5–10 thùng carton', N'1.0m × 2.0m × 2.4m', N'Cá nhân, sinh viên, giấy tờ', N'ACTIVE', N'NORMAL'),
    (7, N'Kho Lạnh 6m²', 6.00, 15.00, 2900000.00, N'Thực phẩm, đồ uống, nông sản đóng thùng', N'2.0m × 3.0m × 2.5m', N'Giữ 0–8°C, độ ẩm ≤ 90%, cảm biến nhiệt độ 24/7 — gửi được thực phẩm', N'ACTIVE', N'COLD'),
    (8, N'Kho Đông 4m²', 4.00, 9.60, 2600000.00, N'Thực phẩm đông lạnh, thịt cá, hải sản', N'2.0m × 2.0m × 2.4m', N'Giữ -25 → -15°C, cảm biến nhiệt độ 24/7 — gửi được thực phẩm đông lạnh', N'ACTIVE', N'FROZEN');
SET IDENTITY_INSERT [unit_types] OFF;
GO

/* ---------- goods_categories (10 dòng) ---------- */
DELETE FROM [goods_categories];
SET IDENTITY_INSERT [goods_categories] ON;
INSERT INTO [goods_categories] ([id], [code], [name], [description], [requires_cold_storage], [requires_note], [sort_order], [status], [created_at]) VALUES
    (1, N'HOUSEHOLD', N'Gia dụng', N'Đồ dùng gia đình, dụng cụ nhà bếp, thiết bị nhỏ', 0, 0, 1, N'ACTIVE', N'2026-11-05T11:16:10.0420243'),
    (2, N'STATIONERY', N'Văn phòng phẩm', N'Giấy tờ, hồ sơ, sách vở, dụng cụ văn phòng', 0, 0, 2, N'ACTIVE', N'2026-11-05T11:16:10.0420243'),
    (3, N'FOOD', N'Thực phẩm', N'Chỉ gửi ở kho lạnh hoặc kho đông', 1, 0, 3, N'ACTIVE', N'2026-11-05T11:16:10.0420243'),
    (4, N'CLOTHING', N'Quần áo', N'Quần áo, chăn màn, giày dép', 0, 0, 4, N'ACTIVE', N'2026-11-05T11:16:10.0420243'),
    (5, N'FURNITURE', N'Nội thất', N'Bàn ghế, tủ, giường, đồ gỗ', 0, 0, 5, N'ACTIVE', N'2026-11-05T11:16:10.0420243'),
    (6, N'ELECTRONICS', N'Điện tử', N'Thiết bị điện, điện tử, máy tính', 0, 0, 6, N'ACTIVE', N'2026-11-05T11:16:10.0420243'),
    (7, N'OTHER', N'Khác', N'Ghi rõ loại hàng', 0, 1, 7, N'ACTIVE', N'2026-11-05T11:16:10.0420243'),
    (8, N'E2E_115859', N'E2E Sach vo', NULL, 0, 0, 99, N'INACTIVE', N'2026-11-05T11:59:02.2780618'),
    (9, N'E2E_115928', N'E2E Sach vo', NULL, 0, 0, 99, N'INACTIVE', N'2026-11-05T11:59:30.6099977'),
    (10, N'E2E_120006', N'E2E Sach vo', NULL, 0, 0, 99, N'INACTIVE', N'2026-11-05T12:00:08.4472194');
SET IDENTITY_INSERT [goods_categories] OFF;
GO

/* ---------- central_warehouses (4 dòng) ---------- */
DELETE FROM [central_warehouses];
SET IDENTITY_INSERT [central_warehouses] ON;
INSERT INTO [central_warehouses] ([id], [name], [address], [hotline], [note], [status], [created_at]) VALUES
    (1, N'Kho tổng QueenKho', N'Lô C3, KCN Tân Bình, P. Tây Thạnh, Q. Tân Phú, TP.HCM', N'0281234567', N'Giữ hàng của khách quá hạn hợp đồng — không bán, khách đến nhận lại sau khi thanh toán', N'ACTIVE', N'2026-11-05T11:16:10.3381744'),
    (2, N'E2E Kho tong 115859', N'1 Duong E2E', N'0900000999', NULL, N'INACTIVE', N'2026-11-05T11:59:10.1784844'),
    (3, N'E2E Kho tong 115928', N'1 Duong E2E', N'0900000999', NULL, N'INACTIVE', N'2026-11-05T11:59:38.8910182'),
    (4, N'E2E Kho tong 120006', N'1 Duong E2E', N'0900000999', NULL, N'INACTIVE', N'2026-11-05T12:00:17.9285265');
SET IDENTITY_INSERT [central_warehouses] OFF;
GO

/* ---------- storage_units (122 dòng) ---------- */
DELETE FROM [storage_units];
INSERT INTO [storage_units] ([id], [facility_id], [unit_type_id], [floor], [zone], [room_number], [status], [map_x], [map_y], [map_w], [map_h], [map_door], [maintenance_note], [maintenance_since]) VALUES
    (N'KV-BT-A101', 2, 2, N'Tầng 1', N'A', N'101', N'AVAILABLE', 12, 5, 5, 5, N'BOTTOM', NULL, NULL),
    (N'KV-BT-A102', 2, 6, N'Tầng 1', N'A', N'102', N'AVAILABLE', 17, 6, 2, 4, N'BOTTOM', NULL, NULL),
    (N'KV-BT-A103', 2, 1, N'Tầng 1', N'A', N'103', N'AVAILABLE', 19, 5, 3, 5, N'BOTTOM', NULL, NULL),
    (N'KV-BT-A104', 2, 5, N'Tầng 1', N'A', N'104', N'AVAILABLE', 22, 0, 10, 10, N'BOTTOM', NULL, NULL),
    (N'KV-BT-A105', 2, 4, N'Tầng 1', N'A', N'105', N'AVAILABLE', 32, 2, 8, 8, N'BOTTOM', NULL, NULL),
    (N'KV-BT-A106', 2, 3, N'Tầng 1', N'A', N'106', N'AVAILABLE', 40, 4, 8, 6, N'BOTTOM', NULL, NULL),
    (N'KV-BT-A107', 2, 2, N'Tầng 1', N'A', N'107', N'AVAILABLE', 48, 5, 5, 5, N'BOTTOM', NULL, NULL),
    (N'KV-BT-A108', 2, 1, N'Tầng 1', N'A', N'108', N'AVAILABLE', 53, 5, 3, 5, N'BOTTOM', NULL, NULL),
    (N'KV-BT-B201', 2, 4, N'Tầng 1', N'B', N'201', N'AVAILABLE', 12, 14, 8, 8, N'TOP', NULL, NULL),
    (N'KV-BT-B202', 2, 5, N'Tầng 1', N'B', N'202', N'AVAILABLE', 20, 14, 10, 10, N'TOP', NULL, NULL),
    (N'KV-BT-B203', 2, 3, N'Tầng 1', N'B', N'203', N'AVAILABLE', 30, 14, 8, 6, N'TOP', NULL, NULL),
    (N'KV-BT-B204', 2, 2, N'Tầng 1', N'B', N'204', N'AVAILABLE', 38, 14, 5, 5, N'TOP', NULL, NULL),
    (N'KV-BT-B205', 2, 1, N'Tầng 1', N'B', N'205', N'AVAILABLE', 43, 14, 3, 5, N'TOP', NULL, NULL),
    (N'KV-BT-B206', 2, 6, N'Tầng 1', N'B', N'206', N'AVAILABLE', 46, 14, 2, 4, N'TOP', NULL, NULL),
    (N'KV-BT-B207', 2, 6, N'Tầng 1', N'B', N'207', N'AVAILABLE', 48, 14, 2, 4, N'TOP', NULL, NULL),
    (N'KV-BT-L101', 2, 7, N'Tầng 1', N'L', N'101', N'AVAILABLE', 12, 34, 4, 6, N'TOP', NULL, NULL),
    (N'KV-BT-L102', 2, 8, N'Tầng 1', N'L', N'102', N'AVAILABLE', 16, 34, 4, 4, N'TOP', NULL, NULL),
    (N'KV-BT-L103', 2, 7, N'Tầng 1', N'L', N'103', N'AVAILABLE', 20, 34, 4, 6, N'TOP', NULL, NULL),
    (N'KV-BT-L104', 2, 7, N'Tầng 1', N'L', N'104', N'AVAILABLE', 24, 34, 4, 6, N'TOP', NULL, NULL),
    (N'KV-BT-L105', 2, 8, N'Tầng 1', N'L', N'105', N'AVAILABLE', 28, 34, 4, 4, N'TOP', NULL, NULL),
    (N'KV-CG-A101', 5, 6, N'Tầng 1', N'A', N'101', N'AVAILABLE', 12, 6, 2, 4, N'BOTTOM', NULL, NULL),
    (N'KV-CG-A102', 5, 2, N'Tầng 1', N'A', N'102', N'AVAILABLE', 14, 5, 5, 5, N'BOTTOM', NULL, NULL),
    (N'KV-CG-A103', 5, 2, N'Tầng 1', N'A', N'103', N'AVAILABLE', 19, 5, 5, 5, N'BOTTOM', NULL, NULL),
    (N'KV-CG-A104', 5, 3, N'Tầng 1', N'A', N'104', N'AVAILABLE', 24, 4, 8, 6, N'BOTTOM', NULL, NULL),
    (N'KV-CG-A105', 5, 5, N'Tầng 1', N'A', N'105', N'AVAILABLE', 32, 0, 10, 10, N'BOTTOM', NULL, NULL),
    (N'KV-CG-A106', 5, 4, N'Tầng 1', N'A', N'106', N'AVAILABLE', 42, 2, 8, 8, N'BOTTOM', NULL, NULL),
    (N'KV-CG-A107', 5, 2, N'Tầng 1', N'A', N'107', N'AVAILABLE', 50, 5, 5, 5, N'BOTTOM', NULL, NULL),
    (N'KV-CG-B201', 5, 4, N'Tầng 1', N'B', N'201', N'AVAILABLE', 12, 14, 8, 8, N'TOP', NULL, NULL),
    (N'KV-CG-B202', 5, 5, N'Tầng 1', N'B', N'202', N'AVAILABLE', 20, 14, 10, 10, N'TOP', NULL, NULL),
    (N'KV-CG-B203', 5, 3, N'Tầng 1', N'B', N'203', N'AVAILABLE', 30, 14, 8, 6, N'TOP', NULL, NULL),
    (N'KV-CG-B204', 5, 1, N'Tầng 1', N'B', N'204', N'AVAILABLE', 38, 14, 3, 5, N'TOP', NULL, NULL),
    (N'KV-CG-B205', 5, 1, N'Tầng 1', N'B', N'205', N'AVAILABLE', 41, 14, 3, 5, N'TOP', NULL, NULL),
    (N'KV-CG-B206', 5, 1, N'Tầng 1', N'B', N'206', N'AVAILABLE', 44, 14, 3, 5, N'TOP', NULL, NULL),
    (N'KV-CG-B207', 5, 6, N'Tầng 1', N'B', N'207', N'AVAILABLE', 47, 14, 2, 4, N'TOP', NULL, NULL),
    (N'KV-CG-B208', 5, 6, N'Tầng 1', N'B', N'208', N'AVAILABLE', 49, 14, 2, 4, N'TOP', NULL, NULL),
    (N'KV-CG-L101', 5, 7, N'Tầng 1', N'L', N'101', N'AVAILABLE', 12, 34, 4, 6, N'TOP', NULL, NULL),
    (N'KV-CG-L102', 5, 8, N'Tầng 1', N'L', N'102', N'AVAILABLE', 16, 34, 4, 4, N'TOP', NULL, NULL),
    (N'KV-CG-L103', 5, 7, N'Tầng 1', N'L', N'103', N'AVAILABLE', 20, 34, 4, 6, N'TOP', NULL, NULL),
    (N'KV-CG-L104', 5, 7, N'Tầng 1', N'L', N'104', N'AVAILABLE', 24, 34, 4, 6, N'TOP', NULL, NULL),
    (N'KV-CG-L105', 5, 8, N'Tầng 1', N'L', N'105', N'AVAILABLE', 28, 34, 4, 4, N'TOP', NULL, NULL),
    (N'KV-GV-A101', 4, 6, N'Tầng 1', N'A', N'101', N'AVAILABLE', 12, 6, 2, 4, N'BOTTOM', NULL, NULL),
    (N'KV-GV-A102', 4, 1, N'Tầng 1', N'A', N'102', N'AVAILABLE', 14, 5, 3, 5, N'BOTTOM', NULL, NULL),
    (N'KV-GV-A103', 4, 2, N'Tầng 1', N'A', N'103', N'AVAILABLE', 17, 5, 5, 5, N'BOTTOM', NULL, NULL),
    (N'KV-GV-A104', 4, 5, N'Tầng 1', N'A', N'104', N'AVAILABLE', 22, 0, 10, 10, N'BOTTOM', NULL, NULL),
    (N'KV-GV-A105', 4, 5, N'Tầng 1', N'A', N'105', N'AVAILABLE', 32, 0, 10, 10, N'BOTTOM', NULL, NULL),
    (N'KV-GV-A106', 4, 4, N'Tầng 1', N'A', N'106', N'AVAILABLE', 42, 2, 8, 8, N'BOTTOM', NULL, NULL),
    (N'KV-GV-A107', 4, 2, N'Tầng 1', N'A', N'107', N'AVAILABLE', 50, 5, 5, 5, N'BOTTOM', NULL, NULL),
    (N'KV-GV-B201', 4, 4, N'Tầng 1', N'B', N'201', N'AVAILABLE', 12, 14, 8, 8, N'TOP', NULL, NULL),
    (N'KV-GV-B202', 4, 3, N'Tầng 1', N'B', N'202', N'AVAILABLE', 20, 14, 8, 6, N'TOP', NULL, NULL),
    (N'KV-GV-B203', 4, 3, N'Tầng 1', N'B', N'203', N'AVAILABLE', 28, 14, 8, 6, N'TOP', NULL, NULL),
    (N'KV-GV-B204', 4, 2, N'Tầng 1', N'B', N'204', N'AVAILABLE', 36, 14, 5, 5, N'TOP', NULL, NULL),
    (N'KV-GV-B205', 4, 1, N'Tầng 1', N'B', N'205', N'AVAILABLE', 41, 14, 3, 5, N'TOP', NULL, NULL),
    (N'KV-GV-B206', 4, 1, N'Tầng 1', N'B', N'206', N'AVAILABLE', 44, 14, 3, 5, N'TOP', NULL, NULL),
    (N'KV-GV-B207', 4, 6, N'Tầng 1', N'B', N'207', N'AVAILABLE', 47, 14, 2, 4, N'TOP', NULL, NULL),
    (N'KV-GV-B208', 4, 6, N'Tầng 1', N'B', N'208', N'AVAILABLE', 49, 14, 2, 4, N'TOP', NULL, NULL),
    (N'KV-GV-L101', 4, 7, N'Tầng 1', N'L', N'101', N'AVAILABLE', 12, 34, 4, 6, N'TOP', NULL, NULL),
    (N'KV-GV-L102', 4, 8, N'Tầng 1', N'L', N'102', N'AVAILABLE', 16, 34, 4, 4, N'TOP', NULL, NULL),
    (N'KV-GV-L103', 4, 7, N'Tầng 1', N'L', N'103', N'AVAILABLE', 20, 34, 4, 6, N'TOP', NULL, NULL),
    (N'KV-GV-L104', 4, 7, N'Tầng 1', N'L', N'104', N'AVAILABLE', 24, 34, 4, 6, N'TOP', NULL, NULL),
    (N'KV-GV-L105', 4, 8, N'Tầng 1', N'L', N'105', N'AVAILABLE', 28, 34, 4, 4, N'TOP', NULL, NULL),
    (N'KV-Q7-A101', 6, 2, N'Tầng 1', N'A', N'101', N'AVAILABLE', 12, 5, 5, 5, N'BOTTOM', NULL, NULL),
    (N'KV-Q7-A102', 6, 2, N'Tầng 1', N'A', N'102', N'AVAILABLE', 17, 5, 5, 5, N'BOTTOM', NULL, NULL),
    (N'KV-Q7-A103', 6, 3, N'Tầng 1', N'A', N'103', N'AVAILABLE', 22, 4, 8, 6, N'BOTTOM', NULL, NULL),
    (N'KV-Q7-A104', 6, 5, N'Tầng 1', N'A', N'104', N'AVAILABLE', 30, 0, 10, 10, N'BOTTOM', NULL, NULL),
    (N'KV-Q7-A105', 6, 4, N'Tầng 1', N'A', N'105', N'AVAILABLE', 40, 2, 8, 8, N'BOTTOM', NULL, NULL),
    (N'KV-Q7-A106', 6, 3, N'Tầng 1', N'A', N'106', N'AVAILABLE', 48, 4, 8, 6, N'BOTTOM', NULL, NULL),
    (N'KV-Q7-B201', 6, 6, N'Tầng 1', N'B', N'201', N'AVAILABLE', 12, 14, 2, 4, N'TOP', NULL, NULL),
    (N'KV-Q7-B202', 6, 1, N'Tầng 1', N'B', N'202', N'AVAILABLE', 14, 14, 3, 5, N'TOP', NULL, NULL),
    (N'KV-Q7-B203', 6, 4, N'Tầng 1', N'B', N'203', N'AVAILABLE', 17, 14, 8, 8, N'TOP', NULL, NULL),
    (N'KV-Q7-B204', 6, 5, N'Tầng 1', N'B', N'204', N'AVAILABLE', 25, 14, 10, 10, N'TOP', NULL, NULL),
    (N'KV-Q7-B205', 6, 2, N'Tầng 1', N'B', N'205', N'AVAILABLE', 35, 14, 5, 5, N'TOP', NULL, NULL),
    (N'KV-Q7-B206', 6, 1, N'Tầng 1', N'B', N'206', N'AVAILABLE', 40, 14, 3, 5, N'TOP', NULL, NULL),
    (N'KV-Q7-B207', 6, 1, N'Tầng 1', N'B', N'207', N'AVAILABLE', 43, 14, 3, 5, N'TOP', NULL, NULL),
    (N'KV-Q7-B208', 6, 6, N'Tầng 1', N'B', N'208', N'AVAILABLE', 46, 14, 2, 4, N'TOP', NULL, NULL),
    (N'KV-Q7-B209', 6, 6, N'Tầng 1', N'B', N'209', N'AVAILABLE', 48, 14, 2, 4, N'TOP', NULL, NULL),
    (N'KV-Q7-L101', 6, 7, N'Tầng 1', N'L', N'101', N'AVAILABLE', 12, 34, 4, 6, N'TOP', NULL, NULL),
    (N'KV-Q7-L102', 6, 8, N'Tầng 1', N'L', N'102', N'AVAILABLE', 16, 34, 4, 4, N'TOP', NULL, NULL),
    (N'KV-Q7-L103', 6, 7, N'Tầng 1', N'L', N'103', N'AVAILABLE', 20, 34, 4, 6, N'TOP', NULL, NULL),
    (N'KV-Q7-L104', 6, 7, N'Tầng 1', N'L', N'104', N'AVAILABLE', 24, 34, 4, 6, N'TOP', NULL, NULL),
    (N'KV-Q7-L105', 6, 8, N'Tầng 1', N'L', N'105', N'AVAILABLE', 28, 34, 4, 4, N'TOP', NULL, NULL),
    (N'KV-TB-A101', 1, 2, N'Tầng 1', N'A', N'101', N'AVAILABLE', 12, 5, 5, 5, N'BOTTOM', NULL, NULL),
    (N'KV-TB-A102', 1, 2, N'Tầng 1', N'A', N'102', N'AVAILABLE', 17, 5, 5, 5, N'BOTTOM', NULL, NULL),
    (N'KV-TB-A103', 1, 2, N'Tầng 1', N'A', N'103', N'AVAILABLE', 22, 5, 5, 5, N'BOTTOM', NULL, NULL),
    (N'KV-TB-A104', 1, 2, N'Tầng 1', N'A', N'104', N'AVAILABLE', 27, 5, 5, 5, N'BOTTOM', NULL, NULL),
    (N'KV-TB-A105', 1, 2, N'Tầng 1', N'A', N'105', N'AVAILABLE', 32, 5, 5, 5, N'BOTTOM', NULL, NULL),
    (N'KV-TB-A106', 1, 5, N'Tầng 1', N'A', N'106', N'AVAILABLE', 37, 0, 10, 10, N'BOTTOM', NULL, NULL),
    (N'KV-TB-A107', 1, 1, N'Tầng 1', N'A', N'107', N'AVAILABLE', 47, 5, 3, 5, N'BOTTOM', NULL, NULL),
    (N'KV-TB-B201', 1, 3, N'Tầng 1', N'B', N'201', N'AVAILABLE', 12, 14, 8, 6, N'TOP', NULL, NULL),
    (N'KV-TB-B202', 1, 3, N'Tầng 1', N'B', N'202', N'AVAILABLE', 20, 14, 8, 6, N'TOP', NULL, NULL),
    (N'KV-TB-B203', 1, 4, N'Tầng 1', N'B', N'203', N'AVAILABLE', 28, 14, 8, 8, N'TOP', NULL, NULL),
    (N'KV-TB-B204', 1, 4, N'Tầng 1', N'B', N'204', N'AVAILABLE', 36, 14, 8, 8, N'TOP', NULL, NULL),
    (N'KV-TB-B205', 1, 5, N'Tầng 1', N'B', N'205', N'AVAILABLE', 44, 14, 10, 10, N'TOP', NULL, NULL),
    (N'KV-TB-C101', 1, 6, N'Tầng 1', N'C', N'101', N'AVAILABLE', 12, 26, 2, 4, N'BOTTOM', NULL, NULL),
    (N'KV-TB-C102', 1, 6, N'Tầng 1', N'C', N'102', N'AVAILABLE', 14, 26, 2, 4, N'BOTTOM', NULL, NULL),
    (N'KV-TB-C103', 1, 1, N'Tầng 1', N'C', N'103', N'AVAILABLE', 16, 25, 3, 5, N'BOTTOM', NULL, NULL),
    (N'KV-TB-C104', 1, 1, N'Tầng 1', N'C', N'104', N'AVAILABLE', 19, 25, 3, 5, N'BOTTOM', NULL, NULL),
    (N'KV-TB-C105', 1, 6, N'Tầng 1', N'C', N'105', N'AVAILABLE', 22, 26, 2, 4, N'BOTTOM', NULL, NULL),
    (N'KV-TB-L101', 1, 7, N'Tầng 1', N'L', N'101', N'AVAILABLE', 12, 34, 4, 6, N'TOP', NULL, NULL),
    (N'KV-TB-L102', 1, 7, N'Tầng 1', N'L', N'102', N'AVAILABLE', 16, 34, 4, 6, N'TOP', NULL, NULL),
    (N'KV-TB-L103', 1, 8, N'Tầng 1', N'L', N'103', N'AVAILABLE', 20, 34, 4, 4, N'TOP', NULL, NULL),
    (N'KV-TB-L104', 1, 7, N'Tầng 1', N'L', N'104', N'AVAILABLE', 24, 34, 4, 6, N'TOP', NULL, NULL),
    (N'KV-TB-L105', 1, 8, N'Tầng 1', N'L', N'105', N'AVAILABLE', 28, 34, 4, 4, N'TOP', NULL, NULL),
    (N'KV-TD-A101', 3, 6, N'Tầng 1', N'A', N'101', N'AVAILABLE', 12, 6, 2, 4, N'BOTTOM', NULL, NULL),
    (N'KV-TD-A102', 3, 1, N'Tầng 1', N'A', N'102', N'AVAILABLE', 14, 5, 3, 5, N'BOTTOM', NULL, NULL),
    (N'KV-TD-A103', 3, 2, N'Tầng 1', N'A', N'103', N'AVAILABLE', 17, 5, 5, 5, N'BOTTOM', NULL, NULL),
    (N'KV-TD-A104', 3, 2, N'Tầng 1', N'A', N'104', N'AVAILABLE', 22, 5, 5, 5, N'BOTTOM', NULL, NULL),
    (N'KV-TD-A105', 3, 5, N'Tầng 1', N'A', N'105', N'AVAILABLE', 27, 0, 10, 10, N'BOTTOM', NULL, NULL),
    (N'KV-TD-A106', 3, 5, N'Tầng 1', N'A', N'106', N'AVAILABLE', 37, 0, 10, 10, N'BOTTOM', NULL, NULL),
    (N'KV-TD-A107', 3, 4, N'Tầng 1', N'A', N'107', N'AVAILABLE', 47, 2, 8, 8, N'BOTTOM', NULL, NULL),
    (N'KV-TD-B201', 3, 3, N'Tầng 1', N'B', N'201', N'AVAILABLE', 12, 14, 8, 6, N'TOP', NULL, NULL),
    (N'KV-TD-B202', 3, 4, N'Tầng 1', N'B', N'202', N'AVAILABLE', 20, 14, 8, 8, N'TOP', NULL, NULL),
    (N'KV-TD-B203', 3, 3, N'Tầng 1', N'B', N'203', N'AVAILABLE', 28, 14, 8, 6, N'TOP', NULL, NULL),
    (N'KV-TD-B204', 3, 2, N'Tầng 1', N'B', N'204', N'AVAILABLE', 36, 14, 5, 5, N'TOP', NULL, NULL),
    (N'KV-TD-B205', 3, 1, N'Tầng 1', N'B', N'205', N'AVAILABLE', 41, 14, 3, 5, N'TOP', NULL, NULL),
    (N'KV-TD-B206', 3, 1, N'Tầng 1', N'B', N'206', N'AVAILABLE', 44, 14, 3, 5, N'TOP', NULL, NULL),
    (N'KV-TD-B207', 3, 6, N'Tầng 1', N'B', N'207', N'AVAILABLE', 47, 14, 2, 4, N'TOP', NULL, NULL),
    (N'KV-TD-B208', 3, 6, N'Tầng 1', N'B', N'208', N'AVAILABLE', 49, 14, 2, 4, N'TOP', NULL, NULL),
    (N'KV-TD-L101', 3, 7, N'Tầng 1', N'L', N'101', N'AVAILABLE', 12, 34, 4, 6, N'TOP', NULL, NULL),
    (N'KV-TD-L102', 3, 8, N'Tầng 1', N'L', N'102', N'AVAILABLE', 16, 34, 4, 4, N'TOP', NULL, NULL),
    (N'KV-TD-L103', 3, 7, N'Tầng 1', N'L', N'103', N'AVAILABLE', 20, 34, 4, 6, N'TOP', NULL, NULL),
    (N'KV-TD-L104', 3, 7, N'Tầng 1', N'L', N'104', N'AVAILABLE', 24, 34, 4, 6, N'TOP', NULL, NULL),
    (N'KV-TD-L105', 3, 8, N'Tầng 1', N'L', N'105', N'AVAILABLE', 28, 34, 4, 4, N'TOP', NULL, NULL);
GO

/* ---------- facility_floors (6 dòng) ---------- */
DELETE FROM [facility_floors];
SET IDENTITY_INSERT [facility_floors] ON;
INSERT INTO [facility_floors] ([id], [facility_id], [name], [grid_width], [grid_height], [sort_order]) VALUES
    (1, 1, N'Tầng 1', 56, 40, 1),
    (2, 2, N'Tầng 1', 56, 40, 1),
    (3, 3, N'Tầng 1', 56, 40, 1),
    (4, 4, N'Tầng 1', 56, 40, 1),
    (5, 5, N'Tầng 1', 56, 40, 1),
    (6, 6, N'Tầng 1', 56, 40, 1);
SET IDENTITY_INSERT [facility_floors] OFF;
GO

/* ---------- floor_fixtures (42 dòng) ---------- */
DELETE FROM [floor_fixtures];
SET IDENTITY_INSERT [floor_fixtures] ON;
INSERT INTO [floor_fixtures] ([id], [floor_id], [fixture_type], [label], [map_x], [map_y], [map_w], [map_h]) VALUES
    (8, 2, N'STAIRS', N'Thang bộ', 0, 0, 8, 6),
    (9, 2, N'ELEVATOR', N'Thang máy', 0, 6, 8, 5),
    (10, 2, N'OFFICE', N'Quầy lễ tân', 0, 28, 8, 8),
    (11, 2, N'ENTRANCE', N'Cửa chính', 0, 36, 8, 4),
    (12, 2, N'AISLE', N'Lối đi chính', 8, 0, 4, 40),
    (13, 2, N'AISLE', N'Lối đi A – B', 12, 10, 44, 4),
    (14, 2, N'AISLE', N'Lối đi C', 12, 30, 44, 4),
    (15, 3, N'STAIRS', N'Thang bộ', 0, 0, 8, 6),
    (16, 3, N'ELEVATOR', N'Thang máy', 0, 6, 8, 5),
    (17, 3, N'OFFICE', N'Quầy lễ tân', 0, 28, 8, 8),
    (18, 3, N'ENTRANCE', N'Cửa chính', 0, 36, 8, 4),
    (19, 3, N'AISLE', N'Lối đi chính', 8, 0, 4, 40),
    (20, 3, N'AISLE', N'Lối đi A – B', 12, 10, 44, 4),
    (21, 3, N'AISLE', N'Lối đi C', 12, 30, 44, 4),
    (22, 4, N'STAIRS', N'Thang bộ', 0, 0, 8, 6),
    (23, 4, N'ELEVATOR', N'Thang máy', 0, 6, 8, 5),
    (24, 4, N'OFFICE', N'Quầy lễ tân', 0, 28, 8, 8),
    (25, 4, N'ENTRANCE', N'Cửa chính', 0, 36, 8, 4),
    (26, 4, N'AISLE', N'Lối đi chính', 8, 0, 4, 40),
    (27, 4, N'AISLE', N'Lối đi A – B', 12, 10, 44, 4),
    (28, 4, N'AISLE', N'Lối đi C', 12, 30, 44, 4),
    (29, 5, N'STAIRS', N'Thang bộ', 0, 0, 8, 6),
    (30, 5, N'ELEVATOR', N'Thang máy', 0, 6, 8, 5),
    (31, 5, N'OFFICE', N'Quầy lễ tân', 0, 28, 8, 8),
    (32, 5, N'ENTRANCE', N'Cửa chính', 0, 36, 8, 4),
    (33, 5, N'AISLE', N'Lối đi chính', 8, 0, 4, 40),
    (34, 5, N'AISLE', N'Lối đi A – B', 12, 10, 44, 4),
    (35, 5, N'AISLE', N'Lối đi C', 12, 30, 44, 4),
    (36, 6, N'STAIRS', N'Thang bộ', 0, 0, 8, 6),
    (37, 6, N'ELEVATOR', N'Thang máy', 0, 6, 8, 5),
    (38, 6, N'OFFICE', N'Quầy lễ tân', 0, 28, 8, 8),
    (39, 6, N'ENTRANCE', N'Cửa chính', 0, 36, 8, 4),
    (40, 6, N'AISLE', N'Lối đi chính', 8, 0, 4, 40),
    (41, 6, N'AISLE', N'Lối đi A – B', 12, 10, 44, 4),
    (42, 6, N'AISLE', N'Lối đi C', 12, 30, 44, 4),
    (64, 1, N'STAIRS', N'Thang bộ', 0, 0, 8, 6),
    (65, 1, N'ELEVATOR', N'Thang máy', 0, 6, 8, 5),
    (66, 1, N'OFFICE', N'Quầy lễ tân', 0, 28, 8, 8),
    (67, 1, N'ENTRANCE', N'Cửa chính', 0, 36, 8, 4),
    (68, 1, N'AISLE', N'Lối đi chính', 8, 0, 4, 40),
    (69, 1, N'AISLE', N'Lối đi A – B', 12, 10, 44, 4),
    (70, 1, N'AISLE', N'Lối đi C', 12, 30, 44, 4);
SET IDENTITY_INSERT [floor_fixtures] OFF;
GO

/* ---------- rental_policy (8 dòng) ---------- */
DELETE FROM [rental_policy];
SET IDENTITY_INSERT [rental_policy] ON;
INSERT INTO [rental_policy] ([id], [facility_id], [policy_name], [deposit_month_multiplier], [cancel_fee_percent], [cancel_free_hours], [late_fee_percent_per_day], [late_fee_max_percent], [liquidation_days], [booking_discount_3m], [booking_discount_6m], [booking_discount_12m], [renewal_discount_3m], [renewal_discount_6m], [renewal_discount_12m], [allow_late_fee_waiver], [overstay_percent], [held_goods_fee_percent], [goods_moving_fee_percent], [version], [is_active], [created_at], [created_by_user_id]) VALUES
    (1, 1, N'Chính sách Kho Tân Bình - Tiêu chuẩn', 1, 50, 24, 10, 50, 15, 5, 10, 15, 0, 5, 10, 1, 150, 20, 30, 1, 1, N'2026-10-29T19:48:48.1488768', NULL),
    (2, 2, N'Chính sách Kho Bình Thạnh - Tiêu chuẩn', 1, 50, 24, 10, 50, 15, 5, 10, 15, 0, 5, 10, 1, 150, 20, 30, 1, 1, N'2026-10-29T19:48:48.1488768', NULL),
    (3, 3, N'Chính sách Kho Thủ Đức - Tiêu chuẩn', 1, 50, 24, 10, 50, 15, 5, 10, 15, 0, 5, 10, 1, 150, 20, 30, 1, 1, N'2026-10-29T19:48:48.1488768', NULL),
    (4, 4, N'Chính sách Kho Gò Vấp - Tiêu chuẩn', 1, 50, 24, 10, 50, 15, 5, 10, 15, 0, 5, 10, 1, 150, 20, 30, 1, 1, N'2026-10-29T19:48:48.1488768', NULL),
    (5, 5, N'Chính sách Kho Cầu Giấy - Tiêu chuẩn', 1, 50, 24, 10, 50, 15, 5, 10, 15, 0, 5, 10, 1, 150, 20, 30, 1, 1, N'2026-10-29T19:48:48.1488768', NULL),
    (6, 6, N'Chính sách Kho Quận 7 - Tiêu chuẩn', 1, 50, 24, 10, 50, 15, 5, 10, 15, 0, 5, 10, 1, 150, 20, 30, 1, 1, N'2026-10-29T19:48:48.1488768', NULL),
    (7, 1, N'Chính sách QueenKho Tân Bình', 1, 50, 24, 10, 50, 15, 8, 10, 15, 0, 5, 10, 1, 150, 20, 30, 2, 0, N'2026-11-05T12:00:50.6533571', 25),
    (8, 1, N'Chính sách QueenKho Tân Bình', 1, 50, 24, 10, 50, 15, 8, 10, 15, 0, 5, 10, 1, 150, 20, 30, 3, 0, N'2026-11-05T12:01:44.0384579', 25);
SET IDENTITY_INSERT [rental_policy] OFF;
GO

/* ---------- vouchers (6 dòng) ---------- */
DELETE FROM [vouchers];
SET IDENTITY_INSERT [vouchers] ON;
INSERT INTO [vouchers] ([id], [code], [name], [discount_type], [discount_value], [max_discount], [min_months], [facility_id], [unit_type_id], [start_at], [end_at], [usage_limit], [per_user_limit], [used_count], [is_default], [status], [created_by], [created_at]) VALUES
    (1, N'NEWKHO', N'Ưu đãi đặt kho trực tuyến', N'FIXED', 100000.00, NULL, 1, NULL, NULL, N'2026-01-01T00:00:00', NULL, NULL, NULL, 0, 1, N'ACTIVE', NULL, N'2026-11-02T14:33:19.6733173'),
    (2, N'E2E150805', N'E2E giam 10 phan tram', N'PERCENT', 10.00, 200000.00, 3, NULL, NULL, N'2026-11-02T15:08:05.2936683', NULL, NULL, 1, 0, 0, N'ACTIVE', 25, N'2026-11-02T15:08:05.2946853'),
    (3, N'E2EKL115859', N'E2E kho lanh', N'FIXED', 50000.00, NULL, 1, NULL, 2, N'2026-11-05T11:59:03.8434909', NULL, NULL, NULL, 0, 0, N'INACTIVE', 25, N'2026-11-05T11:59:03.8444864'),
    (4, N'E2EKL115928', N'E2E kho lanh', N'FIXED', 50000.00, NULL, 1, NULL, 2, N'2026-11-05T11:59:32.3751874', NULL, NULL, NULL, 0, 0, N'INACTIVE', 25, N'2026-11-05T11:59:32.3751874'),
    (5, N'E2EKL120006', N'E2E kho lanh', N'FIXED', 50000.00, NULL, 1, NULL, 2, N'2026-11-05T12:00:10.2417509', NULL, NULL, NULL, 0, 0, N'INACTIVE', 25, N'2026-11-05T12:00:10.2417509'),
    (6, N'E2E120037', N'E2E giam 10 phan tram', N'PERCENT', 10.00, 200000.00, 3, NULL, NULL, N'2026-11-05T12:00:37.9383197', NULL, NULL, 1, 0, 0, N'ACTIVE', 25, N'2026-11-05T12:00:37.9383197');
SET IDENTITY_INSERT [vouchers] OFF;
GO

/* ---------- Chỉnh lại sau khi bỏ dữ liệu giao dịch ---------- */
UPDATE storage_units SET status = 'AVAILABLE' WHERE status IN ('OCCUPIED', 'RESERVED');
UPDATE vouchers SET used_count = 0;
GO

/* ============================================================
   KHO LẠNH / KHO ĐÔNG (D-16) — bỏ qua nếu dữ liệu nguồn đã có
   ============================================================ */
/* ---------- 1. unit_types ---------- */
IF NOT EXISTS (SELECT 1 FROM unit_types WHERE name = N'Kho Lạnh 6m²')
    INSERT INTO unit_types (name, area_sqm, volume_cbm, base_price_monthly, suggested_capacity, dimensions, features, temperature_class)
    VALUES (N'Kho Lạnh 6m²', 6.0, 15.0, 2900000, N'Thực phẩm, đồ uống, nông sản đóng thùng',
            N'2.0m × 3.0m × 2.5m', N'Giữ 0–8°C, độ ẩm ≤ 90%, cảm biến nhiệt độ 24/7 — gửi được thực phẩm', 'COLD');
GO
IF NOT EXISTS (SELECT 1 FROM unit_types WHERE name = N'Kho Đông 4m²')
    INSERT INTO unit_types (name, area_sqm, volume_cbm, base_price_monthly, suggested_capacity, dimensions, features, temperature_class)
    VALUES (N'Kho Đông 4m²', 4.0, 9.6, 2600000, N'Thực phẩm đông lạnh, thịt cá, hải sản',
            N'2.0m × 2.0m × 2.4m', N'Giữ -25 → -15°C, cảm biến nhiệt độ 24/7 — gửi được thực phẩm đông lạnh', 'FROZEN');
GO

/* ---------- 2. storage_units ---------- */
DECLARE @cold INT = (SELECT id FROM unit_types WHERE name = N'Kho Lạnh 6m²');
DECLARE @frozen INT = (SELECT id FROM unit_types WHERE name = N'Kho Đông 4m²');

INSERT INTO storage_units (id, facility_id, unit_type_id, floor, zone, room_number, status)
SELECT s.code, f.id, CASE s.kind WHEN 'COLD' THEN @cold ELSE @frozen END, N'Tầng 1', 'L', RIGHT(s.code, 3), 'AVAILABLE'
FROM (VALUES
    ('KV-TB-L101', 'TB', 'COLD'), ('KV-TB-L102', 'TB', 'COLD'), ('KV-TB-L103', 'TB', 'FROZEN'),
    ('KV-BT-L101', 'BT', 'COLD'), ('KV-BT-L102', 'BT', 'FROZEN'),
    ('KV-TD-L101', 'TD', 'COLD'), ('KV-TD-L102', 'TD', 'FROZEN'),
    ('KV-GV-L101', 'GV', 'COLD'), ('KV-GV-L102', 'GV', 'FROZEN'),
    ('KV-CG-L101', 'CG', 'COLD'), ('KV-CG-L102', 'CG', 'FROZEN'),
    ('KV-Q7-L101', 'Q7', 'COLD'), ('KV-Q7-L102', 'Q7', 'FROZEN')
) AS s(code, facility_code, kind)
JOIN facilities f ON f.code = s.facility_code
WHERE NOT EXISTS (SELECT 1 FROM storage_units su WHERE su.id = s.code);
GO

/* ---------- 3. Vị trí trên mặt bằng (UC-06): Kho Lạnh 4×6 ô lưới (2m × 3m), Kho Đông 4×4 (2m × 2m) ---------- */
UPDATE su
SET su.map_x = p.x, su.map_y = p.y, su.map_w = p.w, su.map_h = p.h, su.map_door = 'TOP'
FROM storage_units su
JOIN (VALUES
    ('KV-TB-L101', 12, 34, 4, 6), ('KV-TB-L102', 16, 34, 4, 6), ('KV-TB-L103', 20, 34, 4, 4),
    ('KV-BT-L101', 12, 34, 4, 6), ('KV-BT-L102', 16, 34, 4, 4),
    ('KV-TD-L101', 12, 34, 4, 6), ('KV-TD-L102', 16, 34, 4, 4),
    ('KV-GV-L101', 12, 34, 4, 6), ('KV-GV-L102', 16, 34, 4, 4),
    ('KV-CG-L101', 12, 34, 4, 6), ('KV-CG-L102', 16, 34, 4, 4),
    ('KV-Q7-L101', 12, 34, 4, 6), ('KV-Q7-L102', 16, 34, 4, 4)
) AS p(id, x, y, w, h) ON p.id = su.id
WHERE su.map_x IS NULL;
GO

GO

/* ============================================================
   TRIGGER ĐỒNG BỘ HOÀN TIỀN (UC-15, UC-22, UC-25, UC-28)
   Bản mới nhất (UC28_setup.sql): hợp đồng LIQUIDATED giữ nguyên trạng thái khi hoàn tiền.
   ============================================================ */
CREATE OR ALTER TRIGGER trg_payment_transactions_refund_sync
ON payment_transactions
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Giao dịch REFUND thành công → đơn đặt chỗ REFUNDED
    UPDATE r
    SET r.status = 'REFUNDED'
    FROM reservations r
    INNER JOIN inserted i ON r.id = i.reservation_id
    WHERE i.payment_type = 'REFUND'
      AND i.status = 'SUCCESS'
      AND r.status <> 'REFUNDED';
END;
GO

CREATE OR ALTER TRIGGER trg_facility_tasks_refund_sync
ON facility_tasks
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Hoàn cọc khi trả kho / thanh lý: LIQUIDATED giữ nguyên, còn lại → TERMINATED; cọc giữ về 0
    UPDATE c
    SET c.status = CASE WHEN c.status = 'LIQUIDATED' THEN 'LIQUIDATED' ELSE 'TERMINATED' END,
        c.deposit_held_amount = 0
    FROM rental_contracts c
    INNER JOIN inserted i ON c.id = i.contract_id
    WHERE i.task_type = 'REFUND'
      AND i.status = 'COMPLETED';

    -- 2. Hoàn cọc khi khách huỷ giữ chỗ: đơn (mã nằm trong note) → REFUNDED
    UPDATE r
    SET r.status = 'REFUNDED'
    FROM reservations r
    INNER JOIN inserted i ON (i.note LIKE '%' + r.reservation_code + '%')
    WHERE i.task_type = 'REFUND'
      AND i.status = 'COMPLETED'
      AND r.status <> 'REFUNDED';

    -- 3. Giao dịch hoàn cọc còn PENDING → SUCCESS
    UPDATE p
    SET p.status = 'SUCCESS', p.paid_at = SYSDATETIME()
    FROM payment_transactions p
    INNER JOIN reservations r ON p.reservation_id = r.id
    INNER JOIN inserted i ON (i.note LIKE '%' + r.reservation_code + '%')
    WHERE i.task_type = 'REFUND'
      AND i.status = 'COMPLETED'
      AND p.payment_type = 'REFUND'
      AND p.status <> 'SUCCESS';
END;
GO


/* ============================================================
   KIỂM TRA: số dòng theo bảng
   ============================================================ */
SELECT 'roles' AS [table], COUNT(*) AS [rows] FROM roles
UNION ALL SELECT 'facilities', COUNT(*) FROM facilities
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'unit_types', COUNT(*) FROM unit_types
UNION ALL SELECT 'goods_categories', COUNT(*) FROM goods_categories
UNION ALL SELECT 'central_warehouses', COUNT(*) FROM central_warehouses
UNION ALL SELECT 'storage_units', COUNT(*) FROM storage_units
UNION ALL SELECT 'facility_floors', COUNT(*) FROM facility_floors
UNION ALL SELECT 'floor_fixtures', COUNT(*) FROM floor_fixtures
UNION ALL SELECT 'rental_policy', COUNT(*) FROM rental_policy
UNION ALL SELECT 'vouchers', COUNT(*) FROM vouchers
UNION ALL SELECT 'reservations', COUNT(*) FROM reservations
UNION ALL SELECT 'rental_contracts', COUNT(*) FROM rental_contracts
UNION ALL SELECT 'payment_transactions', COUNT(*) FROM payment_transactions
UNION ALL SELECT 'facility_tasks', COUNT(*) FROM facility_tasks
UNION ALL SELECT 'handover_records', COUNT(*) FROM handover_records
UNION ALL SELECT 'support_requests', COUNT(*) FROM support_requests
UNION ALL SELECT 'compensation_claims', COUNT(*) FROM compensation_claims
UNION ALL SELECT 'unit_sensor_readings', COUNT(*) FROM unit_sensor_readings
UNION ALL SELECT 'held_goods', COUNT(*) FROM held_goods
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'activity_logs', COUNT(*) FROM activity_logs
UNION ALL SELECT 'login_history', COUNT(*) FROM login_history
UNION ALL SELECT 'damage_cases', COUNT(*) FROM damage_cases
UNION ALL SELECT 'unit_transfers', COUNT(*) FROM unit_transfers;
GO

/* ============================================================
   QueenKho — SCRIPT DATABASE ĐẦY ĐỦ (SQL Server)
   Gộp từ: QueenKho.sql + Update_activity_logs.sql + QueenKhoDuLieuMau_UC09.sql
           + rental_policies_data.sql + setup_test_env.sql  (cập nhật tới UC-17)

   ⚠️ XOÁ VÀ TẠO LẠI TOÀN BỘ QueenKhoDB — mất hết dữ liệu local (đơn, hợp đồng, task...)
   Chạy 1 lần trên SSMS (F5). Chạy xong nhớ đăng nhập lại trên FE.

   Tài khoản test (mật khẩu đều là 123456):
     - Khách hàng (5)        : khachhang<1..5>@gmail.com     vd khachhang1@gmail.com
     - Quản lý (1 / cơ sở)   : fm<cơ sở>@gmail.com           vd fmtanbinh@gmail.com
     - Nhân viên (3 / cơ sở) : staff<cơ sở><1..3>@gmail.com  vd stafftanbinh1@gmail.com
     <cơ sở> = tanbinh | binhthanh | thuduc | govap | caugiay | quan7
     - BOM                   : bom@queenkho.com
     - Quản trị (2)          : admin@queenkho.com, admin2@queenkho.com
     - system@queenkho.local : tài khoản của job tự động, KHÔNG đăng nhập được
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
    features            NVARCHAR(500)  NULL
);
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
    CONSTRAINT FK_storageunits_facility FOREIGN KEY (facility_id)  REFERENCES facilities(id),
    CONSTRAINT FK_storageunits_unittype FOREIGN KEY (unit_type_id) REFERENCES unit_types(id)
);
GO
CREATE INDEX IX_storageunits_facility ON storage_units(facility_id);
CREATE INDEX IX_storageunits_unittype ON storage_units(unit_type_id);
GO

/* ---------- 6. rental_policy ---------- */
CREATE TABLE rental_policy (
    id                          INT IDENTITY(1,1) PRIMARY KEY,
    facility_id                 INT NOT NULL,
    policy_name                 NVARCHAR(150) NOT NULL,
    deposit_month_multiplier    INT NOT NULL DEFAULT 1,
    cancel_fee_percent          INT NOT NULL DEFAULT 0,
    cancel_free_hours           INT NOT NULL DEFAULT 0,
    lock_account_days           INT NOT NULL DEFAULT 0,
    late_fee_per_day            DECIMAL(12,2) NOT NULL DEFAULT 0,
    liquidation_days            INT NOT NULL DEFAULT 0,
    CONSTRAINT FK_rentalpolicy_facility FOREIGN KEY (facility_id) REFERENCES facilities(id)
);
GO
CREATE INDEX IX_rentalpolicy_facility ON rental_policy(facility_id);
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
    created_at                  DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_reservations_customer    FOREIGN KEY (customer_id)     REFERENCES users(id),
    CONSTRAINT FK_reservations_facility    FOREIGN KEY (facility_id)     REFERENCES facilities(id),
    CONSTRAINT FK_reservations_unittype    FOREIGN KEY (unit_type_id)    REFERENCES unit_types(id),
    CONSTRAINT FK_reservations_storageunit FOREIGN KEY (storage_unit_id) REFERENCES storage_units(id)
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
    payment_type        NVARCHAR(30) NOT NULL,   -- DEPOSIT / MONTHLY_RENT / REFUND / LATE_FEE
    payment_method      NVARCHAR(30) NOT NULL,   -- VNPAY / MOMO / BANK_TRANSFER / CASH
    amount              DECIMAL(12,2) NOT NULL,
    renewal_months      INT NULL,                -- gói gia hạn 1 / 3 / 6 / 12 tháng; không suy ra từ transaction_code
    status              NVARCHAR(30) NOT NULL DEFAULT 'PENDING', -- PENDING / SUCCESS / FAILED / REFUNDED
    paid_at             DATETIME2 NULL,
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
    staff_id                        INT NOT NULL,
    record_type                     NVARCHAR(30) NOT NULL,  -- CHECK_IN / CHECK_OUT
    is_identity_verified            BIT NOT NULL DEFAULT 0,
    is_empty                        BIT NOT NULL DEFAULT 1,
    is_clean                        BIT NOT NULL DEFAULT 1,
    is_lock_intact                  BIT NOT NULL DEFAULT 1,
    customer_signature_confirmed    BIT NOT NULL DEFAULT 0,
    notes                           NVARCHAR(MAX) NULL,
    created_at                      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_handover_contract FOREIGN KEY (contract_id) REFERENCES rental_contracts(id),
    CONSTRAINT FK_handover_staff    FOREIGN KEY (staff_id)    REFERENCES users(id)
);
GO
CREATE INDEX IX_handover_contract ON handover_records(contract_id);
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
    evidence_image_url  NVARCHAR(1000) NULL,                  -- ảnh bằng chứng chuyển khoản / nghiệm thu
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
    evidence_image_urls NVARCHAR(MAX) NULL,                       -- Danh sách link ảnh (JSON array hoặc dấu phẩy phân tách)
    created_at          DATETIME2(7) NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_damagecases_contract FOREIGN KEY (contract_id) REFERENCES rental_contracts(id),
    CONSTRAINT FK_damagecases_task     FOREIGN KEY (task_id) REFERENCES facility_tasks(id)
);
GO
CREATE INDEX IX_damagecases_contract ON damage_cases(contract_id);
CREATE INDEX IX_damagecases_task ON damage_cases(task_id);
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
GO

/* ============================================================
   PHẦN 2 — DỮ LIỆU NỀN
   ============================================================ */

/* ---------- roles ---------- */
INSERT INTO roles (name, description) VALUES
    ('CUSTOMER',         N'Khách hàng thuê kho'),
    ('STAFF',            N'Nhân viên tại cơ sở'),
    ('FACILITY_MANAGER', N'Quản lý cơ sở'),
    ('BOM',              N'Business Operations Manager'),
    ('ADMIN',            N'Quản trị hệ thống');
GO

/* ---------- facilities (id cố định 1..6) ---------- */
SET IDENTITY_INSERT facilities ON;
INSERT INTO facilities (id, code, name, city, district, address, hotline, status) VALUES
    (1, 'TB', N'QueenKho Tân Bình',   N'TP.HCM', N'Tân Bình',   N'142 Cộng Hòa, P.13',               N'028-3811-0001', 'ACTIVE'),
    (2, 'BT', N'QueenKho Bình Thạnh', N'TP.HCM', N'Bình Thạnh', N'456 Điện Biên Phủ, P.22',          N'028-3811-0003', 'ACTIVE'),
    (3, 'TD', N'QueenKho Thủ Đức',    N'TP.HCM', N'Thủ Đức',    N'789 Võ Văn Ngân, P.Linh Chiểu',    N'028-3811-0004', 'ACTIVE'),
    (4, 'GV', N'QueenKho Gò Vấp',     N'TP.HCM', N'Gò Vấp',     N'321 Quang Trung, P.10',            N'028-3811-0005', 'ACTIVE'),
    (5, 'CG', N'QueenKho Cầu Giấy',   N'Hà Nội', N'Cầu Giấy',   N'56 Duy Tân, P.Dịch Vọng Hậu',      N'024-3511-0001', 'ACTIVE'),
    (6, 'Q7', N'QueenKho Quận 7',     N'TP.HCM', N'Quận 7',     N'123 Nguyễn Văn Linh, P.Tân Phong', N'028-3811-0002', 'ACTIVE');
SET IDENTITY_INSERT facilities OFF;
GO

/* ---------- unit_types (id cố định 1..6) ---------- */
SET IDENTITY_INSERT unit_types ON;
INSERT INTO unit_types (id, name, area_sqm, volume_cbm, base_price_monthly, suggested_capacity, dimensions, features) VALUES
    (1, N'Kho Mini M',      3.5,  8.4,   750000, N'10–20 thùng carton',          N'1.5m × 2.3m × 2.4m', N'Cá nhân, đồ theo mùa'),
    (2, N'Kho Tiêu Chuẩn',  6.0,  16.2, 1850000, N'20–40 thùng, nội thất nhỏ',   N'2.5m × 2.4m × 2.7m', N'Phổ biến nhất, phù hợp chuyển nhà'),
    (3, N'Kho Gia Đình',    12.0, 32.4, 3450000, N'Đồ 1 phòng ngủ hoặc VP nhỏ',  N'4.0m × 3.0m × 2.7m', N'Gia đình, doanh nghiệp nhỏ'),
    (4, N'Kho Lớn',         16.0, 43.2, 4500000, N'Đồ 2 phòng ngủ hoặc hàng hóa', N'4.0m × 4.0m × 2.7m', N'Doanh nghiệp, kho hàng'),
    (5, N'Kho Đặc Biệt XL', 25.0, 67.5, 6500000, N'Hàng hóa lớn, máy móc',       N'5.0m × 5.0m × 2.7m', N'Doanh nghiệp, sản xuất'),
    (6, N'Kho nhỏ 2m²',     2.0,  4.8,   500000, N'5–10 thùng carton',           N'1.0m × 2.0m × 2.4m', N'Cá nhân, sinh viên, giấy tờ');
SET IDENTITY_INSERT unit_types OFF;
GO

/* ---------- rental_policy: mỗi cơ sở 1 chính sách (id = facility_id) ---------- */
SET IDENTITY_INSERT rental_policy ON;
INSERT INTO rental_policy (id, facility_id, policy_name, deposit_month_multiplier, cancel_fee_percent, cancel_free_hours, late_fee_per_day, lock_account_days, liquidation_days) VALUES
    (1, 1, N'Chính sách Kho Tân Bình - Tiêu chuẩn',   1, 50, 24, 50000, 5, 30),
    (2, 2, N'Chính sách Kho Bình Thạnh - Tiêu chuẩn', 1, 50, 24, 50000, 5, 30),
    (3, 3, N'Chính sách Kho Thủ Đức - Tiêu chuẩn',    1, 50, 24, 50000, 5, 30),
    (4, 4, N'Chính sách Kho Gò Vấp - Tiêu chuẩn',     1, 50, 24, 50000, 5, 30),
    (5, 5, N'Chính sách Kho Cầu Giấy - Tiêu chuẩn',   1, 50, 24, 50000, 5, 30),
    (6, 6, N'Chính sách Kho Quận 7 - Tiêu chuẩn',     1, 50, 24, 50000, 5, 30);
SET IDENTITY_INSERT rental_policy OFF;
GO

/* ---------- storage_units ----------
   Mã ô: KV-<cơ sở>-<zone><phòng>. Một số ô OCCUPIED / MAINTENANCE sẵn để demo tìm kiếm (UC-09).
   unit_type_id: 1 Mini M · 2 Tiêu Chuẩn · 3 Gia Đình · 4 Lớn · 5 XL · 6 Nhỏ 2m² */
INSERT INTO storage_units (id, facility_id, unit_type_id, floor, zone, room_number, status)
SELECT code, facility_id, unit_type_id, N'Tầng 1', SUBSTRING(code, 7, 1), RIGHT(code, 3), status
FROM (VALUES
    -- Tân Bình (1)
    ('KV-TB-A101', 1, 2, 'AVAILABLE'), ('KV-TB-A102', 1, 2, 'AVAILABLE'), ('KV-TB-A103', 1, 2, 'OCCUPIED'),
    ('KV-TB-A104', 1, 2, 'AVAILABLE'), ('KV-TB-A105', 1, 2, 'OCCUPIED'),
    ('KV-TB-B201', 1, 3, 'AVAILABLE'), ('KV-TB-B202', 1, 3, 'OCCUPIED'),
    ('KV-TB-B203', 1, 4, 'AVAILABLE'), ('KV-TB-B204', 1, 4, 'MAINTENANCE'),
    ('KV-TB-C101', 1, 6, 'AVAILABLE'), ('KV-TB-C102', 1, 6, 'AVAILABLE'), ('KV-TB-C105', 1, 6, 'MAINTENANCE'),
    ('KV-TB-C103', 1, 1, 'OCCUPIED'),  ('KV-TB-C104', 1, 1, 'AVAILABLE'),
    -- Bình Thạnh (2)
    ('KV-BT-A101', 2, 2, 'AVAILABLE'), ('KV-BT-A102', 2, 6, 'AVAILABLE'), ('KV-BT-A103', 2, 1, 'AVAILABLE'),
    ('KV-BT-B201', 2, 4, 'AVAILABLE'), ('KV-BT-B202', 2, 5, 'AVAILABLE'), ('KV-BT-B203', 2, 3, 'OCCUPIED'),
    -- Thủ Đức (3)
    ('KV-TD-A101', 3, 6, 'AVAILABLE'), ('KV-TD-A102', 3, 1, 'AVAILABLE'), ('KV-TD-A103', 3, 2, 'AVAILABLE'),
    ('KV-TD-A104', 3, 2, 'OCCUPIED'),  ('KV-TD-B201', 3, 3, 'AVAILABLE'),
    -- Gò Vấp (4)
    ('KV-GV-A101', 4, 6, 'AVAILABLE'), ('KV-GV-A102', 4, 1, 'AVAILABLE'), ('KV-GV-A103', 4, 2, 'AVAILABLE'),
    ('KV-GV-B201', 4, 4, 'OCCUPIED'),
    -- Cầu Giấy (5)
    ('KV-CG-A101', 5, 6, 'AVAILABLE'), ('KV-CG-A102', 5, 2, 'AVAILABLE'), ('KV-CG-A103', 5, 2, 'AVAILABLE'),
    ('KV-CG-A104', 5, 3, 'AVAILABLE'), ('KV-CG-B201', 5, 4, 'AVAILABLE'), ('KV-CG-B202', 5, 5, 'OCCUPIED'),
    -- Quận 7 (6)
    ('KV-Q7-A101', 6, 2, 'AVAILABLE'), ('KV-Q7-A102', 6, 2, 'AVAILABLE'), ('KV-Q7-A103', 6, 3, 'AVAILABLE'),
    ('KV-Q7-B201', 6, 6, 'AVAILABLE'), ('KV-Q7-B202', 6, 1, 'OCCUPIED'),  ('KV-Q7-B203', 6, 4, 'AVAILABLE'),
    ('KV-Q7-B204', 6, 5, 'AVAILABLE')
) AS s(code, facility_id, unit_type_id, status);
GO

/* ============================================================
   PHẦN 3 — TÀI KHOẢN TEST (mật khẩu 123456, BCrypt)
   ============================================================ */
DECLARE @pw NVARCHAR(255) = '$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu';

-- 5 khách hàng: khachhang1..5@gmail.com (không gán cơ sở)
INSERT INTO users (full_name, email, password_hash, phone, role_id, facility_id, status)
SELECT N'Khách Hàng ' + CAST(n.no AS NVARCHAR(2)),
       'khachhang' + CAST(n.no AS VARCHAR(2)) + '@gmail.com', @pw,
       '090000000' + CAST(n.no AS VARCHAR(2)),
       (SELECT id FROM roles WHERE name = 'CUSTOMER'), NULL, 'ACTIVE'
FROM (VALUES (1), (2), (3), (4), (5)) AS n(no);

-- Mỗi cơ sở: 1 Facility Manager + 3 nhân viên
DECLARE @site TABLE (facility_id INT, short_name NVARCHAR(50), slug VARCHAR(20), code VARCHAR(2));
INSERT INTO @site VALUES
    (1, N'Tân Bình',   'tanbinh',   '01'),
    (2, N'Bình Thạnh', 'binhthanh', '02'),
    (3, N'Thủ Đức',    'thuduc',    '03'),
    (4, N'Gò Vấp',     'govap',     '04'),
    (5, N'Cầu Giấy',   'caugiay',   '05'),
    (6, N'Quận 7',     'quan7',     '06');

INSERT INTO users (full_name, email, password_hash, phone, role_id, facility_id, status)
SELECT N'Quản lý ' + s.short_name, 'fm' + s.slug + '@gmail.com', @pw, '09010000' + s.code,
       (SELECT id FROM roles WHERE name = 'FACILITY_MANAGER'), s.facility_id, 'ACTIVE'
FROM @site s;

INSERT INTO users (full_name, email, password_hash, phone, role_id, facility_id, status)
SELECT N'Nhân viên ' + s.short_name + N' ' + CAST(n.no AS NVARCHAR(2)),
       'staff' + s.slug + CAST(n.no AS VARCHAR(2)) + '@gmail.com', @pw,
       '09020' + s.code + CAST(n.no AS VARCHAR(2)),
       (SELECT id FROM roles WHERE name = 'STAFF'), s.facility_id, 'ACTIVE'
FROM @site s
CROSS JOIN (VALUES (1), (2), (3)) AS n(no);

-- 1 BOM (Quản lý vận hành toàn hệ thống): bom@queenkho.com / 123456
INSERT INTO users (full_name, email, password_hash, phone, role_id, facility_id, status)
VALUES (N'Business Operations Manager', 'bom@queenkho.com', @pw, '0908889999',
       (SELECT id FROM roles WHERE name = 'BOM'), NULL, 'ACTIVE');

-- UC-03: 2 Quản trị viên (admin2 để test PR-A7 "luôn còn ≥ 1 Admin ACTIVE")
INSERT INTO users (full_name, email, password_hash, phone, role_id, facility_id, status)
SELECT v.full_name, v.email, @pw, v.phone,
       (SELECT id FROM roles WHERE name = 'ADMIN'), NULL, 'ACTIVE'
FROM (VALUES (N'Quản trị viên',   'admin@queenkho.com',  '0903000001'),
             (N'Quản trị viên 2', 'admin2@queenkho.com', '0903000002')) AS v(full_name, email, phone);

-- PR-A8: tài khoản "system" = người thao tác của các job tự động trong activity_logs.
-- DISABLED + hash không phải BCrypt → passwordEncoder.matches() luôn false → không đăng nhập được.
INSERT INTO users (full_name, email, password_hash, phone, role_id, facility_id, status)
VALUES (N'Hệ thống', 'system@queenkho.local', 'NO_LOGIN', '0000000000',
        (SELECT id FROM roles WHERE name = 'ADMIN'), NULL, 'DISABLED');
GO

/* ---------- Kiểm tra ---------- */
SELECT 'roles' AS [table], COUNT(*) AS [rows] FROM roles
UNION ALL SELECT 'facilities',    COUNT(*) FROM facilities
UNION ALL SELECT 'unit_types',    COUNT(*) FROM unit_types
UNION ALL SELECT 'rental_policy', COUNT(*) FROM rental_policy
UNION ALL SELECT 'storage_units', COUNT(*) FROM storage_units
UNION ALL SELECT 'users',         COUNT(*) FROM users;
GO
/* ---------- 14. Đồng bộ bảng và Trigger Hoàn Cọc (UC-15, UC-22, UC-25) ---------- */
-- Đảm bảo tương thích nếu database cũ dùng tên 'staff_tasks'
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'staff_tasks') 
   AND NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'facility_tasks')
BEGIN
    EXEC sp_rename 'staff_tasks', 'facility_tasks';
END
GO

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'facility_tasks')
   AND NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('facility_tasks') AND name = 'evidence_image_url')
BEGIN
    ALTER TABLE facility_tasks ADD evidence_image_url NVARCHAR(1000) NULL;
END
GO

-- Trigger tự động đồng bộ trạng thái đơn và giao dịch hoàn tiền
CREATE OR ALTER TRIGGER trg_payment_transactions_refund_sync
ON payment_transactions
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
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
    
    -- 1. Khi task REFUND chuyển sang COMPLETED gắn với hợp đồng: cập nhật contract = TERMINATED
    UPDATE c
    SET c.status = 'TERMINATED', c.deposit_held_amount = 0
    FROM rental_contracts c
    INNER JOIN inserted i ON c.id = i.contract_id
    WHERE i.task_type = 'REFUND' 
      AND i.status = 'COMPLETED'
      AND c.status <> 'TERMINATED';
      
    -- 2. Khi task REFUND chuyển sang COMPLETED (hủy đơn đặt chỗ): tìm reservation từ note và update REFUNDED
    UPDATE r
    SET r.status = 'REFUNDED'
    FROM reservations r
    INNER JOIN inserted i ON (
        i.note LIKE '%' + r.reservation_code + '%'
    )
    WHERE i.task_type = 'REFUND' 
      AND i.status = 'COMPLETED'
      AND r.status <> 'REFUNDED';
      
    -- 3. Cập nhật payment_transactions thành SUCCESS luôn nếu còn PENDING
    UPDATE p
    SET p.status = 'SUCCESS', p.paid_at = SYSDATETIME()
    FROM payment_transactions p
    INNER JOIN reservations r ON p.reservation_id = r.id
    INNER JOIN inserted i ON (
        i.note LIKE '%' + r.reservation_code + '%'
    )
    WHERE i.task_type = 'REFUND' 
      AND i.status = 'COMPLETED'
      AND p.payment_type = 'REFUND'
      AND p.status <> 'SUCCESS';
END;
GO


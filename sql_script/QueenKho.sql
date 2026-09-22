/* ============================================================
   QueenKho — DB Schema (SQL Server)
   Sinh từ erd-no-grid.drawio — SETUP-01, Sprint 0
   Thứ tự tạo bảng theo phụ thuộc khóa ngoại (bảng cha trước).
   ============================================================ */

IF DB_ID('QueenKhoDB') IS NULL
BEGIN
    CREATE DATABASE QueenKhoDB;
END
GO

USE QueenKhoDB;
GO

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
    facility_id     INT NULL,             -- nullable: chỉ Facility Manager/Staff mới gán cơ sở
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
-- id là mã ô kho dạng chuỗi (vd: "A-104") theo đúng ERD, không dùng IDENTITY
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
    storage_unit_id             NVARCHAR(20) NULL,   -- nullable: FM chỉ gán ô sau khi duyệt (UC-14)
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
                            -- ACTIVE / OVERDUE / TERMINATED / LIQUIDATED
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
    contract_id         INT NULL,        -- tiền thuê hàng tháng gắn với contract
    payment_type        NVARCHAR(30) NOT NULL,   -- DEPOSIT / MONTHLY_RENT / REFUND / LATE_FEE
    payment_method      NVARCHAR(30) NOT NULL,   -- VNPAY / MOMO / BANK_TRANSFER / CASH
    amount              DECIMAL(12,2) NOT NULL,
    status              NVARCHAR(30) NOT NULL DEFAULT 'PENDING', -- PENDING / SUCCESS / FAILED / REFUNDED
    paid_at             DATETIME2 NULL,
    CONSTRAINT FK_payments_user        FOREIGN KEY (user_id)        REFERENCES users(id),
    CONSTRAINT FK_payments_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id),
    CONSTRAINT FK_payments_contract    FOREIGN KEY (contract_id)    REFERENCES rental_contracts(id)
);
GO
CREATE INDEX IX_payments_user        ON payment_transactions(user_id);
CREATE INDEX IX_payments_reservation ON payment_transactions(reservation_id);
CREATE INDEX IX_payments_contract    ON payment_transactions(contract_id);
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
    created_at      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_support_contract FOREIGN KEY (contract_id) REFERENCES rental_contracts(id),
    CONSTRAINT FK_support_customer FOREIGN KEY (customer_id) REFERENCES users(id)
);
GO
CREATE INDEX IX_support_customer ON support_requests(customer_id);
GO

/* ---------- 12. activity_logs ---------- */
CREATE TABLE activity_logs (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    user_id         INT NOT NULL,
    action          NVARCHAR(100) NOT NULL,
    target_entity   NVARCHAR(50)  NULL,   -- vd: "reservation", "contract"
    target_id       NVARCHAR(50)  NULL,   -- lưu string để tương thích cả PK int lẫn PK string (storage_units)
    created_at      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_activitylogs_user FOREIGN KEY (user_id) REFERENCES users(id)
);
GO
CREATE INDEX IX_activitylogs_user ON activity_logs(user_id);
GO

/* ============================================================
   Seed tối thiểu để test kết nối & login (SETUP-02, UC-01)
   ============================================================ */
INSERT INTO roles (name, description) VALUES
    ('CUSTOMER', N'Khách hàng thuê kho'),
    ('STAFF', N'Nhân viên tại cơ sở'),
    ('FACILITY_MANAGER', N'Quản lý cơ sở'),
    ('BOM', N'Business Operations Manager'),
    ('ADMIN', N'Quản trị hệ thống');
GO


Select * from roles
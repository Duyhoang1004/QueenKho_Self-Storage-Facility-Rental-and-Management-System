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
    features            NVARCHAR(500)  NULL,
    status              NVARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE / INACTIVE (UC-05, PR-M4)
    CONSTRAINT UQ_unit_types_name UNIQUE (name)                    -- PR-M3
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
    version                    INT NOT NULL DEFAULT 1,
    is_active                   BIT NOT NULL DEFAULT 0,
    created_at                  DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    created_by_user_id          INT NULL,
    CONSTRAINT UQ_rentalpolicy_facility_version UNIQUE (facility_id, version),
    CONSTRAINT CK_rentalpolicy_values CHECK (deposit_month_multiplier BETWEEN 1 AND 3 AND cancel_fee_percent BETWEEN 0 AND 100 AND cancel_free_hours >= 0 AND late_fee_percent_per_day BETWEEN 0 AND 100 AND late_fee_max_percent BETWEEN late_fee_percent_per_day AND 100 AND liquidation_days >= 1),
    CONSTRAINT CK_rentalpolicy_discounts CHECK (booking_discount_3m BETWEEN 0 AND 50 AND booking_discount_6m BETWEEN 0 AND 50 AND booking_discount_12m BETWEEN 0 AND 50 AND renewal_discount_3m BETWEEN 0 AND 50 AND renewal_discount_6m BETWEEN 0 AND 50 AND renewal_discount_12m BETWEEN 0 AND 50),
    CONSTRAINT CK_rentalpolicy_overstay CHECK (overstay_percent BETWEEN 100 AND 300 AND held_goods_fee_percent BETWEEN 0 AND 100),
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
    rent_discount_percent       INT NULL,            -- % ưu đãi tiền thuê chốt lúc tạo đơn (giống deposit_amount)
    terms_version               NVARCHAR(20) NULL,   -- Phiên bản điều khoản xử lý tài sản khách đã đồng ý (NULL = đơn cũ, chưa đồng ý)
    terms_accepted_at           DATETIME2 NULL,      -- Thời điểm khách tick đồng ý điều khoản khi đặt kho
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
    late_fee_waived         BIT NOT NULL DEFAULT 0,       -- FM miễn phí trễ cho đợt quá hạn hiện tại
    late_fee_waiver_note    NVARCHAR(500) NULL,
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
    payment_type        NVARCHAR(30) NOT NULL,   -- DEPOSIT / MONTHLY_RENT / REFUND / LATE_FEE / DAMAGE_FEE / OVERSTAY_FEE (phí chiếm dụng + phí lưu giữ hàng)
    payment_method      NVARCHAR(30) NOT NULL,   -- VNPAY / MOMO / BANK_TRANSFER / CASH
    amount              DECIMAL(12,2) NOT NULL,
    renewal_months      INT NULL,                -- gói gia hạn 1 / 3 / 6 / 12 tháng; không suy ra từ transaction_code
    status              NVARCHAR(30) NOT NULL DEFAULT 'PENDING', -- PENDING / SUCCESS / FAILED / REFUNDED
    paid_at             DATETIME2 NULL,
    bank_transaction_code NVARCHAR(100) NULL,    -- Mã giao dịch từ ngân hàng (FT... hoặc vnp_BankTranNo / vnp_TransactionNo)
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
    created_at      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_support_contract FOREIGN KEY (contract_id) REFERENCES rental_contracts(id),
    CONSTRAINT FK_support_customer FOREIGN KEY (customer_id) REFERENCES users(id)
);
GO
CREATE INDEX IX_support_customer ON support_requests(customer_id);
GO

/* ---------- 11b. facility_tasks (UC-16, UC-17, UC-18, REFUND) ----------
   Bảng công việc tại cơ sở, sinh tự động:
   - CHECK_IN : khi Manager gán ô (UC-14)
   - CHECK_OUT: khi khách yêu cầu trả kho (UC-22)
   - REFUND   : khi khách hủy đơn cọc (UC-15) - Manager thực hiện hoàn cọc
   - SUPPORT  : khi khách gửi yêu cầu hỗ trợ
   Có IF guard để chạy lại script trên DB cũ vẫn tạo được bảng. */
IF OBJECT_ID('facility_tasks', 'U') IS NULL
BEGIN
    CREATE TABLE facility_tasks (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        facility_id         INT NOT NULL,
        task_type           NVARCHAR(50) NOT NULL,                -- CHECK_IN, CHECK_OUT, SUPPORT, REFUND, MAINTENANCE...
        contract_id         INT NULL,                             -- Bắt buộc với CHECK_IN / CHECK_OUT
        support_request_id  INT NULL,                             -- Bắt buộc với SUPPORT
        status              NVARCHAR(30) NOT NULL DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, OVERDUE, COMPLETED, CANCELLED
        staff_id            INT NULL,                             -- ID người phụ trách (Staff hoặc Facility Manager)
        due_at              DATETIME2(7) NOT NULL,                -- Deadline hoàn thành
        evidence_image_url  NVARCHAR(MAX) NULL,
        maintenance_reason  NVARCHAR(20) NULL,
        note                NVARCHAR(1000) NULL,                  -- Chi tiết STK, thông tin hoàn cọc
        created_at          DATETIME2(7) NOT NULL DEFAULT SYSDATETIME(),
        claimed_at          DATETIME2(7) NULL,
        completed_at        DATETIME2(7) NULL,
        CONSTRAINT FK_facilitytasks_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
        CONSTRAINT FK_facilitytasks_contract FOREIGN KEY (contract_id) REFERENCES rental_contracts(id),
        CONSTRAINT FK_facilitytasks_support  FOREIGN KEY (support_request_id) REFERENCES support_requests(id),
        CONSTRAINT FK_facilitytasks_user     FOREIGN KEY (staff_id)    REFERENCES users(id),
        CONSTRAINT CK_facilitytasks_type     CHECK (task_type IN ('CHECK_IN', 'CHECK_OUT', 'SUPPORT', 'REFUND', 'MAINTENANCE')),
        CONSTRAINT CK_facilitytasks_status   CHECK (status IN ('OPEN', 'IN_PROGRESS', 'OVERDUE', 'COMPLETED', 'CANCELLED')),
        CONSTRAINT CK_facilitytasks_target   CHECK (
            (task_type IN ('CHECK_IN', 'CHECK_OUT') AND contract_id IS NOT NULL)
            OR (task_type = 'SUPPORT' AND support_request_id IS NOT NULL)
            OR (task_type IN ('REFUND', 'MAINTENANCE'))
        )
    );
    CREATE INDEX IX_facilitytasks_facility_status ON facility_tasks(facility_id, status);
    CREATE INDEX IX_facilitytasks_staff           ON facility_tasks(staff_id);
END
GO

/* ---------- 11c. damage_cases (UC-23, UC-24) ---------- */
IF OBJECT_ID('damage_cases', 'U') IS NULL
BEGIN
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
    CREATE INDEX IX_damagecases_contract ON damage_cases(contract_id);
    CREATE INDEX IX_damagecases_task ON damage_cases(task_id);
END
GO

/* ---------- 11d. held_goods (PR-Q10: hàng của khách lưu giữ sau thanh lý) ----------
   Tạo khi Staff / FM bấm "Dọn xong" task dọn kho sau thanh lý (kèm biên bản kiểm kê).
   HOLDING 60 ngày → RETURNED (khách trả hết nợ, nhận lại) / SOLD (hết hạn + khách đã đồng ý điều khoản)
   / DESTROYED (hết hạn, không còn giá trị) / HANDED_TO_AUTHORITY (hàng cấm, giấy tờ — làm bất cứ lúc nào). */
IF OBJECT_ID('held_goods', 'U') IS NULL
BEGIN
    CREATE TABLE held_goods (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        contract_id         INT NOT NULL,
        facility_id         INT NOT NULL,
        task_id             INT NULL,                                 -- task MAINTENANCE dọn kho đã tạo bản ghi
        inventory_note      NVARCHAR(2000) NOT NULL,                  -- Danh sách hàng kiểm kê
        evidence_image_urls NVARCHAR(MAX) NULL,                       -- Ảnh kiểm kê (link, phân tách bằng |||)
        witness_note        NVARCHAR(500) NOT NULL,                   -- Người mở kho / chứng kiến
        storage_location    NVARCHAR(100) NOT NULL,                   -- Khu lưu giữ (VD: Kho K2 - kệ 3)
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
        CONSTRAINT FK_heldgoods_resolver FOREIGN KEY (resolved_by) REFERENCES users(id),
        CONSTRAINT FK_heldgoods_creator  FOREIGN KEY (created_by)  REFERENCES users(id),
        CONSTRAINT CK_heldgoods_status   CHECK (status IN ('HOLDING', 'RETURNED', 'SOLD', 'DESTROYED', 'HANDED_TO_AUTHORITY'))
    );
    CREATE INDEX IX_heldgoods_facility_status ON held_goods(facility_id, status);
    CREATE INDEX IX_heldgoods_contract ON held_goods(contract_id);
END
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


Select * from roles;
GO

/* =========================================================================
   13. TRIGGER TỰ ĐỘNG ĐỒNG BỘ TRẠNG THÁI HOÀN TIỀN CỌC (UC-15, UC-22, UC-25)
   ========================================================================= */

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
    
    -- 1. Hoàn cọc khi trả kho (có gắn hợp đồng): Cập nhật hợp đồng TERMINATED và cọc giữ về 0
    UPDATE c
    SET c.status = 'TERMINATED', c.deposit_held_amount = 0
    FROM rental_contracts c
    INNER JOIN inserted i ON c.id = i.contract_id
    WHERE i.task_type = 'REFUND' 
      AND i.status = 'COMPLETED'
      AND c.status <> 'TERMINATED';
      
    -- 2. Hoàn cọc khi khách hủy giữ chỗ: Cập nhật đơn đặt chỗ thành REFUNDED
    UPDATE r
    SET r.status = 'REFUNDED'
    FROM reservations r
    INNER JOIN inserted i ON (
        i.note LIKE '%' + r.reservation_code + '%'
    )
    WHERE i.task_type = 'REFUND' 
      AND i.status = 'COMPLETED'
      AND r.status <> 'REFUNDED';
      
    -- 3. Cập nhật bản ghi thanh toán hoàn cọc thành SUCCESS nếu còn PENDING
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

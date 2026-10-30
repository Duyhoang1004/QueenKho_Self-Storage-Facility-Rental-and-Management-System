-- ============================================================
-- V2__sync_latest_migrations.sql: Đồng bộ các cột và bảng mới nhất
-- Đảm bảo an toàn cho mọi máy đã có sẵn Database QueenKhoDB
-- ============================================================

-- 1. payment_transactions: renewal_months & bank_transaction_code
IF COL_LENGTH('payment_transactions', 'renewal_months') IS NULL
BEGIN
    ALTER TABLE payment_transactions ADD renewal_months INT NULL;
END
GO

IF COL_LENGTH('payment_transactions', 'bank_transaction_code') IS NULL
BEGIN
    ALTER TABLE payment_transactions ADD bank_transaction_code NVARCHAR(100) NULL;
END
GO

-- 2. rental_policy: overstay_percent & held_goods_fee_percent
IF COL_LENGTH('rental_policy', 'overstay_percent') IS NULL
BEGIN
    ALTER TABLE rental_policy ADD overstay_percent INT NOT NULL DEFAULT 150;
END
GO

IF COL_LENGTH('rental_policy', 'held_goods_fee_percent') IS NULL
BEGIN
    ALTER TABLE rental_policy ADD held_goods_fee_percent INT NOT NULL DEFAULT 20;
END
GO

-- 3. damage_cases: liable_party
IF COL_LENGTH('damage_cases', 'liable_party') IS NULL
BEGIN
    ALTER TABLE damage_cases ADD liable_party NVARCHAR(20) NOT NULL DEFAULT 'CUSTOMER';
END
GO

-- 4. reservations: rent_discount_percent, terms_version, terms_accepted_at
IF COL_LENGTH('reservations', 'rent_discount_percent') IS NULL
BEGIN
    ALTER TABLE reservations ADD rent_discount_percent INT NULL;
END
GO

IF COL_LENGTH('reservations', 'terms_version') IS NULL
BEGIN
    ALTER TABLE reservations ADD terms_version NVARCHAR(20) NULL;
END
GO

IF COL_LENGTH('reservations', 'terms_accepted_at') IS NULL
BEGIN
    ALTER TABLE reservations ADD terms_accepted_at DATETIME2 NULL;
END
GO

-- 5. rental_contracts: late_fee_waived & late_fee_waiver_note
IF COL_LENGTH('rental_contracts', 'late_fee_waived') IS NULL
BEGIN
    ALTER TABLE rental_contracts ADD late_fee_waived BIT NOT NULL DEFAULT 0;
END
GO

IF COL_LENGTH('rental_contracts', 'late_fee_waiver_note') IS NULL
BEGIN
    ALTER TABLE rental_contracts ADD late_fee_waiver_note NVARCHAR(500) NULL;
END
GO

-- 6. facility_tasks: maintenance_reason & evidence_image_url
IF COL_LENGTH('facility_tasks', 'maintenance_reason') IS NULL
BEGIN
    ALTER TABLE facility_tasks ADD maintenance_reason NVARCHAR(20) NULL;
END
GO

IF COL_LENGTH('facility_tasks', 'evidence_image_url') IS NOT NULL
BEGIN
    ALTER TABLE facility_tasks ALTER COLUMN evidence_image_url NVARCHAR(MAX) NULL;
END
GO

-- 7. support_requests: resolution_note, resolved_at, closed_at
IF COL_LENGTH('support_requests', 'resolution_note') IS NULL
BEGIN
    ALTER TABLE support_requests ADD resolution_note NVARCHAR(1000) NULL;
END
GO

IF COL_LENGTH('support_requests', 'resolved_at') IS NULL
BEGIN
    ALTER TABLE support_requests ADD resolved_at DATETIME2 NULL;
END
GO

IF COL_LENGTH('support_requests', 'closed_at') IS NULL
BEGIN
    ALTER TABLE support_requests ADD closed_at DATETIME2 NULL;
END
GO

-- 8. held_goods: tạo bảng nếu chưa có
IF OBJECT_ID('held_goods', 'U') IS NULL
BEGIN
    CREATE TABLE held_goods (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        contract_id         INT NOT NULL,
        facility_id         INT NOT NULL,
        task_id             INT NULL,
        inventory_note      NVARCHAR(2000) NOT NULL,
        evidence_image_urls NVARCHAR(MAX) NULL,
        witness_note        NVARCHAR(500) NOT NULL,
        storage_location    NVARCHAR(100) NOT NULL,
        status              NVARCHAR(30) NOT NULL DEFAULT 'HOLDING',
        hold_until          DATE NOT NULL,
        proceeds_amount     DECIMAL(12,2) NULL,
        debt_offset_amount  DECIMAL(12,2) NULL,
        refund_amount       DECIMAL(12,2) NULL,
        storage_fee_amount  DECIMAL(12,2) NULL,
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

-- 9. login_history: tạo bảng nếu chưa có
IF OBJECT_ID('login_history', 'U') IS NULL
BEGIN
    CREATE TABLE login_history (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        user_id         INT NULL,
        email           NVARCHAR(255) NOT NULL,
        event_type      NVARCHAR(20)  NOT NULL,
        failure_reason  NVARCHAR(50)  NULL,
        ip_address      NVARCHAR(64)  NULL,
        user_agent      NVARCHAR(300) NULL,
        created_at      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_loginhistory_user FOREIGN KEY (user_id) REFERENCES users(id),
        CONSTRAINT CK_loginhistory_event CHECK (event_type IN ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT'))
    );
    CREATE INDEX IX_loginhistory_created_at ON login_history(created_at DESC);
    CREATE INDEX IX_loginhistory_user ON login_history(user_id);
END
GO

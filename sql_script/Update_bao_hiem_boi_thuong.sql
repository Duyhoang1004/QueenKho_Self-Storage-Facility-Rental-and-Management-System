/* ============================================================
   QueenKho — Bảo hiểm hàng hoá & bồi thường hàng hư / mất (04/11/2026, góp ý giảng viên) — chạy được nhiều lần
   Dùng cho DB đang có dữ liệu; DB tạo mới từ QueenKho_full.sql / QueenKho_TongHop.sql đã có sẵn.
   Chạy SAU Update_bang_chung_chuyen_o.sql.

   1. reservations         : gói bảo hiểm khách chọn khi đặt kho + giá trị hàng khai báo (BR-125)
   2. rental_contracts     : cờ chấm dứt hợp đồng do lỗi cơ sở — không phí phá HĐ, hoàn tiền thuê theo ngày (BR-127)
   3. compensation_claims  : hồ sơ bồi thường hàng hư / mất (BR-126, BR-127, BR-128)
   4. unit_sensor_readings : nhiệt độ / độ ẩm từng ô (IoT mô phỏng — BR-129)

   sqlcmd: sqlcmd -S localhost -U sa -P 12345 -I -f 65001 -i sql_script/Update_bao_hiem_boi_thuong.sql
   ============================================================ */

USE QueenKhoDB;
GO

/* ---------- 1. reservations ---------- */
IF COL_LENGTH('reservations', 'insurance_plan') IS NULL
    ALTER TABLE reservations ADD insurance_plan NVARCHAR(20) NOT NULL
        CONSTRAINT DF_reservations_insurance DEFAULT 'BASIC';                    -- BASIC / ADVANCED / PREMIUM
GO
IF COL_LENGTH('reservations', 'insurance_premium_monthly') IS NULL
    ALTER TABLE reservations ADD insurance_premium_monthly DECIMAL(15, 2) NOT NULL
        CONSTRAINT DF_reservations_premium DEFAULT 0;                            -- phí bảo hiểm / tháng chốt lúc đặt
GO
IF COL_LENGTH('reservations', 'declared_goods_value') IS NULL
    ALTER TABLE reservations ADD declared_goods_value DECIMAL(15, 2) NULL;       -- giá trị hàng khách khai báo (căn cứ trần bồi thường)
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_reservations_insurance')
    ALTER TABLE reservations ADD CONSTRAINT CK_reservations_insurance
        CHECK (insurance_plan IN ('BASIC', 'ADVANCED', 'PREMIUM'));
GO

/* ---------- 2. rental_contracts ---------- */
IF COL_LENGTH('rental_contracts', 'fault_termination') IS NULL
    ALTER TABLE rental_contracts ADD fault_termination BIT NOT NULL
        CONSTRAINT DF_contracts_fault_termination DEFAULT 0;
GO

/* ---------- 3. compensation_claims ---------- */
IF OBJECT_ID('compensation_claims', 'U') IS NULL
BEGIN
    CREATE TABLE compensation_claims (
        id                   INT IDENTITY(1,1) PRIMARY KEY,
        claim_code           NVARCHAR(20)   NOT NULL UNIQUE,            -- BT-xxxxxx
        support_request_id   INT            NOT NULL UNIQUE,            -- ticket hỗ trợ GOODS_DAMAGE / GOODS_LOSS
        contract_id          INT            NOT NULL,
        customer_id          INT            NOT NULL,
        facility_id          INT            NOT NULL,
        claim_type           NVARCHAR(20)   NOT NULL,                   -- GOODS_DAMAGE / GOODS_LOSS
        incident_date        DATE           NULL,
        items_description    NVARCHAR(2000) NOT NULL,                   -- danh sách hàng + giá trị khách khai
        claimed_amount       DECIMAL(15, 2) NOT NULL,
        customer_images      NVARCHAR(MAX)  NULL,                       -- ảnh hàng hư / hoá đơn, ngăn bởi |||
        status               NVARCHAR(20)   NOT NULL DEFAULT 'SUBMITTED', -- SUBMITTED / INSPECTED / APPROVED / PAID / REJECTED / WITHDRAWN
        -- Kiểm tra hiện trường (Staff)
        inspected_by         INT            NULL,
        inspected_at         DATETIME2      NULL,
        inspection_note      NVARCHAR(1000) NULL,
        inspection_images    NVARCHAR(MAX)  NULL,
        preliminary_cause    NVARCHAR(20)   NULL,                       -- CUSTOMER / FACILITY / FORCE_MAJEURE / UNKNOWN
        -- Quyết định (FM)
        liable_party         NVARCHAR(20)   NULL,                       -- CUSTOMER / FACILITY / FORCE_MAJEURE
        assessed_value       DECIMAL(15, 2) NULL,                       -- giá trị hàng bị ảnh hưởng FM thẩm định
        damage_percent       INT            NULL,                       -- mất = 100
        unusable_days        INT            NULL,                       -- số ngày ô không dùng được
        coverage_cap         DECIMAL(15, 2) NULL,
        goods_compensation   DECIMAL(15, 2) NULL,
        penalty_amount       DECIMAL(15, 2) NULL,                       -- phạt vi phạm = 1 tháng giá thuê (lỗi cơ sở)
        rent_refund_amount   DECIMAL(15, 2) NULL,
        total_compensation   DECIMAL(15, 2) NULL,
        resolution           NVARCHAR(20)   NULL,                       -- CONTINUE / TERMINATE
        decision_note        NVARCHAR(1000) NULL,
        decided_by           INT            NULL,
        decided_at           DATETIME2      NULL,
        -- Chi trả (FM)
        payment_method       NVARCHAR(20)   NULL,                       -- BANK_TRANSFER / CASH
        payment_evidence     NVARCHAR(MAX)  NULL,
        bank_transaction_code NVARCHAR(100) NULL,
        paid_by              INT            NULL,
        paid_at              DATETIME2      NULL,
        -- Hồ sơ đòi bảo hiểm (cơ sở trả khách trước, sau đó đòi bên bảo hiểm)
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
    CREATE INDEX IX_claims_facility_status ON compensation_claims(facility_id, status);
    CREATE INDEX IX_claims_contract ON compensation_claims(contract_id);
END
GO

/* ---------- 4. unit_sensor_readings ---------- */
IF OBJECT_ID('unit_sensor_readings', 'U') IS NULL
BEGIN
    CREATE TABLE unit_sensor_readings (
        id              BIGINT IDENTITY(1,1) PRIMARY KEY,
        storage_unit_id NVARCHAR(20)  NOT NULL,
        temperature     DECIMAL(5, 2) NOT NULL,   -- °C
        humidity        DECIMAL(5, 2) NOT NULL,   -- %
        is_alert        BIT           NOT NULL DEFAULT 0,
        recorded_at     DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_sensor_unit FOREIGN KEY (storage_unit_id) REFERENCES storage_units(id)
    );
    CREATE INDEX IX_sensor_unit_time ON unit_sensor_readings(storage_unit_id, recorded_at DESC);
END
GO

PRINT N'Đã cập nhật: bảo hiểm hàng hoá, hồ sơ bồi thường, cảm biến nhiệt độ';
GO

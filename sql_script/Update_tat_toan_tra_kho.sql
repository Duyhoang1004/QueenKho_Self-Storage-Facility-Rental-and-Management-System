/* ============================================================
   QueenKho — D-21 (19/11/2026): Trả kho = tất toán, khách xác nhận kết thúc hợp đồng
   Chạy được nhiều lần. DB tạo mới từ QueenKho.sql / QueenKho_full.sql / QueenKho_TongHop.sql đã có sẵn.

   1. checkout_settlements           : bảng quyết toán trả kho, mỗi vòng (nghiệm thu / FM sửa / kiểm tra lại) 1 dòng (PR-O19)
   2. compensation_claims.settlement_id : hồ sơ bồi thường chi trả qua quyết toán (PR-O20, PR-O21)
   3. Trigger trg_facility_tasks_refund_sync : không ghi đè LIQUIDATED / SETTLEMENT_PENDING (L-44)

   Trạng thái hợp đồng mới: SETTLEMENT_PENDING (cột status không có CHECK, không cần ALTER).
   payment_method mới: SETTLEMENT_OFFSET (cấn trừ trong quyết toán, không phải tiền mới).

   sqlcmd: sqlcmd -S localhost -U sa -P 12345 -I -f 65001 -i sql_script/Update_tat_toan_tra_kho.sql
   ============================================================ */

USE QueenKhoDB;
GO

/* ---------- 1. checkout_settlements ---------- */
IF OBJECT_ID('checkout_settlements', 'U') IS NULL
BEGIN
    CREATE TABLE checkout_settlements (
        id                    INT IDENTITY(1,1) PRIMARY KEY,
        contract_id           INT            NOT NULL,
        round_no              INT            NOT NULL DEFAULT 1,
        check_out_task_id     INT            NULL,                       -- task CHECK_OUT (nghiệm thu / kiểm tra lại) sinh ra vòng này
        status                NVARCHAR(30)   NOT NULL,                   -- WAITING_CLAIM / WAITING_CUSTOMER / DISPUTED / RECHECKING / AWAITING_PAYMENT / COMPLETED / SUPERSEDED
        checkout_date         DATE           NOT NULL,                   -- ngày nghiệm thu — phí trễ / chiếm dụng chốt tại ngày này
        deposit_held          DECIMAL(15, 2) NOT NULL DEFAULT 0,
        damage_fee            DECIMAL(15, 2) NOT NULL DEFAULT 0,         -- sự cố lỗi khách
        late_fee              DECIMAL(15, 2) NOT NULL DEFAULT 0,         -- phí trễ (chỉ trừ trong phần cọc còn lại)
        overstay_fee          DECIMAL(15, 2) NOT NULL DEFAULT 0,         -- phí chiếm dụng
        rent_refund           DECIMAL(15, 2) NOT NULL DEFAULT 0,         -- hoàn tiền thuê trả sớm / fault_termination
        compensation_amount   DECIMAL(15, 2) NOT NULL DEFAULT 0,         -- bồi thường hồ sơ APPROVED
        net_amount            DECIMAL(15, 2) NOT NULL DEFAULT 0,         -- > 0 cơ sở hoàn khách, < 0 khách trả thêm
        breakdown_note        NVARCHAR(2000) NULL,
        staff_note            NVARCHAR(1000) NULL,
        manager_note          NVARCHAR(1000) NULL,
        dispute_reason        NVARCHAR(500)  NULL,
        disputed_at           DATETIME2      NULL,
        customer_confirmed_at DATETIME2      NULL,
        auto_confirmed        BIT            NOT NULL DEFAULT 0,
        refund_method         NVARCHAR(20)   NULL,                       -- BANK_TRANSFER / CASH (khách chọn lúc hẹn trả)
        debt_transaction_id   INT            NULL,                       -- dòng nợ khi quyết toán âm
        refund_task_id        INT            NULL,                       -- task REFUND khi quyết toán dương
        created_by            INT            NULL,
        created_at            DATETIME2      NOT NULL DEFAULT SYSDATETIME(),
        updated_at            DATETIME2      NULL,
        CONSTRAINT FK_settlements_contract FOREIGN KEY (contract_id)         REFERENCES rental_contracts(id),
        CONSTRAINT FK_settlements_task     FOREIGN KEY (check_out_task_id)   REFERENCES facility_tasks(id),
        CONSTRAINT FK_settlements_refund   FOREIGN KEY (refund_task_id)      REFERENCES facility_tasks(id),
        CONSTRAINT FK_settlements_debt     FOREIGN KEY (debt_transaction_id) REFERENCES payment_transactions(id),
        CONSTRAINT FK_settlements_creator  FOREIGN KEY (created_by)          REFERENCES users(id),
        CONSTRAINT CK_settlements_status   CHECK (status IN ('WAITING_CLAIM', 'WAITING_CUSTOMER', 'DISPUTED', 'RECHECKING',
                                                             'AWAITING_PAYMENT', 'COMPLETED', 'SUPERSEDED'))
    );
    CREATE INDEX IX_settlements_contract_status ON checkout_settlements(contract_id, status);
END
GO

/* ---------- 2. compensation_claims.settlement_id ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('compensation_claims') AND name = 'settlement_id')
    ALTER TABLE compensation_claims ADD settlement_id INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_claims_settlement')
    ALTER TABLE compensation_claims ADD CONSTRAINT FK_claims_settlement FOREIGN KEY (settlement_id) REFERENCES checkout_settlements(id);
GO

/* ---------- 3. Trigger hoàn tiền: giữ LIQUIDATED / SETTLEMENT_PENDING (L-44) ---------- */
CREATE OR ALTER TRIGGER trg_facility_tasks_refund_sync
ON facility_tasks
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Hoàn tiền gắn hợp đồng: cọc giữ về 0; chỉ chuyển TERMINATED khi hợp đồng chưa kết thúc theo đường khác
    UPDATE c
    SET c.status = CASE WHEN c.status IN ('LIQUIDATED', 'SETTLEMENT_PENDING') THEN c.status ELSE 'TERMINATED' END,
        c.deposit_held_amount = 0
    FROM rental_contracts c
    INNER JOIN inserted i ON c.id = i.contract_id
    WHERE i.task_type = 'REFUND'
      AND i.status = 'COMPLETED';

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

PRINT N'==> [D-21] Đã tạo checkout_settlements, compensation_claims.settlement_id và cập nhật trigger hoàn tiền.';
GO

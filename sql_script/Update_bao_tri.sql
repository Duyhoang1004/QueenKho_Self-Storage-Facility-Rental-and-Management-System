/* ============================================================
   QueenKho — Hoàn thiện bảo trì sau trả kho + điều khoản xử lý tài sản (27/10/2026)
   Chạy trên DB đang có dữ liệu (giữ nguyên dữ liệu, chạy lại nhiều lần không sao).
   DB mới thì chỉ cần QueenKho_full.sql (đã gộp các thay đổi dưới đây).

   1. damage_cases : phân lỗi sự cố CUSTOMER (trừ cọc) / FACILITY (cơ sở chịu, hoàn cọc bình thường)
   2. reservations : lưu phiên bản + thời điểm khách đồng ý điều khoản xử lý tài sản khi không trả kho
   3. facility_tasks: lý do task MAINTENANCE (DAMAGE / LIQUIDATION)
   4. held_goods   : hàng của khách lưu giữ sau thanh lý (60 ngày → trả khách / bán / tiêu huỷ / giao cơ quan)

   sqlcmd: sqlcmd -S localhost -U sa -P 12345 -I -f 65001 -i sql_script/Update_bao_tri.sql
   ============================================================ */
USE QueenKhoDB;
GO
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
GO

/* ---------- 1. damage_cases: ai chịu lỗi (sự cố cũ coi là lỗi khách như trước) ---------- */
IF COL_LENGTH('damage_cases', 'liable_party') IS NULL
    ALTER TABLE damage_cases ADD liable_party NVARCHAR(20) NOT NULL
        CONSTRAINT DF_damagecases_liable DEFAULT 'CUSTOMER';
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE parent_object_id = OBJECT_ID('damage_cases') AND name = 'CK_damagecases_liable')
    ALTER TABLE damage_cases ADD CONSTRAINT CK_damagecases_liable CHECK (liable_party IN ('CUSTOMER', 'FACILITY'));
GO

/* ---------- 2. reservations: điều khoản xử lý tài sản khách đã đồng ý ---------- */
IF COL_LENGTH('reservations', 'terms_version') IS NULL
    ALTER TABLE reservations ADD terms_version NVARCHAR(20) NULL;
IF COL_LENGTH('reservations', 'terms_accepted_at') IS NULL
    ALTER TABLE reservations ADD terms_accepted_at DATETIME2 NULL;
GO

/* ---------- 3. facility_tasks: lý do task bảo trì ---------- */
IF COL_LENGTH('facility_tasks', 'maintenance_reason') IS NULL
    ALTER TABLE facility_tasks ADD maintenance_reason NVARCHAR(20) NULL;
GO
-- Task cũ: sinh từ thanh lý thì ghi chú bắt đầu bằng "Dọn ô", còn lại là sự cố trả kho
UPDATE facility_tasks
SET maintenance_reason = CASE WHEN note LIKE N'Dọn ô%' THEN 'LIQUIDATION' ELSE 'DAMAGE' END
WHERE task_type = 'MAINTENANCE' AND maintenance_reason IS NULL;
GO

/* ---------- 4. held_goods: hàng của khách lưu giữ sau thanh lý ---------- */
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

PRINT N'Update_bao_tri.sql: xong';
GO

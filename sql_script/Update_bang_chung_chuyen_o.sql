/* ============================================================
   QueenKho — Cập nhật theo góp ý giảng viên 04/11/2026 (chạy được nhiều lần)
   Dùng cho DB đang có dữ liệu; DB tạo mới từ QueenKho_full.sql / QueenKho_TongHop.sql đã có sẵn.

   1. handover_records : ảnh bằng chứng khi check-in / nghiệm thu trả kho (BR-121),
                         check-in online do khách tự làm (BR-124) → staff_id cho phép NULL + cột check_in_method
   2. unit_transfers   : lịch sử FM chuyển hợp đồng sang ô khác (BR-122)
   3. rental_policy    : % phí dọn & di dời hàng khi thanh lý (PR-Q16)

   sqlcmd: sqlcmd -S localhost -U sa -P 12345 -I -f 65001 -i sql_script/Update_bang_chung_chuyen_o.sql
   ============================================================ */

USE QueenKhoDB;
GO

/* ---------- 1. handover_records ---------- */
IF COL_LENGTH('handover_records', 'evidence_image_urls') IS NULL
    ALTER TABLE handover_records ADD evidence_image_urls NVARCHAR(MAX) NULL;   -- BR-121: ảnh hiện trạng ô, ngăn bởi |||
GO
IF COL_LENGTH('handover_records', 'check_in_method') IS NULL
    ALTER TABLE handover_records ADD check_in_method NVARCHAR(10) NOT NULL
        CONSTRAINT DF_handover_method DEFAULT 'COUNTER';                         -- BR-124: COUNTER (Staff) / ONLINE (khách tự làm)
GO
-- Check-in online không có nhân viên lập biên bản → staff_id cho phép NULL (gỡ khoá ngoại rồi gắn lại cho chắc)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('handover_records') AND name = 'staff_id' AND is_nullable = 0)
BEGIN
    IF OBJECT_ID('FK_handover_staff', 'F') IS NOT NULL
        ALTER TABLE handover_records DROP CONSTRAINT FK_handover_staff;
    ALTER TABLE handover_records ALTER COLUMN staff_id INT NULL;
    ALTER TABLE handover_records ADD CONSTRAINT FK_handover_staff FOREIGN KEY (staff_id) REFERENCES users(id);
END
GO

/* ---------- 2. unit_transfers ---------- */
IF OBJECT_ID('unit_transfers', 'U') IS NULL
BEGIN
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
    CREATE INDEX IX_unit_transfers_contract ON unit_transfers(contract_id);
END
GO

/* ---------- 3. rental_policy ---------- */
IF COL_LENGTH('rental_policy', 'goods_moving_fee_percent') IS NULL
    ALTER TABLE rental_policy ADD goods_moving_fee_percent INT NOT NULL
        CONSTRAINT DF_rentalpolicy_moving DEFAULT 30;                            -- PR-Q16: phí dọn & di dời hàng = giá tháng × %
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_rentalpolicy_moving')
    ALTER TABLE rental_policy ADD CONSTRAINT CK_rentalpolicy_moving CHECK (goods_moving_fee_percent BETWEEN 0 AND 100);
GO

PRINT N'Đã cập nhật: ảnh biên bản, check-in online, chuyển ô, phí di dời hàng';
GO

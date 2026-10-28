/* ============================================================
   QueenKho — Gia hạn & tối ưu doanh thu ô kho (27/10/2026)
   Chạy trên DB đang có dữ liệu (giữ nguyên dữ liệu, chạy lại nhiều lần không sao).
   DB mới thì chỉ cần QueenKho_full.sql (đã gộp các thay đổi dưới đây).

   1. rental_policy: + overstay_percent (phí chiếm dụng khi quá hạn, mặc định 150% giá ngày)
                     + held_goods_fee_percent (phí lưu giữ hàng sau thanh lý, mặc định 20% giá ngày)
                     liquidation_days mặc định 30 → 15
   2. Mỗi cơ sở sinh 1 PHIÊN BẢN CHÍNH SÁCH MỚI (thanh lý 15 ngày) — không sửa phiên bản cũ,
      hợp đồng đã ký vẫn giữ mốc 30 ngày của phiên bản cũ (PR-M5).
   3. held_goods: + storage_fee_amount (phí lưu giữ đã tính khi chốt hồ sơ)

   Không đổi schema: payment_transactions.payment_type nhận thêm giá trị 'OVERSTAY_FEE'.

   sqlcmd: sqlcmd -S localhost -U sa -P 12345 -I -f 65001 -i sql_script/Update_gia_han_doanh_thu.sql
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

/* ---------- 1. rental_policy: cột mới ---------- */
IF COL_LENGTH('rental_policy', 'overstay_percent') IS NULL
    ALTER TABLE rental_policy ADD overstay_percent INT NOT NULL
        CONSTRAINT DF_rentalpolicy_overstay DEFAULT 150 WITH VALUES;
IF COL_LENGTH('rental_policy', 'held_goods_fee_percent') IS NULL
    ALTER TABLE rental_policy ADD held_goods_fee_percent INT NOT NULL
        CONSTRAINT DF_rentalpolicy_heldfee DEFAULT 20 WITH VALUES;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE parent_object_id = OBJECT_ID('rental_policy') AND name = 'CK_rentalpolicy_overstay')
    ALTER TABLE rental_policy ADD CONSTRAINT CK_rentalpolicy_overstay
        CHECK (overstay_percent BETWEEN 100 AND 300 AND held_goods_fee_percent BETWEEN 0 AND 100);
GO

/* Đổi DEFAULT của liquidation_days 30 → 15 (tên constraint do SQL Server tự sinh nên tìm theo cột) */
DECLARE @df SYSNAME = (
    SELECT dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID('rental_policy') AND c.name = 'liquidation_days');
IF @df IS NOT NULL AND @df <> 'DF_rentalpolicy_liquidation'
BEGIN
    EXEC('ALTER TABLE rental_policy DROP CONSTRAINT ' + @df);
    SET @df = NULL;
END
IF @df IS NULL
    ALTER TABLE rental_policy ADD CONSTRAINT DF_rentalpolicy_liquidation DEFAULT 15 FOR liquidation_days;
GO

/* ---------- 2. Phiên bản chính sách mới cho cơ sở đang dùng mốc thanh lý > 15 ngày ---------- */
DECLARE @newVersions TABLE (facility_id INT, old_id INT);
INSERT INTO @newVersions (facility_id, old_id)
SELECT facility_id, id FROM rental_policy WHERE is_active = 1 AND liquidation_days > 15;

UPDATE rental_policy SET is_active = 0 WHERE id IN (SELECT old_id FROM @newVersions);

INSERT INTO rental_policy (
    facility_id, policy_name, deposit_month_multiplier, cancel_fee_percent, cancel_free_hours,
    late_fee_percent_per_day, late_fee_max_percent, liquidation_days,
    booking_discount_3m, booking_discount_6m, booking_discount_12m,
    renewal_discount_3m, renewal_discount_6m, renewal_discount_12m,
    allow_late_fee_waiver, overstay_percent, held_goods_fee_percent, version, is_active)
SELECT p.facility_id, p.policy_name, p.deposit_month_multiplier, p.cancel_fee_percent, p.cancel_free_hours,
       p.late_fee_percent_per_day, p.late_fee_max_percent, 15,
       p.booking_discount_3m, p.booking_discount_6m, p.booking_discount_12m,
       p.renewal_discount_3m, p.renewal_discount_6m, p.renewal_discount_12m,
       p.allow_late_fee_waiver, 150, 20,
       (SELECT MAX(version) FROM rental_policy x WHERE x.facility_id = p.facility_id) + 1, 1
FROM rental_policy p
JOIN @newVersions n ON n.old_id = p.id;
GO

/* ---------- 3. held_goods: phí lưu giữ ---------- */
IF OBJECT_ID('held_goods', 'U') IS NOT NULL AND COL_LENGTH('held_goods', 'storage_fee_amount') IS NULL
    ALTER TABLE held_goods ADD storage_fee_amount DECIMAL(12,2) NULL;
GO

PRINT N'Update_gia_han_doanh_thu.sql: xong';
GO

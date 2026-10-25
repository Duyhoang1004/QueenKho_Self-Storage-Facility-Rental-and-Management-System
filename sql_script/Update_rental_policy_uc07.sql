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

/* UC-07: giữ nguyên id của chính sách cũ vì rental_contracts tham chiếu id này. */
IF COL_LENGTH('rental_policy', 'late_fee_percent_per_day') IS NULL
    ALTER TABLE rental_policy ADD late_fee_percent_per_day INT NOT NULL CONSTRAINT DF_rentalpolicy_late_percent DEFAULT 10;
IF COL_LENGTH('rental_policy', 'late_fee_max_percent') IS NULL
    ALTER TABLE rental_policy ADD late_fee_max_percent INT NOT NULL CONSTRAINT DF_rentalpolicy_late_max DEFAULT 50;
IF COL_LENGTH('rental_policy', 'version') IS NULL
    ALTER TABLE rental_policy ADD version INT NULL;
IF COL_LENGTH('rental_policy', 'created_at') IS NULL
    ALTER TABLE rental_policy ADD created_at DATETIME2 NOT NULL CONSTRAINT DF_rentalpolicy_created_at DEFAULT SYSDATETIME();
IF COL_LENGTH('rental_policy', 'created_by_user_id') IS NULL
    ALTER TABLE rental_policy ADD created_by_user_id INT NULL;
IF COL_LENGTH('rental_policy', 'is_active') IS NULL
    ALTER TABLE rental_policy ADD is_active BIT NOT NULL CONSTRAINT DF_rentalpolicy_active DEFAULT 0;
GO

;WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY facility_id ORDER BY id) AS ordinal
    FROM rental_policy
)
UPDATE p SET version = n.ordinal
FROM rental_policy p JOIN numbered n ON n.id = p.id
WHERE p.version IS NULL;
GO

UPDATE rental_policy SET deposit_month_multiplier = 1 WHERE deposit_month_multiplier NOT BETWEEN 1 AND 3;
UPDATE rental_policy SET liquidation_days = 30 WHERE liquidation_days < 1;
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('rental_policy') AND name = 'version' AND is_nullable = 1)
    ALTER TABLE rental_policy ALTER COLUMN version INT NOT NULL;
GO

/* SQL Server yêu cầu bỏ default constraint trước khi bỏ cột legacy. */
DECLARE @dropDefaults NVARCHAR(MAX) = N'';
SELECT @dropDefaults = @dropDefaults + N'ALTER TABLE rental_policy DROP CONSTRAINT ' + QUOTENAME(dc.name) + N';'
FROM sys.default_constraints dc
JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID('rental_policy') AND c.name IN ('late_fee_per_day', 'lock_account_days');
IF LEN(@dropDefaults) > 0 EXEC sp_executesql @dropDefaults;
GO

IF COL_LENGTH('rental_policy', 'late_fee_per_day') IS NOT NULL
    ALTER TABLE rental_policy DROP COLUMN late_fee_per_day;
IF COL_LENGTH('rental_policy', 'lock_account_days') IS NOT NULL
    ALTER TABLE rental_policy DROP COLUMN lock_account_days;
GO

IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('rental_policy') AND name = 'UQ_rentalpolicy_facility_version')
    ALTER TABLE rental_policy ADD CONSTRAINT UQ_rentalpolicy_facility_version UNIQUE (facility_id, version);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('rental_policy') AND name = 'FK_rentalpolicy_creator')
    ALTER TABLE rental_policy ADD CONSTRAINT FK_rentalpolicy_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('rental_policy') AND name = 'CK_rentalpolicy_values')
    ALTER TABLE rental_policy ADD CONSTRAINT CK_rentalpolicy_values CHECK (
        deposit_month_multiplier BETWEEN 1 AND 3 AND cancel_fee_percent BETWEEN 0 AND 100
        AND cancel_free_hours >= 0 AND late_fee_percent_per_day BETWEEN 0 AND 100
        AND late_fee_max_percent BETWEEN late_fee_percent_per_day AND 100 AND liquidation_days >= 1);
GO

/* Cơ sở có sẵn từ trước UC-07 có thể chưa có chính sách: tạo bản mặc định v1.
   NOT EXISTS giúp chạy lại migration mà không thêm phiên bản thừa hoặc sửa bản cũ. */
INSERT INTO rental_policy (
    facility_id, policy_name, deposit_month_multiplier, cancel_fee_percent,
    cancel_free_hours, late_fee_percent_per_day, late_fee_max_percent,
    liquidation_days, version, is_active
)
SELECT f.id, LEFT(N'Chính sách ' + f.name + N' - Tiêu chuẩn', 150), 1, 50, 24, 10, 50, 30, 1, 1
FROM facilities f
WHERE NOT EXISTS (SELECT 1 FROM rental_policy p WHERE p.facility_id = f.id);
GO

/* Giữ nguyên lựa chọn hiệu lực khi chạy lại; chỉ khởi tạo cho cơ sở chưa có bản hiệu lực. */
;WITH latest AS (
    SELECT id, facility_id, ROW_NUMBER() OVER (PARTITION BY facility_id ORDER BY version DESC, id DESC) AS row_num
    FROM rental_policy
)
UPDATE p SET is_active = 1
FROM rental_policy p JOIN latest l ON l.id = p.id
WHERE l.row_num = 1
  AND NOT EXISTS (SELECT 1 FROM rental_policy active_policy
                  WHERE active_policy.facility_id = p.facility_id AND active_policy.is_active = 1);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('rental_policy') AND name = 'UX_rentalpolicy_active_facility')
    CREATE UNIQUE INDEX UX_rentalpolicy_active_facility ON rental_policy(facility_id) WHERE is_active = 1;
GO

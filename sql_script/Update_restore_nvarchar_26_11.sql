/* ============================================================================
   Update_restore_nvarchar_26_11.sql
   ----------------------------------------------------------------------------
   Mục đích:
   Khôi phục kiểu dữ liệu NVARCHAR cho 15 cột bị Hibernate 6 (ddl-auto: update)
   tự động ALTER xuống varchar(255), gây lỗi mất dấu tiếng Việt (biến thành '?')
   và cắt cụt chuỗi JSON / danh sách URL ảnh quá 255 ký tự.

   Cách chạy chuẩn UTF-8 (PowerShell):
     [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
     sqlcmd -S localhost,1433 -U sa -P 12345 -d QueenKhoDB -I -f 65001 -b -i "sql_script/Update_restore_nvarchar_26_11.sql"

   Lưu ý: Luôn giữ spring.jpa.hibernate.ddl-auto: validate trong application.yaml
   để Hibernate không ghi đè lại kiểu cột về varchar(255) khi khởi động Backend.
   ============================================================================ */

USE QueenKhoDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. facility_tasks
IF COL_LENGTH(N'dbo.facility_tasks', N'note') IS NOT NULL
    ALTER TABLE dbo.facility_tasks ALTER COLUMN note NVARCHAR(1000) NULL;
IF COL_LENGTH(N'dbo.facility_tasks', N'evidence_image_url') IS NOT NULL
    ALTER TABLE dbo.facility_tasks ALTER COLUMN evidence_image_url NVARCHAR(MAX) NULL;

-- 2. handover_records
IF COL_LENGTH(N'dbo.handover_records', N'notes') IS NOT NULL
    ALTER TABLE dbo.handover_records ALTER COLUMN notes NVARCHAR(MAX) NULL;
IF COL_LENGTH(N'dbo.handover_records', N'record_type') IS NOT NULL
    ALTER TABLE dbo.handover_records ALTER COLUMN record_type NVARCHAR(30) NOT NULL;

-- 3. support_requests
IF COL_LENGTH(N'dbo.support_requests', N'description') IS NOT NULL
    ALTER TABLE dbo.support_requests ALTER COLUMN description NVARCHAR(MAX) NULL;
IF COL_LENGTH(N'dbo.support_requests', N'evidence_images') IS NOT NULL
    ALTER TABLE dbo.support_requests ALTER COLUMN evidence_images NVARCHAR(MAX) NULL;

-- 4. unit_transfers
IF COL_LENGTH(N'dbo.unit_transfers', N'reason') IS NOT NULL
    ALTER TABLE dbo.unit_transfers ALTER COLUMN reason NVARCHAR(500) NOT NULL;
IF COL_LENGTH(N'dbo.unit_transfers', N'old_unit_status') IS NOT NULL
    ALTER TABLE dbo.unit_transfers ALTER COLUMN old_unit_status NVARCHAR(20) NOT NULL;

-- 5. compensation_claims
IF COL_LENGTH(N'dbo.compensation_claims', N'customer_images') IS NOT NULL
    ALTER TABLE dbo.compensation_claims ALTER COLUMN customer_images NVARCHAR(MAX) NULL;
IF COL_LENGTH(N'dbo.compensation_claims', N'inspection_images') IS NOT NULL
    ALTER TABLE dbo.compensation_claims ALTER COLUMN inspection_images NVARCHAR(MAX) NULL;
IF COL_LENGTH(N'dbo.compensation_claims', N'payment_evidence') IS NOT NULL
    ALTER TABLE dbo.compensation_claims ALTER COLUMN payment_evidence NVARCHAR(MAX) NULL;

-- 6. damage_cases
IF COL_LENGTH(N'dbo.damage_cases', N'evidence_image_urls') IS NOT NULL
    ALTER TABLE dbo.damage_cases ALTER COLUMN evidence_image_urls NVARCHAR(MAX) NULL;

-- 7. held_goods
IF COL_LENGTH(N'dbo.held_goods', N'evidence_image_urls') IS NOT NULL
    ALTER TABLE dbo.held_goods ALTER COLUMN evidence_image_urls NVARCHAR(MAX) NULL;

-- 8. reservations
IF COL_LENGTH(N'dbo.reservations', N'goods_value_evidence_images') IS NOT NULL
    ALTER TABLE dbo.reservations ALTER COLUMN goods_value_evidence_images NVARCHAR(MAX) NULL;
IF COL_LENGTH(N'dbo.reservations', N'terms_version') IS NOT NULL
    ALTER TABLE dbo.reservations ALTER COLUMN terms_version NVARCHAR(20) NULL;
GO

-- Hậu kiểm: xác nhận toàn bộ 15 cột đã về kiểu nvarchar
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE (TABLE_NAME = 'facility_tasks'      AND COLUMN_NAME IN ('note', 'evidence_image_url'))
   OR (TABLE_NAME = 'handover_records'    AND COLUMN_NAME IN ('notes', 'record_type'))
   OR (TABLE_NAME = 'support_requests'    AND COLUMN_NAME IN ('description', 'evidence_images'))
   OR (TABLE_NAME = 'unit_transfers'      AND COLUMN_NAME IN ('reason', 'old_unit_status'))
   OR (TABLE_NAME = 'compensation_claims' AND COLUMN_NAME IN ('customer_images', 'inspection_images', 'payment_evidence'))
   OR (TABLE_NAME = 'damage_cases'        AND COLUMN_NAME = 'evidence_image_urls')
   OR (TABLE_NAME = 'held_goods'          AND COLUMN_NAME = 'evidence_image_urls')
   OR (TABLE_NAME = 'reservations'        AND COLUMN_NAME IN ('goods_value_evidence_images', 'terms_version'))
ORDER BY TABLE_NAME, COLUMN_NAME;
GO

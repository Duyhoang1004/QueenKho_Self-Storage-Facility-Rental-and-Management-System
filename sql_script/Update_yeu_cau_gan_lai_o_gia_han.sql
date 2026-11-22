/* ============================================================
   QueenKho — 22/11/2026: Yêu cầu gán lại ô kho mới khi gia hạn (PR-R10 / PR-R11 mở rộng)
   Khi ô kho gần hết hạn (dưới 3 ngày) và đã có khách khác đặt trùng ô đó,
   khách có thể gửi yêu cầu cho Quản lý (FM) gán lại ô kho mới cùng loại theo số tháng muốn gia hạn,
   hoặc Quản lý thông báo hết loại kho đó để khách đặt loại kho khác.

   sqlcmd: sqlcmd -S localhost -U sa -P 12345 -I -f 65001 -i sql_script/Update_yeu_cau_gan_lai_o_gia_han.sql
   ============================================================ */

USE QueenKhoDB;
GO

IF COL_LENGTH('rental_contracts', 'reassign_request_status') IS NULL
    ALTER TABLE rental_contracts ADD reassign_request_status NVARCHAR(30) NULL;
GO

IF COL_LENGTH('rental_contracts', 'reassign_requested_months') IS NULL
    ALTER TABLE rental_contracts ADD reassign_requested_months INT NULL;
GO

IF COL_LENGTH('rental_contracts', 'reassign_requested_at') IS NULL
    ALTER TABLE rental_contracts ADD reassign_requested_at DATETIME2 NULL;
GO

IF COL_LENGTH('rental_contracts', 'reassign_assigned_unit_id') IS NULL
    ALTER TABLE rental_contracts ADD reassign_assigned_unit_id VARCHAR(50) NULL;
GO

IF COL_LENGTH('rental_contracts', 'reassign_note') IS NULL
    ALTER TABLE rental_contracts ADD reassign_note NVARCHAR(500) NULL;
GO

IF COL_LENGTH('rental_contracts', 'reassign_resolved_at') IS NULL
    ALTER TABLE rental_contracts ADD reassign_resolved_at DATETIME2 NULL;
GO

PRINT N'==> Đã thêm các cột yêu cầu gán lại ô kho khi gia hạn vào bảng rental_contracts.';
GO

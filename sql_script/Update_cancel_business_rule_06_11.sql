/*
  06/11/2026 - Lưu snapshot chính sách hoàn tiền khi khách hủy trước check-in.
  Script idempotent, có thể chạy trên database hiện tại nhiều lần.
*/

IF COL_LENGTH('dbo.reservations', 'cancelled_at') IS NULL
    ALTER TABLE dbo.reservations ADD cancelled_at DATETIME2 NULL;
GO

IF COL_LENGTH('dbo.reservations', 'cancellation_tier') IS NULL
    ALTER TABLE dbo.reservations ADD cancellation_tier NVARCHAR(30) NULL;
GO

IF COL_LENGTH('dbo.reservations', 'cancellation_penalty_amount') IS NULL
    ALTER TABLE dbo.reservations ADD cancellation_penalty_amount DECIMAL(12,2) NULL;
GO

IF COL_LENGTH('dbo.reservations', 'cancellation_refund_amount') IS NULL
    ALTER TABLE dbo.reservations ADD cancellation_refund_amount DECIMAL(12,2) NULL;
GO

/* Chính sách hủy là cố định toàn hệ thống; giữ 2 cột cũ để tương thích API/DB. */
UPDATE dbo.rental_policy
SET cancel_free_hours = 48,
    cancel_fee_percent = 50
WHERE cancel_free_hours <> 48 OR cancel_fee_percent <> 50;
GO

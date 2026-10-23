-- =====================================================================
-- UC-26 & UC-27: BỔ SUNG CỘT CHO BẢNG support_requests (PR-S10)
-- Đảm bảo chạy lại nhiều lần không lỗi (Idempotent)
-- =====================================================================
USE QueenKhoDB;
GO

IF OBJECT_ID('support_requests', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('support_requests', 'resolution_note') IS NULL
    BEGIN
        ALTER TABLE support_requests ADD resolution_note NVARCHAR(1000) NULL;
        PRINT N'Đã thêm cột support_requests.resolution_note';
    END

    IF COL_LENGTH('support_requests', 'resolved_at') IS NULL
    BEGIN
        ALTER TABLE support_requests ADD resolved_at DATETIME2 NULL;
        PRINT N'Đã thêm cột support_requests.resolved_at';
    END

    IF COL_LENGTH('support_requests', 'closed_at') IS NULL
    BEGIN
        ALTER TABLE support_requests ADD closed_at DATETIME2 NULL;
        PRINT N'Đã thêm cột support_requests.closed_at';
    END
END
GO

-- ============================================================
-- V3__create_notifications.sql: Bảng thông báo người dùng
-- ============================================================

IF OBJECT_ID('notifications', 'U') IS NULL
BEGIN
    CREATE TABLE notifications (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL CONSTRAINT FK_notifications_user REFERENCES users(id) ON DELETE CASCADE,
        title NVARCHAR(200) NOT NULL,
        message NVARCHAR(1000) NOT NULL,
        type NVARCHAR(50) NOT NULL,
        target_url NVARCHAR(255) NULL,
        is_read BIT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );

    CREATE INDEX IX_notifications_user_read ON notifications(user_id, is_read, created_at DESC);
END
GO

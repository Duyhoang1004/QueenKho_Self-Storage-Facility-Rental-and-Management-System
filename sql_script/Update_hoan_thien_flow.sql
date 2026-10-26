/* ============================================================
   QueenKho — Hoàn thiện 5 flow Must-have (26/10/2026)
   Chạy trên DB đang có dữ liệu (giữ nguyên dữ liệu, chạy lại nhiều lần không sao).
   DB mới thì chỉ cần QueenKho_full.sql (đã gộp các thay đổi dưới đây).

   1. rental_policy  : % ưu đãi gói đặt mới / gia hạn + quyền miễn phí trễ (Flow 4)
   2. reservations   : chốt % ưu đãi lúc tạo đơn (giống deposit_amount — PR-M6)
   3. rental_contracts: đánh dấu hợp đồng được FM miễn phí trễ (Flow 4 / Flow 6)
   4. login_history  : lịch sử đăng nhập cho Admin

   sqlcmd: sqlcmd -S localhost -U sa -P 12345 -I -f 65001 -i sql_script/Update_hoan_thien_flow.sql
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

/* ---------- 1. rental_policy: ưu đãi theo gói + quyền miễn phí trễ ---------- */
IF COL_LENGTH('rental_policy', 'booking_discount_3m') IS NULL
    ALTER TABLE rental_policy ADD booking_discount_3m INT NOT NULL CONSTRAINT DF_rentalpolicy_bd3 DEFAULT 5;
IF COL_LENGTH('rental_policy', 'booking_discount_6m') IS NULL
    ALTER TABLE rental_policy ADD booking_discount_6m INT NOT NULL CONSTRAINT DF_rentalpolicy_bd6 DEFAULT 10;
IF COL_LENGTH('rental_policy', 'booking_discount_12m') IS NULL
    ALTER TABLE rental_policy ADD booking_discount_12m INT NOT NULL CONSTRAINT DF_rentalpolicy_bd12 DEFAULT 15;
IF COL_LENGTH('rental_policy', 'renewal_discount_3m') IS NULL
    ALTER TABLE rental_policy ADD renewal_discount_3m INT NOT NULL CONSTRAINT DF_rentalpolicy_rd3 DEFAULT 0;
IF COL_LENGTH('rental_policy', 'renewal_discount_6m') IS NULL
    ALTER TABLE rental_policy ADD renewal_discount_6m INT NOT NULL CONSTRAINT DF_rentalpolicy_rd6 DEFAULT 5;
IF COL_LENGTH('rental_policy', 'renewal_discount_12m') IS NULL
    ALTER TABLE rental_policy ADD renewal_discount_12m INT NOT NULL CONSTRAINT DF_rentalpolicy_rd12 DEFAULT 10;
IF COL_LENGTH('rental_policy', 'allow_late_fee_waiver') IS NULL
    ALTER TABLE rental_policy ADD allow_late_fee_waiver BIT NOT NULL CONSTRAINT DF_rentalpolicy_waiver DEFAULT 1;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE parent_object_id = OBJECT_ID('rental_policy') AND name = 'CK_rentalpolicy_discounts')
    ALTER TABLE rental_policy ADD CONSTRAINT CK_rentalpolicy_discounts CHECK (
        booking_discount_3m BETWEEN 0 AND 50 AND booking_discount_6m BETWEEN 0 AND 50
        AND booking_discount_12m BETWEEN 0 AND 50 AND renewal_discount_3m BETWEEN 0 AND 50
        AND renewal_discount_6m BETWEEN 0 AND 50 AND renewal_discount_12m BETWEEN 0 AND 50);
GO

/* ---------- 2. reservations: chốt % ưu đãi tiền thuê lúc tạo đơn ---------- */
IF COL_LENGTH('reservations', 'rent_discount_percent') IS NULL
    ALTER TABLE reservations ADD rent_discount_percent INT NULL;
GO
-- Đơn cũ: điền theo bảng ưu đãi cũ (0/5/10/15%) để tính hoàn tiền trả sớm như trước
UPDATE reservations
SET rent_discount_percent = CASE duration_months WHEN 3 THEN 5 WHEN 6 THEN 10 WHEN 12 THEN 15 ELSE 0 END
WHERE rent_discount_percent IS NULL;
GO

/* ---------- 3. rental_contracts: FM miễn phí trễ cho đợt quá hạn hiện tại ---------- */
IF COL_LENGTH('rental_contracts', 'late_fee_waived') IS NULL
    ALTER TABLE rental_contracts ADD late_fee_waived BIT NOT NULL CONSTRAINT DF_contracts_late_fee_waived DEFAULT 0;
IF COL_LENGTH('rental_contracts', 'late_fee_waiver_note') IS NULL
    ALTER TABLE rental_contracts ADD late_fee_waiver_note NVARCHAR(500) NULL;
GO

/* ---------- 4. login_history: lịch sử đăng nhập / đăng xuất ---------- */
IF OBJECT_ID('login_history', 'U') IS NULL
BEGIN
    CREATE TABLE login_history (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        user_id         INT NULL,                 -- NULL khi gõ email không tồn tại
        email           NVARCHAR(255) NOT NULL,
        event_type      NVARCHAR(20)  NOT NULL,   -- LOGIN_SUCCESS / LOGIN_FAILED / LOGOUT
        failure_reason  NVARCHAR(50)  NULL,       -- INVALID_CREDENTIALS / ACCOUNT_LOCKED / ACCOUNT_DISABLED
        ip_address      NVARCHAR(64)  NULL,
        user_agent      NVARCHAR(300) NULL,
        created_at      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_loginhistory_user FOREIGN KEY (user_id) REFERENCES users(id),
        CONSTRAINT CK_loginhistory_event CHECK (event_type IN ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT'))
    );
    CREATE INDEX IX_loginhistory_created_at ON login_history(created_at DESC);
    CREATE INDEX IX_loginhistory_user ON login_history(user_id);
END
GO

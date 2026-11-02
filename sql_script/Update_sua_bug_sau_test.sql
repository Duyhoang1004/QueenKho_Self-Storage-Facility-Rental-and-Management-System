/* ============================================================
   QueenKho — Cập nhật schema sau đợt test 02/11/2026 (chạy được nhiều lần)
   Dùng cho DB đang có dữ liệu; DB tạo mới từ QueenKho_full.sql / QueenKho_TongHop.sql đã có sẵn.

   1. notifications           : thông báo lưu DB (trước đây chỉ nằm trên RAM, restart BE là mất)
   2. vouchers + reservations : voucher thật do BOM quản lý, đơn chốt mã + số tiền giảm lúc tạo
   3. storage_units           : ghi chú khi FM chuyển ô sang Bảo trì

   sqlcmd: sqlcmd -S localhost -U sa -P 12345 -I -f 65001 -i sql_script/Update_sua_bug_sau_test.sql
   ============================================================ */

USE QueenKhoDB;
GO

/* ---------- 1. notifications ---------- */
IF OBJECT_ID('notifications', 'U') IS NULL
BEGIN
    CREATE TABLE notifications (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        user_id         INT NOT NULL,
        title           NVARCHAR(200)  NOT NULL,
        message         NVARCHAR(1000) NOT NULL,
        type            NVARCHAR(30)   NOT NULL,   -- BOOKING / REFUND / TASK / SUPPORT / RENEWAL / OVERDUE / CHECKOUT ...
        target_url      NVARCHAR(300)  NULL,
        ref_key         NVARCHAR(150)  NULL,       -- chống gửi trùng (vd nhắc gia hạn RENEWAL:12:2026-11-30:3)
        is_read         BIT NOT NULL DEFAULT 0,
        created_at      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_notifications_user FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IX_notifications_user_created ON notifications(user_id, created_at DESC);
    CREATE UNIQUE INDEX UX_notifications_user_ref ON notifications(user_id, ref_key) WHERE ref_key IS NOT NULL;
    PRINT N'Đã tạo bảng notifications.';
END
GO

/* ---------- 2. vouchers ---------- */
IF OBJECT_ID('vouchers', 'U') IS NULL
BEGIN
    CREATE TABLE vouchers (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        code            NVARCHAR(30)  NOT NULL UNIQUE,   -- luôn viết HOA
        name            NVARCHAR(150) NOT NULL,
        discount_type   NVARCHAR(10)  NOT NULL,          -- FIXED (số tiền) / PERCENT (% tiền thuê)
        discount_value  DECIMAL(12,2) NOT NULL,
        max_discount    DECIMAL(12,2) NULL,              -- trần giảm cho PERCENT (NULL = không trần)
        min_months      INT NOT NULL DEFAULT 1,          -- gói thuê tối thiểu được áp
        facility_id     INT NULL,                        -- NULL = mọi cơ sở
        start_at        DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        end_at          DATETIME2 NULL,                  -- NULL = không hết hạn
        usage_limit     INT NULL,                        -- tổng lượt (NULL = không giới hạn)
        per_user_limit  INT NULL,                        -- lượt / khách (NULL = không giới hạn)
        used_count      INT NOT NULL DEFAULT 0,          -- cộng khi VNPAY báo cọc thành công
        is_default      BIT NOT NULL DEFAULT 0,          -- tự áp khi khách không nhập mã (NEWKHO, BR-25)
        status          NVARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE / INACTIVE
        created_by      INT NULL,
        created_at      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_vouchers_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
        CONSTRAINT FK_vouchers_creator  FOREIGN KEY (created_by)  REFERENCES users(id),
        CONSTRAINT CK_vouchers_type     CHECK (discount_type IN ('FIXED', 'PERCENT')),
        CONSTRAINT CK_vouchers_status   CHECK (status IN ('ACTIVE', 'INACTIVE')),
        CONSTRAINT CK_vouchers_value    CHECK (discount_value > 0 AND (discount_type <> 'PERCENT' OR discount_value <= 100)),
        CONSTRAINT CK_vouchers_months   CHECK (min_months IN (1, 3, 6, 12))
    );
    PRINT N'Đã tạo bảng vouchers.';
END
GO

IF NOT EXISTS (SELECT 1 FROM vouchers WHERE code = 'NEWKHO')
BEGIN
    INSERT INTO vouchers (code, name, discount_type, discount_value, min_months, start_at, is_default, status)
    VALUES ('NEWKHO', N'Ưu đãi đặt kho trực tuyến', 'FIXED', 100000, 1, '2026-01-01', 1, 'ACTIVE');
    PRINT N'Đã thêm voucher mặc định NEWKHO.';
END
GO

IF COL_LENGTH('reservations', 'voucher_id') IS NULL
BEGIN
    ALTER TABLE reservations ADD
        voucher_id       INT NULL CONSTRAINT FK_reservations_voucher REFERENCES vouchers(id),
        voucher_code     NVARCHAR(30) NULL,
        voucher_discount DECIMAL(12,2) NULL;   -- số tiền giảm chốt lúc tạo đơn (NULL = đơn cũ, BE coi như NEWKHO 100.000đ)
    PRINT N'Đã thêm cột voucher vào reservations.';
END
GO

-- Đơn cũ đều đã được trừ NEWKHO 100.000đ lúc tạo link VNPAY
UPDATE r SET r.voucher_id = v.id, r.voucher_code = v.code, r.voucher_discount = 100000
FROM reservations r CROSS JOIN vouchers v
WHERE v.code = 'NEWKHO' AND r.voucher_discount IS NULL;
GO

UPDATE v SET v.used_count = x.cnt
FROM vouchers v
JOIN (SELECT r.voucher_id, COUNT(*) AS cnt FROM reservations r
      WHERE EXISTS (SELECT 1 FROM payment_transactions p
                    WHERE p.reservation_id = r.id AND p.payment_type = 'DEPOSIT' AND p.status = 'SUCCESS')
      GROUP BY r.voucher_id) x ON x.voucher_id = v.id
WHERE v.used_count = 0;
GO

/* ---------- 3. storage_units: ghi chú bảo trì ---------- */
IF COL_LENGTH('storage_units', 'maintenance_note') IS NULL
BEGIN
    ALTER TABLE storage_units ADD
        maintenance_note  NVARCHAR(500) NULL,   -- lý do FM chuyển ô sang MAINTENANCE (xoá khi mở lại)
        maintenance_since DATETIME2 NULL;
    PRINT N'Đã thêm cột ghi chú bảo trì vào storage_units.';
END
GO

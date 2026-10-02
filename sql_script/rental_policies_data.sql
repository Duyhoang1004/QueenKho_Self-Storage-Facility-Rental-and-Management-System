USE QueenKhoDB;
GO

-- 1. Bật tính năng cho phép chèn ID chỉ định
SET IDENTITY_INSERT rental_policy ON;

-- =========================================================================
-- CS1: QueenKho Quận 7 (TP.HCM)
-- =========================================================================
IF NOT EXISTS (SELECT 1 FROM rental_policy WHERE id = 1)
    INSERT INTO rental_policy (id, facility_id, policy_name, deposit_month_multiplier, cancel_fee_percent, cancel_free_hours, late_fee_per_day, lock_account_days, liquidation_days)
    VALUES (1, 1, N'Chính sách Kho Quận 7 - Tiêu chuẩn', 1, 50, 24, 50000.00, 5, 30);
ELSE
    UPDATE rental_policy 
    SET facility_id = 1, policy_name = N'Chính sách Kho Quận 7 - Tiêu chuẩn', deposit_month_multiplier = 1, cancel_fee_percent = 50, cancel_free_hours = 24, late_fee_per_day = 50000.00, lock_account_days = 5, liquidation_days = 30 
    WHERE id = 1;

-- =========================================================================
-- CS2: QueenKho Tân Bình (TP.HCM)
-- =========================================================================
IF NOT EXISTS (SELECT 1 FROM rental_policy WHERE id = 2)
    INSERT INTO rental_policy (id, facility_id, policy_name, deposit_month_multiplier, cancel_fee_percent, cancel_free_hours, late_fee_per_day, lock_account_days, liquidation_days)
    VALUES (2, 2, N'Chính sách Kho Tân Bình - Tiêu chuẩn', 1, 50, 24, 50000.00, 5, 30);
ELSE
    UPDATE rental_policy 
    SET facility_id = 2, policy_name = N'Chính sách Kho Tân Bình - Tiêu chuẩn', deposit_month_multiplier = 1, cancel_fee_percent = 50, cancel_free_hours = 24, late_fee_per_day = 50000.00, lock_account_days = 5, liquidation_days = 30 
    WHERE id = 2;

-- =========================================================================
-- CS3: QueenKho Bình Thạnh (TP.HCM)
-- =========================================================================
IF NOT EXISTS (SELECT 1 FROM rental_policy WHERE id = 3)
    INSERT INTO rental_policy (id, facility_id, policy_name, deposit_month_multiplier, cancel_fee_percent, cancel_free_hours, late_fee_per_day, lock_account_days, liquidation_days)
    VALUES (3, 3, N'Chính sách Kho Bình Thạnh - Tiêu chuẩn', 1, 50, 24, 50000.00, 5, 30);
ELSE
    UPDATE rental_policy 
    SET facility_id = 3, policy_name = N'Chính sách Kho Bình Thạnh - Tiêu chuẩn', deposit_month_multiplier = 1, cancel_fee_percent = 50, cancel_free_hours = 24, late_fee_per_day = 50000.00, lock_account_days = 5, liquidation_days = 30 
    WHERE id = 3;

-- =========================================================================
-- CS4: QueenKho Thủ Đức (TP.HCM)
-- =========================================================================
IF NOT EXISTS (SELECT 1 FROM rental_policy WHERE id = 4)
    INSERT INTO rental_policy (id, facility_id, policy_name, deposit_month_multiplier, cancel_fee_percent, cancel_free_hours, late_fee_per_day, lock_account_days, liquidation_days)
    VALUES (4, 4, N'Chính sách Kho Thủ Đức - Tiêu chuẩn', 1, 50, 24, 50000.00, 5, 30);
ELSE
    UPDATE rental_policy 
    SET facility_id = 4, policy_name = N'Chính sách Kho Thủ Đức - Tiêu chuẩn', deposit_month_multiplier = 1, cancel_fee_percent = 50, cancel_free_hours = 24, late_fee_per_day = 50000.00, lock_account_days = 5, liquidation_days = 30 
    WHERE id = 4;

-- =========================================================================
-- CS5: QueenKho Gò Vấp (TP.HCM)
-- =========================================================================
IF NOT EXISTS (SELECT 1 FROM rental_policy WHERE id = 5)
    INSERT INTO rental_policy (id, facility_id, policy_name, deposit_month_multiplier, cancel_fee_percent, cancel_free_hours, late_fee_per_day, lock_account_days, liquidation_days)
    VALUES (5, 5, N'Chính sách Kho Gò Vấp - Tiêu chuẩn', 1, 50, 24, 50000.00, 5, 30);
ELSE
    UPDATE rental_policy 
    SET facility_id = 5, policy_name = N'Chính sách Kho Gò Vấp - Tiêu chuẩn', deposit_month_multiplier = 1, cancel_fee_percent = 50, cancel_free_hours = 24, late_fee_per_day = 50000.00, lock_account_days = 5, liquidation_days = 30 
    WHERE id = 5;

-- =========================================================================
-- CS6: QueenKho Cầu Giấy (Hà Nội)
-- =========================================================================
IF NOT EXISTS (SELECT 1 FROM rental_policy WHERE id = 6)
    INSERT INTO rental_policy (id, facility_id, policy_name, deposit_month_multiplier, cancel_fee_percent, cancel_free_hours, late_fee_per_day, lock_account_days, liquidation_days)
    VALUES (6, 6, N'Chính sách Kho Cầu Giấy - Tiêu chuẩn', 1, 50, 24, 50000.00, 5, 30);
ELSE
    UPDATE rental_policy 
    SET facility_id = 6, policy_name = N'Chính sách Kho Cầu Giấy - Tiêu chuẩn', deposit_month_multiplier = 1, cancel_fee_percent = 50, cancel_free_hours = 24, late_fee_per_day = 50000.00, lock_account_days = 5, liquidation_days = 30 
    WHERE id = 6;

-- 2. Tắt tính năng IDENTITY
SET IDENTITY_INSERT rental_policy OFF;
GO

-- 3. Kiểm tra lại kết quả
SELECT * FROM rental_policy;
GO
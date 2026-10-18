USE QueenKhoDB;
GO

/* =========================================================================
   CẬP NHẬT CỘT 'code' CHO BẢNG facilities (UC-04, PR-M1) & TÀI KHOẢN BOM
   ========================================================================= */

-- 1. Bổ sung cột code nếu chưa có
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('facilities') AND name = 'code')
BEGIN
    ALTER TABLE facilities ADD code NVARCHAR(4) NULL;
    PRINT N'==> [1] Đã thêm cột code vào bảng facilities.';
END
GO

-- 2. Điền mã cơ sở mặc định cho dữ liệu mẫu hiện tại
UPDATE facilities SET code = 'T' + CAST(id AS NVARCHAR(2));
UPDATE facilities SET code = 'TB' WHERE name LIKE N'%Tân Bình%';
UPDATE facilities SET code = 'BT' WHERE name LIKE N'%Bình Thạnh%';
UPDATE facilities SET code = 'TD' WHERE name LIKE N'%Thủ Đức%';
UPDATE facilities SET code = 'GV' WHERE name LIKE N'%Gò Vấp%';
UPDATE facilities SET code = 'CG' WHERE name LIKE N'%Cầu Giấy%';
UPDATE facilities SET code = 'Q7' WHERE name LIKE N'%Quận 7%';

-- Nếu còn cơ sở nào chưa có code, tự sinh tạm theo ID
UPDATE facilities 
SET code = 'F' + RIGHT('00' + CAST(id AS NVARCHAR(3)), 3)
WHERE code IS NULL OR code = '';

PRINT N'==> [2] Đã gán mã code chuẩn (TB, BT, TD, GV, CG, Q7...) cho các cơ sở hiện tại.';
GO

-- 3. Đổi cột code sang NOT NULL và tạo ràng buộc UNIQUE (PR-M1)
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('facilities') AND name = 'code' AND is_nullable = 1)
BEGIN
    ALTER TABLE facilities ALTER COLUMN code NVARCHAR(4) NOT NULL;
    PRINT N'==> [3] Đã đổi cột code sang NOT NULL.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('facilities') AND name = 'UQ_facilities_code')
BEGIN
    ALTER TABLE facilities ADD CONSTRAINT UQ_facilities_code UNIQUE (code);
    PRINT N'==> [4] Đã tạo ràng buộc UNIQUE cho cột facilities.code.';
END
GO

-- 4. Bổ sung tài khoản mẫu BOM: bom@queenkho.com / mật khẩu 123456 nếu chưa có
DECLARE @bomRoleId INT = (SELECT id FROM roles WHERE name = 'BOM');
IF @bomRoleId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'bom@queenkho.com')
BEGIN
    DECLARE @pw NVARCHAR(255) = '$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu'; -- 123456
    INSERT INTO users (full_name, email, password_hash, phone, role_id, facility_id, status)
    VALUES (N'Business Operations Manager', 'bom@queenkho.com', @pw, '0908889999', @bomRoleId, NULL, 'ACTIVE');
    PRINT N'==> [5] Đã tạo tài khoản test BOM: bom@queenkho.com / 123456.';
END
GO

-- 5. Đồng bộ trạng thái ô kho OCCUPIED với hợp đồng đang hoạt động (tránh lệch số liệu mẫu)
UPDATE storage_units 
SET status = 'AVAILABLE' 
WHERE status = 'OCCUPIED' 
  AND id NOT IN (
      SELECT storage_unit_id FROM rental_contracts 
      WHERE status IN ('PENDING_CHECK_IN', 'ACTIVE', 'OVERDUE', 'TERMINATION_PENDING')
  );

UPDATE storage_units
SET status = 'OCCUPIED'
WHERE id IN (
    SELECT storage_unit_id FROM rental_contracts 
    WHERE status IN ('PENDING_CHECK_IN', 'ACTIVE', 'OVERDUE', 'TERMINATION_PENDING')
);

UPDATE storage_units
SET status = 'AVAILABLE'
WHERE status = 'MAINTENANCE';
GO

-- Kiểm tra lại bảng facilities
SELECT id, code, name, city, district, address, hotline, status FROM facilities;
GO

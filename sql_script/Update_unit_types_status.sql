USE QueenKhoDB;
GO

/* =========================================================================
   CẬP NHẬT CỘT 'status' CHO BẢNG unit_types (UC-05, PR-M4) & UNIQUE NAME (PR-M3)
   ========================================================================= */

-- 1. Bổ sung cột status nếu chưa có (mặc định 'ACTIVE')
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('unit_types') AND name = 'status')
BEGIN
    ALTER TABLE unit_types ADD status NVARCHAR(20) NOT NULL CONSTRAINT DF_unit_types_status DEFAULT 'ACTIVE';
    PRINT N'==> [1] Đã thêm cột status vào bảng unit_types với giá trị mặc định ACTIVE.';
END
ELSE
BEGIN
    PRINT N'==> [1] Cột status đã tồn tại trong bảng unit_types.';
END
GO

-- 2. Đảm bảo tất cả bản ghi hiện tại đều có status = 'ACTIVE' nếu NULL hoặc rỗng
UPDATE unit_types 
SET status = 'ACTIVE' 
WHERE status IS NULL OR status = '';
GO

-- 3. Tạo ràng buộc UNIQUE cho tên loại kho (PR-M3) nếu chưa có
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('unit_types') AND name = 'UQ_unit_types_name')
BEGIN
    ALTER TABLE unit_types ADD CONSTRAINT UQ_unit_types_name UNIQUE (name);
    PRINT N'==> [2] Đã tạo ràng buộc UNIQUE cho cột unit_types.name.';
END
ELSE
BEGIN
    PRINT N'==> [2] Ràng buộc UNIQUE unit_types.name đã tồn tại.';
END
GO

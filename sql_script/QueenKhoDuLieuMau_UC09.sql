/* ============================================================
   QueenKho — Dữ liệu mẫu cho UC-09 (Tìm kiếm & Khám phá kho)
   Chạy file này SAU KHI đã chạy QueenKho.sql (tạo schema)
   ============================================================ */

USE QueenKhoDB;
GO

/* ---------- Đảm bảo có đủ Facility ---------- */
IF NOT EXISTS (SELECT 1 FROM facilities WHERE name LIKE N'%QueenKho Quận 7%')
    INSERT INTO facilities (name, city, district, address, hotline, status)
    VALUES (N'QueenKho Quận 7', N'TP.HCM', N'Quận 7', N'123 Nguyễn Văn Linh, P.Tân Phong', N'028-3811-0002', 'ACTIVE');
ELSE
    UPDATE facilities SET city = N'TP.HCM', district = N'Quận 7', address = N'123 Nguyễn Văn Linh, P.Tân Phong', hotline = N'028-3811-0002' WHERE name LIKE N'%QueenKho Quận 7%';

IF NOT EXISTS (SELECT 1 FROM facilities WHERE name LIKE N'%QueenKho Tân Bình%')
    INSERT INTO facilities (name, city, district, address, hotline, status)
    VALUES (N'QueenKho Tân Bình', N'TP.HCM', N'Tân Bình', N'142 Cộng Hòa, P.13', N'028-3811-0001', 'ACTIVE');

IF NOT EXISTS (SELECT 1 FROM facilities WHERE name LIKE N'%QueenKho Bình Thạnh%')
    INSERT INTO facilities (name, city, district, address, hotline, status)
    VALUES (N'QueenKho Bình Thạnh', N'TP.HCM', N'Bình Thạnh', N'456 Điện Biên Phủ, P.22', N'028-3811-0003', 'ACTIVE');

IF NOT EXISTS (SELECT 1 FROM facilities WHERE name LIKE N'%QueenKho Thủ Đức%')
    INSERT INTO facilities (name, city, district, address, hotline, status)
    VALUES (N'QueenKho Thủ Đức', N'TP.HCM', N'Thủ Đức', N'789 Võ Văn Ngân, P.Linh Chiểu', N'028-3811-0004', 'ACTIVE');

IF NOT EXISTS (SELECT 1 FROM facilities WHERE name LIKE N'%QueenKho Gò Vấp%')
    INSERT INTO facilities (name, city, district, address, hotline, status)
    VALUES (N'QueenKho Gò Vấp', N'TP.HCM', N'Gò Vấp', N'321 Quang Trung, P.10', N'028-3811-0005', 'ACTIVE');

IF NOT EXISTS (SELECT 1 FROM facilities WHERE name LIKE N'%QueenKho Cầu Giấy%')
    INSERT INTO facilities (name, city, district, address, hotline, status)
    VALUES (N'QueenKho Cầu Giấy', N'Hà Nội', N'Cầu Giấy', N'56 Duy Tân, P.Dịch Vọng Hậu', N'024-3511-0001', 'ACTIVE');
GO

/* ---------- Đảm bảo có đủ UnitType ---------- */
IF NOT EXISTS (SELECT 1 FROM unit_types WHERE name LIKE N'%Kho nhỏ 2m%')
    INSERT INTO unit_types (name, area_sqm, volume_cbm, base_price_monthly, suggested_capacity, dimensions, features)
    VALUES (N'Kho nhỏ 2m²', 2.0, 4.8, 500000, N'5–10 thùng carton', N'1.0m × 2.0m × 2.4m', N'Cá nhân, sinh viên, giấy tờ');
ELSE
    UPDATE unit_types SET area_sqm = 2.0, volume_cbm = 4.8, base_price_monthly = 500000, suggested_capacity = N'5–10 thùng carton', dimensions = N'1.0m × 2.0m × 2.4m', features = N'Cá nhân, sinh viên, giấy tờ' WHERE name LIKE N'%Kho nhỏ 2m%';

IF NOT EXISTS (SELECT 1 FROM unit_types WHERE name LIKE N'%Kho Mini M%')
    INSERT INTO unit_types (name, area_sqm, volume_cbm, base_price_monthly, suggested_capacity, dimensions, features)
    VALUES (N'Kho Mini M', 3.5, 8.4, 750000, N'10–20 thùng carton', N'1.5m × 2.3m × 2.4m', N'Cá nhân, đồ theo mùa');

IF NOT EXISTS (SELECT 1 FROM unit_types WHERE name LIKE N'%Kho Tiêu Chuẩn%')
    INSERT INTO unit_types (name, area_sqm, volume_cbm, base_price_monthly, suggested_capacity, dimensions, features)
    VALUES (N'Kho Tiêu Chuẩn', 6.0, 16.2, 1850000, N'20–40 thùng, nội thất nhỏ', N'2.5m × 2.4m × 2.7m', N'Phổ biến nhất, phù hợp chuyển nhà');

IF NOT EXISTS (SELECT 1 FROM unit_types WHERE name LIKE N'%Kho Gia Đình%')
    INSERT INTO unit_types (name, area_sqm, volume_cbm, base_price_monthly, suggested_capacity, dimensions, features)
    VALUES (N'Kho Gia Đình', 12.0, 32.4, 3450000, N'Đồ 1 phòng ngủ hoặc VP nhỏ', N'4.0m × 3.0m × 2.7m', N'Gia đình, doanh nghiệp nhỏ');

IF NOT EXISTS (SELECT 1 FROM unit_types WHERE name LIKE N'%Kho Lớn%')
    INSERT INTO unit_types (name, area_sqm, volume_cbm, base_price_monthly, suggested_capacity, dimensions, features)
    VALUES (N'Kho Lớn', 16.0, 43.2, 4500000, N'Đồ 2 phòng ngủ hoặc hàng hóa', N'4.0m × 4.0m × 2.7m', N'Doanh nghiệp, kho hàng');

IF NOT EXISTS (SELECT 1 FROM unit_types WHERE name LIKE N'%Kho Đặc Biệt XL%')
    INSERT INTO unit_types (name, area_sqm, volume_cbm, base_price_monthly, suggested_capacity, dimensions, features)
    VALUES (N'Kho Đặc Biệt XL', 25.0, 67.5, 6500000, N'Hàng hóa lớn, máy móc', N'5.0m × 5.0m × 2.7m', N'Doanh nghiệp, sản xuất');
GO

/* ---------- Lưu dữ liệu vào bảng tạm (Tránh lỗi DECLARE Scope) ---------- */
IF OBJECT_ID('tempdb..#SeedInfo') IS NOT NULL DROP TABLE #SeedInfo;
CREATE TABLE #SeedInfo (Code VARCHAR(20), FactId INT, TypeId INT);

INSERT INTO #SeedInfo (Code, FactId, TypeId) VALUES 
('KV-TB-A101', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Tân Bình%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Tiêu Chuẩn%')),
('KV-TB-A102', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Tân Bình%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Tiêu Chuẩn%')),
('KV-TB-A103', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Tân Bình%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Tiêu Chuẩn%')),
('KV-TB-A104', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Tân Bình%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Tiêu Chuẩn%')),
('KV-TB-A105', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Tân Bình%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Tiêu Chuẩn%')),
('KV-TB-B201', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Tân Bình%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Gia Đình%')),
('KV-TB-B202', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Tân Bình%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Gia Đình%')),
('KV-TB-B203', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Tân Bình%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Kho Lớn%')),
('KV-TB-B204', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Tân Bình%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Kho Lớn%')),
('KV-TB-C101', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Tân Bình%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%nhỏ 2m%')),
('KV-TB-C102', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Tân Bình%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%nhỏ 2m%')),
('KV-TB-C103', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Tân Bình%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Mini M%')),
('KV-TB-C104', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Tân Bình%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Mini M%')),
('KV-TB-C105', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Tân Bình%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%nhỏ 2m%')),

('KV-Q7-A101', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Quận 7%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Tiêu Chuẩn%')),
('KV-Q7-A102', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Quận 7%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Tiêu Chuẩn%')),
('KV-Q7-A103', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Quận 7%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Gia Đình%')),
('KV-Q7-B201', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Quận 7%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%nhỏ 2m%')),
('KV-Q7-B202', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Quận 7%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Mini M%')),
('KV-Q7-B203', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Quận 7%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Kho Lớn%')),
('KV-Q7-B204', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Quận 7%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Đặc Biệt XL%')),

('KV-BT-A101', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Bình Thạnh%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Tiêu Chuẩn%')),
('KV-BT-A102', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Bình Thạnh%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%nhỏ 2m%')),
('KV-BT-A103', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Bình Thạnh%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Mini M%')),
('KV-BT-B201', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Bình Thạnh%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Kho Lớn%')),
('KV-BT-B202', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Bình Thạnh%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Đặc Biệt XL%')),
('KV-BT-B203', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Bình Thạnh%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Gia Đình%')),

('KV-TD-A101', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Thủ Đức%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%nhỏ 2m%')),
('KV-TD-A102', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Thủ Đức%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Mini M%')),
('KV-TD-A103', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Thủ Đức%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Tiêu Chuẩn%')),
('KV-TD-A104', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Thủ Đức%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Tiêu Chuẩn%')),
('KV-TD-B201', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Thủ Đức%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Gia Đình%')),

('KV-GV-A101', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Gò Vấp%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%nhỏ 2m%')),
('KV-GV-A102', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Gò Vấp%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Mini M%')),
('KV-GV-A103', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Gò Vấp%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Tiêu Chuẩn%')),
('KV-GV-B201', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Gò Vấp%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Kho Lớn%')),

('KV-CG-A101', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Cầu Giấy%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%nhỏ 2m%')),
('KV-CG-A102', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Cầu Giấy%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Tiêu Chuẩn%')),
('KV-CG-A103', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Cầu Giấy%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Tiêu Chuẩn%')),
('KV-CG-A104', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Cầu Giấy%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Gia Đình%')),
('KV-CG-B201', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Cầu Giấy%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Kho Lớn%')),
('KV-CG-B202', (SELECT TOP 1 id FROM facilities WHERE name LIKE N'%Cầu Giấy%'), (SELECT TOP 1 id FROM unit_types WHERE name LIKE N'%Đặc Biệt XL%'));

/* ---------- Thực thi INSERT ---------- */
INSERT INTO storage_units (id, facility_id, unit_type_id, floor, zone, room_number, status)
SELECT Code, FactId, TypeId, N'Tầng 1', SUBSTRING(Code, 7, 1), RIGHT(Code, 3), 
  CASE 
    WHEN Code IN ('KV-TB-A103', 'KV-TB-A105', 'KV-TB-B202', 'KV-TB-C103', 'KV-Q7-B202', 'KV-BT-B203', 'KV-TD-A104', 'KV-GV-B201', 'KV-CG-B202') THEN 'OCCUPIED'
    WHEN Code IN ('KV-TB-B204', 'KV-TB-C105') THEN 'MAINTENANCE'
    ELSE 'AVAILABLE' 
  END
FROM #SeedInfo
WHERE Code NOT IN (SELECT id FROM storage_units)
AND FactId IS NOT NULL 
AND TypeId IS NOT NULL;
GO

/* ---------- Kiểm tra dữ liệu ---------- */
SELECT 'facilities' AS [table], COUNT(*) AS [count] FROM facilities
UNION ALL
SELECT 'unit_types', COUNT(*) FROM unit_types
UNION ALL
SELECT 'storage_units', COUNT(*) FROM storage_units;
GO


SELECT u.id, u.email, r.name AS role, u.facility_id
   FROM users u JOIN roles r ON r.id = u.role_id;
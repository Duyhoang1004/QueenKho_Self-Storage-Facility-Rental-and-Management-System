USE QueenKhoDB;
GO

DELETE FROM staff_tasks;
DELETE FROM handover_records;
DELETE FROM rental_contracts;
DELETE FROM payment_transactions;
DELETE FROM reservations;

DBCC CHECKIDENT ('rental_contracts', RESEED, 0);
DBCC CHECKIDENT ('reservations', RESEED, 0);
DBCC CHECKIDENT ('payment_transactions', RESEED, 0);
GO

IF NOT EXISTS (SELECT 1 FROM facilities WHERE id = 1)
BEGIN
    SET IDENTITY_INSERT facilities ON;
    INSERT INTO facilities (id, name, city, district, address)
    VALUES (1, N'Cơ sở Tân Bình', N'Hồ Chí Minh', N'Tân Bình', N'123 Cộng Hòa');
    SET IDENTITY_INSERT facilities OFF;
END
IF NOT EXISTS (SELECT 1 FROM facilities WHERE id = 2)
BEGIN
    SET IDENTITY_INSERT facilities ON;
    INSERT INTO facilities (id, name, city, district, address)
    VALUES (2, N'Cơ sở Quận 9', N'Hồ Chí Minh', N'Quận 9', N'456 Lê Văn Việt');
    SET IDENTITY_INSERT facilities OFF;
END
GO

IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'fm1@gmail.com')
BEGIN
    INSERT INTO users (full_name, email, password_hash, phone, role_id, facility_id, status)
    VALUES (N'Quản lý Tân Bình', 'fm1@gmail.com', '123456', '0901234567', (SELECT id FROM roles WHERE name='FACILITY_MANAGER'), 1, 'ACTIVE');
END

IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'fm2@gmail.com')
BEGIN
    INSERT INTO users (full_name, email, password_hash, phone, role_id, facility_id, status)
    VALUES (N'Quản lý Quận 9', 'fm2@gmail.com', '123456', '0909876543', (SELECT id FROM roles WHERE name='FACILITY_MANAGER'), 2, 'ACTIVE');
END
GO

-- Mỗi cơ sở một Facility Manager: fm<tên cơ sở>@gmail.com / 123456 (BCrypt)
DECLARE @fmRole INT = (SELECT id FROM roles WHERE name = 'FACILITY_MANAGER');
DECLARE @pw NVARCHAR(255) = '$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu';

INSERT INTO users (full_name, email, password_hash, phone, role_id, facility_id, status)
SELECT m.full_name, m.email, @pw, m.phone, @fmRole, f.id, 'ACTIVE'
FROM (VALUES
    (N'QueenKho Tân Bình',  N'Quản lý Tân Bình',  'fmtanbinh@gmail.com',  '0901000001'),
    (N'QueenKho Bình Thạnh', N'Quản lý Bình Thạnh', 'fmbinhthanh@gmail.com', '0901000002'),
    (N'QueenKho Thủ Đức',   N'Quản lý Thủ Đức',   'fmthuduc@gmail.com',   '0901000003'),
    (N'QueenKho Gò Vấp',    N'Quản lý Gò Vấp',    'fmgovap@gmail.com',    '0901000004'),
    (N'QueenKho Cầu Giấy',  N'Quản lý Cầu Giấy',  'fmcaugiay@gmail.com',  '0901000005'),
    (N'QueenKho Quận 7',    N'Quản lý Quận 7',    'fmquan7@gmail.com',    '0901000006')
) AS m(facility_name, full_name, email, phone)
JOIN facilities f ON f.name = m.facility_name
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.email = m.email);
GO

-- UC-16: Mỗi cơ sở 3 nhân viên: staff<tên cơ sở><1..3>@gmail.com / 123456 (BCrypt)
DECLARE @staffRole INT = (SELECT id FROM roles WHERE name = 'STAFF');
DECLARE @staffPw NVARCHAR(255) = '$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu';

INSERT INTO users (full_name, email, password_hash, phone, role_id, facility_id, status)
SELECT N'Nhân viên ' + s.short_name + N' ' + CAST(n.no AS NVARCHAR(2)),
       'staff' + s.slug + CAST(n.no AS VARCHAR(2)) + '@gmail.com',
       @staffPw,
       '09020' + s.code + CAST(n.no AS VARCHAR(2)),
       @staffRole, f.id, 'ACTIVE'
FROM (VALUES
    (N'QueenKho Tân Bình',   N'Tân Bình',   'tanbinh',   '01'),
    (N'QueenKho Bình Thạnh', N'Bình Thạnh', 'binhthanh', '02'),
    (N'QueenKho Thủ Đức',    N'Thủ Đức',    'thuduc',    '03'),
    (N'QueenKho Gò Vấp',     N'Gò Vấp',     'govap',     '04'),
    (N'QueenKho Cầu Giấy',   N'Cầu Giấy',   'caugiay',   '05'),
    (N'QueenKho Quận 7',     N'Quận 7',     'quan7',     '06')
) AS s(facility_name, short_name, slug, code)
CROSS JOIN (VALUES (1), (2), (3)) AS n(no)
JOIN facilities f ON f.name = s.facility_name
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.email = 'staff' + s.slug + CAST(n.no AS VARCHAR(2)) + '@gmail.com');
GO

IF NOT EXISTS (SELECT 1 FROM unit_types WHERE id = 1)
BEGIN
    SET IDENTITY_INSERT unit_types ON;
    INSERT INTO unit_types (id, name, area_sqm, volume_cbm, base_price_monthly)
    VALUES (1, N'Kho nhỏ (2m2)', 2, 4, 500000);
    SET IDENTITY_INSERT unit_types OFF;
END
GO

DELETE FROM storage_units WHERE id LIKE 'KV-TB-%' OR id LIKE 'KV-Q9-%';

INSERT INTO storage_units (id, facility_id, unit_type_id, floor, zone, room_number, status)
VALUES ('KV-TB-A101', 1, 1, '1', 'A', '101', 'AVAILABLE');
INSERT INTO storage_units (id, facility_id, unit_type_id, floor, zone, room_number, status)
VALUES ('KV-TB-A102', 1, 1, '1', 'A', '102', 'AVAILABLE');
INSERT INTO storage_units (id, facility_id, unit_type_id, floor, zone, room_number, status)
VALUES ('KV-TB-A103', 1, 1, '1', 'A', '103', 'AVAILABLE');

INSERT INTO storage_units (id, facility_id, unit_type_id, floor, zone, room_number, status)
VALUES ('KV-Q9-B201', 2, 1, '2', 'B', '201', 'AVAILABLE');
INSERT INTO storage_units (id, facility_id, unit_type_id, floor, zone, room_number, status)
VALUES ('KV-Q9-B202', 2, 1, '2', 'B', '202', 'AVAILABLE');
GO

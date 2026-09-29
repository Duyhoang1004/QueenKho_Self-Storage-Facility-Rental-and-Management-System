USE QueenKhoDB;
GO

DELETE FROM rental_contracts;
DELETE FROM handover_records;
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

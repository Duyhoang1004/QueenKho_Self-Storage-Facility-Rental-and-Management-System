USE QueenKhoDB;

-- Role & user test (nếu chưa có customer nào)
IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'CUSTOMER')
    INSERT INTO roles (name, description) VALUES ('CUSTOMER', 'Khach hang');

INSERT INTO users (role_id, email, password_hash, full_name, phone, status)
VALUES (
    (SELECT id FROM roles WHERE name = 'CUSTOMER'),
    'test.customer@queenkho.com', 'hashed', 'Nguyen Van Test', '0900000000', 'ACTIVE'
);

-- Facility test
INSERT INTO facilities (name, city, district, address, status)
VALUES (N'QueenKho Quận 7', N'TP.HCM', N'Quận 7', N'123 Nguyễn Văn Linh', 'ACTIVE');

-- Unit type test
INSERT INTO unit_types (name, area_sqm, volume_cbm, base_price_monthly)
VALUES (N'Kho nhỏ 2m²', 2.0, 4.0, 500000);

-- Reservation test cho UC-12 (customer xem đơn của mình)
INSERT INTO reservations (reservation_code, customer_id, facility_id, unit_type_id, storage_unit_id, status, duration_months, deposit_amount, total_deposit_paid, start_date)
VALUES ('RES-001', (SELECT id FROM users WHERE email='test.customer@queenkho.com'), 1, 1, NULL, 'DEPOSIT_PAID', 3, 500000, 500000, '2026-10-01');

-- Reservation test cho UC-13 (FM xem đơn chờ gán ô — status DEPOSIT_PAID, storage_unit_id NULL)
INSERT INTO reservations (reservation_code, customer_id, facility_id, unit_type_id, storage_unit_id, status, duration_months, deposit_amount, total_deposit_paid, start_date)
VALUES ('RES-002', (SELECT id FROM users WHERE email='test.customer@queenkho.com'), 1, 1, NULL, 'DEPOSIT_PAID', 6, 1000000, 1000000, '2026-10-15');


SELECT id, email FROM users
SELECT id, name FROM facilities
/* ============================================================
   QueenKho — Seed Data mở rộng (demo/test)
   Chạy SAU khi QueenKho.sql đã tạo xong 12 bảng (roles đã có sẵn 5 dòng).
   Giả định chạy trên DB SẠCH (mới tạo, chưa insert gì thêm ngoài roles)
   để các ID tự tăng khớp đúng với các FK bên dưới.
   ============================================================ */

USE QueenKhoDB;
GO

/* ---------- facilities (5) ---------- */
INSERT INTO facilities (name, city, district, address, hotline, status) VALUES
    (N'QueenKho Quận 7',     N'Hồ Chí Minh', N'Quận 7',      N'123 Nguyễn Lương Bằng, P.Tân Phú', '028-1234567', 'ACTIVE'),
    (N'QueenKho Thủ Đức',    N'Hồ Chí Minh', N'Thủ Đức',     N'45 Võ Văn Ngân, P.Linh Chiểu',      '028-2345678', 'ACTIVE'),
    (N'QueenKho Bình Thạnh', N'Hồ Chí Minh', N'Bình Thạnh',  N'78 Điện Biên Phủ, P.25',             '028-3456789', 'ACTIVE'),
    (N'QueenKho Cầu Giấy',   N'Hà Nội',      N'Cầu Giấy',    N'12 Xuân Thủy, P.Dịch Vọng',          '024-4567890', 'ACTIVE'),
    (N'QueenKho Hải Châu',   N'Đà Nẵng',     N'Hải Châu',    N'56 Trần Phú, P.Thạch Thang',         '023-5678901', 'INACTIVE');
GO

/* ---------- users (10) ----------
   role_id: 1=CUSTOMER, 2=STAFF, 3=FACILITY_MANAGER, 4=BOM, 5=ADMIN
   Mật khẩu mẫu bên dưới là hash giả để test hiển thị — thay bằng BCrypt.encode() thật khi có API register */
INSERT INTO users (facility_id, role_id, email, password_hash, full_name, phone, cccd, status) VALUES
    (NULL, 1, 'nguyenvana@gmail.com',  '$2a$10$placeholderHash1', N'Nguyễn Văn A',  '0901111111', '079201000111', 'ACTIVE'),
    (NULL, 1, 'tranthib@gmail.com',    '$2a$10$placeholderHash2', N'Trần Thị B',    '0902222222', '079201000222', 'ACTIVE'),
    (NULL, 1, 'levanc@gmail.com',      '$2a$10$placeholderHash3', N'Lê Văn C',      '0903333333', '079201000333', 'ACTIVE'),
    (NULL, 1, 'phamthid@gmail.com',    '$2a$10$placeholderHash4', N'Phạm Thị D',    '0904444444', '079201000444', 'ACTIVE'),
    (1,    2, 'staff.q7@queenkho.vn',  '$2a$10$placeholderHash5', N'Hoàng Văn Staff', '0905555555', '079201000555', 'ACTIVE'),
    (2,    2, 'staff.tdu@queenkho.vn', '$2a$10$placeholderHash6', N'Ngô Thị Staff2',  '0906666666', '079201000666', 'ACTIVE'),
    (1,    3, 'fm.q7@queenkho.vn',     '$2a$10$placeholderHash7', N'Đặng Văn Quản Lý', '0907777777', '079201000777', 'ACTIVE'),
    (2,    3, 'fm.tdu@queenkho.vn',    '$2a$10$placeholderHash8', N'Vũ Thị Quản Lý2',  '0908888888', '079201000888', 'ACTIVE'),
    (NULL, 4, 'bom@queenkho.vn',       '$2a$10$placeholderHash9', N'Bùi Văn BOM',      '0909999999', '079201000999', 'ACTIVE'),
    (NULL, 5, 'admin@queenkho.vn',     '$2a$10$placeholderHash10', N'Admin Hệ Thống',  '0900000000', '079201000000', 'ACTIVE');
GO

/* ---------- unit_types (5) ---------- */
INSERT INTO unit_types (name, area_sqm, volume_cbm, base_price_monthly, suggested_capacity, dimensions, features) VALUES
    (N'Locker nhỏ',     0.5,  1.0,   200000,  N'Vali, tài liệu, đồ cá nhân',        N'0.5m x 0.5m x 1m', N'Có khóa số, camera 24/7'),
    (N'Kho Nhỏ (S)',    1.0,  2.5,   500000,  N'Đồ 1 phòng trọ nhỏ',                N'1m x 1m x 2.5m',   N'Kệ để đồ, chống ẩm'),
    (N'Kho Vừa (M)',    3.0,  7.5,   1200000, N'Đồ 1-2 phòng ngủ',                  N'2m x 1.5m x 2.5m', N'Kệ để đồ, chống ẩm, camera'),
    (N'Kho Lớn (L)',    6.0,  15.0,  2200000, N'Đồ nguyên căn hộ',                  N'3m x 2m x 2.5m',   N'Xe đẩy hỗ trợ, camera, kiểm soát nhiệt độ'),
    (N'Kho Rất Lớn (XL)', 10.0, 25.0, 3500000, N'Hàng hóa kinh doanh, kho lưu trữ', N'4m x 2.5m x 2.5m', N'Cửa xe tải, pallet, kiểm soát nhiệt độ');
GO

/* ---------- storage_units (10) ---------- */
INSERT INTO storage_units (id, facility_id, unit_type_id, floor, zone, room_number, status) VALUES
    ('Q7-A101', 1, 2, N'1', N'A', '101', 'OCCUPIED'),
    ('Q7-A102', 1, 2, N'1', N'A', '102', 'AVAILABLE'),
    ('Q7-B201', 1, 3, N'2', N'B', '201', 'RESERVED'),
    ('Q7-B202', 1, 3, N'2', N'B', '202', 'AVAILABLE'),
    ('TDU-A101', 2, 1, N'1', N'A', '101', 'AVAILABLE'),
    ('TDU-A102', 2, 2, N'1', N'A', '102', 'OCCUPIED'),
    ('TDU-C301', 2, 4, N'3', N'C', '301', 'AVAILABLE'),
    ('BTH-A101', 3, 2, N'1', N'A', '101', 'MAINTENANCE'),
    ('BTH-B201', 3, 3, N'2', N'B', '201', 'AVAILABLE'),
    ('BTH-C301', 3, 5, N'3', N'C', '301', 'AVAILABLE');
GO

/* ---------- rental_policy (5, 1 policy/facility) ---------- */
INSERT INTO rental_policy (facility_id, policy_name, deposit_month_multiplier, cancel_fee_percent, cancel_free_hours, lock_account_days, late_fee_per_day, liquidation_days) VALUES
    (1, N'Chính sách chuẩn Quận 7',     1, 10, 24, 7,  50000, 30),
    (2, N'Chính sách chuẩn Thủ Đức',    1, 10, 24, 7,  50000, 30),
    (3, N'Chính sách chuẩn Bình Thạnh', 1, 15, 12, 10, 60000, 30),
    (4, N'Chính sách chuẩn Cầu Giấy',   1, 10, 24, 7,  45000, 30),
    (5, N'Chính sách chuẩn Hải Châu',   1, 10, 24, 7,  40000, 30);
GO

/* ---------- reservations (8) ----------
   customer_id (users 1-4), facility_id, unit_type_id, storage_unit_id (nullable) */
INSERT INTO reservations (reservation_code, customer_id, facility_id, unit_type_id, storage_unit_id, status, duration_months, deposit_amount, total_deposit_paid, expected_appointment_time, start_date) VALUES
    ('RES-0001', 1, 1, 2, 'Q7-A101',  'COMPLETED',     6, 500000,  500000, '2026-08-01 09:00', '2026-08-01'),
    ('RES-0002', 2, 2, 2, 'TDU-A102', 'COMPLETED',     3, 500000,  500000, '2026-08-10 10:00', '2026-08-10'),
    ('RES-0003', 3, 1, 3, 'Q7-B201',  'UNIT_ASSIGNED', 6, 1200000, 1200000, '2026-09-25 14:00', NULL),
    ('RES-0004', 4, 3, 2, NULL,       'DEPOSIT_PAID',  1, 500000,  500000, '2026-09-28 09:00', NULL),
    ('RES-0005', 1, 2, 1, NULL,       'PENDING',       1, 200000,  0,      NULL, NULL),
    ('RES-0006', 2, 1, 4, NULL,       'CANCELLED',     3, 2200000, 0,      '2026-09-05 11:00', NULL),
    ('RES-0007', 3, 3, 3, NULL,       'EXPIRED',       6, 1200000, 0,      '2026-09-02 15:00', NULL),
    ('RES-0008', 4, 1, 2, NULL,       'PENDING',       1, 500000,  0,      NULL, NULL);
GO

/* ---------- rental_contracts (5) — chỉ từ reservation đã COMPLETED/có unit gán ---------- */
INSERT INTO rental_contracts (contract_code, reservation_id, customer_id, storage_unit_id, rental_policy_id, status, start_date, end_date, billing_cycle_months, deposit_held_amount, access_pin_code, rfid_card_code) VALUES
    ('HD-0001', 1, 1, 'Q7-A101',  1, 'ACTIVE',    '2026-08-01', '2027-02-01', 1, 500000,  '1357', 'RFID-000123'),
    ('HD-0002', 2, 2, 'TDU-A102', 2, 'ACTIVE',    '2026-08-10', '2026-11-10', 1, 500000,  '2468', 'RFID-000124'),
    ('HD-0003', 3, 3, 'Q7-B201',  1, 'ACTIVE',    '2026-09-25', '2027-03-25', 1, 1200000, '9182', 'RFID-000125'),
    ('HD-0004', 1, 1, 'Q7-A101',  1, 'OVERDUE',   '2026-02-01', '2026-08-01', 1, 500000,  '3141', 'RFID-000110'),
    ('HD-0005', 2, 2, 'TDU-A102', 2, 'TERMINATED','2026-01-10', '2026-04-10', 1, 500000,  '5926', 'RFID-000098');
GO

/* ---------- payment_transactions (8) ---------- */
INSERT INTO payment_transactions (transaction_code, user_id, reservation_id, contract_id, payment_type, payment_method, amount, status, paid_at) VALUES
    ('TXN-0001', 1, 1, NULL, 'DEPOSIT',      'VNPAY',         500000,  'SUCCESS', '2026-08-01 08:55'),
    ('TXN-0002', 2, 2, NULL, 'DEPOSIT',      'MOMO',          500000,  'SUCCESS', '2026-08-10 09:50'),
    ('TXN-0003', 3, 3, NULL, 'DEPOSIT',      'BANK_TRANSFER', 1200000, 'SUCCESS', '2026-09-25 13:40'),
    ('TXN-0004', 4, 4, NULL, 'DEPOSIT',      'VNPAY',         500000,  'SUCCESS', '2026-09-27 16:20'),
    ('TXN-0005', 1, NULL, 1, 'MONTHLY_RENT', 'VNPAY',         1200000, 'SUCCESS', '2026-09-01 09:00'),
    ('TXN-0006', 2, NULL, 2, 'MONTHLY_RENT', 'MOMO',          1200000, 'PENDING', NULL),
    ('TXN-0007', 3, NULL, 3, 'LATE_FEE',     'CASH',          50000,   'SUCCESS', '2026-09-20 10:00'),
    ('TXN-0008', 2, NULL, 5, 'REFUND',       'BANK_TRANSFER', 500000,  'REFUNDED','2026-04-12 11:00');
GO

/* ---------- handover_records (5) ---------- */
INSERT INTO handover_records (contract_id, staff_id, record_type, is_identity_verified, is_empty, is_clean, is_lock_intact, customer_signature_confirmed, notes) VALUES
    (1, 5, 'CHECK_IN',  1, 1, 1, 1, 1, N'Bàn giao ô kho sạch, không hư hỏng'),
    (2, 6, 'CHECK_IN',  1, 1, 1, 1, 1, N'Khách xác nhận đủ điều kiện nhận kho'),
    (3, 5, 'CHECK_IN',  1, 1, 1, 1, 0, N'Khách chưa ký xác nhận, chờ bổ sung'),
    (4, 5, 'CHECK_OUT', 1, 0, 1, 1, 1, N'Còn sót vài thùng carton, đã nhắc khách lấy nốt'),
    (5, 6, 'CHECK_OUT', 1, 1, 1, 1, 1, N'Trả kho đúng hạn, hoàn cọc đủ');
GO

/* ---------- support_requests (5) ---------- */
INSERT INTO support_requests (ticket_code, contract_id, customer_id, issue_type, description, status) VALUES
    ('TICKET-0001', 1, 1, N'Sự cố khóa',        N'Khóa số ô kho bị kẹt, không mở được', 'RESOLVED'),
    ('TICKET-0002', 2, 2, N'Hỏi phí',           N'Muốn hỏi cách tính phí trễ hạn',       'CLOSED'),
    ('TICKET-0003', 3, 3, N'Yêu cầu đổi kho',   N'Muốn đổi sang ô kho tầng trệt',        'IN_PROGRESS'),
    ('TICKET-0004', NULL, 4, N'Hỏi trước khi thuê', N'Kho có hỗ trợ xe tải lớn không',   'OPEN'),
    ('TICKET-0005', 4, 1, N'Khiếu nại',         N'Phát hiện đồ bị ẩm mốc trong kho',     'OPEN');
GO

/* ---------- activity_logs (8) ---------- */
INSERT INTO activity_logs (user_id, action, target_entity, target_id) VALUES
    (1,  'CREATE_RESERVATION',  'reservation',    '1'),
    (1,  'PAY_DEPOSIT',         'reservation',    '1'),
    (7,  'ASSIGN_UNIT',         'reservation',    '3'),
    (5,  'CHECK_IN',            'contract',       '1'),
    (2,  'CANCEL_RESERVATION',  'reservation',    '6'),
    (9,  'CREATE_USER',         'user',           '10'),
    (3,  'SUBMIT_TICKET',       'support_request','3'),
    (10, 'LOGIN',               'user',           '10');
GO


select * from payment_transactions
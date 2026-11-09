/* ============================================================
   QueenKho — DỮ LIỆU DEMO 7 FLOW (SQL Server) — 08/11/2026
   Đi kèm kịch bản: docs/kich-ban-demo-7-flow.md (mã đơn, mã hợp đồng trong file này khớp với kịch bản).

   CÁCH CHẠY (làm đúng thứ tự, trong NGÀY demo, trước giờ demo tối đa 12 tiếng):
     1. Tắt backend.
     2. sqlcmd -S localhost -U sa -P 12345 -C -I -f 65001 -i sql_script/QueenKho_setup_data.sql
        (XOÁ VÀ TẠO LẠI QueenKhoDB — mất dữ liệu local đang có)
     3. sqlcmd -S localhost -U sa -P 12345 -C -I -f 65001 -i sql_script/QueenKho_demo_data.sql
     4. Bật backend + frontend, đăng xuất / đăng nhập lại.
   Trên SSMS: mở từng file rồi F5. Muốn demo lại từ đầu: làm lại từ bước 1.

   VÌ SAO CHẠY TRONG NGÀY: mọi ngày trong file tính theo hôm nay (ví dụ "hẹn sau 36 giờ" cho ca huỷ giữ 50% cọc).
   Task trả kho / check-in của ca chính hết hạn lúc 21:00 hôm nay.

   Mật khẩu mọi tài khoản demo: 123456. Email đuôi @queenkho.local — không phải hộp thư thật, không gửi nhầm ai.

   Script này:
     - bổ sung 4 cột huỷ đơn mà QueenKho_setup_data.sql còn thiếu (= Update_cancel_business_rule_06_11.sql);
     - xoá dữ liệu rác E2E trong file setup (voucher, kho tổng, loại hàng tên E2E);
     - thêm Tầng 2 cho Tân Bình (24 ô Tiêu Chuẩn D201–D224, 12 ô Mini M E201–E212) để đủ ô cho các ca;
     - thêm 15 khách demo + 6 khách lịch sử, 5 voucher, đơn / hợp đồng / task / giao dịch / ticket / hồ sơ bồi thường;
     - thêm lịch sử doanh thu 12 tháng ở Tân Bình, Bình Thạnh, Thủ Đức, Gò Vấp cho báo cáo BOM.
   ============================================================ */
USE QueenKhoDB;
GO
SET NOCOUNT ON;
GO

-- Chặn chạy trên DB đã có giao dịch: file này giả định DB vừa chạy QueenKho_setup_data.sql
IF EXISTS (SELECT 1 FROM reservations)
BEGIN
    RAISERROR(N'DB đã có đơn đặt chỗ. Hãy chạy lại QueenKho_setup_data.sql trước rồi mới chạy file này.', 16, 1);
    SET NOEXEC ON;
END
GO

-- ------------------------------------------------------------
-- 0. Đồng bộ schema + dọn rác của file setup
-- ------------------------------------------------------------
IF COL_LENGTH('dbo.reservations', 'cancelled_at') IS NULL ALTER TABLE dbo.reservations ADD cancelled_at DATETIME2 NULL;
GO
IF COL_LENGTH('dbo.reservations', 'cancellation_tier') IS NULL ALTER TABLE dbo.reservations ADD cancellation_tier NVARCHAR(30) NULL;
GO
IF COL_LENGTH('dbo.reservations', 'cancellation_penalty_amount') IS NULL ALTER TABLE dbo.reservations ADD cancellation_penalty_amount DECIMAL(12,2) NULL;
GO
IF COL_LENGTH('dbo.reservations', 'cancellation_refund_amount') IS NULL ALTER TABLE dbo.reservations ADD cancellation_refund_amount DECIMAL(12,2) NULL;
GO
UPDATE dbo.rental_policy SET cancel_free_hours = 48, cancel_fee_percent = 50 WHERE cancel_free_hours <> 48 OR cancel_fee_percent <> 50;
DELETE FROM dbo.vouchers WHERE code LIKE 'E2E%';
DELETE FROM dbo.central_warehouses WHERE name LIKE 'E2E%';
DELETE FROM dbo.goods_categories WHERE code LIKE 'E2E%';
GO

-- ------------------------------------------------------------
-- 1. Tài khoản khách (mật khẩu 123456 — dùng lại hash của tài khoản seed)
-- ------------------------------------------------------------
DECLARE @hash NVARCHAR(255) = (SELECT password_hash FROM users WHERE email = 'fmtanbinh@gmail.com');
DECLARE @role INT = (SELECT id FROM roles WHERE name = 'CUSTOMER');
INSERT INTO users (facility_id, role_id, email, password_hash, full_name, phone, cccd, status)
SELECT NULL, @role, v.email, @hash, v.full_name, v.phone, v.cccd, 'ACTIVE'
FROM (VALUES
    ('an.khach@queenkho.local',    N'Nguyễn Văn An',     '0911000001', '079201000001'),
    ('binh.khach@queenkho.local',  N'Trần Thị Bình',     '0911000002', '079201000002'),
    ('cuong.khach@queenkho.local', N'Lê Hoàng Cường',    '0911000003', '079201000003'),
    ('dung.khach@queenkho.local',  N'Phạm Thu Dung',     '0911000004', '079201000004'),
    ('duc.khach@queenkho.local',   N'Hoàng Minh Đức',    '0911000005', '079201000005'),
    ('giang.khach@queenkho.local', N'Vũ Thị Giang',      '0911000006', '079201000006'),
    ('hai.khach@queenkho.local',   N'Đỗ Văn Hải',        '0911000007', '079201000007'),
    ('khanh.khach@queenkho.local', N'Bùi Quốc Khánh',    '0911000008', '079201000008'),
    ('lan.khach@queenkho.local',   N'Ngô Thị Lan',       '0911000009', '079201000009'),
    ('minh.khach@queenkho.local',  N'Đặng Quang Minh',   '0911000010', '079201000010'),
    ('nga.khach@queenkho.local',   N'Trịnh Thuý Nga',    '0911000011', '079201000011'),
    ('phuc.khach@queenkho.local',  N'Phan Văn Phúc',     '0911000012', '079201000012'),
    ('quynh.khach@queenkho.local', N'Lý Thu Quỳnh',      '0911000013', '079201000013'),
    ('son.khach@queenkho.local',   N'Hồ Thanh Sơn',      '0911000014', '079201000014'),
    ('tam.khach@queenkho.local',   N'Cao Minh Tâm',      '0911000015', '079201000015'),
    ('ls1.khach@queenkho.local',   N'Công ty Hoa Mai',   '0911000021', '079201000021'),
    ('ls2.khach@queenkho.local',   N'Shop Thời Trang Vy','0911000022', '079201000022'),
    ('ls3.khach@queenkho.local',   N'Nguyễn Hữu Tín',    '0911000023', '079201000023'),
    ('ls4.khach@queenkho.local',   N'Lê Thị Hạnh',       '0911000024', '079201000024'),
    ('ls5.khach@queenkho.local',   N'Trần Quốc Bảo',     '0911000025', '079201000025'),
    ('ls6.khach@queenkho.local',   N'Võ Thanh Trà',      '0911000026', '079201000026')
) v(email, full_name, phone, cccd);
GO

-- ------------------------------------------------------------
-- 2. Tân Bình Tầng 2: thêm ô để đủ chỗ cho các ca demo (có mặt bằng, vật cố định)
-- ------------------------------------------------------------
INSERT INTO facility_floors (facility_id, name, grid_width, grid_height, sort_order) VALUES (1, N'Tầng 2', 56, 40, 2);
DECLARE @floor INT = SCOPE_IDENTITY();
INSERT INTO floor_fixtures (floor_id, fixture_type, label, map_x, map_y, map_w, map_h) VALUES
    (@floor, 'STAIRS',   N'Thang bộ',   0, 0, 8, 6),
    (@floor, 'ELEVATOR', N'Thang máy',  0, 6, 8, 5),
    (@floor, 'AISLE',    N'Lối đi D',   8, 11, 48, 4),
    (@floor, 'AISLE',    N'Lối đi E',   8, 20, 48, 4),
    (@floor, 'AISLE',    N'Lối đi F',   8, 35, 48, 4);

DECLARE @i INT = 1;
WHILE @i <= 24
BEGIN
    INSERT INTO storage_units (id, facility_id, unit_type_id, floor, zone, room_number, status, map_x, map_y, map_w, map_h, map_door)
    VALUES (CONCAT('KV-TB-D', 200 + @i), 1, 2, N'Tầng 2', N'D', CAST(200 + @i AS NVARCHAR(10)), 'AVAILABLE',
            12 + ((@i - 1) % 8) * 5, CASE WHEN @i <= 8 THEN 6 WHEN @i <= 16 THEN 15 ELSE 30 END, 5, 5, CASE WHEN @i <= 8 OR @i > 16 THEN 'BOTTOM' ELSE 'TOP' END);
    SET @i += 1;
END
SET @i = 1;
WHILE @i <= 12
BEGIN
    INSERT INTO storage_units (id, facility_id, unit_type_id, floor, zone, room_number, status, map_x, map_y, map_w, map_h, map_door)
    VALUES (CONCAT('KV-TB-E', 200 + @i), 1, 1, N'Tầng 2', N'E', CAST(200 + @i AS NVARCHAR(10)), 'AVAILABLE',
            12 + (@i - 1) * 3, 24, 3, 5, 'TOP');
    SET @i += 1;
END
GO

-- ------------------------------------------------------------
-- 3. Voucher (BR-25, BR-133) — NEWKHO mặc định đã có sẵn
-- ------------------------------------------------------------
DECLARE @bom INT = (SELECT id FROM users WHERE email = 'bom@queenkho.com');
DECLARE @now DATETIME2 = SYSDATETIME();
INSERT INTO vouchers (code, name, discount_type, discount_value, max_discount, min_months, facility_id, unit_type_id, start_at, end_at, usage_limit, per_user_limit, used_count, is_default, status, created_by)
VALUES
    ('HE2026',   N'Ưu đãi mùa hè giảm 150.000đ',         'FIXED',   150000, NULL,   1, NULL, NULL, DATEADD(DAY, -30, @now), DATEADD(DAY, 60, @now), 100, 1, 0, 0, 'ACTIVE', @bom),
    ('DAIHAN10', N'Thuê từ 3 tháng giảm 10% (tối đa 300.000đ)', 'PERCENT', 10, 300000, 3, NULL, NULL, DATEADD(DAY, -30, @now), DATEADD(DAY, 60, @now), 100, 1, 0, 0, 'ACTIVE', @bom),
    ('LANH50',   N'Chỉ áp cho Kho Lạnh 6m²',             'FIXED',   50000,  NULL,   1, NULL, 7,    DATEADD(DAY, -30, @now), DATEADD(DAY, 60, @now), 100, 1, 0, 0, 'ACTIVE', @bom),
    ('HETHAN',   N'Voucher đã hết hạn',                  'FIXED',   200000, NULL,   1, NULL, NULL, DATEADD(DAY, -60, @now), DATEADD(DAY, -1, @now), 100, 1, 0, 0, 'ACTIVE', @bom),
    ('HETLUOT',  N'Voucher đã hết lượt dùng',            'FIXED',   200000, NULL,   1, NULL, NULL, DATEADD(DAY, -30, @now), DATEADD(DAY, 60, @now), 1,   1, 1, 0, 'ACTIVE', @bom);
GO

-- ------------------------------------------------------------
-- 4. Thủ tục phụ (chỉ tồn tại trong phiên chạy file này)
-- ------------------------------------------------------------
-- Đơn đã thanh toán: tiền đúng công thức BR-24 = thuê sau ưu đãi gói + cọc − voucher NEWKHO + bảo hiểm × số tháng
CREATE PROCEDURE #mk_order
    @code NVARCHAR(50), @email NVARCHAR(100), @fac INT, @type INT, @months INT, @start DATE,
    @appt DATETIME2 = NULL, @paid_at DATETIME2 = NULL, @plan NVARCHAR(20) = 'BASIC', @terms NVARCHAR(10) = 'v4',
    @goods NVARCHAR(200) = 'HOUSEHOLD', @declared DECIMAL(14,2) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @cust INT = (SELECT id FROM users WHERE email = @email);
    DECLARE @base DECIMAL(12,2) = (SELECT base_price_monthly FROM unit_types WHERE id = @type);
    DECLARE @mult DECIMAL(6,2), @d3 INT, @d6 INT, @d12 INT;
    SELECT @mult = deposit_month_multiplier, @d3 = booking_discount_3m, @d6 = booking_discount_6m, @d12 = booking_discount_12m
    FROM rental_policy WHERE facility_id = @fac AND is_active = 1;
    DECLARE @disc INT = CASE @months WHEN 3 THEN @d3 WHEN 6 THEN @d6 WHEN 12 THEN @d12 ELSE 0 END;
    DECLARE @deposit DECIMAL(12,2) = @base * @mult;
    DECLARE @premium DECIMAL(12,2) = CASE @plan WHEN 'ADVANCED' THEN 50000 WHEN 'PREMIUM' THEN 120000 ELSE 0 END;
    DECLARE @voucher INT = (SELECT id FROM vouchers WHERE code = 'NEWKHO');
    DECLARE @total DECIMAL(12,2) = ROUND(@base * @months * (100 - @disc) / 100, 0) + @deposit - 100000 + @premium * @months;
    SET @appt = COALESCE(@appt, DATEADD(HOUR, 9, CAST(@start AS DATETIME2)));
    SET @paid_at = COALESCE(@paid_at, DATEADD(DAY, -1, SYSDATETIME()));
    DECLARE @created DATETIME2 = DATEADD(MINUTE, -5, @paid_at);

    INSERT INTO reservations (reservation_code, customer_id, facility_id, unit_type_id, status, duration_months, deposit_amount, total_deposit_paid,
                              expected_appointment_time, start_date, rent_discount_percent, terms_version, terms_accepted_at,
                              insurance_plan, insurance_premium_monthly, declared_goods_value, goods_category_codes,
                              voucher_id, voucher_code, voucher_discount, created_at)
    VALUES (@code, @cust, @fac, @type, 'DEPOSIT_PAID', @months, @deposit, @deposit, @appt, @start, @disc, @terms, @created,
            @plan, @premium, @declared, @goods, @voucher, 'NEWKHO', 100000, @created);
    DECLARE @res INT = SCOPE_IDENTITY();

    INSERT INTO payment_transactions (transaction_code, user_id, reservation_id, payment_type, payment_method, amount, status, paid_at, bank_transaction_code)
    VALUES (CONCAT('QK', REPLACE(@code, '-', '')), @cust, @res, 'DEPOSIT', 'VNPAY', @total, 'SUCCESS', @paid_at, CONCAT('NCB', RIGHT(CONCAT('00000000', @res * 137), 8)));
END
GO

-- Hợp đồng của 1 đơn. Đã check-in → có biên bản CHECK_IN + task CHECK_IN đã xong; chờ nhận kho → task CHECK_IN theo @task_status
CREATE PROCEDURE #mk_contract
    @res_code NVARCHAR(50), @code NVARCHAR(50), @unit NVARCHAR(20), @status NVARCHAR(30),
    @end DATE = NULL, @held DECIMAL(12,2) = NULL, @task_status NVARCHAR(20) = 'OPEN', @task_staff NVARCHAR(100) = NULL,
    @rfid NVARCHAR(50) = NULL, @pin NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @res INT, @cust INT, @fac INT, @start DATE, @months INT, @deposit DECIMAL(12,2);
    SELECT @res = id, @cust = customer_id, @fac = facility_id, @start = start_date, @months = duration_months, @deposit = deposit_amount
    FROM reservations WHERE reservation_code = @res_code;
    DECLARE @policy INT = (SELECT id FROM rental_policy WHERE facility_id = @fac AND is_active = 1);
    DECLARE @live BIT = CASE WHEN @status IN ('ACTIVE', 'OVERDUE', 'TERMINATION_PENDING') THEN 1 ELSE 0 END;
    DECLARE @checked BIT = CASE WHEN @status = 'PENDING_CHECK_IN' THEN 0 ELSE 1 END;

    INSERT INTO rental_contracts (contract_code, reservation_id, customer_id, storage_unit_id, rental_policy_id, status, start_date, end_date,
                                  billing_cycle_months, deposit_held_amount, access_pin_code, rfid_card_code)
    VALUES (@code, @res, @cust, @unit, @policy, @status, @start, COALESCE(@end, DATEADD(MONTH, @months, @start)), @months, COALESCE(@held, @deposit),
            CASE WHEN @live = 1 THEN COALESCE(@pin, RIGHT(CONCAT('5', 100000 + @res * 7), 6)) END,
            CASE WHEN @live = 1 THEN COALESCE(@rfid, CONCAT('RFID-', @code)) END);
    DECLARE @contract INT = SCOPE_IDENTITY();

    UPDATE reservations SET storage_unit_id = @unit,
        status = CASE WHEN @status = 'TERMINATION_PENDING' THEN 'TERMINATION_PENDING'
                      WHEN @status IN ('TERMINATED', 'LIQUIDATED') THEN 'COMPLETED' ELSE 'UNIT_ASSIGNED' END
    WHERE id = @res;

    DECLARE @staff1 INT = (SELECT TOP 1 u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'STAFF' AND u.facility_id = @fac ORDER BY u.id);
    DECLARE @due DATETIME2 = DATEADD(HOUR, 21, CAST(@start AS DATETIME2));
    IF @checked = 1
    BEGIN
        DECLARE @at DATETIME2 = DATEADD(HOUR, 10, CAST(@start AS DATETIME2));
        INSERT INTO facility_tasks (facility_id, task_type, contract_id, status, staff_id, due_at, created_at, claimed_at, completed_at)
        VALUES (@fac, 'CHECK_IN', @contract, 'COMPLETED', @staff1, @due, DATEADD(HOUR, -1, @at), DATEADD(MINUTE, -30, @at), @at);
        INSERT INTO handover_records (contract_id, staff_id, record_type, is_identity_verified, is_empty, is_clean, is_lock_intact, customer_signature_confirmed, is_prohibited_goods_committed, notes, evidence_image_urls, check_in_method, created_at)
        VALUES (@contract, @staff1, 'CHECK_IN', 1, 1, 1, 1, 1, 1, N'Ô sạch, khoá tốt, đã đối chiếu CCCD và loại hàng.', 'http://localhost:5173/demo/hien-trang-o-kho.svg', 'COUNTER', @at);
    END
    ELSE
    BEGIN
        DECLARE @staff INT = (SELECT id FROM users WHERE email = @task_staff);
        INSERT INTO facility_tasks (facility_id, task_type, contract_id, status, staff_id, due_at, created_at, claimed_at)
        VALUES (@fac, 'CHECK_IN', @contract, @task_status, @staff, @due, DATEADD(HOUR, -2, SYSDATETIME()), CASE WHEN @staff IS NOT NULL THEN DATEADD(HOUR, -1, SYSDATETIME()) END);
    END
END
GO

-- Hợp đồng đã hẹn trả kho: task CHECK_OUT + đúng ghi chú hoàn cọc mà nghiệp vụ đọc lại (PR-O3)
CREATE PROCEDURE #mk_checkout @contract_code NVARCHAR(50), @day DATE, @status NVARCHAR(20) = 'OPEN', @staff_email NVARCHAR(100) = NULL, @bank BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @contract INT, @fac INT, @name NVARCHAR(100);
    SELECT @contract = c.id, @fac = su.facility_id, @name = u.full_name FROM rental_contracts c
    JOIN storage_units su ON su.id = c.storage_unit_id JOIN users u ON u.id = c.customer_id WHERE c.contract_code = @contract_code;
    DECLARE @staff INT = (SELECT id FROM users WHERE email = @staff_email);
    INSERT INTO facility_tasks (facility_id, task_type, contract_id, status, staff_id, due_at, note, created_at, claimed_at)
    VALUES (@fac, 'CHECK_OUT', @contract, @status, @staff, DATEADD(HOUR, 21, CAST(@day AS DATETIME2)),
            CONCAT(N'Yêu cầu trả kho ngày: ', CONVERT(CHAR(10), @day, 23),
                   CASE WHEN @bank = 1 THEN CONCAT(N' | Hoàn cọc STK: 0123456789 (Vietcombank - ', @name, N')') ELSE N' | Hoàn tiền: Nhận tiền mặt trực tiếp tại quầy' END),
            DATEADD(DAY, -2, SYSDATETIME()), CASE WHEN @staff IS NOT NULL THEN DATEADD(HOUR, -2, SYSDATETIME()) END);
END
GO

-- Ticket hỗ trợ + task SUPPORT cùng định dạng ghi chú với SupportRequestService
CREATE PROCEDURE #mk_ticket @code NVARCHAR(30), @contract_code NVARCHAR(50), @type NVARCHAR(30), @desc NVARCHAR(1000), @status NVARCHAR(20) = 'OPEN',
    @task_status NVARCHAR(20) = 'OPEN', @staff_email NVARCHAR(100) = NULL, @due DATETIME2 = NULL, @resolution NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @contract INT, @cust INT, @fac INT;
    SELECT @contract = c.id, @cust = c.customer_id, @fac = su.facility_id FROM rental_contracts c
    JOIN storage_units su ON su.id = c.storage_unit_id WHERE c.contract_code = @contract_code;
    INSERT INTO support_requests (ticket_code, contract_id, customer_id, issue_type, description, status, resolution_note, resolved_at, created_at)
    VALUES (@code, @contract, @cust, @type, @desc, @status, @resolution, CASE WHEN @status = 'RESOLVED' THEN DATEADD(HOUR, -3, SYSDATETIME()) END, DATEADD(HOUR, -6, SYSDATETIME()));
    DECLARE @ticket INT = SCOPE_IDENTITY();
    DECLARE @urgent BIT = CASE WHEN @type IN ('LOCK_ISSUE', 'SECURITY', 'GOODS_DAMAGE', 'GOODS_LOSS') THEN 1 ELSE 0 END;
    DECLARE @label NVARCHAR(50) = CASE @type WHEN 'LOCK_ISSUE' THEN N'Lỗi khoá / PIN' WHEN 'CLEANING' THEN N'Vệ sinh' WHEN 'FACILITY_DAMAGE' THEN N'Hư hỏng cơ sở vật chất'
        WHEN 'GOODS_DAMAGE' THEN N'Hàng hư hỏng' WHEN 'GOODS_LOSS' THEN N'Hàng thất lạc' ELSE N'Khác' END;
    DECLARE @staff INT = (SELECT id FROM users WHERE email = @staff_email);
    INSERT INTO facility_tasks (facility_id, task_type, contract_id, support_request_id, status, staff_id, due_at, note, created_at, claimed_at, completed_at)
    VALUES (@fac, 'SUPPORT', @contract, @ticket, @task_status, @staff,
            COALESCE(@due, DATEADD(HOUR, 21, CAST(CAST(SYSDATETIME() AS DATE) AS DATETIME2))),
            CONCAT(CASE WHEN @urgent = 1 THEN N'[KHẨN] ' END, '[', @code, '] ', @label, ': ', @desc),
            DATEADD(HOUR, -6, SYSDATETIME()), CASE WHEN @staff IS NOT NULL THEN DATEADD(HOUR, -5, SYSDATETIME()) END,
            CASE WHEN @task_status = 'COMPLETED' THEN DATEADD(HOUR, -3, SYSDATETIME()) END);
END
GO

-- ------------------------------------------------------------
-- 5. FLOW 1 — Đặt kho (ca huỷ đơn, khách còn nợ, ô tương lai, ô sắp trống)
-- ------------------------------------------------------------
DECLARE @today DATE = CAST(SYSDATETIME() AS DATE);
DECLARE @now DATETIME2 = SYSDATETIME();
DECLARE @d DATE, @t DATETIME2;

-- F1-X5..X8: 5 mức huỷ đơn trên 1 khách (hai.khach) — Kho Tiêu Chuẩn
SET @d = DATEADD(DAY, 10, @today);
EXEC #mk_order 'RES-F1-01', 'hai.khach@queenkho.local', 1, 2, 1, @d;                                         -- còn ≥ 48h → hoàn 100%
SET @t = DATEADD(HOUR, 36, @now); SET @d = CAST(@t AS DATE);
EXEC #mk_order 'RES-F1-02', 'hai.khach@queenkho.local', 1, 2, 1, @d, @t;                                     -- còn 24–48h → giữ 50% cọc
SET @t = DATEADD(HOUR, 20, @now); SET @d = CAST(@t AS DATE);
EXEC #mk_order 'RES-F1-03', 'hai.khach@queenkho.local', 1, 2, 1, @d, @t;                                     -- còn < 24h → giữ 100% cọc
SET @t = DATEADD(HOUR, -5, @now); SET @d = CAST(@t AS DATE);
EXEC #mk_order 'RES-F1-04', 'hai.khach@queenkho.local', 1, 2, 3, @d, @t;                                     -- đã qua giờ hẹn → giữ cọc + 1 tháng
EXEC #mk_contract 'RES-F1-04', 'HD-F1-04', 'KV-TB-A105', 'PENDING_CHECK_IN';
SET @d = DATEADD(DAY, -1, @today);
EXEC #mk_order 'RES-F1-05', 'hai.khach@queenkho.local', 1, 2, 1, @d;                                         -- tới ngày mà cơ sở chưa gán ô → PR-R12 hoàn 100%

-- F1-X3: khách còn nợ phí sự cố → bị chặn đặt kho; trả nợ ở /thanh-toan (PR-Q12, PR-50)
SET @d = DATEADD(MONTH, -4, @today);
EXEC #mk_order 'RES-F1-06', 'duc.khach@queenkho.local', 1, 1, 1, @d, NULL, @d;
SET @d = DATEADD(MONTH, -3, @today);
EXEC #mk_contract 'RES-F1-06', 'HD-F1-06', 'KV-TB-E211', 'TERMINATED', @d, 0;
INSERT INTO payment_transactions (transaction_code, user_id, contract_id, payment_type, payment_method, amount, status)
SELECT 'DMG-DEBT-F1-06', customer_id, id, 'DAMAGE_FEE', 'VNPAY', 650000, 'PENDING' FROM rental_contracts WHERE contract_code = 'HD-F1-06';

-- F1-X4: Kho Gia Đình — B201 đã gán cho khách nhận sau 60 ngày, B202 đang thuê → chỉ còn khoảng trống trước ngày 60 (BR-136)
SET @d = DATEADD(DAY, 60, @today);
EXEC #mk_order 'RES-F1-07', 'khanh.khach@queenkho.local', 1, 3, 12, @d;
EXEC #mk_contract 'RES-F1-07', 'HD-F1-07', 'KV-TB-B201', 'PENDING_CHECK_IN';
SET @d = DATEADD(DAY, -60, @today);
EXEC #mk_order 'RES-F1-08', 'ls1.khach@queenkho.local', 1, 3, 12, @d, NULL, @d;
EXEC #mk_contract 'RES-F1-08', 'HD-F1-08', 'KV-TB-B202', 'ACTIVE';

-- F1-X2: Kho Đặc Biệt XL — A106 đã hẹn trả sau 5 ngày, B205 đang thuê → hết ô, tìm kiếm hiện "Trống từ dd/MM" (PR-R11)
SET @d = DATEADD(DAY, -10, @today);
EXEC #mk_order 'RES-F1-09', 'khanh.khach@queenkho.local', 1, 5, 1, @d, NULL, @d;
EXEC #mk_contract 'RES-F1-09', 'HD-F1-09', 'KV-TB-A106', 'TERMINATION_PENDING';
SET @d = DATEADD(DAY, 5, @today);
EXEC #mk_checkout 'HD-F1-09', @d;
SET @d = DATEADD(DAY, -60, @today);
EXEC #mk_order 'RES-F1-10', 'ls2.khach@queenkho.local', 1, 5, 12, @d, NULL, @d;
EXEC #mk_contract 'RES-F1-10', 'HD-F1-10', 'KV-TB-B205', 'ACTIVE';

-- F1-X9: Kho Lạnh còn đúng 1 suất (L104) — 2 khách tranh suất cuối (PR-B1). L101 dùng ở Flow 7, L102 đang thuê.
SET @d = DATEADD(DAY, -30, @today);
EXEC #mk_order 'RES-F1-11', 'ls3.khach@queenkho.local', 1, 7, 6, @d, NULL, @d, 'BASIC', 'v4', 'FOOD';
EXEC #mk_contract 'RES-F1-11', 'HD-F1-11', 'KV-TB-L102', 'ACTIVE';
GO

-- ------------------------------------------------------------
-- 6. FLOW 2 — Gán ô, giao việc, check-in
-- ------------------------------------------------------------
DECLARE @today DATE = CAST(SYSDATETIME() AS DATE);
DECLARE @now DATETIME2 = SYSDATETIME();
DECLARE @d DATE, @t DATETIME2;
DECLARE @staff1 NVARCHAR(100) = 'stafftanbinh1@gmail.com';
DECLARE @fm INT = (SELECT id FROM users WHERE email = 'fmtanbinh@gmail.com');
DECLARE @st1 INT = (SELECT id FROM users WHERE email = @staff1);

-- Ca chính: đơn đã cọc, nhận kho hôm nay, chưa có ô
EXEC #mk_order 'RES-F2-01', 'binh.khach@queenkho.local', 1, 2, 3, @today;

-- F2-X1 / X2: đã giao Staff 1, hẹn sau 3 ngày → check-in sớm bị chặn; Staff 2 không phải người giữ task
SET @d = DATEADD(DAY, 3, @today);
EXEC #mk_order 'RES-F2-02', 'binh.khach@queenkho.local', 1, 2, 1, @d;
EXEC #mk_contract 'RES-F2-02', 'HD-F2-02', 'KV-TB-D202', 'PENDING_CHECK_IN', NULL, NULL, 'IN_PROGRESS', @staff1;

-- F2-X3: hẹn sau 45 ngày → ngoài khung 30 ngày, chưa giao được (PR-T1)
SET @d = DATEADD(DAY, 45, @today);
EXEC #mk_order 'RES-F2-03', 'khanh.khach@queenkho.local', 1, 2, 3, @d;
EXEC #mk_contract 'RES-F2-03', 'HD-F2-03', 'KV-TB-D203', 'PENDING_CHECK_IN';

-- F2-X4: Kịch bản giảng viên — ô C101 đã gán khách A (12 tháng, nhận sau 60 ngày); khách B thuê 1 tháng từ tuần sau lấp khoảng trống
SET @d = DATEADD(DAY, 60, @today);
EXEC #mk_order 'RES-F2-04', 'khanh.khach@queenkho.local', 1, 6, 12, @d;
EXEC #mk_contract 'RES-F2-04', 'HD-F2-04', 'KV-TB-C101', 'PENDING_CHECK_IN';
SET @d = DATEADD(DAY, 7, @today);
EXEC #mk_order 'RES-F2-05', 'tam.khach@queenkho.local', 1, 6, 1, @d;     -- khách B: 1 tháng → gợi ý C101 "Vừa khít"
EXEC #mk_order 'RES-F2-06', 'tam.khach@queenkho.local', 1, 6, 3, @d;     -- 3 tháng → đè ngày A nhận, không được gợi ý C101

-- F2-X5: ô bảo trì mà khách đã gán trước, hôm nay nhận → check-in bị chặn, FM đổi ô (BR-139)
EXEC #mk_order 'RES-F2-07', 'binh.khach@queenkho.local', 1, 2, 1, @today;
EXEC #mk_contract 'RES-F2-07', 'HD-F2-07', 'KV-TB-D204', 'PENDING_CHECK_IN', NULL, NULL, 'IN_PROGRESS', @staff1;
UPDATE storage_units SET status = 'MAINTENANCE', maintenance_note = N'Thấm nước trần ô D204 sau cơn mưa, đang chờ thợ sửa', maintenance_since = DATEADD(HOUR, -3, @now) WHERE id = 'KV-TB-D204';

-- F2-X6: No-Show — khách từ chối tới → huỷ ngay, không chờ 48h (PR-X3a)
SET @d = DATEADD(DAY, -1, @today);
EXEC #mk_order 'RES-F2-08', 'lan.khach@queenkho.local', 1, 2, 3, @d;
EXEC #mk_contract 'RES-F2-08', 'HD-F2-08', 'KV-TB-D205', 'PENDING_CHECK_IN', NULL, NULL, 'OVERDUE';
INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at)
SELECT @st1, N'[CONTACT][REFUSED] Nhân viên Tân Bình 1 báo cáo liên hệ: [Khách từ chối tới nhận kho]', 'reservations', CAST(id AS NVARCHAR(50)), DATEADD(HOUR, -4, @now) FROM reservations WHERE reservation_code = 'RES-F2-08';

-- F2-X7: No-Show — không liên lạc được, đủ 2 lần + qua 48h (PR-X3b); gói 3 tháng để thấy phần hoàn lại (PR-X1)
SET @d = DATEADD(DAY, -3, @today);
EXEC #mk_order 'RES-F2-09', 'lan.khach@queenkho.local', 1, 2, 3, @d;
EXEC #mk_contract 'RES-F2-09', 'HD-F2-09', 'KV-TB-D206', 'PENDING_CHECK_IN', NULL, NULL, 'OVERDUE';
INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at)
SELECT @st1, v.a, 'reservations', CAST(r.id AS NVARCHAR(50)), v.t FROM reservations r
CROSS JOIN (VALUES (N'[CONTACT][FAILED] Nhân viên Tân Bình 1 báo cáo liên hệ: [Không nghe máy]', DATEADD(HOUR, -30, @now)),
                   (N'[CONTACT][FAILED] Nhân viên Tân Bình 1 báo cáo liên hệ: [Thuê bao không liên lạc được]', DATEADD(HOUR, -6, @now))) v(a, t)
WHERE r.reservation_code = 'RES-F2-09';

-- F2-X8: No-Show chưa đủ điều kiện (1 lần, chưa qua 48h) → nút khoá; liên hệ được thì dời lịch (BR-52)
SET @d = DATEADD(DAY, -1, @today);
EXEC #mk_order 'RES-F2-10', 'lan.khach@queenkho.local', 1, 2, 1, @d;
EXEC #mk_contract 'RES-F2-10', 'HD-F2-10', 'KV-TB-D207', 'PENDING_CHECK_IN', NULL, NULL, 'OVERDUE';
INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at)
SELECT @st1, N'[CONTACT][FAILED] Nhân viên Tân Bình 1 báo cáo liên hệ: [Không nghe máy]', 'reservations', CAST(id AS NVARCHAR(50)), DATEADD(HOUR, -5, @now) FROM reservations WHERE reservation_code = 'RES-F2-10';

-- Cột "Báo cáo từ Staff" ở tab No-Show đọc ghi chú trên task CHECK_IN
UPDATE t SET t.note = v.n FROM facility_tasks t JOIN rental_contracts c ON c.id = t.contract_id
JOIN (VALUES ('HD-F2-08', N'[Khách từ chối tới nhận kho] Khách nói đã thuê chỗ khác, không nhận kho nữa'),
             ('HD-F2-09', N'[Thuê bao không liên lạc được] Gọi 2 lần trong 2 ngày đều không được'),
             ('HD-F2-10', N'[Không nghe máy] Sẽ gọi lại chiều nay')) v(code, n) ON v.code = c.contract_code
WHERE t.task_type = 'CHECK_IN';

-- F2-X9: Trùng lịch — khách đang thuê D208 đã gia hạn đè lên ngày nhận của khách gán sau → lịch báo đỏ, FM đổi ô (BR-137)
SET @d = DATEADD(DAY, -20, @today);
EXEC #mk_order 'RES-F2-11', 'ls4.khach@queenkho.local', 1, 2, 1, @d, NULL, @d;
EXEC #mk_contract 'RES-F2-11', 'HD-F2-11', 'KV-TB-D208', 'ACTIVE';
SET @d = DATEADD(DAY, 5, @today);
EXEC #mk_order 'RES-F2-12', 'khanh.khach@queenkho.local', 1, 2, 1, @d;
EXEC #mk_contract 'RES-F2-12', 'HD-F2-12', 'KV-TB-D208', 'PENDING_CHECK_IN';

-- F2-X10: Kịch bản giảng viên phần 2 — khách B đang thuê trong khoảng trống của khách A, ô hỏng → chuyển B, ô bảo trì, hệ thống báo phải đổi ô cho A
SET @d = DATEADD(DAY, -5, @today);
EXEC #mk_order 'RES-F2-13', 'tam.khach@queenkho.local', 1, 2, 1, @d, NULL, @d;
EXEC #mk_contract 'RES-F2-13', 'HD-F2-13', 'KV-TB-D209', 'ACTIVE';
SET @d = DATEADD(DAY, 60, @today);
EXEC #mk_order 'RES-F2-14', 'khanh.khach@queenkho.local', 1, 2, 12, @d;
EXEC #mk_contract 'RES-F2-14', 'HD-F2-14', 'KV-TB-D209', 'PENDING_CHECK_IN';
GO

-- ------------------------------------------------------------
-- 7. FLOW 3 — Kho đang thuê, trả kho, nghiệm thu, hoàn tiền
-- ------------------------------------------------------------
DECLARE @today DATE = CAST(SYSDATETIME() AS DATE);
DECLARE @now DATETIME2 = SYSDATETIME();
DECLARE @d DATE, @e DATE;
DECLARE @staff1 NVARCHAR(100) = 'stafftanbinh1@gmail.com';
DECLARE @st1 INT = (SELECT id FROM users WHERE email = @staff1);

-- Ca chính: gói 3 tháng, đang ở tháng cuối → chỉ hoàn cọc, không phí phá HĐ (PR-O2a). RFID này còn dùng cho ca trùng RFID ở Flow 2.
SET @e = DATEADD(DAY, 10, @today); SET @d = DATEADD(MONTH, -3, @e);
EXEC #mk_order 'RES-F3-01', 'cuong.khach@queenkho.local', 1, 2, 3, @d, NULL, @d;
EXEC #mk_contract 'RES-F3-01', 'HD-F3-01', 'KV-TB-D210', 'ACTIVE', NULL, NULL, 'OPEN', NULL, 'RFID-DEMO-F3-01', '135001';

-- F3-X1: trả sớm gói 6 tháng → hoàn tiền thuê theo công thức PR-O2
SET @d = DATEADD(DAY, -40, @today);
EXEC #mk_order 'RES-F3-02', 'dung.khach@queenkho.local', 1, 2, 6, @d, NULL, @d;
EXEC #mk_contract 'RES-F3-02', 'HD-F3-02', 'KV-TB-D211', 'ACTIVE';

-- F3-X2: đã hẹn trả sau 5 ngày → dời muộn hơn bị chặn, dời sớm được, huỷ yêu cầu về ACTIVE (PR-O1, PR-O4)
SET @d = DATEADD(DAY, -30, @today);
EXEC #mk_order 'RES-F3-03', 'dung.khach@queenkho.local', 1, 2, 3, @d, NULL, @d;
EXEC #mk_contract 'RES-F3-03', 'HD-F3-03', 'KV-TB-D212', 'TERMINATION_PENDING';
SET @d = DATEADD(DAY, 5, @today);
EXEC #mk_checkout 'HD-F3-03', @d, 'OPEN', NULL, 1;

-- F3-X3 / X4 / X5: hẹn trả hôm nay, Staff 1 đang giữ task → nhập sự cố: trong cọc / vượt cọc / lỗi cơ sở
SET @e = DATEADD(DAY, 7, @today); SET @d = DATEADD(MONTH, -3, @e);
EXEC #mk_order 'RES-F3-04', 'minh.khach@queenkho.local', 1, 2, 3, @d, NULL, @d;
EXEC #mk_contract 'RES-F3-04', 'HD-F3-04', 'KV-TB-D213', 'TERMINATION_PENDING';
EXEC #mk_checkout 'HD-F3-04', @today, 'IN_PROGRESS', @staff1, 1;
EXEC #mk_order 'RES-F3-05', 'minh.khach@queenkho.local', 1, 2, 3, @d, NULL, @d;
EXEC #mk_contract 'RES-F3-05', 'HD-F3-05', 'KV-TB-D214', 'TERMINATION_PENDING';
EXEC #mk_checkout 'HD-F3-05', @today, 'IN_PROGRESS', @staff1, 0;
EXEC #mk_order 'RES-F3-06', 'minh.khach@queenkho.local', 1, 2, 3, @d, NULL, @d;
EXEC #mk_contract 'RES-F3-06', 'HD-F3-06', 'KV-TB-D215', 'TERMINATION_PENDING';
EXEC #mk_checkout 'HD-F3-06', @today, 'IN_PROGRESS', @staff1, 1;

-- F3-X6: ô đang bảo trì sau trả kho có sự cố → Staff "Sửa xong", ô mở bán lại (PR-O10)
SET @d = DATEADD(MONTH, -2, @today);
EXEC #mk_order 'RES-F3-07', 'ls5.khach@queenkho.local', 1, 2, 1, @d, NULL, @d;
SET @e = DATEADD(DAY, -2, @today);
EXEC #mk_contract 'RES-F3-07', 'HD-F3-07', 'KV-TB-D216', 'TERMINATED', @e, 0;
UPDATE storage_units SET status = 'MAINTENANCE', maintenance_note = N'Khắc phục sự cố sau trả kho HĐ HD-F3-07: bản lề cửa cong', maintenance_since = DATEADD(DAY, -2, @now) WHERE id = 'KV-TB-D216';
INSERT INTO facility_tasks (facility_id, task_type, contract_id, status, staff_id, due_at, maintenance_reason, note, created_at, claimed_at)
SELECT 1, 'MAINTENANCE', id, 'IN_PROGRESS', @st1, DATEADD(HOUR, 21, CAST(DATEADD(DAY, 1, @today) AS DATETIME2)), 'DAMAGE',
       N'Khắc phục sự cố sau trả kho ô KV-TB-D216 (HĐ HD-F3-07): bản lề cửa cong', DATEADD(DAY, -2, @now), DATEADD(DAY, -1, @now)
FROM rental_contracts WHERE contract_code = 'HD-F3-07';
DECLARE @maint INT = SCOPE_IDENTITY();
INSERT INTO damage_cases (contract_id, task_id, title, description, estimated_cost, liable_party, evidence_image_urls, created_at)
SELECT c.id, t.id, N'Bản lề cửa cong', N'Khách kéo hàng va vào cửa', 400000, 'CUSTOMER', 'http://localhost:5173/demo/hien-trang-o-kho.svg', DATEADD(DAY, -2, @now)
FROM rental_contracts c JOIN facility_tasks t ON t.contract_id = c.id AND t.task_type = 'CHECK_IN' WHERE c.contract_code = 'HD-F3-07';

-- F3-X7: chuyển ô khi đang thuê (BR-122) — Mini M
SET @d = DATEADD(DAY, -15, @today);
EXEC #mk_order 'RES-F3-08', 'cuong.khach@queenkho.local', 1, 1, 3, @d, NULL, @d;
EXEC #mk_contract 'RES-F3-08', 'HD-F3-08', 'KV-TB-E202', 'ACTIVE';
GO

-- ------------------------------------------------------------
-- 8. FLOW 5 — ô Kho Đông vừa đủ suất: khoá bảo trì bị chặn (PR-M10)
-- ------------------------------------------------------------
DECLARE @today DATE = CAST(SYSDATETIME() AS DATE);
DECLARE @d DATE = DATEADD(DAY, -30, @today);
EXEC #mk_order 'RES-F5-01', 'ls3.khach@queenkho.local', 1, 8, 6, @d, NULL, @d, 'BASIC', 'v4', 'FOOD';
EXEC #mk_contract 'RES-F5-01', 'HD-F5-01', 'KV-TB-L103', 'ACTIVE';
SET @d = DATEADD(DAY, 5, @today);
EXEC #mk_order 'RES-F5-02', 'tam.khach@queenkho.local', 1, 8, 1, @d, NULL, NULL, 'BASIC', 'v4', 'FOOD';   -- giữ suất L105 (chưa gán ô)
GO

-- ------------------------------------------------------------
-- 9. FLOW 6 — Gia hạn, quá hạn, thanh lý, kho tổng
-- ------------------------------------------------------------
DECLARE @today DATE = CAST(SYSDATETIME() AS DATE);
DECLARE @now DATETIME2 = SYSDATETIME();
DECLARE @d DATE, @e DATE;
DECLARE @fm INT = (SELECT id FROM users WHERE email = 'fmtanbinh@gmail.com');
DECLARE @st1 INT = (SELECT id FROM users WHERE email = 'stafftanbinh1@gmail.com');

-- Ca chính: còn 10 ngày → gia hạn ưu tiên (PR-R10)
SET @e = DATEADD(DAY, 10, @today); SET @d = DATEADD(MONTH, -1, @e);
EXEC #mk_order 'RES-F6-01', 'nga.khach@queenkho.local', 1, 1, 1, @d, NULL, @d;
EXEC #mk_contract 'RES-F6-01', 'HD-F6-01', 'KV-TB-E204', 'ACTIVE';

-- F6-X1: còn 2 ngày → cửa sổ muộn, chưa ai cần ô nên vẫn gia hạn được
SET @e = DATEADD(DAY, 2, @today); SET @d = DATEADD(MONTH, -1, @e);
EXEC #mk_order 'RES-F6-02', 'nga.khach@queenkho.local', 1, 1, 1, @d, NULL, @d;
EXEC #mk_contract 'RES-F6-02', 'HD-F6-02', 'KV-TB-E205', 'ACTIVE';

-- F6-X2: Kho Lớn — B203 hẹn trả sau 3 ngày, B204 đang thuê; đơn mới đã cọc nhận sau 4 ngày → khách cũ đổi ý gia hạn bị chặn (RENEWAL_UNIT_RESERVED)
SET @d = DATEADD(DAY, -20, @today);
EXEC #mk_order 'RES-F6-03', 'nga.khach@queenkho.local', 1, 4, 1, @d, NULL, @d;
EXEC #mk_contract 'RES-F6-03', 'HD-F6-03', 'KV-TB-B203', 'TERMINATION_PENDING';
SET @d = DATEADD(DAY, 3, @today);
EXEC #mk_checkout 'HD-F6-03', @d, 'OPEN', NULL, 1;
SET @d = DATEADD(DAY, -60, @today);
EXEC #mk_order 'RES-F6-04', 'ls2.khach@queenkho.local', 1, 4, 12, @d, NULL, @d;
EXEC #mk_contract 'RES-F6-04', 'HD-F6-04', 'KV-TB-B204', 'ACTIVE';
SET @d = DATEADD(DAY, 4, @today);
EXEC #mk_order 'RES-F6-05', 'tam.khach@queenkho.local', 1, 4, 1, @d;       -- cũng là ca "hết ô, chỉ có ô sắp trống" khi FM gán ô (F2-X11)

-- F6-X3: điều khoản v3, quá hạn 3 ngày → khoá PIN, phí trễ + phí chiếm dụng, FM miễn phí trễ, gia hạn trả hết (PR-Q3, Q5, Q6, Q14)
SET @e = DATEADD(DAY, -3, @today); SET @d = DATEADD(MONTH, -1, @e);
EXEC #mk_order 'RES-F6-06', 'giang.khach@queenkho.local', 1, 2, 1, @d, NULL, @d, 'BASIC', 'v3';
EXEC #mk_contract 'RES-F6-06', 'HD-F6-06', 'KV-TB-A104', 'OVERDUE';

-- F6-X4: điều khoản v3, quá hạn 16 ngày, mới 2 lần liên hệ → thanh lý bị chặn tới khi đủ 3 lần (PR-Q8, PR-Q10)
SET @e = DATEADD(DAY, -16, @today); SET @d = DATEADD(MONTH, -1, @e);
EXEC #mk_order 'RES-F6-07', 'son.khach@queenkho.local', 1, 2, 1, @d, NULL, @d, 'BASIC', 'v3';
EXEC #mk_contract 'RES-F6-07', 'HD-F6-07', 'KV-TB-A103', 'OVERDUE';
INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at)
SELECT @fm, CONCAT('[OVERDUE_CONTACT] HĐ HD-F6-07: ', v.n), 'rental_contracts', CAST(c.id AS NVARCHAR(50)), v.t
FROM rental_contracts c CROSS JOIN (VALUES (N'Gọi ngày quá hạn thứ 1, khách không nghe máy', DATEADD(DAY, -15, @now)), (N'Gọi ngày quá hạn thứ 3, thuê bao', DATEADD(DAY, -13, @now))) v(n, t)
WHERE c.contract_code = 'HD-F6-07';

-- F6-X5: điều khoản v4, còn hiệu lực → ⚡ Quá hạn 1 ngày: tự thanh lý, chuyển hàng vào kho tổng (D-15)
SET @e = DATEADD(DAY, 20, @today); SET @d = DATEADD(MONTH, -1, @e);
EXEC #mk_order 'RES-F6-08', 'tam.khach@queenkho.local', 1, 1, 1, @d, NULL, @d;
EXEC #mk_contract 'RES-F6-08', 'HD-F6-08', 'KV-TB-E207', 'ACTIVE';

-- F6-X6: đã thanh lý, hàng ở kho tổng, còn nợ → nhận lại bị chặn tới khi hết nợ + trả phí lưu giữ (PR-Q15, BR-134)
SET @e = DATEADD(DAY, -25, @today); SET @d = DATEADD(MONTH, -1, @e);
EXEC #mk_order 'RES-F6-09', 'giang.khach@queenkho.local', 1, 1, 1, @d, NULL, @d, 'BASIC', 'v4';
EXEC #mk_contract 'RES-F6-09', 'HD-F6-09', 'KV-TB-E208', 'LIQUIDATED', NULL, 0;
INSERT INTO payment_transactions (transaction_code, user_id, contract_id, payment_type, payment_method, amount, status)
SELECT 'MV-DEBT-F6-09', customer_id, id, 'OVERSTAY_FEE', 'VNPAY', 225000, 'PENDING' FROM rental_contracts WHERE contract_code = 'HD-F6-09';
INSERT INTO facility_tasks (facility_id, task_type, contract_id, status, staff_id, due_at, maintenance_reason, note, created_at, claimed_at, completed_at)
SELECT 1, 'MAINTENANCE', id, 'COMPLETED', @st1, DATEADD(DAY, -20, @now), 'LIQUIDATION', N'Dọn ô KV-TB-E208 sau thanh lý HĐ HD-F6-09', DATEADD(DAY, -24, @now), DATEADD(DAY, -24, @now), DATEADD(DAY, -22, @now)
FROM rental_contracts WHERE contract_code = 'HD-F6-09';
DECLARE @clean INT = SCOPE_IDENTITY();
INSERT INTO held_goods (contract_id, facility_id, task_id, inventory_note, evidence_image_urls, witness_note, storage_location, central_warehouse_id, status, hold_until, created_by, created_at)
SELECT id, 1, @clean, N'3 thùng carton quần áo, 1 tủ nhựa', 'http://localhost:5173/demo/hien-trang-o-kho.svg', N'Nhân viên Tân Bình 1 và Nhân viên Tân Bình 2 chứng kiến', N'Kệ B-12',
       (SELECT TOP 1 id FROM central_warehouses WHERE status = 'ACTIVE'), 'HOLDING', DATEADD(DAY, 36, @today), @st1, DATEADD(DAY, -22, @now)
FROM rental_contracts WHERE contract_code = 'HD-F6-09';
GO

-- ------------------------------------------------------------
-- 10. FLOW 7 — Hỗ trợ + bồi thường + cảm biến
-- ------------------------------------------------------------
DECLARE @today DATE = CAST(SYSDATETIME() AS DATE);
DECLARE @now DATETIME2 = SYSDATETIME();
DECLARE @d DATE = DATEADD(DAY, -25, @today);
DECLARE @st1 INT = (SELECT id FROM users WHERE email = 'stafftanbinh1@gmail.com');

-- Ca chính: khách báo lỗi khoá → Staff cấp lại PIN
EXEC #mk_order 'RES-F7-01', 'phuc.khach@queenkho.local', 1, 1, 3, @d, NULL, @d;
EXEC #mk_contract 'RES-F7-01', 'HD-F7-01', 'KV-TB-E209', 'ACTIVE';

-- F7-X1..X3: 2 ticket đang mở (1 quá hạn) + 1 đã xử lý chờ khách xác nhận trên cùng hợp đồng → gửi thêm cùng loại / quá 3 ticket bị chặn
EXEC #mk_order 'RES-F7-02', 'phuc.khach@queenkho.local', 1, 1, 3, @d, NULL, @d;
EXEC #mk_contract 'RES-F7-02', 'HD-F7-02', 'KV-TB-E210', 'ACTIVE';
DECLARE @past DATETIME2 = DATEADD(HOUR, 21, CAST(DATEADD(DAY, -1, @today) AS DATETIME2));
EXEC #mk_ticket 'SR-F7-01', 'HD-F7-02', 'CLEANING', N'Hành lang trước ô có nhiều bụi, nhờ vệ sinh giúp', 'OPEN', 'OPEN';
EXEC #mk_ticket 'SR-F7-02', 'HD-F7-02', 'FACILITY_DAMAGE', N'Đèn hành lang khu E bị hỏng, tối không thấy đường', 'IN_PROGRESS', 'OVERDUE', 'stafftanbinh2@gmail.com', @past;
EXEC #mk_ticket 'SR-F7-03', 'HD-F7-02', 'OTHER', N'Cửa cuốn kêu to khi kéo lên, nhờ kiểm tra', 'RESOLVED', 'COMPLETED', 'stafftanbinh1@gmail.com', NULL, N'Đã tra dầu ray cửa cuốn, cửa kéo êm.';

-- F7-X4: hàng hư do cơ sở, gói Nâng cao, Staff đã kiểm tra xong → FM chốt, chi trả, đòi bảo hiểm (BR-127, BR-128). Kho Lạnh L101: cảm biến BR-129.
EXEC #mk_order 'RES-F7-03', 'quynh.khach@queenkho.local', 1, 7, 3, @d, NULL, @d, 'ADVANCED', 'v4', 'FOOD', 30000000;
EXEC #mk_contract 'RES-F7-03', 'HD-F7-03', 'KV-TB-L101', 'ACTIVE';
EXEC #mk_ticket 'SR-F7-04', 'HD-F7-03', 'GOODS_DAMAGE', N'Thùng thực phẩm trong kho bị hỏng do máy lạnh ngừng chạy đêm qua', 'IN_PROGRESS', 'IN_PROGRESS', 'stafftanbinh1@gmail.com';
INSERT INTO compensation_claims (claim_code, support_request_id, contract_id, customer_id, facility_id, claim_type, incident_date, items_description, claimed_amount, customer_images, status,
                                 inspected_by, inspected_at, inspection_note, inspection_images, preliminary_cause, created_at)
SELECT 'BT-F7-04', s.id, s.contract_id, s.customer_id, 1, 'GOODS_DAMAGE', DATEADD(DAY, -1, @today), N'20 thùng hải sản đông lạnh, giá trị 12.000.000đ', 12000000,
       'http://localhost:5173/demo/hien-trang-o-kho.svg', 'INSPECTED', @st1, DATEADD(HOUR, -2, @now),
       N'Máy nén ngừng chạy từ 2h sáng, nhiệt độ ô lên 14°C, hàng rã đông toàn bộ', 'http://localhost:5173/demo/hien-trang-o-kho.svg', 'FACILITY', DATEADD(HOUR, -6, @now)
FROM support_requests s WHERE s.ticket_code = 'SR-F7-04';

-- F7-X5: hàng hư, Staff chưa kiểm tra → Staff lập biên bản → FM kết luận lỗi khách, từ chối (BR-126, BR-127)
EXEC #mk_order 'RES-F7-04', 'quynh.khach@queenkho.local', 1, 2, 3, @d, NULL, @d;
EXEC #mk_contract 'RES-F7-04', 'HD-F7-04', 'KV-TB-A102', 'ACTIVE';
EXEC #mk_ticket 'SR-F7-05', 'HD-F7-04', 'GOODS_DAMAGE', N'Tủ gỗ trong kho bị nứt mặt, nghi do ẩm', 'OPEN', 'OPEN';
INSERT INTO compensation_claims (claim_code, support_request_id, contract_id, customer_id, facility_id, claim_type, incident_date, items_description, claimed_amount, customer_images, status, created_at)
SELECT 'BT-F7-05', s.id, s.contract_id, s.customer_id, 1, 'GOODS_DAMAGE', @today, N'1 tủ gỗ, giá trị 3.000.000đ', 3000000, 'http://localhost:5173/demo/hien-trang-o-kho.svg', 'SUBMITTED', DATEADD(HOUR, -6, @now)
FROM support_requests s WHERE s.ticket_code = 'SR-F7-05';

-- F7-X6: lỗi cơ sở, khách muốn chấm dứt → hướng TERMINATE: trả kho không phí phá HĐ, hoàn tiền thuê theo ngày (BR-127)
EXEC #mk_order 'RES-F7-05', 'quynh.khach@queenkho.local', 1, 2, 6, @d, NULL, @d;
EXEC #mk_contract 'RES-F7-05', 'HD-F7-05', 'KV-TB-A101', 'ACTIVE';
EXEC #mk_ticket 'SR-F7-06', 'HD-F7-05', 'GOODS_LOSS', N'Mất 2 thùng hồ sơ trong kho, khoá không có dấu hiệu bị phá', 'IN_PROGRESS', 'IN_PROGRESS', 'stafftanbinh1@gmail.com';
INSERT INTO compensation_claims (claim_code, support_request_id, contract_id, customer_id, facility_id, claim_type, incident_date, items_description, claimed_amount, status,
                                 inspected_by, inspected_at, inspection_note, inspection_images, preliminary_cause, created_at)
SELECT 'BT-F7-06', s.id, s.contract_id, s.customer_id, 1, 'GOODS_LOSS', DATEADD(DAY, -2, @today), N'2 thùng hồ sơ, giá trị 4.000.000đ', 4000000, 'INSPECTED', @st1, DATEADD(HOUR, -2, @now),
       N'Camera hành lang cho thấy nhân viên vệ sinh mở nhầm ô', 'http://localhost:5173/demo/hien-trang-o-kho.svg', 'FACILITY', DATEADD(HOUR, -6, @now)
FROM support_requests s WHERE s.ticket_code = 'SR-F7-06';

-- F7-X7: hợp đồng quá hạn thì không cấp lại PIN (PR-S6) — dùng HD-F6-06, chỉ cần ticket
EXEC #mk_ticket 'SR-F7-07', 'HD-F6-06', 'LOCK_ISSUE', N'Không mở được khoá bằng mã PIN', 'IN_PROGRESS', 'IN_PROGRESS', 'stafftanbinh1@gmail.com';
GO

-- ------------------------------------------------------------
-- 11. FLOW 4 — Lịch sử doanh thu 12 tháng cho báo cáo BOM / FM (đã kết thúc + đang thuê ở cơ sở khác)
-- ------------------------------------------------------------
DECLARE @today DATE = CAST(SYSDATETIME() AS DATE);
DECLARE @hist TABLE (n INT IDENTITY(1,1), fac INT, typ INT, months INT, ago INT, renew_months INT, late DECIMAL(12,2), damage DECIMAL(12,2), cust NVARCHAR(100));
INSERT INTO @hist (fac, typ, months, ago, renew_months, late, damage, cust) VALUES
 (1,2, 3, 12, 3,      0,       0, 'ls1.khach@queenkho.local'), (1,1, 1, 11, NULL,   0,       0, 'ls2.khach@queenkho.local'),
 (1,3, 6, 11, NULL,   0,  500000, 'ls3.khach@queenkho.local'), (1,4, 3, 10, 3,      0,       0, 'ls4.khach@queenkho.local'),
 (1,2, 1,  9, NULL, 185000,    0, 'ls5.khach@queenkho.local'), (1,6, 3,  8, NULL,   0,       0, 'ls6.khach@queenkho.local'),
 (1,7, 3,  7, 3,      0,       0, 'ls1.khach@queenkho.local'), (1,2, 3,  6, NULL,   0,  300000, 'ls2.khach@queenkho.local'),
 (1,1, 3,  5, NULL,   0,       0, 'ls3.khach@queenkho.local'), (1,5, 1,  4, NULL,   0,       0, 'ls4.khach@queenkho.local'),
 (2,2, 6, 12, NULL,   0,       0, 'ls5.khach@queenkho.local'), (2,1, 3, 11, 3,      0,       0, 'ls6.khach@queenkho.local'),
 (2,3, 3,  9, NULL,   0,  700000, 'ls1.khach@queenkho.local'), (2,4, 1,  8, NULL, 225000,    0, 'ls2.khach@queenkho.local'),
 (2,2, 3,  6, NULL,   0,       0, 'ls3.khach@queenkho.local'), (2,6, 3,  5, NULL,   0,       0, 'ls4.khach@queenkho.local'),
 (3,2, 3, 10, NULL,   0,       0, 'ls5.khach@queenkho.local'), (3,1, 6,  9, NULL,   0,       0, 'ls6.khach@queenkho.local'),
 (3,3, 1,  7, NULL,   0,       0, 'ls1.khach@queenkho.local'), (3,2, 3,  5, 3,      0,       0, 'ls2.khach@queenkho.local'),
 (4,1, 3,  8, NULL,   0,       0, 'ls3.khach@queenkho.local'), (4,2, 1,  6, NULL,   0,  200000, 'ls4.khach@queenkho.local'),
 (4,4, 3,  5, NULL,   0,       0, 'ls5.khach@queenkho.local');
DECLARE @n INT = 1, @max INT = (SELECT MAX(n) FROM @hist);
DECLARE @fac INT, @typ INT, @months INT, @ago INT, @renew INT, @late DECIMAL(12,2), @damage DECIMAL(12,2), @cust NVARCHAR(100);
DECLARE @code NVARCHAR(50), @ccode NVARCHAR(50), @unit NVARCHAR(20), @start DATE, @end DATE, @paid DATETIME2, @cid INT, @uid INT, @dep DECIMAL(12,2), @base DECIMAL(12,2), @refund DECIMAL(12,2);
WHILE @n <= @max
BEGIN
    SELECT @fac = fac, @typ = typ, @months = months, @ago = ago, @renew = renew_months, @late = late, @damage = damage, @cust = cust FROM @hist WHERE n = @n;
    SET @code = CONCAT('RES-LS-', RIGHT(CONCAT('0', @n), 2));
    SET @ccode = CONCAT('HD-LS-', RIGHT(CONCAT('0', @n), 2));
    SET @start = DATEADD(DAY, -(@n % 20), DATEADD(MONTH, -@ago, @today));
    SET @end = DATEADD(MONTH, @months + COALESCE(@renew, 0), @start);
    IF @end >= @today SET @end = DATEADD(DAY, -3, @today);
    SET @paid = DATEADD(HOUR, 10, CAST(@start AS DATETIME2));
    SET @unit = (SELECT TOP 1 id FROM storage_units WHERE facility_id = @fac AND unit_type_id = @typ ORDER BY id DESC);
    EXEC #mk_order @code, @cust, @fac, @typ, @months, @start, NULL, @paid;
    EXEC #mk_contract @code, @ccode, @unit, 'TERMINATED', @end, 0;
    SELECT @cid = id, @uid = customer_id FROM rental_contracts WHERE contract_code = @ccode;
    SET @dep = (SELECT deposit_amount FROM reservations WHERE reservation_code = @code);
    SET @base = (SELECT base_price_monthly FROM unit_types WHERE id = @typ);
    IF @renew IS NOT NULL
        INSERT INTO payment_transactions (transaction_code, user_id, contract_id, payment_type, payment_method, amount, renewal_months, status, paid_at, bank_transaction_code)
        VALUES (CONCAT('RN-LS-', @n), @uid, @cid, 'MONTHLY_RENT', 'VNPAY', @base * @renew, @renew, 'SUCCESS', DATEADD(MONTH, @months, @paid), CONCAT('NCB7', RIGHT(CONCAT('0000000', @n * 991), 7)));
    IF @late > 0
        INSERT INTO payment_transactions (transaction_code, user_id, contract_id, payment_type, payment_method, amount, status, paid_at)
        VALUES (CONCAT('LF-LS-', @n), @uid, @cid, 'LATE_FEE', 'DEPOSIT_OFFSET', @late, 'SUCCESS', DATEADD(HOUR, 20, CAST(@end AS DATETIME2)));
    IF @damage > 0
        INSERT INTO payment_transactions (transaction_code, user_id, contract_id, payment_type, payment_method, amount, status, paid_at)
        VALUES (CONCAT('DM-LS-', @n), @uid, @cid, 'DAMAGE_FEE', 'DEPOSIT_OFFSET', @damage, 'SUCCESS', DATEADD(HOUR, 20, CAST(@end AS DATETIME2)));
    SET @refund = @dep - @late - @damage;
    IF @refund > 0
        INSERT INTO payment_transactions (transaction_code, user_id, contract_id, payment_type, payment_method, amount, status, paid_at, bank_transaction_code)
        VALUES (CONCAT('REF-LS-', @n), @uid, @cid, 'REFUND', CASE WHEN @n % 3 = 0 THEN 'CASH' ELSE 'BANK_TRANSFER' END, @refund, 'SUCCESS', DATEADD(DAY, 1, CAST(@end AS DATETIME2)),
                CASE WHEN @n % 3 = 0 THEN CONCAT('CASH-', @n) ELSE CONCAT('FT2600', RIGHT(CONCAT('00000', @n * 77), 5)) END);
    SET @n += 1;
END

-- Hợp đồng đang thuê ở cơ sở khác: cho tỉ lệ lấp đầy, cọc đang giữ, và 2 hợp đồng quá hạn toàn chuỗi cho BOM (BR-130)
DECLARE @a TABLE (n INT IDENTITY(1,1), fac INT, typ INT, months INT, ago_days INT, cust NVARCHAR(100), stat NVARCHAR(20), terms NVARCHAR(10));
INSERT INTO @a (fac, typ, months, ago_days, cust, stat, terms) VALUES
 (2,2, 6,  40, 'ls1.khach@queenkho.local', 'ACTIVE', 'v4'), (2,1, 3,  20, 'ls2.khach@queenkho.local', 'ACTIVE', 'v4'),
 (2,3, 12, 90, 'ls3.khach@queenkho.local', 'ACTIVE', 'v4'), (3,2, 3,  30, 'ls4.khach@queenkho.local', 'ACTIVE', 'v4'),
 (3,1, 6,  70, 'ls5.khach@queenkho.local', 'ACTIVE', 'v4'), (4,2, 12, 120,'ls6.khach@queenkho.local', 'ACTIVE', 'v4'),
 (4,1, 1,  35, 'ls1.khach@queenkho.local', 'OVERDUE', 'v3'), (2,4, 1,  36, 'ls2.khach@queenkho.local', 'OVERDUE', 'v3');
SET @n = 1;
DECLARE @stat NVARCHAR(20), @terms NVARCHAR(10), @ago_days INT;
WHILE @n <= 8
BEGIN
    SELECT @fac = fac, @typ = typ, @months = months, @ago_days = ago_days, @cust = cust, @stat = stat, @terms = terms FROM @a WHERE n = @n;
    SET @code = CONCAT('RES-CS-', @n); SET @ccode = CONCAT('HD-CS-', @n);
    SET @start = DATEADD(DAY, -@ago_days, @today);
    SET @paid = DATEADD(HOUR, 10, CAST(@start AS DATETIME2));
    SET @unit = (SELECT TOP 1 id FROM storage_units su WHERE facility_id = @fac AND unit_type_id = @typ
                 AND NOT EXISTS (SELECT 1 FROM rental_contracts c WHERE c.storage_unit_id = su.id AND c.status IN ('ACTIVE', 'OVERDUE')) ORDER BY id);
    EXEC #mk_order @code, @cust, @fac, @typ, @months, @start, NULL, @paid, 'BASIC', @terms;
    EXEC #mk_contract @code, @ccode, @unit, @stat;
    SET @n += 1;
END
GO

-- ------------------------------------------------------------
-- 12. Trạng thái ô theo lịch (cùng logic UnitScheduleService.syncUnitStatuses) + kiểm tra
-- ------------------------------------------------------------
DECLARE @today DATE = CAST(SYSDATETIME() AS DATE);
UPDATE su SET su.status = 'OCCUPIED' FROM storage_units su
WHERE su.status = 'AVAILABLE' AND EXISTS (SELECT 1 FROM rental_contracts c WHERE c.storage_unit_id = su.id
    AND (c.status IN ('ACTIVE', 'TERMINATION_PENDING', 'OVERDUE') OR (c.status = 'PENDING_CHECK_IN' AND c.start_date <= @today)));

PRINT N'=== Đã nạp dữ liệu demo ===';
SELECT status, COUNT(*) AS so_don FROM reservations GROUP BY status ORDER BY status;
SELECT status, COUNT(*) AS so_hop_dong FROM rental_contracts GROUP BY status ORDER BY status;
SELECT task_type, status, COUNT(*) AS so_task FROM facility_tasks WHERE facility_id = 1 GROUP BY task_type, status ORDER BY task_type, status;
SELECT status, COUNT(*) AS so_o_tan_binh FROM storage_units WHERE facility_id = 1 GROUP BY status ORDER BY status;
GO
SET NOEXEC OFF;
GO

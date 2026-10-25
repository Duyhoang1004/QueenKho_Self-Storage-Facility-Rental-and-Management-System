USE QueenKhoDB;
GO

/* =====================================================================================
   QUEENKHO - SCRIPT MIGRATION & CẬP NHẬT DATABASE TỔNG HỢP (ALL-IN-ONE)
   Áp dụng cho các tính năng:
   - UC-03 & UC-08: Quản trị vai trò & Tài khoản người dùng (Admin, BOM, System)
   - UC-04 & UC-06: Mã cơ sở kho (facilities.code) & Quản lý ô khoang
   - UC-18, 23, 24, 25: Bàn giao, Nghiệm thu trả kho, Sự cố hư hại & Hoàn tiền cọc
   - UC-28, 29, 30: Hợp đồng quá hạn, Dashboard vận hành & Doanh thu BOM

   Đặc tính script:
   - Tuân thủ 100% mô hình IF / ELSE / IF NOT EXISTS (Idempotent - chạy nhiều lần an toàn)
   - KHÔNG drop bảng, KHÔNG truncate, giữ nguyên 100% dữ liệu đang có
   - Tự động bổ sung cột, ràng buộc, chỉ mục và tài khoản mẫu nếu chưa có
   ===================================================================================== */

PRINT N'======================================================================';
PRINT N'==> BẮT ĐẦU CHẠY SCRIPT MIGRATION TỔNG HỢP CHO QUEENKHO DATABASE...';
PRINT N'======================================================================';
GO

-- =====================================================================
-- 1. BẢNG roles: BỔ SUNG CÁC VAI TRÒ HỆ THỐNG CÒN THIẾU
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'ADMIN')
    INSERT INTO roles (name, description) VALUES ('ADMIN', N'Quản trị viên toàn hệ thống');

IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'BOM')
    INSERT INTO roles (name, description) VALUES ('BOM', N'Ban giám đốc / Quản lý vận hành cấp cao');

IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'FACILITY_MANAGER')
    INSERT INTO roles (name, description) VALUES ('FACILITY_MANAGER', N'Quản lý cơ sở kho bãi');

IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'STAFF')
    INSERT INTO roles (name, description) VALUES ('STAFF', N'Nhân viên vận hành cơ sở');

IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'CUSTOMER')
    INSERT INTO roles (name, description) VALUES ('CUSTOMER', N'Khách hàng thuê kho');

PRINT N'==> [1/10] Đã kiểm tra & đồng bộ bảng roles.';
GO

-- =====================================================================
-- 2. BẢNG facilities: BỔ SUNG CỘT code (UC-04, PR-M1)
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('facilities') AND name = 'code')
BEGIN
    ALTER TABLE facilities ADD code NVARCHAR(4) NULL;
    PRINT N'   [+] Đã thêm cột code vào bảng facilities.';
END
GO

-- Điền mã code mặc định cho các cơ sở hiện tại nếu code đang NULL hoặc rỗng
UPDATE facilities SET code = 'TB' WHERE (code IS NULL OR code = '') AND (name LIKE N'%Tân Bình%' OR id = 1);
UPDATE facilities SET code = 'BT' WHERE (code IS NULL OR code = '') AND (name LIKE N'%Bình Thạnh%' OR id = 2);
UPDATE facilities SET code = 'TD' WHERE (code IS NULL OR code = '') AND (name LIKE N'%Thủ Đức%' OR id = 3);
UPDATE facilities SET code = 'GV' WHERE (code IS NULL OR code = '') AND (name LIKE N'%Gò Vấp%' OR id = 4);
UPDATE facilities SET code = 'CG' WHERE (code IS NULL OR code = '') AND (name LIKE N'%Cầu Giấy%' OR id = 5);
UPDATE facilities SET code = 'Q7' WHERE (code IS NULL OR code = '') AND (name LIKE N'%Quận 7%' OR id = 6);

-- Fallback cho các cơ sở khác (nếu có thêm)
UPDATE facilities 
SET code = 'F' + RIGHT('00' + CAST(id AS NVARCHAR(3)), 3)
WHERE code IS NULL OR code = '';

-- Chuyển cột code sang NOT NULL nếu đang NULL
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('facilities') AND name = 'code' AND is_nullable = 1)
BEGIN
    ALTER TABLE facilities ALTER COLUMN code NVARCHAR(4) NOT NULL;
    PRINT N'   [+] Đã cập nhật facilities.code sang NOT NULL.';
END
GO

-- Ràng buộc UNIQUE cho facilities.code
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('facilities') AND name = 'UQ_facilities_code')
BEGIN
    ALTER TABLE facilities ADD CONSTRAINT UQ_facilities_code UNIQUE (code);
    PRINT N'   [+] Đã tạo ràng buộc UNIQUE (UQ_facilities_code).';
END

PRINT N'==> [2/10] Đã kiểm tra & đồng bộ cột code bảng facilities.';
GO

-- =====================================================================
-- 3. BẢNG users: BỔ SUNG CỘT created_at (UC-08)
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'created_at')
BEGIN
    ALTER TABLE users ADD created_at DATETIME2 NOT NULL CONSTRAINT DF_users_created_at DEFAULT SYSDATETIME();
    PRINT N'   [+] Đã thêm cột created_at vào bảng users.';
END

PRINT N'==> [3/10] Đã kiểm tra cấu trúc bảng users.';
GO

-- =====================================================================
-- 4. BỔ SUNG CÁC TÀI KHOẢN MẪU HỆ THỐNG (BOM, ADMIN, SYSTEM)
--    Mật khẩu mặc định: 123456 (BCrypt hash)
-- =====================================================================
DECLARE @pw NVARCHAR(255) = '$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu'; -- 123456
DECLARE @adminRole INT = (SELECT id FROM roles WHERE name = 'ADMIN');
DECLARE @bomRole   INT = (SELECT id FROM roles WHERE name = 'BOM');

-- 4.1. Tài khoản BOM (Business Operations Manager)
IF @bomRole IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'bom@queenkho.com')
BEGIN
    INSERT INTO users (full_name, email, password_hash, phone, role_id, facility_id, status)
    VALUES (N'Business Operations Manager', 'bom@queenkho.com', @pw, '0908889999', @bomRole, NULL, 'ACTIVE');
    PRINT N'   [+] Đã tạo tài khoản BOM: bom@queenkho.com / 123456';
END

-- 4.2. Tài khoản Admin (UC-03, UC-08)
IF @adminRole IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@queenkho.com')
BEGIN
    INSERT INTO users (full_name, email, password_hash, phone, role_id, facility_id, status)
    VALUES (N'Quản trị viên', 'admin@queenkho.com', @pw, '0903000001', @adminRole, NULL, 'ACTIVE');
    PRINT N'   [+] Đã tạo tài khoản Admin: admin@queenkho.com / 123456';
END

IF @adminRole IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin2@queenkho.com')
BEGIN
    INSERT INTO users (full_name, email, password_hash, phone, role_id, facility_id, status)
    VALUES (N'Quản trị viên 2', 'admin2@queenkho.com', @pw, '0903000002', @adminRole, NULL, 'ACTIVE');
    PRINT N'   [+] Đã tạo tài khoản Admin 2: admin2@queenkho.com / 123456';
END

-- 4.3. Tài khoản SYSTEM (PR-A8, Scheduler background jobs, không cho đăng nhập)
-- UC-31: chỉ dùng DUY NHẤT system@queenkho.local (= ActivityLogService.SYSTEM_EMAIL).
-- Tài khoản cũ system@queenkho.com được gộp vào ở mục 9.
IF @adminRole IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'system@queenkho.local')
BEGIN
    INSERT INTO users (full_name, email, password_hash, phone, role_id, facility_id, status)
    VALUES (N'Hệ thống', 'system@queenkho.local', 'NO_LOGIN', '0000000000', @adminRole, NULL, 'DISABLED');
    PRINT N'   [+] Đã tạo tài khoản job: system@queenkho.local (DISABLED)';
END

PRINT N'==> [4/10] Đã kiểm tra & tạo tài khoản quản trị hệ thống.';
GO

-- =====================================================================
-- 5. BẢNG handover_records: BỔ SUNG CỘT record_type (UC-18, UC-23)
-- =====================================================================
IF OBJECT_ID('handover_records', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('handover_records') AND name = 'record_type')
    BEGIN
        ALTER TABLE handover_records ADD record_type NVARCHAR(30) NOT NULL CONSTRAINT DF_handover_record_type DEFAULT 'CHECK_IN';
        PRINT N'   [+] Đã thêm cột record_type vào bảng handover_records.';
    END
END

PRINT N'==> [5/10] Đã kiểm tra bảng handover_records.';
GO

-- =====================================================================
-- 6. BẢNG rental_contracts: KIỂM TRA CỘT BẢO VỆ CHU KỲ & TIỀN CỌC
-- =====================================================================
IF OBJECT_ID('rental_contracts', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('rental_contracts') AND name = 'billing_cycle_months')
    BEGIN
        ALTER TABLE rental_contracts ADD billing_cycle_months INT NOT NULL CONSTRAINT DF_contracts_cycle DEFAULT 1;
        PRINT N'   [+] Đã thêm cột billing_cycle_months vào rental_contracts.';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('rental_contracts') AND name = 'deposit_held_amount')
    BEGIN
        ALTER TABLE rental_contracts ADD deposit_held_amount DECIMAL(12,2) NOT NULL CONSTRAINT DF_contracts_deposit DEFAULT 0;
        PRINT N'   [+] Đã thêm cột deposit_held_amount vào rental_contracts.';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('rental_contracts') AND name = 'access_pin_code')
    BEGIN
        ALTER TABLE rental_contracts ADD access_pin_code NVARCHAR(20) NULL;
        PRINT N'   [+] Đã thêm cột access_pin_code vào rental_contracts.';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('rental_contracts') AND name = 'rfid_card_code')
    BEGIN
        ALTER TABLE rental_contracts ADD rfid_card_code NVARCHAR(50) NULL;
        PRINT N'   [+] Đã thêm cột rfid_card_code vào rental_contracts.';
    END
END

PRINT N'==> [6/10] Đã kiểm tra các cột trong bảng rental_contracts.';
GO

-- =====================================================================
-- 7. BẢNG facility_tasks: ĐỒNG BỘ TÊN VÀ CẤU TRÚC (PR #55, UC-16, 25)
-- =====================================================================
-- 7.1. Đổi tên từ staff_tasks sang facility_tasks nếu DB cũ mang tên staff_tasks
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'staff_tasks') 
   AND NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'facility_tasks')
BEGIN
    EXEC sp_rename 'staff_tasks', 'facility_tasks';
    PRINT N'   [+] Đã đổi tên bảng staff_tasks -> facility_tasks.';
END
GO

-- 7.2. Tạo mới bảng facility_tasks nếu chưa có
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'facility_tasks')
BEGIN
    CREATE TABLE facility_tasks (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        facility_id         INT NOT NULL,
        task_type           NVARCHAR(50) NOT NULL,                -- CHECK_IN, CHECK_OUT, SUPPORT, REFUND, MAINTENANCE
        contract_id         INT NULL,                             -- Bắt buộc với CHECK_IN / CHECK_OUT
        support_request_id  INT NULL,                             -- Bắt buộc với SUPPORT
        status              NVARCHAR(30) NOT NULL DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, OVERDUE, COMPLETED, CANCELLED
        staff_id            INT NULL,                             -- ID người phụ trách (Staff hoặc Facility Manager)
        due_at              DATETIME2 NOT NULL,                   -- Deadline hoàn thành
        evidence_image_url  NVARCHAR(1000) NULL,                  -- Ảnh bằng chứng chuyển khoản / nghiệm thu
        note                NVARCHAR(1000) NULL,                  -- Chi tiết STK, thông tin hoàn cọc
        created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        claimed_at          DATETIME2 NULL,
        completed_at        DATETIME2 NULL,
        CONSTRAINT FK_facilitytasks_facility FOREIGN KEY (facility_id)        REFERENCES facilities(id),
        CONSTRAINT FK_facilitytasks_contract FOREIGN KEY (contract_id)        REFERENCES rental_contracts(id),
        CONSTRAINT FK_facilitytasks_support  FOREIGN KEY (support_request_id) REFERENCES support_requests(id),
        CONSTRAINT FK_facilitytasks_user     FOREIGN KEY (staff_id)           REFERENCES users(id),
        CONSTRAINT CK_facilitytasks_type     CHECK (task_type IN ('CHECK_IN', 'CHECK_OUT', 'SUPPORT', 'REFUND', 'MAINTENANCE')),
        CONSTRAINT CK_facilitytasks_status   CHECK (status IN ('OPEN', 'IN_PROGRESS', 'OVERDUE', 'COMPLETED', 'CANCELLED')),
        CONSTRAINT CK_facilitytasks_target   CHECK (
            (task_type IN ('CHECK_IN', 'CHECK_OUT') AND contract_id IS NOT NULL)
            OR (task_type = 'SUPPORT' AND support_request_id IS NOT NULL)
            OR (task_type IN ('REFUND', 'MAINTENANCE'))
        )
    );

    CREATE INDEX IX_facilitytasks_facility_status ON facility_tasks(facility_id, status);
    CREATE INDEX IX_facilitytasks_contract        ON facility_tasks(contract_id);
    CREATE INDEX IX_facilitytasks_staff           ON facility_tasks(staff_id);

    PRINT N'   [+] Đã tạo mới bảng facility_tasks.';
END
ELSE
-- 7.3. Nếu bảng đã có, kiểm tra và bổ sung cột / constraints
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('facility_tasks') AND name = 'evidence_image_url')
    BEGIN
        ALTER TABLE facility_tasks ADD evidence_image_url NVARCHAR(1000) NULL;
        PRINT N'   [+] Đã thêm cột evidence_image_url vào facility_tasks.';
    END

    -- Cập nhật ràng buộc CK_facilitytasks_type
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('facility_tasks') AND name LIKE '%tasks_type%')
    BEGIN
        DECLARE @dropTypeSql NVARCHAR(500);
        SELECT @dropTypeSql = 'ALTER TABLE facility_tasks DROP CONSTRAINT ' + name FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('facility_tasks') AND name LIKE '%tasks_type%';
        EXEC sp_executesql @dropTypeSql;
    END
    ALTER TABLE facility_tasks ADD CONSTRAINT CK_facilitytasks_type 
        CHECK (task_type IN ('CHECK_IN', 'CHECK_OUT', 'SUPPORT', 'REFUND', 'MAINTENANCE'));

    -- Cập nhật ràng buộc CK_facilitytasks_target
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('facility_tasks') AND name LIKE '%tasks_target%')
    BEGIN
        DECLARE @dropTargetSql NVARCHAR(500);
        SELECT @dropTargetSql = 'ALTER TABLE facility_tasks DROP CONSTRAINT ' + name FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('facility_tasks') AND name LIKE '%tasks_target%';
        EXEC sp_executesql @dropTargetSql;
    END
    ALTER TABLE facility_tasks ADD CONSTRAINT CK_facilitytasks_target CHECK (
        (task_type IN ('CHECK_IN', 'CHECK_OUT') AND contract_id IS NOT NULL)
        OR (task_type = 'SUPPORT' AND support_request_id IS NOT NULL)
        OR (task_type IN ('REFUND', 'MAINTENANCE'))
    );
END
GO

PRINT N'==> [7/10] Đã kiểm tra & đồng bộ bảng facility_tasks.';
GO

-- =====================================================================
-- 8. BẢNG damage_cases: GHI NHẬN SỰ CỐ HƯ HỎNG KHOANG (UC-23, UC-24)
-- =====================================================================
IF OBJECT_ID('damage_cases', 'U') IS NULL
BEGIN
    CREATE TABLE damage_cases (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        contract_id         INT NOT NULL,
        task_id             INT NOT NULL,                             -- ID task CHECK_OUT ở facility_tasks
        title               NVARCHAR(150) NOT NULL,                   -- VD: 'Vệ sinh rác', 'Hỏng khóa SmartLock', 'Móp vách'
        description         NVARCHAR(1000) NULL,                      -- Mô tả chi tiết mức độ hư hại
        estimated_cost      DECIMAL(12,2) NOT NULL DEFAULT 0,         -- Chi phí đền bù (>= 0)
        evidence_image_urls NVARCHAR(MAX) NULL,                       -- Danh sách link ảnh / base64 JSON
        created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_damagecases_contract FOREIGN KEY (contract_id) REFERENCES rental_contracts(id),
        CONSTRAINT FK_damagecases_task     FOREIGN KEY (task_id) REFERENCES facility_tasks(id)
    );

    CREATE INDEX IX_damagecases_contract ON damage_cases(contract_id);
    CREATE INDEX IX_damagecases_task ON damage_cases(task_id);

    PRINT N'   [+] Đã tạo mới bảng damage_cases thành công!';
END
ELSE
BEGIN
    PRINT N'   [+] Bảng damage_cases đã tồn tại.';
END

PRINT N'==> [8/10] Đã kiểm tra bảng damage_cases.';
GO

-- =====================================================================
-- 9. BẢNG activity_logs: MỞ RỘNG CỘT action LÊN NVARCHAR(500)
-- =====================================================================
IF OBJECT_ID('activity_logs', 'U') IS NULL
BEGIN
    CREATE TABLE activity_logs (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        user_id         INT NOT NULL,
        action          NVARCHAR(500) NOT NULL,
        target_entity   NVARCHAR(50)  NULL,
        target_id       NVARCHAR(50)  NULL,
        created_at      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_activitylogs_user FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IX_activitylogs_user ON activity_logs(user_id);
    PRINT N'   [+] Đã tạo mới bảng activity_logs.';
END
ELSE
BEGIN
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'activity_logs' AND COLUMN_NAME = 'action' AND CHARACTER_MAXIMUM_LENGTH < 500
    )
    BEGIN
        ALTER TABLE activity_logs ALTER COLUMN action NVARCHAR(500) NOT NULL;
        PRINT N'   [+] Đã mở rộng cột activity_logs.action lên NVARCHAR(500).';
    END
END

-- UC-31: màn nhật ký luôn sắp xếp / lọc theo thời gian → index created_at
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_activitylogs_created_at' AND object_id = OBJECT_ID('activity_logs'))
BEGIN
    CREATE INDEX IX_activitylogs_created_at ON activity_logs(created_at DESC);
    PRINT N'   [+] Đã tạo index IX_activitylogs_created_at.';
END

-- UC-31 / PR-A8: gộp tài khoản job cũ system@queenkho.com vào system@queenkho.local
DECLARE @oldSystemId INT = (SELECT id FROM users WHERE email = 'system@queenkho.com');
DECLARE @systemId    INT = (SELECT id FROM users WHERE email = 'system@queenkho.local');
IF @oldSystemId IS NOT NULL AND @systemId IS NOT NULL
BEGIN
    UPDATE activity_logs SET user_id = @systemId WHERE user_id = @oldSystemId;
    BEGIN TRY
        DELETE FROM users WHERE id = @oldSystemId;
        PRINT N'   [+] Đã gộp system@queenkho.com vào system@queenkho.local và xoá tài khoản cũ.';
    END TRY
    BEGIN CATCH
        -- Còn bảng khác tham chiếu → giữ lại (đang DISABLED, không đăng nhập được)
        PRINT N'   [!] Đã chuyển log nhưng không xoá được system@queenkho.com: ' + ERROR_MESSAGE();
    END CATCH
END

PRINT N'==> [9/10] Đã kiểm tra bảng activity_logs.';
GO

-- =====================================================================
-- 10. TRIGGERS TỰ ĐỘNG ĐỒNG BỘ TRẠNG THÁI HOÀN TIỀN CỌC & THANH LÝ
-- =====================================================================
-- 10.1. Trigger đồng bộ đơn đặt chỗ khi có giao dịch REFUND thành công
CREATE OR ALTER TRIGGER trg_payment_transactions_refund_sync
ON payment_transactions
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE r
    SET r.status = 'REFUNDED'
    FROM reservations r
    INNER JOIN inserted i ON r.id = i.reservation_id
    WHERE i.payment_type = 'REFUND' 
      AND i.status = 'SUCCESS'
      AND r.status <> 'REFUNDED';
END;
GO

-- 10.2. Trigger đồng bộ hợp đồng & đơn đặt khi Quản lý hoàn tất task REFUND
--       (Hỗ trợ an toàn cả hợp đồng bình thường lẫn hợp đồng LIQUIDATED)
CREATE OR ALTER TRIGGER trg_facility_tasks_refund_sync
ON facility_tasks
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Khi task REFUND chuyển sang COMPLETED gắn với hợp đồng:
    -- Nếu hợp đồng là LIQUIDATED -> giữ LIQUIDATED và đưa deposit_held_amount = 0
    -- Nếu hợp đồng khác -> chuyển sang TERMINATED và đưa deposit_held_amount = 0
    UPDATE c
    SET c.status = CASE 
                     WHEN c.status = 'LIQUIDATED' THEN 'LIQUIDATED' 
                     ELSE 'TERMINATED' 
                   END,
        c.deposit_held_amount = 0
    FROM rental_contracts c
    INNER JOIN inserted i ON c.id = i.contract_id
    WHERE i.task_type = 'REFUND' 
      AND i.status = 'COMPLETED';
      
    -- Khi task REFUND hoàn thành cho hủy giữ chỗ: cập nhật reservation sang REFUNDED
    UPDATE r
    SET r.status = 'REFUNDED'
    FROM reservations r
    INNER JOIN inserted i ON (
        i.note LIKE '%' + r.reservation_code + '%'
    )
    WHERE i.task_type = 'REFUND' 
      AND i.status = 'COMPLETED'
      AND r.status <> 'REFUNDED';
      
    -- Cập nhật giao dịch hoàn tiền còn PENDING sang SUCCESS
    UPDATE p
    SET p.status = 'SUCCESS', p.paid_at = SYSDATETIME()
    FROM payment_transactions p
    INNER JOIN reservations r ON p.reservation_id = r.id
    INNER JOIN inserted i ON (
        i.note LIKE '%' + r.reservation_code + '%'
    )
    WHERE i.task_type = 'REFUND' 
      AND i.status = 'COMPLETED'
      AND p.payment_type = 'REFUND'
      AND p.status <> 'SUCCESS';
END;
GO

PRINT N'==> [10/11] Đã tạo / cập nhật 2 Triggers đồng bộ hoàn tiền an toàn!';
GO

-- =====================================================================
-- 11. BẢNG support_requests: BỔ SUNG CỘT CHO UC-26 & UC-27 (PR-S10)
-- =====================================================================
IF OBJECT_ID('support_requests', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('support_requests', 'resolution_note') IS NULL
    BEGIN
        ALTER TABLE support_requests ADD resolution_note NVARCHAR(1000) NULL;
        PRINT N'==> [11a/11] Đã thêm cột support_requests.resolution_note';
    END

    IF COL_LENGTH('support_requests', 'resolved_at') IS NULL
    BEGIN
        ALTER TABLE support_requests ADD resolved_at DATETIME2 NULL;
        PRINT N'==> [11b/11] Đã thêm cột support_requests.resolved_at';
    END

    IF COL_LENGTH('support_requests', 'closed_at') IS NULL
    BEGIN
        ALTER TABLE support_requests ADD closed_at DATETIME2 NULL;
        PRINT N'==> [11c/11] Đã thêm cột support_requests.closed_at';
    END
END
GO

-- =====================================================================
-- KIỂM TRA TỔNG QUÁT SAU KHI MIGRATION
-- =====================================================================
PRINT N'';
PRINT N'======================================================================';
PRINT N'==> HOÀN TẤT MIGRATION THÀNH CÔNG! THỐNG KÊ DỮ LIỆU HIỆN CÓ:';
PRINT N'======================================================================';

SELECT 'facilities' AS [Bang], COUNT(*) AS [SoLuongBanGhi] FROM facilities
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'roles', COUNT(*) FROM roles
UNION ALL
SELECT 'storage_units', COUNT(*) FROM storage_units
UNION ALL
SELECT 'rental_contracts', COUNT(*) FROM rental_contracts
UNION ALL
SELECT 'facility_tasks', COUNT(*) FROM facility_tasks
UNION ALL
SELECT 'damage_cases', COUNT(*) FROM damage_cases
UNION ALL
SELECT 'activity_logs', COUNT(*) FROM activity_logs;

PRINT N'==> Danh sách tài khoản Quản trị & BOM:';
SELECT u.id, u.email, r.name AS [Role], u.full_name, u.status 
FROM users u 
INNER JOIN roles r ON u.role_id = r.id 
WHERE r.name IN ('ADMIN', 'BOM');
GO

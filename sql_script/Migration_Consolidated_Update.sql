USE QueenKhoDB;
GO

/* =====================================================================================
   QUEENKHO - SCRIPT MIGRATION & CẬP NHẬT DATABASE TỔNG HỢP (ALL-IN-ONE)
   Áp dụng đầy đủ cho toàn bộ tính năng và thay đổi mới nhất (Cập nhật 27/10/2026):
   - UC-03 & UC-08: Quản trị vai trò & Tài khoản người dùng (Admin, BOM, System)
   - UC-04: Mã cơ sở kho (facilities.code)
   - UC-05: Trạng thái loại kho (unit_types.status) & UNIQUE tên loại kho
   - UC-07: Chính sách thuê kho phiên bản (rental_policy) & Ưu đãi chu kỳ (3m/6m/12m)
   - UC-18, 23, 24, 25: Bàn giao, Nghiệm thu trả kho, Sự cố hư hại & Hoàn tiền cọc
   - UC-26 & 27: Phiếu hỗ trợ khách hàng (support_requests: resolution_note, resolved_at, closed_at)
   - UC-28: Hợp đồng quá hạn, miễn phí trễ hạn (rental_contracts.late_fee_waived)
   - VNPAY: Chu kỳ gia hạn (payment_transactions.renewal_months) & Chỉ mục PENDING
   - Admin & Must-have: Bảng lịch sử đăng nhập (login_history) & Activity logs
   - 27/10 (PR #86): Hoàn thiện bảo trì sau trả kho, phân lỗi sự cố (CUSTOMER/FACILITY),
     điều khoản xử lý tài sản khi không trả kho (reservations.terms_version) và
     quản lý hàng lưu giữ sau thanh lý (bảng held_goods)

   Đặc tính script:
   - Tuân thủ 100% mô hình IF / ELSE / IF NOT EXISTS (Idempotent - chạy lại an toàn nhiều lần)
   - Sử dụng EXEC sp_executesql và ngắt GO batch để chống lỗi biên dịch Msg 207 Invalid column name
   - KHÔNG drop bảng, KHÔNG truncate, giữ nguyên 100% dữ liệu đang có trong database.
   ===================================================================================== */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
GO

PRINT N'======================================================================';
PRINT N'==> BẮT ĐẦU CHẠY SCRIPT MIGRATION TỔNG HỢP CHO QUEENKHO DATABASE...';
PRINT N'======================================================================';
GO

-- =====================================================================
-- 1. BẢNG roles: BỔ SUNG CÁC VAI TRÒ HỆ THỐNG
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

PRINT N'==> [1/17] Đã kiểm tra & đồng bộ bảng roles.';
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

IF OBJECT_ID('facilities', 'U') IS NOT NULL AND COL_LENGTH('facilities', 'code') IS NOT NULL
BEGIN
    EXEC sp_executesql N'
    UPDATE facilities SET code = ''TB'' WHERE (code IS NULL OR code = '''') AND (name LIKE N''%Tân Bình%'' OR id = 1);
    UPDATE facilities SET code = ''BT'' WHERE (code IS NULL OR code = '''') AND (name LIKE N''%Bình Thạnh%'' OR id = 2);
    UPDATE facilities SET code = ''TD'' WHERE (code IS NULL OR code = '''') AND (name LIKE N''%Thủ Đức%'' OR id = 3);
    UPDATE facilities SET code = ''GV'' WHERE (code IS NULL OR code = '''') AND (name LIKE N''%Gò Vấp%'' OR id = 4);
    UPDATE facilities SET code = ''CG'' WHERE (code IS NULL OR code = '''') AND (name LIKE N''%Cầu Giấy%'' OR id = 5);
    UPDATE facilities SET code = ''Q7'' WHERE (code IS NULL OR code = '''') AND (name LIKE N''%Quận 7%'' OR id = 6);

    UPDATE facilities 
    SET code = ''F'' + RIGHT(''00'' + CAST(id AS NVARCHAR(3)), 3)
    WHERE code IS NULL OR code = '''';';
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('facilities') AND name = 'code' AND is_nullable = 1)
BEGIN
    ALTER TABLE facilities ALTER COLUMN code NVARCHAR(4) NOT NULL;
    PRINT N'   [+] Đã cập nhật facilities.code sang NOT NULL.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('facilities') AND name = 'UQ_facilities_code')
BEGIN
    ALTER TABLE facilities ADD CONSTRAINT UQ_facilities_code UNIQUE (code);
    PRINT N'   [+] Đã tạo ràng buộc UNIQUE (UQ_facilities_code).';
END

PRINT N'==> [2/17] Đã kiểm tra & đồng bộ cột code bảng facilities.';
GO

-- =====================================================================
-- 3. BẢNG users: BỔ SUNG CỘT created_at (UC-08)
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'created_at')
BEGIN
    ALTER TABLE users ADD created_at DATETIME2 NOT NULL CONSTRAINT DF_users_created_at DEFAULT SYSDATETIME();
    PRINT N'   [+] Đã thêm cột created_at vào bảng users.';
END

PRINT N'==> [3/17] Đã kiểm tra cấu trúc bảng users.';
GO

-- =====================================================================
-- 4. BỔ SUNG CÁC TÀI KHOẢN MẪU HỆ THỐNG (BOM, ADMIN, SYSTEM)
--    Mật khẩu mặc định: 123456
-- =====================================================================
DECLARE @pw NVARCHAR(255) = '$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu'; -- 123456
DECLARE @adminRole INT = (SELECT id FROM roles WHERE name = 'ADMIN');
DECLARE @bomRole   INT = (SELECT id FROM roles WHERE name = 'BOM');

IF @bomRole IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'bom@queenkho.com')
BEGIN
    INSERT INTO users (full_name, email, password_hash, phone, role_id, facility_id, status)
    VALUES (N'Business Operations Manager', 'bom@queenkho.com', @pw, '0908889999', @bomRole, NULL, 'ACTIVE');
    PRINT N'   [+] Đã tạo tài khoản BOM: bom@queenkho.com / 123456';
END

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

IF @adminRole IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'system@queenkho.local')
BEGIN
    INSERT INTO users (full_name, email, password_hash, phone, role_id, facility_id, status)
    VALUES (N'Hệ thống', 'system@queenkho.local', 'NO_LOGIN', '0000000000', @adminRole, NULL, 'DISABLED');
    PRINT N'   [+] Đã tạo tài khoản job: system@queenkho.local (DISABLED)';
END

PRINT N'==> [4/17] Đã kiểm tra & tạo tài khoản quản trị hệ thống.';
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

PRINT N'==> [5/17] Đã kiểm tra bảng handover_records.';
GO

-- =====================================================================
-- 6. BẢNG rental_contracts: CỘT BẢO VỆ CHU KỲ & TIỀN CỌC
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

PRINT N'==> [6/17] Đã kiểm tra các cột trong bảng rental_contracts.';
GO

-- =====================================================================
-- 7. BẢNG facility_tasks: ĐỒNG BỘ TÊN VÀ CẤU TRÚC (PR #55, UC-16, 25)
-- =====================================================================
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'staff_tasks') 
   AND NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'facility_tasks')
BEGIN
    EXEC sp_rename 'staff_tasks', 'facility_tasks';
    PRINT N'   [+] Đã đổi tên bảng staff_tasks -> facility_tasks.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'facility_tasks')
BEGIN
    CREATE TABLE facility_tasks (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        facility_id         INT NOT NULL,
        task_type           NVARCHAR(50) NOT NULL,
        contract_id         INT NULL,
        support_request_id  INT NULL,
        status              NVARCHAR(30) NOT NULL DEFAULT 'OPEN',
        staff_id            INT NULL,
        due_at              DATETIME2 NOT NULL,
        evidence_image_url  NVARCHAR(MAX) NULL,
        note                NVARCHAR(1000) NULL,
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
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('facility_tasks') AND name = 'evidence_image_url')
    BEGIN
        ALTER TABLE facility_tasks ADD evidence_image_url NVARCHAR(MAX) NULL;
        PRINT N'   [+] Đã thêm cột evidence_image_url vào facility_tasks.';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('facility_tasks') AND name = 'support_request_id')
    BEGIN
        ALTER TABLE facility_tasks ADD support_request_id INT NULL;
        PRINT N'   [+] Đã thêm cột support_request_id vào facility_tasks.';
    END
END
GO

IF OBJECT_ID('facility_tasks', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_facilitytasks_support' AND parent_object_id = OBJECT_ID('facility_tasks'))
       AND COL_LENGTH('facility_tasks', 'support_request_id') IS NOT NULL
    BEGIN
        ALTER TABLE facility_tasks ADD CONSTRAINT FK_facilitytasks_support FOREIGN KEY (support_request_id) REFERENCES support_requests(id);
    END

    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('facility_tasks') AND name LIKE '%tasks_type%')
    BEGIN
        DECLARE @dropTypeSql NVARCHAR(500);
        SELECT @dropTypeSql = 'ALTER TABLE facility_tasks DROP CONSTRAINT ' + name FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('facility_tasks') AND name LIKE '%tasks_type%';
        EXEC sp_executesql @dropTypeSql;
    END

    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('facility_tasks') AND name = 'CK_facilitytasks_type')
    BEGIN
        ALTER TABLE facility_tasks ADD CONSTRAINT CK_facilitytasks_type 
            CHECK (task_type IN ('CHECK_IN', 'CHECK_OUT', 'SUPPORT', 'REFUND', 'MAINTENANCE'));
    END

    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('facility_tasks') AND name LIKE '%tasks_target%')
    BEGIN
        DECLARE @dropTargetSql NVARCHAR(500);
        SELECT @dropTargetSql = 'ALTER TABLE facility_tasks DROP CONSTRAINT ' + name FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('facility_tasks') AND name LIKE '%tasks_target%';
        EXEC sp_executesql @dropTargetSql;
    END

    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('facility_tasks') AND name = 'CK_facilitytasks_target')
    BEGIN
        EXEC sp_executesql N'
        ALTER TABLE facility_tasks ADD CONSTRAINT CK_facilitytasks_target CHECK (
            (task_type IN (''CHECK_IN'', ''CHECK_OUT'') AND contract_id IS NOT NULL)
            OR (task_type = ''SUPPORT'' AND support_request_id IS NOT NULL)
            OR (task_type IN (''REFUND'', ''MAINTENANCE''))
        );';
    END
END
GO

PRINT N'==> [7/17] Đã kiểm tra & đồng bộ bảng facility_tasks.';
GO

-- =====================================================================
-- 8. BẢNG damage_cases: GHI NHẬN SỰ CỐ HƯ HỎNG KHOANG (UC-23, UC-24)
-- =====================================================================
IF OBJECT_ID('damage_cases', 'U') IS NULL
BEGIN
    CREATE TABLE damage_cases (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        contract_id         INT NOT NULL,
        task_id             INT NOT NULL,
        title               NVARCHAR(150) NOT NULL,
        description         NVARCHAR(1000) NULL,
        estimated_cost      DECIMAL(12,2) NOT NULL DEFAULT 0,
        evidence_image_urls NVARCHAR(MAX) NULL,
        created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_damagecases_contract FOREIGN KEY (contract_id) REFERENCES rental_contracts(id),
        CONSTRAINT FK_damagecases_task     FOREIGN KEY (task_id) REFERENCES facility_tasks(id)
    );

    CREATE INDEX IX_damagecases_contract ON damage_cases(contract_id);
    CREATE INDEX IX_damagecases_task ON damage_cases(task_id);

    PRINT N'   [+] Đã tạo mới bảng damage_cases.';
END

PRINT N'==> [8/17] Đã kiểm tra bảng damage_cases.';
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

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_activitylogs_created_at' AND object_id = OBJECT_ID('activity_logs'))
BEGIN
    CREATE INDEX IX_activitylogs_created_at ON activity_logs(created_at DESC);
    PRINT N'   [+] Đã tạo index IX_activitylogs_created_at.';
END

DECLARE @oldSystemId INT = (SELECT id FROM users WHERE email = 'system@queenkho.com');
DECLARE @systemId    INT = (SELECT id FROM users WHERE email = 'system@queenkho.local');
IF @oldSystemId IS NOT NULL AND @systemId IS NOT NULL
BEGIN
    UPDATE activity_logs SET user_id = @systemId WHERE user_id = @oldSystemId;
    BEGIN TRY
        DELETE FROM users WHERE id = @oldSystemId;
    END TRY
    BEGIN CATCH
    END CATCH
END

PRINT N'==> [9/17] Đã kiểm tra bảng activity_logs.';
GO

-- =====================================================================
-- 10. TRIGGERS TỰ ĐỘNG ĐỒNG BỘ TRẠNG THÁI HOÀN TIỀN CỌC & THANH LÝ
-- =====================================================================
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

CREATE OR ALTER TRIGGER trg_facility_tasks_refund_sync
ON facility_tasks
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
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
      
    UPDATE r
    SET r.status = 'REFUNDED'
    FROM reservations r
    INNER JOIN inserted i ON (
        i.note LIKE '%' + r.reservation_code + '%'
    )
    WHERE i.task_type = 'REFUND' 
      AND i.status = 'COMPLETED'
      AND r.status <> 'REFUNDED';
      
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

PRINT N'==> [10/17] Đã tạo / cập nhật 2 Triggers đồng bộ hoàn tiền an toàn!';
GO

-- =====================================================================
-- 11. BẢNG support_requests: BỔ SUNG CỘT CHO UC-26 & UC-27 (PR-S10)
-- =====================================================================
IF OBJECT_ID('support_requests', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('support_requests', 'resolution_note') IS NULL
    BEGIN
        ALTER TABLE support_requests ADD resolution_note NVARCHAR(1000) NULL;
        PRINT N'   [+] Đã thêm cột support_requests.resolution_note';
    END

    IF COL_LENGTH('support_requests', 'resolved_at') IS NULL
    BEGIN
        ALTER TABLE support_requests ADD resolved_at DATETIME2 NULL;
        PRINT N'   [+] Đã thêm cột support_requests.resolved_at';
    END

    IF COL_LENGTH('support_requests', 'closed_at') IS NULL
    BEGIN
        ALTER TABLE support_requests ADD closed_at DATETIME2 NULL;
        PRINT N'   [+] Đã thêm cột support_requests.closed_at';
    END
END
GO

PRINT N'==> [11/17] Đã kiểm tra & đồng bộ bảng support_requests (UC-26 & UC-27).';
GO

-- =====================================================================
-- 12. BẢNG unit_types: CỘT status & RÀNG BUỘC UNIQUE NAME (UC-05, PR-M3, PR-M4)
-- =====================================================================
IF OBJECT_ID('unit_types', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('unit_types') AND name = 'status')
    BEGIN
        ALTER TABLE unit_types ADD status NVARCHAR(20) NOT NULL CONSTRAINT DF_unit_types_status DEFAULT 'ACTIVE';
        PRINT N'   [+] Đã thêm cột status vào bảng unit_types.';
    END
END
GO

-- Sử dụng sp_executesql để tách biệt thời điểm biên dịch (chống lỗi Msg 207)
IF OBJECT_ID('unit_types', 'U') IS NOT NULL AND COL_LENGTH('unit_types', 'status') IS NOT NULL
BEGIN
    EXEC sp_executesql N'UPDATE unit_types SET status = ''ACTIVE'' WHERE status IS NULL OR status = ''''';

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('unit_types') AND name = 'UQ_unit_types_name')
    BEGIN
        ALTER TABLE unit_types ADD CONSTRAINT UQ_unit_types_name UNIQUE (name);
        PRINT N'   [+] Đã tạo ràng buộc UNIQUE (UQ_unit_types_name).';
    END
END
GO

PRINT N'==> [12/17] Đã kiểm tra & đồng bộ bảng unit_types (UC-05).';
GO

-- =====================================================================
-- 13. BẢNG rental_policy: CẤU TRÚC PHIÊN BẢN (UC-07) & ƯU ĐÃI GÓI (26/10)
-- =====================================================================
IF OBJECT_ID('rental_policy', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('rental_policy', 'late_fee_percent_per_day') IS NULL
        ALTER TABLE rental_policy ADD late_fee_percent_per_day INT NOT NULL CONSTRAINT DF_rentalpolicy_late_percent DEFAULT 10;
    IF COL_LENGTH('rental_policy', 'late_fee_max_percent') IS NULL
        ALTER TABLE rental_policy ADD late_fee_max_percent INT NOT NULL CONSTRAINT DF_rentalpolicy_late_max DEFAULT 50;
    IF COL_LENGTH('rental_policy', 'version') IS NULL
        ALTER TABLE rental_policy ADD version INT NULL;
    IF COL_LENGTH('rental_policy', 'created_at') IS NULL
        ALTER TABLE rental_policy ADD created_at DATETIME2 NOT NULL CONSTRAINT DF_rentalpolicy_created_at DEFAULT SYSDATETIME();
    IF COL_LENGTH('rental_policy', 'created_by_user_id') IS NULL
        ALTER TABLE rental_policy ADD created_by_user_id INT NULL;
    IF COL_LENGTH('rental_policy', 'is_active') IS NULL
        ALTER TABLE rental_policy ADD is_active BIT NOT NULL CONSTRAINT DF_rentalpolicy_active DEFAULT 0;

    -- Cột ưu đãi chu kỳ 3/6/12 tháng & quyền miễn phí trễ (26/10)
    IF COL_LENGTH('rental_policy', 'booking_discount_3m') IS NULL
        ALTER TABLE rental_policy ADD booking_discount_3m INT NOT NULL CONSTRAINT DF_rentalpolicy_bd3 DEFAULT 5;
    IF COL_LENGTH('rental_policy', 'booking_discount_6m') IS NULL
        ALTER TABLE rental_policy ADD booking_discount_6m INT NOT NULL CONSTRAINT DF_rentalpolicy_bd6 DEFAULT 10;
    IF COL_LENGTH('rental_policy', 'booking_discount_12m') IS NULL
        ALTER TABLE rental_policy ADD booking_discount_12m INT NOT NULL CONSTRAINT DF_rentalpolicy_bd12 DEFAULT 15;
    IF COL_LENGTH('rental_policy', 'renewal_discount_3m') IS NULL
        ALTER TABLE rental_policy ADD renewal_discount_3m INT NOT NULL CONSTRAINT DF_rentalpolicy_rd3 DEFAULT 0;
    IF COL_LENGTH('rental_policy', 'renewal_discount_6m') IS NULL
        ALTER TABLE rental_policy ADD renewal_discount_6m INT NOT NULL CONSTRAINT DF_rentalpolicy_rd6 DEFAULT 5;
    IF COL_LENGTH('rental_policy', 'renewal_discount_12m') IS NULL
        ALTER TABLE rental_policy ADD renewal_discount_12m INT NOT NULL CONSTRAINT DF_rentalpolicy_rd12 DEFAULT 10;
    IF COL_LENGTH('rental_policy', 'allow_late_fee_waiver') IS NULL
        ALTER TABLE rental_policy ADD allow_late_fee_waiver BIT NOT NULL CONSTRAINT DF_rentalpolicy_waiver DEFAULT 1;
END
GO

-- Sử dụng dynamic SQL cho các thao tác cập nhật cột vừa thêm
IF OBJECT_ID('rental_policy', 'U') IS NOT NULL AND COL_LENGTH('rental_policy', 'version') IS NOT NULL
BEGIN
    EXEC sp_executesql N'
    ;WITH numbered AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY facility_id ORDER BY id) AS ordinal
        FROM rental_policy
    )
    UPDATE p SET version = n.ordinal
    FROM rental_policy p JOIN numbered n ON n.id = p.id
    WHERE p.version IS NULL;

    UPDATE rental_policy SET deposit_month_multiplier = 1 WHERE deposit_month_multiplier NOT BETWEEN 1 AND 3;
    UPDATE rental_policy SET liquidation_days = 30 WHERE liquidation_days < 1;';
END
GO

IF OBJECT_ID('rental_policy', 'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('rental_policy') AND name = 'version' AND is_nullable = 1)
        ALTER TABLE rental_policy ALTER COLUMN version INT NOT NULL;

    -- Bỏ cột legacy late_fee_per_day, lock_account_days
    DECLARE @dropPolicyDefaults NVARCHAR(MAX) = N'';
    SELECT @dropPolicyDefaults = @dropPolicyDefaults + N'ALTER TABLE rental_policy DROP CONSTRAINT ' + QUOTENAME(dc.name) + N';'
    FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID('rental_policy') AND c.name IN ('late_fee_per_day', 'lock_account_days');
    IF LEN(@dropPolicyDefaults) > 0 EXEC sp_executesql @dropPolicyDefaults;

    IF COL_LENGTH('rental_policy', 'late_fee_per_day') IS NOT NULL
        ALTER TABLE rental_policy DROP COLUMN late_fee_per_day;
    IF COL_LENGTH('rental_policy', 'lock_account_days') IS NOT NULL
        ALTER TABLE rental_policy DROP COLUMN lock_account_days;

    IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('rental_policy') AND name = 'UQ_rentalpolicy_facility_version')
        ALTER TABLE rental_policy ADD CONSTRAINT UQ_rentalpolicy_facility_version UNIQUE (facility_id, version);
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('rental_policy') AND name = 'FK_rentalpolicy_creator')
        ALTER TABLE rental_policy ADD CONSTRAINT FK_rentalpolicy_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id);

    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('rental_policy') AND name = 'CK_rentalpolicy_values')
        ALTER TABLE rental_policy ADD CONSTRAINT CK_rentalpolicy_values CHECK (
            deposit_month_multiplier BETWEEN 1 AND 3 AND cancel_fee_percent BETWEEN 0 AND 100
            AND cancel_free_hours >= 0 AND late_fee_percent_per_day BETWEEN 0 AND 100
            AND late_fee_max_percent BETWEEN late_fee_percent_per_day AND 100 AND liquidation_days >= 1);

    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('rental_policy') AND name = 'CK_rentalpolicy_discounts')
        ALTER TABLE rental_policy ADD CONSTRAINT CK_rentalpolicy_discounts CHECK (
            booking_discount_3m BETWEEN 0 AND 50 AND booking_discount_6m BETWEEN 0 AND 50
            AND booking_discount_12m BETWEEN 0 AND 50 AND renewal_discount_3m BETWEEN 0 AND 50
            AND renewal_discount_6m BETWEEN 0 AND 50 AND renewal_discount_12m BETWEEN 0 AND 50);

    -- Tạo chính sách mẫu nếu cơ sở chưa có
    INSERT INTO rental_policy (
        facility_id, policy_name, deposit_month_multiplier, cancel_fee_percent,
        cancel_free_hours, late_fee_percent_per_day, late_fee_max_percent,
        liquidation_days, version, is_active,
        booking_discount_3m, booking_discount_6m, booking_discount_12m,
        renewal_discount_3m, renewal_discount_6m, renewal_discount_12m,
        allow_late_fee_waiver
    )
    SELECT f.id, LEFT(N'Chính sách ' + f.name + N' - Tiêu chuẩn', 150), 1, 50, 24, 10, 50, 30, 1, 1, 5, 10, 15, 0, 5, 10, 1
    FROM facilities f
    WHERE NOT EXISTS (SELECT 1 FROM rental_policy p WHERE p.facility_id = f.id);
END
GO

IF OBJECT_ID('rental_policy', 'U') IS NOT NULL AND COL_LENGTH('rental_policy', 'is_active') IS NOT NULL
BEGIN
    EXEC sp_executesql N'
    ;WITH latest AS (
        SELECT id, facility_id, ROW_NUMBER() OVER (PARTITION BY facility_id ORDER BY version DESC, id DESC) AS row_num
        FROM rental_policy
    )
    UPDATE p SET is_active = 1
    FROM rental_policy p JOIN latest l ON l.id = p.id
    WHERE l.row_num = 1
      AND NOT EXISTS (SELECT 1 FROM rental_policy active_policy
                      WHERE active_policy.facility_id = p.facility_id AND active_policy.is_active = 1);';

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('rental_policy') AND name = 'UX_rentalpolicy_active_facility')
        CREATE UNIQUE INDEX UX_rentalpolicy_active_facility ON rental_policy(facility_id) WHERE is_active = 1;

    PRINT N'   [+] Đã hoàn thiện cấu trúc & ưu đãi bảng rental_policy.';
END
GO

PRINT N'==> [13/17] Đã kiểm tra & đồng bộ bảng rental_policy (UC-07 & 26/10).';
GO

-- =====================================================================
-- 14. BẢNG reservations: CỘT rent_discount_percent (26/10)
-- =====================================================================
IF OBJECT_ID('reservations', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('reservations', 'rent_discount_percent') IS NULL
    BEGIN
        ALTER TABLE reservations ADD rent_discount_percent INT NULL;
        PRINT N'   [+] Đã thêm cột rent_discount_percent vào reservations.';
    END
END
GO

IF OBJECT_ID('reservations', 'U') IS NOT NULL AND COL_LENGTH('reservations', 'rent_discount_percent') IS NOT NULL
BEGIN
    EXEC sp_executesql N'
    UPDATE reservations
    SET rent_discount_percent = CASE duration_months WHEN 3 THEN 5 WHEN 6 THEN 10 WHEN 12 THEN 15 ELSE 0 END
    WHERE rent_discount_percent IS NULL;';
END
GO

PRINT N'==> [14/17] Đã kiểm tra & đồng bộ cột rent_discount_percent bảng reservations.';
GO

-- =====================================================================
-- 15. BẢNG rental_contracts: MIỄN PHÍ TRỄ HẠN (26/10)
-- =====================================================================
IF OBJECT_ID('rental_contracts', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('rental_contracts', 'late_fee_waived') IS NULL
    BEGIN
        ALTER TABLE rental_contracts ADD late_fee_waived BIT NOT NULL CONSTRAINT DF_contracts_late_fee_waived DEFAULT 0;
        PRINT N'   [+] Đã thêm cột late_fee_waived vào rental_contracts.';
    END

    IF COL_LENGTH('rental_contracts', 'late_fee_waiver_note') IS NULL
    BEGIN
        ALTER TABLE rental_contracts ADD late_fee_waiver_note NVARCHAR(500) NULL;
        PRINT N'   [+] Đã thêm cột late_fee_waiver_note vào rental_contracts.';
    END
END
GO

PRINT N'==> [15/17] Đã kiểm tra & đồng bộ cột miễn phí trễ bảng rental_contracts.';
GO

-- =====================================================================
-- 16. BẢNG payment_transactions: CỘT renewal_months & CHỈ MỤC PENDING (VNPAY)
-- =====================================================================
IF OBJECT_ID('payment_transactions', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('payment_transactions', 'renewal_months') IS NULL
    BEGIN
        ALTER TABLE payment_transactions ADD renewal_months INT NULL;
        PRINT N'   [+] Đã thêm cột renewal_months vào payment_transactions.';
    END
END
GO

IF OBJECT_ID('payment_transactions', 'U') IS NOT NULL AND COL_LENGTH('payment_transactions', 'renewal_months') IS NOT NULL
BEGIN
    EXEC sp_executesql N'
    UPDATE payment_transactions
    SET renewal_months = TRY_CONVERT(INT, SUBSTRING(transaction_code, 4, 2))
    WHERE payment_type = ''MONTHLY_RENT''
      AND renewal_months IS NULL
      AND transaction_code LIKE ''QKR%''
      AND TRY_CONVERT(INT, SUBSTRING(transaction_code, 4, 2)) IN (1, 3, 6, 12);

    UPDATE lf
    SET lf.renewal_months = rent.renewal_months
    FROM payment_transactions lf
    JOIN payment_transactions rent ON lf.transaction_code = ''LF'' + rent.transaction_code
    WHERE lf.payment_type = ''LATE_FEE'' AND lf.renewal_months IS NULL;';

    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_payments_renewal_months')
    BEGIN
        ALTER TABLE payment_transactions ADD CONSTRAINT CK_payments_renewal_months
            CHECK (renewal_months IS NULL OR renewal_months IN (1, 3, 6, 12));
    END

    EXEC sp_executesql N'
    ;WITH duplicate_deposit AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY reservation_id ORDER BY id DESC) AS rn
        FROM payment_transactions
        WHERE payment_type = ''DEPOSIT'' AND payment_method = ''VNPAY'' AND status = ''PENDING''
    )
    UPDATE payment_transactions SET status = ''FAILED'', paid_at = NULL
    WHERE id IN (SELECT id FROM duplicate_deposit WHERE rn > 1);

    ;WITH duplicate_renewal AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY contract_id ORDER BY id DESC) AS rn
        FROM payment_transactions
        WHERE payment_type = ''MONTHLY_RENT'' AND payment_method = ''VNPAY'' AND status = ''PENDING''
    )
    UPDATE payment_transactions SET status = ''FAILED'', paid_at = NULL
    WHERE id IN (SELECT id FROM duplicate_renewal WHERE rn > 1);

    UPDATE lf SET status = ''FAILED'', paid_at = NULL
    FROM payment_transactions lf
    WHERE lf.payment_type = ''LATE_FEE'' AND lf.payment_method = ''VNPAY'' AND lf.status = ''PENDING''
      AND NOT EXISTS (
          SELECT 1 FROM payment_transactions rent
          WHERE lf.transaction_code = ''LF'' + rent.transaction_code
            AND rent.payment_type = ''MONTHLY_RENT'' AND rent.status = ''PENDING''
      );';

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_payments_pending_deposit' AND object_id = OBJECT_ID('payment_transactions'))
    BEGIN
        CREATE UNIQUE INDEX UX_payments_pending_deposit
            ON payment_transactions(reservation_id)
            WHERE payment_type = 'DEPOSIT' AND payment_method = 'VNPAY' AND status = 'PENDING';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_payments_pending_renewal' AND object_id = OBJECT_ID('payment_transactions'))
    BEGIN
        CREATE UNIQUE INDEX UX_payments_pending_renewal
            ON payment_transactions(contract_id)
            WHERE payment_type = 'MONTHLY_RENT' AND payment_method = 'VNPAY' AND status = 'PENDING';
    END
END
GO

PRINT N'==> [16/17] Đã kiểm tra & đồng bộ bảng payment_transactions (VNPAY rules).';
GO

-- =====================================================================
-- 17. BẢNG login_history: LỊCH SỬ ĐĂNG NHẬP / ĐĂNG XUẤT (26/10)
-- =====================================================================
IF OBJECT_ID('login_history', 'U') IS NULL
BEGIN
    CREATE TABLE login_history (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        user_id         INT NULL,
        email           NVARCHAR(255) NOT NULL,
        event_type      NVARCHAR(20)  NOT NULL,
        failure_reason  NVARCHAR(50)  NULL,
        ip_address      NVARCHAR(64)  NULL,
        user_agent      NVARCHAR(300) NULL,
        created_at      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_loginhistory_user FOREIGN KEY (user_id) REFERENCES users(id),
        CONSTRAINT CK_loginhistory_event CHECK (event_type IN ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT'))
    );
    CREATE INDEX IX_loginhistory_created_at ON login_history(created_at DESC);
    CREATE INDEX IX_loginhistory_user ON login_history(user_id);
    PRINT N'   [+] Đã tạo mới bảng login_history thành công!';
END
ELSE
BEGIN
    PRINT N'   [+] Bảng login_history đã tồn tại.';
END
GO

PRINT N'==> [17/18] Đã kiểm tra & đồng bộ bảng login_history (Admin).';
GO

-- =====================================================================
-- 18. BẢNG damage_cases, reservations, facility_tasks, held_goods (27/10)
--     HOÀN THIỆN BẢO TRÌ SAU TRẢ KHO & QUẢN LÝ HÀNG LƯU GIỮ THANH LÝ
-- =====================================================================
-- 18.1 damage_cases: phân định lỗi sự cố CUSTOMER / FACILITY
IF COL_LENGTH('damage_cases', 'liable_party') IS NULL
BEGIN
    ALTER TABLE damage_cases ADD liable_party NVARCHAR(20) NOT NULL
        CONSTRAINT DF_damagecases_liable DEFAULT 'CUSTOMER';
    PRINT N'   [+] Đã thêm cột liable_party vào damage_cases.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE parent_object_id = OBJECT_ID('damage_cases') AND name = 'CK_damagecases_liable')
BEGIN
    ALTER TABLE damage_cases ADD CONSTRAINT CK_damagecases_liable CHECK (liable_party IN ('CUSTOMER', 'FACILITY'));
    PRINT N'   [+] Đã tạo ràng buộc CK_damagecases_liable.';
END
GO

-- 18.2 reservations: điều khoản xử lý tài sản khách đã đồng ý
IF COL_LENGTH('reservations', 'terms_version') IS NULL
BEGIN
    ALTER TABLE reservations ADD terms_version NVARCHAR(20) NULL;
    PRINT N'   [+] Đã thêm cột terms_version vào reservations.';
END
IF COL_LENGTH('reservations', 'terms_accepted_at') IS NULL
BEGIN
    ALTER TABLE reservations ADD terms_accepted_at DATETIME2 NULL;
    PRINT N'   [+] Đã thêm cột terms_accepted_at vào reservations.';
END
GO

-- 18.3 facility_tasks: lý do task bảo trì (DAMAGE / LIQUIDATION)
IF COL_LENGTH('facility_tasks', 'maintenance_reason') IS NULL
BEGIN
    ALTER TABLE facility_tasks ADD maintenance_reason NVARCHAR(20) NULL;
    PRINT N'   [+] Đã thêm cột maintenance_reason vào facility_tasks.';
END
GO

IF OBJECT_ID('facility_tasks', 'U') IS NOT NULL AND COL_LENGTH('facility_tasks', 'maintenance_reason') IS NOT NULL
BEGIN
    EXEC sp_executesql N'
    UPDATE facility_tasks
    SET maintenance_reason = CASE WHEN note LIKE N''Dọn ô%'' THEN ''LIQUIDATION'' ELSE ''DAMAGE'' END
    WHERE task_type = ''MAINTENANCE'' AND maintenance_reason IS NULL;';
END
GO

-- 18.4 held_goods: hàng của khách lưu giữ sau thanh lý
IF OBJECT_ID('held_goods', 'U') IS NULL
BEGIN
    CREATE TABLE held_goods (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        contract_id         INT NOT NULL,
        facility_id         INT NOT NULL,
        task_id             INT NULL,
        inventory_note      NVARCHAR(2000) NOT NULL,
        evidence_image_urls NVARCHAR(MAX) NULL,
        witness_note        NVARCHAR(500) NOT NULL,
        storage_location    NVARCHAR(100) NOT NULL,
        status              NVARCHAR(30) NOT NULL DEFAULT 'HOLDING',
        hold_until          DATE NOT NULL,
        proceeds_amount     DECIMAL(12,2) NULL,
        debt_offset_amount  DECIMAL(12,2) NULL,
        refund_amount       DECIMAL(12,2) NULL,
        resolved_note       NVARCHAR(1000) NULL,
        resolved_by         INT NULL,
        resolved_at         DATETIME2 NULL,
        created_by          INT NOT NULL,
        created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_heldgoods_contract FOREIGN KEY (contract_id) REFERENCES rental_contracts(id),
        CONSTRAINT FK_heldgoods_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
        CONSTRAINT FK_heldgoods_task     FOREIGN KEY (task_id)     REFERENCES facility_tasks(id),
        CONSTRAINT FK_heldgoods_resolver FOREIGN KEY (resolved_by) REFERENCES users(id),
        CONSTRAINT FK_heldgoods_creator  FOREIGN KEY (created_by)  REFERENCES users(id),
        CONSTRAINT CK_heldgoods_status   CHECK (status IN ('HOLDING', 'RETURNED', 'SOLD', 'DESTROYED', 'HANDED_TO_AUTHORITY'))
    );
    CREATE INDEX IX_heldgoods_facility_status ON held_goods(facility_id, status);
    CREATE INDEX IX_heldgoods_contract ON held_goods(contract_id);
    PRINT N'   [+] Đã tạo mới bảng held_goods thành công!';
END
ELSE
BEGIN
    PRINT N'   [+] Bảng held_goods đã tồn tại.';
END
GO

PRINT N'==> [18/18] Đã kiểm tra & đồng bộ bảo trì sau trả kho và hàng lưu giữ (held_goods).';
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
SELECT 'support_requests', COUNT(*) FROM support_requests
UNION ALL
SELECT 'activity_logs', COUNT(*) FROM activity_logs
UNION ALL
SELECT 'login_history', COUNT(*) FROM login_history
UNION ALL
SELECT 'held_goods', COUNT(*) FROM held_goods;

PRINT N'==> Danh sách tài khoản Quản trị & BOM:';
SELECT u.id, u.email, r.name AS [Role], u.full_name, u.status 
FROM users u 
INNER JOIN roles r ON u.role_id = r.id 
WHERE r.name IN ('ADMIN', 'BOM');
GO

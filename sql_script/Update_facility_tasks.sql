USE QueenKhoDB;
GO

/* =========================================================================
   BƯỚC 1: NẾU ĐANG CÓ BẢNG CŨ 'staff_tasks' -> ĐỔI TÊN SANG 'facility_tasks'
   ========================================================================= */
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'staff_tasks') 
   AND NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'facility_tasks')
BEGIN
    EXEC sp_rename 'staff_tasks', 'facility_tasks';
    PRINT N'==> [1] Đã ĐỔI TÊN bảng staff_tasks thành facility_tasks thành công (Giữ nguyên dữ liệu cũ).';
END
GO

/* =========================================================================
   BƯỚC 2: NẾU CHƯA CÓ BẢNG facility_tasks -> TẠO MỚI HOÀN CHỈNH
   ========================================================================= */
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'facility_tasks')
BEGIN
    CREATE TABLE facility_tasks (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        facility_id         INT NOT NULL,
        task_type           NVARCHAR(50) NOT NULL,                -- CHECK_IN, CHECK_OUT, SUPPORT, REFUND, MAINTENANCE...
        contract_id         INT NULL,                             -- Bắt buộc với CHECK_IN / CHECK_OUT
        support_request_id  INT NULL,                             -- Bắt buộc với SUPPORT
        status              NVARCHAR(30) NOT NULL DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, OVERDUE, COMPLETED, CANCELLED
        staff_id            INT NULL,                             -- ID người phụ trách (Lưu ID của Staff hoặc ID của Facility Manager)
        due_at              DATETIME2(7) NOT NULL,                -- Deadline hoàn thành (Hạn 24h đối với task Refund)
        evidence_image_url  NVARCHAR(1000) NULL,                  -- Ảnh bằng chứng chuyển khoản / nghiệm thu
        note                NVARCHAR(1000) NULL,                  -- Chi tiết STK, thông tin hoàn cọc
        created_at          DATETIME2(7) NOT NULL DEFAULT SYSDATETIME(),
        claimed_at          DATETIME2(7) NULL,
        completed_at        DATETIME2(7) NULL,
        CONSTRAINT FK_facilitytasks_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
        CONSTRAINT FK_facilitytasks_contract FOREIGN KEY (contract_id) REFERENCES rental_contracts(id),
        CONSTRAINT FK_facilitytasks_support  FOREIGN KEY (support_request_id) REFERENCES support_requests(id),
        CONSTRAINT FK_facilitytasks_user     FOREIGN KEY (staff_id)    REFERENCES users(id),
        
        -- Cho phép loại task REFUND
        CONSTRAINT CK_facilitytasks_type     CHECK (task_type IN ('CHECK_IN', 'CHECK_OUT', 'SUPPORT', 'REFUND', 'MAINTENANCE')),
        CONSTRAINT CK_facilitytasks_status   CHECK (status IN ('OPEN', 'IN_PROGRESS', 'OVERDUE', 'COMPLETED', 'CANCELLED')),
        
        -- Task REFUND không bắt buộc contract_id hay support_request_id
        CONSTRAINT CK_facilitytasks_target   CHECK (
            (task_type IN ('CHECK_IN', 'CHECK_OUT') AND contract_id IS NOT NULL)
            OR (task_type = 'SUPPORT' AND support_request_id IS NOT NULL)
            OR (task_type IN ('REFUND', 'MAINTENANCE'))
        )
    );

    CREATE INDEX IX_facilitytasks_facility_status ON facility_tasks(facility_id, status);
    CREATE INDEX IX_facilitytasks_staff           ON facility_tasks(staff_id);

    PRINT N'==> [2] Đã TẠO MỚI bảng facility_tasks hoàn chỉnh!';
END
ELSE
/* =========================================================================
   BƯỚC 3: NẾU ĐÃ CÓ BẢNG facility_tasks -> KIỂM TRA & CẬP NHẬT CỘT / CONSTRAINT
   ========================================================================= */
BEGIN
    PRINT N'==> Bảng facility_tasks đã tồn tại. Đang kiểm tra cấu trúc...';

    -- 3.1. Thêm cột evidence_image_url nếu thiếu
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('facility_tasks') AND name = 'evidence_image_url')
    BEGIN
        ALTER TABLE facility_tasks ADD evidence_image_url NVARCHAR(1000) NULL;
        PRINT N'   [+] Đã thêm cột evidence_image_url.';
    END

    -- 3.2. Cập nhật Ràng buộc Type cho phép REFUND
    IF EXISTS (SELECT * FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('facility_tasks') AND name LIKE '%tasks_type%')
    BEGIN
        DECLARE @dropTypeSql NVARCHAR(500);
        SELECT @dropTypeSql = 'ALTER TABLE facility_tasks DROP CONSTRAINT ' + name FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('facility_tasks') AND name LIKE '%tasks_type%';
        EXEC sp_executesql @dropTypeSql;
    END
    ALTER TABLE facility_tasks ADD CONSTRAINT CK_facilitytasks_type 
        CHECK (task_type IN ('CHECK_IN', 'CHECK_OUT', 'SUPPORT', 'REFUND', 'MAINTENANCE'));
    PRINT N'   [+] Đã cập nhật ràng buộc loại task: Hỗ trợ REFUND.';

    -- 3.3. Cập nhật Ràng buộc Target (REFUND không bắt buộc contract_id)
    IF EXISTS (SELECT * FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('facility_tasks') AND name LIKE '%tasks_target%')
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
    PRINT N'   [+] Đã cập nhật ràng buộc đối tượng: Hỗ trợ REFUND tự do.';

    PRINT N'==> [3] Hoàn tất đồng bộ bảng facility_tasks!';
END
GO

-- Kiểm tra lại các cột
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'facility_tasks';
GO

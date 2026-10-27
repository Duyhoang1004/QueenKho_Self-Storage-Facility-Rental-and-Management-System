USE QueenKhoDB;
GO

-- 1. KIỂM TRA: NẾU BẢNG CHƯA TỒN TẠI THÌ TẠO MỚI
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'staff_tasks')
BEGIN
    CREATE TABLE staff_tasks (
        id INT IDENTITY(1,1) PRIMARY KEY,
        facility_id INT NOT NULL,
        task_type NVARCHAR(50) NOT NULL,                    -- CHECK_IN, CHECK_OUT, REFUND, MAINTENANCE,...
        contract_id INT NULL,
        support_request_id INT NULL,
        status NVARCHAR(30) NOT NULL DEFAULT 'PENDING',     -- PENDING, IN_PROGRESS, COMPLETED, CANCELLED
        staff_id INT NULL,                                  -- Nhân viên được phân công
        
        -- Field 1: Deadline hoàn thành task (Ví dụ: sau 24h đối với task hoàn cọc)
        due_at DATETIME2(7) NULL,
        
        -- Field 2: Link ảnh bằng chứng nhân viên upload khi hoàn thành
        evidence_image_url NVARCHAR(MAX) NULL,
        
        note NVARCHAR(1000) NULL,
        created_at DATETIME2(7) NOT NULL DEFAULT SYSDATETIME(),
        claimed_at DATETIME2(7) NULL,                       -- Thời điểm nhân viên nhận việc
        completed_at DATETIME2(7) NULL                      -- Thời điểm hoàn thành task
    );
    PRINT N'==> Đã TẠO MỚI bảng staff_tasks thành công!';
END
ELSE
BEGIN
    PRINT N'==> Bảng staff_tasks đã tồn tại. Đang kiểm tra để cập nhật cột...';

    -- 2. KIỂM TRA & BỔ SUNG CỘT ẢNH BẰNG CHỨNG (NẾU CHƯA CÓ)
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('staff_tasks') AND name = 'evidence_image_url')
    BEGIN
        ALTER TABLE staff_tasks ADD evidence_image_url NVARCHAR(MAX) NULL;
        PRINT N'   + Đã thêm cột evidence_image_url (Ảnh bằng chứng).';
    END

    -- 3. KIỂM TRA & BỔ SUNG CỘT DEADLINE (NẾU CHƯA CÓ)
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('staff_tasks') AND name = 'due_at')
    BEGIN
        ALTER TABLE staff_tasks ADD due_at DATETIME2(7) NULL;
        PRINT N'   + Đã thêm cột due_at (Hạn chót / Deadline hoàn thành).';
    END
END
GO

-- 4. KIỂM TRA LẠI CẤU TRÚC BẢNG SAU KHI CHẠY
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    CHARACTER_MAXIMUM_LENGTH, 
    IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'staff_tasks';
GO
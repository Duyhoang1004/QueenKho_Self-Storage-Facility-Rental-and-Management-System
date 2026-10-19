USE QueenKhoDB;
GO

/* =========================================================================
   UC-28 SETUP SCRIPT: TÀI KHOẢN HỆ THỐNG & ĐỒNG BỘ TRIGGER HOÀN TIỀN
   - 1. Đồng bộ tên bảng: đổi staff_tasks -> facility_tasks (theo PR #55 / business-rules)
   - 2. Tạo tài khoản hệ thống 'system' (role ADMIN, status DISABLED, password hash vô hiệu)
   - 3. Cập nhật Trigger trg_facility_tasks_refund_sync để bảo vệ trạng thái LIQUIDATED
   ========================================================================= */

-- 1. ĐỒNG BỘ TÊN BẢNG THEO PR #55 (Nếu database local vẫn còn mang tên cũ staff_tasks)
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'staff_tasks')
   AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'facility_tasks')
BEGIN
    EXEC sp_rename 'staff_tasks', 'facility_tasks';
    PRINT N'==> [UC-28 Setup] Đã đổi tên bảng staff_tasks thành facility_tasks theo PR #55!';
END
ELSE
BEGIN
    PRINT N'==> [UC-28 Setup] Bảng facility_tasks đã sẵn sàng.';
END
GO

-- 2. TẠO USER SYSTEM PHỤC VỤ LOG TỰ ĐỘNG CỦA JOB (PR-A8)
IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'system@queenkho.com')
BEGIN
    DECLARE @adminRoleId INT;
    SELECT TOP 1 @adminRoleId = id FROM roles WHERE name = 'ADMIN';

    INSERT INTO users (facility_id, role_id, email, password_hash, full_name, phone, cccd, status, created_at)
    VALUES (
        NULL,
        @adminRoleId,
        'system@queenkho.com',
        '!DISABLED_SYSTEM_ACCOUNT!_NO_LOGIN_ALLOWED',
        N'Hệ Thống QueenKho',
        '0000000000',
        NULL,
        'DISABLED',
        SYSDATETIME()
    );

    PRINT N'==> [UC-28 Setup] Đã tạo thành công tài khoản system (ID: ' + CAST(SCOPE_IDENTITY() AS NVARCHAR(20)) + N')';
END
ELSE
BEGIN
    PRINT N'==> [UC-28 Setup] Tài khoản system@queenkho.com đã tồn tại, bỏ qua bước tạo mới.';
END
GO

-- 3. CẬP NHẬT TRIGGER ĐỒNG BỘ TASK REFUND CHO HỢP ĐỒNG LIQUIDATED (GĐ1 / PR-Q9)
CREATE OR ALTER TRIGGER trg_facility_tasks_refund_sync
ON facility_tasks
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- 2.1. Hoàn cọc khi trả kho / thanh lý (có gắn contract_id):
    -- Nếu hợp đồng đang là LIQUIDATED: giữ nguyên status LIQUIDATED, chỉ đưa deposit_held_amount = 0
    -- Nếu hợp đồng khác: chuyển status = 'TERMINATED' và đưa deposit_held_amount = 0
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
      
    -- 2.2. Hoàn cọc khi khách hủy giữ chỗ: Cập nhật đơn đặt chỗ thành REFUNDED (GIỮ NGUYÊN)
    UPDATE r
    SET r.status = 'REFUNDED'
    FROM reservations r
    INNER JOIN inserted i ON (
        i.note LIKE '%' + r.reservation_code + '%'
    )
    WHERE i.task_type = 'REFUND' 
      AND i.status = 'COMPLETED'
      AND r.status <> 'REFUNDED';
      
    -- 2.3. Cập nhật bản ghi thanh toán hoàn cọc thành SUCCESS nếu còn PENDING (GIỮ NGUYÊN)
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

PRINT N'==> [UC-28 Setup] Đã cập nhật thành công Trigger trg_facility_tasks_refund_sync an toàn cho hợp đồng LIQUIDATED!';
GO

-- 4. TRUY VẤN KIỂM TRA KẾT QUẢ
SELECT id, email, status FROM users WHERE email = 'system@queenkho.com';
SELECT CASE WHEN OBJECT_DEFINITION(OBJECT_ID('trg_facility_tasks_refund_sync')) LIKE '%LIQUIDATED%'
            THEN N'Trigger đã cập nhật' ELSE N'Trigger CHƯA cập nhật' END AS ket_qua;
GO
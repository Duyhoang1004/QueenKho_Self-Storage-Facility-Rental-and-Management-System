USE QueenKhoDB;
GO

/* =========================================================================
   TRIGGER TỰ ĐỘNG ĐỒNG BỘ TRẠNG THÁI HOÀN TIỀN CỌC (UC-15, UC-22, UC-25)
   ========================================================================= */

-- 1. Trigger đồng bộ đơn đặt chỗ khi giao dịch hoàn tiền thành công
CREATE OR ALTER TRIGGER trg_payment_transactions_refund_sync
ON payment_transactions
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Khi có giao dịch hoàn tiền REFUND thành công -> Đổi đơn đặt chỗ thành REFUNDED
    UPDATE r
    SET r.status = 'REFUNDED'
    FROM reservations r
    INNER JOIN inserted i ON r.id = i.reservation_id
    WHERE i.payment_type = 'REFUND' 
      AND i.status = 'SUCCESS'
      AND r.status <> 'REFUNDED';
END;
GO

-- 2. Trigger đồng bộ hợp đồng & đơn đặt khi Quản lý hoàn thành task hoàn cọc (COMPLETED)
CREATE OR ALTER TRIGGER trg_facility_tasks_refund_sync
ON facility_tasks
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- 2.1. Hoàn cọc khi trả kho (có gắn hợp đồng): Cập nhật hợp đồng TERMINATED và cọc giữ về 0
    UPDATE c
    SET c.status = 'TERMINATED', c.deposit_held_amount = 0
    FROM rental_contracts c
    INNER JOIN inserted i ON c.id = i.contract_id
    WHERE i.task_type = 'REFUND' 
      AND i.status = 'COMPLETED'
      AND c.status <> 'TERMINATED';
      
    -- 2.2. Hoàn cọc khi khách hủy giữ chỗ: Cập nhật đơn đặt chỗ thành REFUNDED
    UPDATE r
    SET r.status = 'REFUNDED'
    FROM reservations r
    INNER JOIN inserted i ON (
        i.note LIKE '%' + r.reservation_code + '%'
    )
    WHERE i.task_type = 'REFUND' 
      AND i.status = 'COMPLETED'
      AND r.status <> 'REFUNDED';
      
    -- 2.3. Cập nhật bản ghi thanh toán hoàn cọc thành SUCCESS nếu còn PENDING
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

PRINT N'==> Đã tạo / cập nhật thành công 2 Trigger đồng bộ hoàn tiền cọc cho facility_tasks!';
GO
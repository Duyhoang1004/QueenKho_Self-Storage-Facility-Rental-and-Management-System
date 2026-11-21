/* ============================================================
   QueenKho — 21/11/2026 (D-23): tất toán chỉ xong khi khách đã nhận tiền hoàn
   Chạy được nhiều lần, chạy SAU Update_hoan_tien_chinh_sach_v6.sql. DB tạo mới từ QueenKho.sql / _full / _TongHop đã có sẵn.

   1. checkout_settlements.status thêm 2 bước (PR-O29):
        REFUNDING   : khách đã xác nhận quyết toán, chờ quản lý cơ sở chi tiền (task REFUND đang mở)
        REFUND_SENT : quản lý đã chi, chờ khách bấm "Đã nhận được" / "Chưa nhận được"
      Hợp đồng giữ SETTLEMENT_PENDING tới khi khách xác nhận đã nhận tiền → COMPLETED + TERMINATED.
   2. checkout_settlements.expected_net / scheduled_checkout_date: số tiền hoàn dự kiến khách thấy lúc hẹn trả kho
      để đối chiếu với số quyết toán (PR-O31).

   sqlcmd: sqlcmd -S localhost -U sa -P 12345 -I -f 65001 -i sql_script/Update_hoan_tien_tat_toan_d23.sql
   ============================================================ */

USE QueenKhoDB;
GO

/* ---------- 1. Trạng thái quyết toán mới ---------- */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_settlements_status'
           AND definition NOT LIKE '%REFUND_SENT%')
    ALTER TABLE checkout_settlements DROP CONSTRAINT CK_settlements_status;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_settlements_status')
    ALTER TABLE checkout_settlements ADD CONSTRAINT CK_settlements_status
        CHECK (status IN ('WAITING_CLAIM', 'WAITING_CUSTOMER', 'DISPUTED', 'RECHECKING',
                          'AWAITING_PAYMENT', 'REFUNDING', 'REFUND_SENT', 'COMPLETED', 'SUPERSEDED'));
GO

/* ---------- 2. Số tiền hoàn dự kiến lúc hẹn trả kho ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('checkout_settlements') AND name = 'expected_net')
    ALTER TABLE checkout_settlements ADD expected_net DECIMAL(15, 2) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('checkout_settlements') AND name = 'scheduled_checkout_date')
    ALTER TABLE checkout_settlements ADD scheduled_checkout_date DATE NULL;
GO

/* ---------- 3. Dữ liệu cũ: quyết toán đã COMPLETED nhưng tiền hoàn chưa tới tay khách → đưa về luồng mới ---------- */
-- Task hoàn chưa xong (hoặc khách báo chưa nhận) → REFUNDING; đã chi, chờ khách xác nhận → REFUND_SENT.
-- Hợp đồng quay lại SETTLEMENT_PENDING; khách xác nhận đã nhận (hoặc job 3 ngày) sẽ kết thúc lại.
UPDATE c SET c.status = 'SETTLEMENT_PENDING'
FROM rental_contracts c
JOIN checkout_settlements s ON s.contract_id = c.id
JOIN facility_tasks t ON t.id = s.refund_task_id
WHERE s.status = 'COMPLETED' AND c.status = 'TERMINATED'
  AND (t.status <> 'COMPLETED' OR t.receipt_status IN ('WAITING_CUSTOMER', 'DISPUTED'));

UPDATE s SET s.status = CASE WHEN t.status = 'COMPLETED' AND t.receipt_status = 'WAITING_CUSTOMER' THEN 'REFUND_SENT' ELSE 'REFUNDING' END,
             s.updated_at = SYSDATETIME()
FROM checkout_settlements s
JOIN facility_tasks t ON t.id = s.refund_task_id
WHERE s.status = 'COMPLETED'
  AND (t.status <> 'COMPLETED' OR t.receipt_status IN ('WAITING_CUSTOMER', 'DISPUTED'));
GO

PRINT N'==> [D-23] Đã thêm trạng thái REFUNDING / REFUND_SENT và số tiền hoàn dự kiến cho quyết toán trả kho.';
GO

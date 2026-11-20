/* ============================================================
   QueenKho — 20/11/2026 (D-22): bảng "Đã đóng − Giữ lại = Hoàn", khách xác nhận đã nhận tiền hoàn, điều khoản v6
   Chạy được nhiều lần, chạy SAU Update_tat_toan_tra_kho.sql. DB tạo mới từ QueenKho.sql / _full / _TongHop đã có sẵn.

   1. checkout_settlements.rent_basis : JSON phần tiền thuê / bảo hiểm của kỳ hiện tại lúc nghiệm thu
                                        (để bảng quyết toán hiện cùng bố cục với màn hẹn trả kho — PR-O19)
   2. facility_tasks (task REFUND)    : khách xác nhận đã nhận tiền hoàn (PR-O25 → PR-O27)

   sqlcmd: sqlcmd -S localhost -U sa -P 12345 -I -f 65001 -i sql_script/Update_hoan_tien_chinh_sach_v6.sql
   ============================================================ */

USE QueenKhoDB;
GO

/* ---------- 1. checkout_settlements.rent_basis ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('checkout_settlements') AND name = 'rent_basis')
    ALTER TABLE checkout_settlements ADD rent_basis NVARCHAR(1000) NULL;
GO

/* ---------- 2. facility_tasks: xác nhận đã nhận tiền hoàn ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('facility_tasks') AND name = 'customer_id')
    ALTER TABLE facility_tasks ADD customer_id INT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('facility_tasks') AND name = 'refund_amount')
    ALTER TABLE facility_tasks ADD refund_amount DECIMAL(15, 2) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('facility_tasks') AND name = 'receipt_status')
    ALTER TABLE facility_tasks ADD receipt_status NVARCHAR(20) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('facility_tasks') AND name = 'receipt_confirmed_at')
    ALTER TABLE facility_tasks ADD receipt_confirmed_at DATETIME2 NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('facility_tasks') AND name = 'receipt_auto_confirmed')
    ALTER TABLE facility_tasks ADD receipt_auto_confirmed BIT NOT NULL CONSTRAINT DF_facilitytasks_receipt_auto DEFAULT 0;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('facility_tasks') AND name = 'receipt_dispute_reason')
    ALTER TABLE facility_tasks ADD receipt_dispute_reason NVARCHAR(500) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('facility_tasks') AND name = 'receipt_disputed_at')
    ALTER TABLE facility_tasks ADD receipt_disputed_at DATETIME2 NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('facility_tasks') AND name = 'receipt_round')
    ALTER TABLE facility_tasks ADD receipt_round INT NOT NULL CONSTRAINT DF_facilitytasks_receipt_round DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_facilitytasks_customer')
    ALTER TABLE facility_tasks ADD CONSTRAINT FK_facilitytasks_customer FOREIGN KEY (customer_id) REFERENCES users(id);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_facilitytasks_receipt')
    ALTER TABLE facility_tasks ADD CONSTRAINT CK_facilitytasks_receipt
        CHECK (receipt_status IS NULL OR receipt_status IN ('WAITING_CUSTOMER', 'CONFIRMED', 'AUTO_CONFIRMED', 'DISPUTED'));
GO

PRINT N'==> [D-22] Đã thêm rent_basis cho quyết toán và các cột xác nhận đã nhận tiền hoàn cho facility_tasks.';
GO

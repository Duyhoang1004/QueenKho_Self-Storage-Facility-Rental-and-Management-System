/* ============================================================
   QueenKho — 24/11/2026: góp ý test (bồi thường chi riêng cần tài khoản khách)
   Chạy được nhiều lần, chạy SAU Update_kho_tong_theo_thanh_pho.sql. DB tạo mới từ QueenKho.sql / _full / _TongHop đã có sẵn.

   1. compensation_claims.payout_bank_name / payout_account_number / payout_account_name / payout_account_updated_at
      — khách nhập tài khoản nhận tiền bồi thường; FM chi chuyển khoản phải có (BR-128a)
   2. facility_tasks.simulated_checkout_date — nút demo "Khách tới trả đúng ngày hẹn": giữ ngày hẹn gốc,
      nghiệm thu chốt quyết toán theo ngày này thay vì ngày hôm nay (PR-O31a)

   sqlcmd: sqlcmd -S localhost -U sa -P 12345 -I -f 65001 -i sql_script/Update_gop_y_test_24_11.sql
   ============================================================ */

USE QueenKhoDB;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('compensation_claims') AND name = 'payout_account_number')
    ALTER TABLE compensation_claims ADD payout_bank_name NVARCHAR(100) NULL, payout_account_number VARCHAR(30) NULL,
        payout_account_name NVARCHAR(100) NULL, payout_account_updated_at DATETIME2 NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('facility_tasks') AND name = 'simulated_checkout_date')
    ALTER TABLE facility_tasks ADD simulated_checkout_date DATE NULL;
GO

PRINT N'==> [BR-128a] Đã thêm tài khoản nhận tiền bồi thường (compensation_claims) + ngày hẹn giả lập (facility_tasks).';
GO

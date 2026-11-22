/* ============================================================
   QueenKho — 22/11/2026: sửa lỗi sau buổi test (D-24)
   Chạy được nhiều lần, chạy SAU Update_hoan_tien_tat_toan_d23.sql. DB tạo mới từ QueenKho.sql / _full / _TongHop đã có sẵn.

   1. facility_tasks.cancel_reason      : lý do task bị huỷ (khách huỷ đơn, khách huỷ yêu cầu hỗ trợ) — PR-T2
   2. reservations.penalty_anchor_time  : giờ hẹn gốc trước khi nút giả lập dời lịch — mốc tính phí huỷ đơn (PR-X4)

   sqlcmd: sqlcmd -S localhost -U sa -P 12345 -I -f 65001 -i sql_script/Update_gop_y_test_22_11.sql
   ============================================================ */

USE QueenKhoDB;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('facility_tasks') AND name = 'cancel_reason')
    ALTER TABLE facility_tasks ADD cancel_reason NVARCHAR(300) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('reservations') AND name = 'penalty_anchor_time')
    ALTER TABLE reservations ADD penalty_anchor_time DATETIME2 NULL;
GO

PRINT N'==> [D-24] Đã thêm facility_tasks.cancel_reason và reservations.penalty_anchor_time.';
GO

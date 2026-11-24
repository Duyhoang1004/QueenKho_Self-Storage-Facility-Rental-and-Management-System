/* ============================================================
   QueenKho — 23/11/2026: kho tổng theo thành phố (BR-134a)
   Chạy được nhiều lần, chạy SAU Update_gop_y_test_22_11.sql. DB tạo mới từ QueenKho.sql / _full / _TongHop đã có sẵn.

   1. central_warehouses.city : thành phố kho tổng phụ trách (khớp facilities.city).
      Cơ sở dùng kho tổng đang hoạt động cùng thành phố làm kho mặc định khi cưỡng chế dọn kho.
   2. Kho tổng cũ (TP.HCM) gán city = TP.HCM; thêm kho tổng Hà Nội cho cơ sở Cầu Giấy.

   sqlcmd: sqlcmd -S localhost -U sa -P 12345 -I -f 65001 -i sql_script/Update_kho_tong_theo_thanh_pho.sql
   ============================================================ */

USE QueenKhoDB;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('central_warehouses') AND name = 'city')
    ALTER TABLE central_warehouses ADD city NVARCHAR(100) NULL;
GO

UPDATE central_warehouses SET city = N'TP.HCM'
WHERE city IS NULL AND address LIKE N'%TP.HCM%';
GO

IF NOT EXISTS (SELECT 1 FROM central_warehouses WHERE city = N'Hà Nội')
    INSERT INTO central_warehouses (name, address, hotline, note, city) VALUES
    (N'Kho tổng QueenKho Hà Nội', N'Lô CN5, KCN Nam Thăng Long, P. Thụy Phương, Q. Bắc Từ Liêm, Hà Nội', N'0241234567',
     N'Giữ hàng của khách quá hạn hợp đồng — không bán, khách đến nhận lại sau khi thanh toán', N'Hà Nội');
GO

PRINT N'==> [BR-134a] Kho tổng đã có thành phố phụ trách (TP.HCM, Hà Nội).';
GO

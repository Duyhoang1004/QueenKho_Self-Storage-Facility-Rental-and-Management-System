/* ============================================================
   QueenKho — Góp ý sau test product (12/11/2026, chạy được nhiều lần)
   DB tạo mới từ QueenKho_full.sql / QueenKho_TongHop.sql đã có sẵn 2 cột dưới, chỉ cần phần 3 (ô khẩn cấp mẫu).

   1. storage_units.is_emergency      : ô kho khẩn cấp (BR-140) — không bán, không tính vào suất trống,
                                         chỉ dùng khi ô của khách gặp sự cố mà hết ô cùng loại. Rảnh = status 'EMERGENCY'.
   2. rental_contracts.overstay_fee_waived : FM / BOM khi miễn phí trễ chọn miễn luôn phí chiếm dụng (PR-Q14 sửa 12/11)
   3. Mỗi cơ sở 1 ô khẩn cấp mẫu "Kho Gia Đình" (zone E) — FM tự đặt lên mặt bằng

   sqlcmd: sqlcmd -S localhost -U sa -P 12345 -I -f 65001 -i sql_script/Update_gop_y_product_12_11.sql
   ============================================================ */

USE QueenKhoDB;
GO

/* ---------- 1. storage_units.is_emergency ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('storage_units') AND name = 'is_emergency')
    ALTER TABLE storage_units ADD is_emergency BIT NOT NULL CONSTRAINT DF_storageunits_emergency DEFAULT 0;
GO

/* ---------- 2. rental_contracts.overstay_fee_waived ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('rental_contracts') AND name = 'overstay_fee_waived')
    ALTER TABLE rental_contracts ADD overstay_fee_waived BIT NOT NULL CONSTRAINT DF_contracts_overstay_waived DEFAULT 0;
GO

/* ---------- 3. Ô khẩn cấp mẫu: mỗi cơ sở đang hoạt động 1 ô "Kho Gia Đình" (unit_type 3) ---------- */
INSERT INTO storage_units (id, facility_id, unit_type_id, floor, zone, room_number, status, is_emergency)
SELECT 'KC-' + f.code + '-E01', f.id, 3, N'Tầng 1', 'E', 'E01', 'EMERGENCY', 1
FROM facilities f
WHERE f.code IS NOT NULL
  AND EXISTS (SELECT 1 FROM unit_types WHERE id = 3)
  AND NOT EXISTS (SELECT 1 FROM storage_units su WHERE su.facility_id = f.id AND su.is_emergency = 1)
  AND NOT EXISTS (SELECT 1 FROM storage_units su WHERE su.id = 'KC-' + f.code + '-E01');
GO

PRINT N'==> Update_gop_y_product_12_11.sql: đã thêm is_emergency, overstay_fee_waived và ô khẩn cấp mẫu.';
GO

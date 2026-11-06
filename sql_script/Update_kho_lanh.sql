/* ============================================================
   QueenKho — Kho lạnh / kho đông (06/11/2026, chạy được nhiều lần)
   Dùng cho DB đang có dữ liệu; DB tạo mới từ QueenKho_full.sql / QueenKho_TongHop.sql đã có sẵn.
   Chạy SAU Update_hop_nhom_05_11.sql (cần cột unit_types.temperature_class).

   1. unit_types    : "Kho Lạnh 6m²" (COLD, 0–8°C) + "Kho Đông 4m²" (FROZEN, -25 → -15°C) — BR-131
   2. storage_units : mỗi cơ sở 1 ô kho lạnh + 1 ô kho đông (Tân Bình thêm 1 ô lạnh), zone L
   3. Mặt bằng      : dãy L dưới "Lối đi C" (y = 34), cửa quay lên (TOP) — chỉ đặt khi ô chưa có vị trí

   sqlcmd: sqlcmd -S localhost -U sa -P 12345 -I -f 65001 -i sql_script/Update_kho_lanh.sql
   ============================================================ */

USE QueenKhoDB;
GO

/* ---------- 1. unit_types ---------- */
IF NOT EXISTS (SELECT 1 FROM unit_types WHERE name = N'Kho Lạnh 6m²')
    INSERT INTO unit_types (name, area_sqm, volume_cbm, base_price_monthly, suggested_capacity, dimensions, features, temperature_class)
    VALUES (N'Kho Lạnh 6m²', 6.0, 15.0, 2900000, N'Thực phẩm, đồ uống, nông sản đóng thùng',
            N'2.0m × 3.0m × 2.5m', N'Giữ 0–8°C, độ ẩm ≤ 90%, cảm biến nhiệt độ 24/7 — gửi được thực phẩm', 'COLD');
GO
IF NOT EXISTS (SELECT 1 FROM unit_types WHERE name = N'Kho Đông 4m²')
    INSERT INTO unit_types (name, area_sqm, volume_cbm, base_price_monthly, suggested_capacity, dimensions, features, temperature_class)
    VALUES (N'Kho Đông 4m²', 4.0, 9.6, 2600000, N'Thực phẩm đông lạnh, thịt cá, hải sản',
            N'2.0m × 2.0m × 2.4m', N'Giữ -25 → -15°C, cảm biến nhiệt độ 24/7 — gửi được thực phẩm đông lạnh', 'FROZEN');
GO

/* ---------- 2. storage_units ---------- */
DECLARE @cold INT = (SELECT id FROM unit_types WHERE name = N'Kho Lạnh 6m²');
DECLARE @frozen INT = (SELECT id FROM unit_types WHERE name = N'Kho Đông 4m²');

INSERT INTO storage_units (id, facility_id, unit_type_id, floor, zone, room_number, status)
SELECT s.code, f.id, CASE s.kind WHEN 'COLD' THEN @cold ELSE @frozen END, N'Tầng 1', 'L', RIGHT(s.code, 3), 'AVAILABLE'
FROM (VALUES
    ('KV-TB-L101', 'TB', 'COLD'), ('KV-TB-L102', 'TB', 'COLD'), ('KV-TB-L103', 'TB', 'FROZEN'),
    ('KV-BT-L101', 'BT', 'COLD'), ('KV-BT-L102', 'BT', 'FROZEN'),
    ('KV-TD-L101', 'TD', 'COLD'), ('KV-TD-L102', 'TD', 'FROZEN'),
    ('KV-GV-L101', 'GV', 'COLD'), ('KV-GV-L102', 'GV', 'FROZEN'),
    ('KV-CG-L101', 'CG', 'COLD'), ('KV-CG-L102', 'CG', 'FROZEN'),
    ('KV-Q7-L101', 'Q7', 'COLD'), ('KV-Q7-L102', 'Q7', 'FROZEN')
) AS s(code, facility_code, kind)
JOIN facilities f ON f.code = s.facility_code
WHERE NOT EXISTS (SELECT 1 FROM storage_units su WHERE su.id = s.code);
GO

/* ---------- 3. Vị trí trên mặt bằng (UC-06): Kho Lạnh 4×6 ô lưới (2m × 3m), Kho Đông 4×4 (2m × 2m) ---------- */
UPDATE su
SET su.map_x = p.x, su.map_y = p.y, su.map_w = p.w, su.map_h = p.h, su.map_door = 'TOP'
FROM storage_units su
JOIN (VALUES
    ('KV-TB-L101', 12, 34, 4, 6), ('KV-TB-L102', 16, 34, 4, 6), ('KV-TB-L103', 20, 34, 4, 4),
    ('KV-BT-L101', 12, 34, 4, 6), ('KV-BT-L102', 16, 34, 4, 4),
    ('KV-TD-L101', 12, 34, 4, 6), ('KV-TD-L102', 16, 34, 4, 4),
    ('KV-GV-L101', 12, 34, 4, 6), ('KV-GV-L102', 16, 34, 4, 4),
    ('KV-CG-L101', 12, 34, 4, 6), ('KV-CG-L102', 16, 34, 4, 4),
    ('KV-Q7-L101', 12, 34, 4, 6), ('KV-Q7-L102', 16, 34, 4, 4)
) AS p(id, x, y, w, h) ON p.id = su.id
WHERE su.map_x IS NULL;
GO

PRINT N'Đã cập nhật: loại kho lạnh / kho đông + ô kho lạnh ở mỗi cơ sở';
GO

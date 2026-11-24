/* ============================================================
   QueenKho — 24/11/2026: mặt bằng đủ 4 tầng cho mọi cơ sở (góp ý test, UC-06)
   Trước đây chỉ Tân Bình có 4 tầng; 5 cơ sở còn lại chỉ có Tầng 1, ~51 ô / cơ sở ở Tầng 2–3 chưa đặt lên sơ đồ,
   mỗi tầng trộn 7–9 loại kho; Tân Bình Tầng 3 lại đảo chỗ thang máy / thang bộ.

   Script này DỰNG LẠI mặt bằng của mọi cơ sở (ghi đè vị trí FM đã kéo trên sơ đồ):
     - 4 tầng "Tầng 1".."Tầng 4", lưới 56 × 40 (ô lưới 0,5m), thiếu tầng nào thì tạo.
     - Mọi tầng: Thang bộ (0,0,8×6) + Thang máy (0,6,8×5) CÙNG VỊ TRÍ, lối đi chính dọc (8,0,4×40).
       Tầng 1 thêm Quầy lễ tân (0,28,8×8) + Cửa chính (0,36,8×4).
     - Mỗi tầng 2 loại kho:
         Tầng 1  Kho Lớn (8×8)        + Kho Đặc Biệt XL (10×10)   hàng to, gần cửa chính
         Tầng 2  Kho Lạnh 6m² (4×6)   + Kho Đông 4m² (4×4)        cần điện / cách nhiệt, gần thang máy
         Tầng 3  Kho Gia Đình (8×6)   + Kho Tiêu Chuẩn (5×5)
         Tầng 4  Kho Mini M (3×5)     + Kho nhỏ 2m² (2×4)
     - Ô xếp theo dãy từ x = 12, 2 dãy quay cửa vào 1 lối đi ngang (cửa dãy chẵn hướng xuống, dãy lẻ hướng lên).
       Ô không còn chỗ trong lưới 40 dòng thì đổi tầng nhưng để chưa đặt lên sơ đồ (FM kéo tay).
   Mã ô (KV-TB-A101...) GIỮ NGUYÊN vì đang gắn với hợp đồng / đơn — chỉ đổi cột floor + vị trí trên sơ đồ.
   Chạy lại được nhiều lần (kết quả như nhau). Chạy SAU Update_kho_tong_theo_thanh_pho.sql.

   sqlcmd: sqlcmd -S localhost -U sa -P 12345 -I -f 65001 -i sql_script/Update_mat_bang_4_tang.sql
   ============================================================ */

USE QueenKhoDB;
GO

SET NOCOUNT ON;

/* ---------- 0. Kế hoạch: loại kho → tầng, thứ tự trên tầng, kích thước ô trên lưới ---------- */
IF OBJECT_ID('tempdb..#plan') IS NOT NULL DROP TABLE #plan;
CREATE TABLE #plan (unit_type_id INT PRIMARY KEY, floor_no INT, ord INT, w INT, h INT);
INSERT INTO #plan (unit_type_id, floor_no, ord, w, h) VALUES
    (4, 1, 1, 8, 8),    -- Kho Lớn
    (5, 1, 2, 10, 10),  -- Kho Đặc Biệt XL
    (7, 2, 1, 4, 6),    -- Kho Lạnh 6m²
    (8, 2, 2, 4, 4),    -- Kho Đông 4m²
    (3, 3, 1, 8, 6),    -- Kho Gia Đình
    (2, 3, 2, 5, 5),    -- Kho Tiêu Chuẩn
    (1, 4, 1, 3, 5),    -- Kho Mini M
    (6, 4, 2, 2, 4);    -- Kho nhỏ 2m²

DECLARE @left INT = 12, @usable INT = 44, @gridH INT = 40, @aisle INT = 4;

/* ---------- 1. Đủ 4 tầng cho mọi cơ sở ---------- */
INSERT INTO facility_floors (facility_id, name, grid_width, grid_height, sort_order)
SELECT f.id, N'Tầng ' + CAST(n.n AS NVARCHAR(2)), 56, 40, n.n
FROM facilities f
CROSS JOIN (VALUES (1), (2), (3), (4)) n(n)
WHERE NOT EXISTS (SELECT 1 FROM facility_floors ff WHERE ff.facility_id = f.id AND ff.name = N'Tầng ' + CAST(n.n AS NVARCHAR(2)));

UPDATE ff SET grid_width = 56, grid_height = 40, sort_order = CAST(RIGHT(ff.name, 1) AS INT)
FROM facility_floors ff
WHERE ff.name IN (N'Tầng 1', N'Tầng 2', N'Tầng 3', N'Tầng 4');

/* ---------- 2. Vật cố định chuẩn (thang bộ / thang máy cùng vị trí mọi tầng) ---------- */
DELETE x FROM floor_fixtures x
JOIN facility_floors ff ON ff.id = x.floor_id
WHERE ff.name IN (N'Tầng 1', N'Tầng 2', N'Tầng 3', N'Tầng 4');

INSERT INTO floor_fixtures (floor_id, fixture_type, label, map_x, map_y, map_w, map_h)
SELECT ff.id, v.fixture_type, v.label, v.x, v.y, v.w, v.h
FROM facility_floors ff
CROSS JOIN (VALUES
    ('STAIRS',   N'Thang bộ',     0, 0, 8, 6),
    ('ELEVATOR', N'Thang máy',    0, 6, 8, 5),
    ('AISLE',    N'Lối đi chính', 8, 0, 4, 40)
) v(fixture_type, label, x, y, w, h)
WHERE ff.name IN (N'Tầng 1', N'Tầng 2', N'Tầng 3', N'Tầng 4');

INSERT INTO floor_fixtures (floor_id, fixture_type, label, map_x, map_y, map_w, map_h)
SELECT ff.id, v.fixture_type, v.label, v.x, v.y, v.w, v.h
FROM facility_floors ff
CROSS JOIN (VALUES
    ('OFFICE',   N'Quầy lễ tân', 0, 28, 8, 8),
    ('ENTRANCE', N'Cửa chính',   0, 36, 8, 4)
) v(fixture_type, label, x, y, w, h)
WHERE ff.name = N'Tầng 1';

/* ---------- 3. Vị trí từng ô ---------- */
-- Số dãy của mỗi loại kho ở mỗi cơ sở; loại thứ 2 trên tầng bắt đầu ngay sau loại thứ 1
-- Dãy r: y = start + r*h + 4*((r+1)/2) (sau mỗi dãy chẵn có 1 lối đi ngang)
-- Chiều cao 1 loại có n dãy = n*h + 4*((n+1)/2)
IF OBJECT_ID('tempdb..#types') IS NOT NULL DROP TABLE #types;
SELECT su.facility_id, p.unit_type_id, p.floor_no, p.ord, p.w, p.h, @usable / p.w AS per_row,
       (COUNT(*) + @usable / p.w - 1) / (@usable / p.w) AS nrows,
       CAST(0 AS INT) AS start_y
INTO #types
FROM storage_units su
JOIN #plan p ON p.unit_type_id = su.unit_type_id
GROUP BY su.facility_id, p.unit_type_id, p.floor_no, p.ord, p.w, p.h;

UPDATE t2 SET start_y = t1.nrows * t1.h + @aisle * ((t1.nrows + 1) / 2)
FROM #types t2
JOIN #types t1 ON t1.facility_id = t2.facility_id AND t1.floor_no = t2.floor_no AND t1.ord = 1
WHERE t2.ord = 2;

IF OBJECT_ID('tempdb..#pos') IS NOT NULL DROP TABLE #pos;
SELECT u.id, u.floor_no, u.w, u.h,
       @left + (u.rn % t.per_row) * u.w AS x,
       t.start_y + (u.rn / t.per_row) * u.h + @aisle * (((u.rn / t.per_row) + 1) / 2) AS y,
       CASE WHEN (u.rn / t.per_row) % 2 = 0 THEN 'BOTTOM' ELSE 'TOP' END AS door
INTO #pos
FROM (
    SELECT su.id, su.facility_id, su.unit_type_id, p.floor_no, p.w, p.h,
           ROW_NUMBER() OVER (PARTITION BY su.facility_id, su.unit_type_id ORDER BY su.id) - 1 AS rn
    FROM storage_units su
    JOIN #plan p ON p.unit_type_id = su.unit_type_id
) u
JOIN #types t ON t.facility_id = u.facility_id AND t.unit_type_id = u.unit_type_id;

UPDATE su SET
    floor    = N'Tầng ' + CAST(p.floor_no AS NVARCHAR(2)),
    map_x    = CASE WHEN p.y + p.h <= @gridH THEN p.x END,
    map_y    = CASE WHEN p.y + p.h <= @gridH THEN p.y END,
    map_w    = CASE WHEN p.y + p.h <= @gridH THEN p.w END,
    map_h    = CASE WHEN p.y + p.h <= @gridH THEN p.h END,
    map_door = CASE WHEN p.y + p.h <= @gridH THEN p.door END
FROM storage_units su
JOIN #pos p ON p.id = su.id;

-- Loại kho ngoài kế hoạch (BOM thêm sau) → giữ tầng, gỡ khỏi sơ đồ để không chồng lên bố cục mới
UPDATE storage_units SET map_x = NULL, map_y = NULL, map_w = NULL, map_h = NULL, map_door = NULL
WHERE unit_type_id NOT IN (SELECT unit_type_id FROM #plan);

/* ---------- 4. Lối đi ngang giữa 2 dãy (sau mỗi dãy chẵn) ---------- */
INSERT INTO floor_fixtures (floor_id, fixture_type, label, map_x, map_y, map_w, map_h)
SELECT ff.id, 'AISLE', N'Lối đi ' + ut.name, @left, a.y, @usable, @aisle
FROM #types t
JOIN unit_types ut ON ut.id = t.unit_type_id
JOIN facility_floors ff ON ff.facility_id = t.facility_id AND ff.name = N'Tầng ' + CAST(t.floor_no AS NVARCHAR(2))
CROSS APPLY (
    SELECT t.start_y + r.r * t.h + @aisle * ((r.r + 1) / 2) + t.h AS y
    FROM (VALUES (0), (2), (4), (6), (8)) r(r)
    WHERE r.r < t.nrows
) a
WHERE a.y + @aisle <= @gridH;

DECLARE @placed INT = (SELECT COUNT(*) FROM storage_units WHERE map_x IS NOT NULL);
DECLARE @unplaced INT = (SELECT COUNT(*) FROM storage_units WHERE map_x IS NULL);
PRINT N'==> [UC-06] Mặt bằng 4 tầng: ' + CAST(@placed AS NVARCHAR(10)) + N' ô đã đặt lên sơ đồ, '
    + CAST(@unplaced AS NVARCHAR(10)) + N' ô chưa đặt (hết chỗ / loại kho mới).';

DROP TABLE #pos;
DROP TABLE #types;
DROP TABLE #plan;
GO

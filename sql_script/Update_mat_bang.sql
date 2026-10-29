/* ============================================================
   QueenKho — Sơ đồ mặt bằng ô kho (UC-06, 29/10/2026)
   Chạy trên DB đang có dữ liệu (giữ nguyên dữ liệu, chạy lại nhiều lần không sao).
   DB mới thì chỉ cần QueenKho_full.sql hoặc QueenKho_TongHop.sql (đã gộp các thay đổi dưới đây).

   Lưới mặt bằng: 1 ô lưới = 0.5m. Toạ độ (map_x, map_y) là góc trên-trái, tính bằng ô lưới.
   1. storage_units: + map_x, map_y, map_w, map_h (vị trí + kích thước trên mặt bằng, NULL = chưa đặt)
                     + map_door (phía cửa ô: TOP / BOTTOM / LEFT / RIGHT)
   2. facility_floors (mới): mặt bằng từng tầng của cơ sở, tên khớp storage_units.floor
   3. floor_fixtures  (mới): lối đi, cửa vào, thang bộ, thang máy, văn phòng trên mặt bằng
   4. Dữ liệu: mỗi (cơ sở, tầng) đang có ô kho → 1 mặt bằng 28m × 20m;
      tầng "Tầng 1" có sẵn lối đi / cửa / thang; 42 ô kho mẫu được đặt sẵn vị trí.

   sqlcmd: sqlcmd -S localhost -U sa -P 12345 -I -f 65001 -i sql_script/Update_mat_bang.sql
   ============================================================ */
USE QueenKhoDB;
GO
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
GO

/* ---------- 1. storage_units: cột vị trí trên mặt bằng ---------- */
IF COL_LENGTH('storage_units', 'map_x') IS NULL
    ALTER TABLE storage_units ADD
        map_x    INT NULL,
        map_y    INT NULL,
        map_w    INT NULL,
        map_h    INT NULL,
        map_door NVARCHAR(10) NULL;
GO
IF OBJECT_ID('CK_storageunits_map', 'C') IS NULL
    ALTER TABLE storage_units ADD CONSTRAINT CK_storageunits_map CHECK (
        (map_x IS NULL AND map_y IS NULL AND map_w IS NULL AND map_h IS NULL)
        OR (map_x >= 0 AND map_y >= 0 AND map_w > 0 AND map_h > 0));
IF OBJECT_ID('CK_storageunits_mapdoor', 'C') IS NULL
    ALTER TABLE storage_units ADD CONSTRAINT CK_storageunits_mapdoor CHECK (
        map_door IS NULL OR map_door IN ('TOP', 'BOTTOM', 'LEFT', 'RIGHT'));
GO

/* ---------- 2. facility_floors ---------- */
IF OBJECT_ID('facility_floors', 'U') IS NULL
BEGIN
    CREATE TABLE facility_floors (
        id           INT IDENTITY(1,1) PRIMARY KEY,
        facility_id  INT NOT NULL,
        name         NVARCHAR(20) NOT NULL,         -- khớp storage_units.floor
        grid_width   INT NOT NULL DEFAULT 56,       -- số ô lưới theo chiều ngang (56 = 28m)
        grid_height  INT NOT NULL DEFAULT 40,       -- số ô lưới theo chiều dọc  (40 = 20m)
        sort_order   INT NOT NULL DEFAULT 0,
        CONSTRAINT FK_facilityfloors_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
        CONSTRAINT UQ_facilityfloors_name UNIQUE (facility_id, name),
        CONSTRAINT CK_facilityfloors_grid CHECK (grid_width BETWEEN 10 AND 200 AND grid_height BETWEEN 10 AND 200)
    );
END
GO

/* ---------- 3. floor_fixtures ---------- */
IF OBJECT_ID('floor_fixtures', 'U') IS NULL
BEGIN
    CREATE TABLE floor_fixtures (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        floor_id      INT NOT NULL,
        fixture_type  NVARCHAR(20) NOT NULL,        -- AISLE / ENTRANCE / STAIRS / ELEVATOR / OFFICE
        label         NVARCHAR(50) NULL,
        map_x         INT NOT NULL,
        map_y         INT NOT NULL,
        map_w         INT NOT NULL,
        map_h         INT NOT NULL,
        CONSTRAINT FK_floorfixtures_floor FOREIGN KEY (floor_id) REFERENCES facility_floors(id) ON DELETE CASCADE,
        CONSTRAINT CK_floorfixtures_type CHECK (fixture_type IN ('AISLE', 'ENTRANCE', 'STAIRS', 'ELEVATOR', 'OFFICE')),
        CONSTRAINT CK_floorfixtures_rect CHECK (map_x >= 0 AND map_y >= 0 AND map_w > 0 AND map_h > 0)
    );
    CREATE INDEX IX_floorfixtures_floor ON floor_fixtures(floor_id);
END
GO

/* ---------- 4a. Mặt bằng cho mọi (cơ sở, tầng) đang có ô kho ---------- */
INSERT INTO facility_floors (facility_id, name, grid_width, grid_height, sort_order)
SELECT DISTINCT su.facility_id, su.floor, 56, 40, 1
FROM storage_units su
WHERE su.floor IS NOT NULL AND LTRIM(RTRIM(su.floor)) <> ''
  AND NOT EXISTS (SELECT 1 FROM facility_floors ff
                  WHERE ff.facility_id = su.facility_id AND ff.name = su.floor);
GO

/* ---------- 4b. Lối đi / cửa / thang cho "Tầng 1" (chỉ tầng chưa có vật cố định nào) ---------- */
INSERT INTO floor_fixtures (floor_id, fixture_type, label, map_x, map_y, map_w, map_h)
SELECT ff.id, f.fixture_type, f.label, f.x, f.y, f.w, f.h
FROM facility_floors ff
CROSS JOIN (VALUES
    ('STAIRS',   N'Thang bộ',      0,  0,  8,  6),
    ('ELEVATOR', N'Thang máy',     0,  6,  8,  5),
    ('OFFICE',   N'Quầy lễ tân',   0, 28,  8,  8),
    ('ENTRANCE', N'Cửa chính',     0, 36,  8,  4),
    ('AISLE',    N'Lối đi chính',  8,  0,  4, 40),
    ('AISLE',    N'Lối đi A – B', 12, 10, 44,  4),
    ('AISLE',    N'Lối đi C',     12, 30, 44,  4)
) AS f(fixture_type, label, x, y, w, h)
WHERE ff.name = N'Tầng 1'
  AND NOT EXISTS (SELECT 1 FROM floor_fixtures x WHERE x.floor_id = ff.id);
GO

/* ---------- 4c. Vị trí 42 ô kho mẫu (chỉ ô ở "Tầng 1" và chưa có vị trí) ----------
   Dãy trên lối đi A–B: cửa quay xuống (BOTTOM); dãy dưới: cửa quay lên (TOP).
   Kích thước theo loại kho: Mini M 3×5 · Tiêu Chuẩn 5×5 · Gia Đình 8×6 · Lớn 8×8 · XL 10×10 · Nhỏ 2m² 2×4 */
UPDATE su
SET su.map_x = p.x, su.map_y = p.y, su.map_w = p.w, su.map_h = p.h, su.map_door = p.door
FROM storage_units su
JOIN (VALUES
    -- Tân Bình
    ('KV-TB-A101', 12,  5, 5,  5, 'BOTTOM'), ('KV-TB-A102', 17,  5, 5,  5, 'BOTTOM'),
    ('KV-TB-A103', 22,  5, 5,  5, 'BOTTOM'), ('KV-TB-A104', 27,  5, 5,  5, 'BOTTOM'),
    ('KV-TB-A105', 32,  5, 5,  5, 'BOTTOM'),
    ('KV-TB-B201', 12, 14, 8,  6, 'TOP'),    ('KV-TB-B202', 20, 14, 8,  6, 'TOP'),
    ('KV-TB-B203', 28, 14, 8,  8, 'TOP'),    ('KV-TB-B204', 36, 14, 8,  8, 'TOP'),
    ('KV-TB-C101', 12, 26, 2,  4, 'BOTTOM'), ('KV-TB-C102', 14, 26, 2,  4, 'BOTTOM'),
    ('KV-TB-C103', 16, 25, 3,  5, 'BOTTOM'), ('KV-TB-C104', 19, 25, 3,  5, 'BOTTOM'),
    ('KV-TB-C105', 22, 26, 2,  4, 'BOTTOM'),
    -- Bình Thạnh
    ('KV-BT-A101', 12,  5, 5,  5, 'BOTTOM'), ('KV-BT-A102', 17,  6, 2,  4, 'BOTTOM'),
    ('KV-BT-A103', 19,  5, 3,  5, 'BOTTOM'),
    ('KV-BT-B201', 12, 14, 8,  8, 'TOP'),    ('KV-BT-B202', 20, 14, 10, 10, 'TOP'),
    ('KV-BT-B203', 30, 14, 8,  6, 'TOP'),
    -- Thủ Đức
    ('KV-TD-A101', 12,  6, 2,  4, 'BOTTOM'), ('KV-TD-A102', 14,  5, 3,  5, 'BOTTOM'),
    ('KV-TD-A103', 17,  5, 5,  5, 'BOTTOM'), ('KV-TD-A104', 22,  5, 5,  5, 'BOTTOM'),
    ('KV-TD-B201', 12, 14, 8,  6, 'TOP'),
    -- Gò Vấp
    ('KV-GV-A101', 12,  6, 2,  4, 'BOTTOM'), ('KV-GV-A102', 14,  5, 3,  5, 'BOTTOM'),
    ('KV-GV-A103', 17,  5, 5,  5, 'BOTTOM'),
    ('KV-GV-B201', 12, 14, 8,  8, 'TOP'),
    -- Cầu Giấy
    ('KV-CG-A101', 12,  6, 2,  4, 'BOTTOM'), ('KV-CG-A102', 14,  5, 5,  5, 'BOTTOM'),
    ('KV-CG-A103', 19,  5, 5,  5, 'BOTTOM'), ('KV-CG-A104', 24,  4, 8,  6, 'BOTTOM'),
    ('KV-CG-B201', 12, 14, 8,  8, 'TOP'),    ('KV-CG-B202', 20, 14, 10, 10, 'TOP'),
    -- Quận 7
    ('KV-Q7-A101', 12,  5, 5,  5, 'BOTTOM'), ('KV-Q7-A102', 17,  5, 5,  5, 'BOTTOM'),
    ('KV-Q7-A103', 22,  4, 8,  6, 'BOTTOM'),
    ('KV-Q7-B201', 12, 14, 2,  4, 'TOP'),    ('KV-Q7-B202', 14, 14, 3,  5, 'TOP'),
    ('KV-Q7-B203', 17, 14, 8,  8, 'TOP'),    ('KV-Q7-B204', 25, 14, 10, 10, 'TOP')
) AS p(id, x, y, w, h, door) ON p.id = su.id
WHERE su.floor = N'Tầng 1' AND su.map_x IS NULL;
GO

/* ---------- Kiểm tra ---------- */
SELECT f.code AS facility, ff.name AS floor, ff.grid_width, ff.grid_height,
       (SELECT COUNT(*) FROM floor_fixtures x WHERE x.floor_id = ff.id) AS fixtures,
       (SELECT COUNT(*) FROM storage_units su WHERE su.facility_id = ff.facility_id AND su.floor = ff.name AND su.map_x IS NOT NULL) AS placed_units,
       (SELECT COUNT(*) FROM storage_units su WHERE su.facility_id = ff.facility_id AND su.floor = ff.name AND su.map_x IS NULL) AS unplaced_units
FROM facility_floors ff JOIN facilities f ON f.id = ff.facility_id
ORDER BY f.id, ff.sort_order, ff.name;
GO

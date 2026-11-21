/* ============================================================
   QueenKho — Thêm ô kho cho mọi cơ sở đang hoạt động (21/11/2026)
   Seed cũ mỗi cơ sở chỉ 1–5 ô / loại kho (có loại còn 0 ô) → khó demo đặt kho, gán ô, ô sắp trống.
   Script này thêm 51 ô / cơ sở ở Tầng 2–3, mỗi loại kho 1 khu riêng (không trùng khu A/B/C/E/L của Tầng 1,
   không trùng khu D/E Tầng 2 mà QueenKho_demo_data.sql thêm cho Tân Bình):

     Khu M  Kho Mini M          (loại 1)  10 ô  Tầng 2  M201–M210
     Khu S  Kho Tiêu Chuẩn      (loại 2)  12 ô  Tầng 2  S201–S212
     Khu G  Kho Gia Đình        (loại 3)   6 ô  Tầng 2  G201–G206
     Khu N  Kho nhỏ 2m²         (loại 6)  10 ô  Tầng 2  N201–N210
     Khu R  Kho Lạnh 6m²        (loại 7)   4 ô  Tầng 2  R201–R204
     Khu F  Kho Đông 4m²        (loại 8)   3 ô  Tầng 2  F201–F203
     Khu K  Kho Lớn             (loại 4)   4 ô  Tầng 3  K301–K304
     Khu X  Kho Đặc Biệt XL     (loại 5)   2 ô  Tầng 3  X301–X302

   Mã ô: KV-<mã cơ sở>-<khu><số> (cùng quy ước seed). Ô mới AVAILABLE, chưa đặt lên mặt bằng (vẫn cho thuê / gán ô
   bình thường — UC-06), FM tự kéo lên sơ đồ khi cần. Chỉ thêm ô chưa có → chạy lại nhiều lần không trùng.
   Loại kho ngừng (INACTIVE) / cơ sở ngừng hoạt động được bỏ qua.

   sqlcmd: sqlcmd -S localhost -U sa -P 12345 -I -f 65001 -i sql_script/Update_them_o_kho_21_11.sql
   ============================================================ */

USE QueenKhoDB;
GO

SET NOCOUNT ON;

DECLARE @plan TABLE (unit_type_id INT, zone NVARCHAR(5), floor_no INT, qty INT);
INSERT INTO @plan (unit_type_id, zone, floor_no, qty) VALUES
    (1, N'M', 2, 10),
    (2, N'S', 2, 12),
    (3, N'G', 2, 6),
    (6, N'N', 2, 10),
    (7, N'R', 2, 4),
    (8, N'F', 2, 3),
    (4, N'K', 3, 4),
    (5, N'X', 3, 2);

;WITH nums AS (
    SELECT TOP (20) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n FROM sys.all_objects
),
wanted AS (
    SELECT f.id AS facility_id,
           p.unit_type_id,
           N'Tầng ' + CAST(p.floor_no AS NVARCHAR(2)) AS floor_name,
           p.zone,
           CAST(p.floor_no * 100 + n.n AS NVARCHAR(10)) AS room_number,
           N'KV-' + f.code + N'-' + p.zone + CAST(p.floor_no * 100 + n.n AS NVARCHAR(10)) AS unit_id
    FROM facilities f
    CROSS JOIN @plan p
    JOIN nums n ON n.n <= p.qty
    JOIN unit_types ut ON ut.id = p.unit_type_id AND ut.status = 'ACTIVE'
    WHERE f.status = 'ACTIVE' AND f.code IS NOT NULL
)
INSERT INTO storage_units (id, facility_id, unit_type_id, floor, zone, room_number, status, is_emergency)
SELECT w.unit_id, w.facility_id, w.unit_type_id, w.floor_name, w.zone, w.room_number, 'AVAILABLE', 0
FROM wanted w
WHERE NOT EXISTS (SELECT 1 FROM storage_units su WHERE su.id = w.unit_id);

PRINT N'==> Đã thêm ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + N' ô kho mới.';
GO

-- Tổng ô theo cơ sở × loại kho sau khi thêm
SELECT f.code AS co_so, ut.name AS loai_kho, COUNT(*) AS so_o,
       SUM(CASE WHEN su.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS dang_trong
FROM storage_units su
JOIN facilities f ON f.id = su.facility_id
JOIN unit_types ut ON ut.id = su.unit_type_id
WHERE su.is_emergency = 0
GROUP BY f.code, ut.name, ut.id
ORDER BY f.code, ut.id;
GO

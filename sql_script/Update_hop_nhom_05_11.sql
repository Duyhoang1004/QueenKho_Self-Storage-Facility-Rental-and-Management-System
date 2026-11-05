/* ============================================================
   QueenKho — Cập nhật theo họp nhóm 05/11/2026 (chạy được nhiều lần)
   Dùng cho DB đang có dữ liệu; DB tạo mới từ QueenKho_full.sql / QueenKho_TongHop.sql đã có sẵn.
   Chạy SAU Update_bao_hiem_boi_thuong.sql.

   1. goods_categories      : danh mục loại hàng (BOM quản lý) — khách khai báo khi đặt kho (BR-131)
   2. unit_types            : loại kho thường / lạnh / đông (thực phẩm chỉ gửi kho lạnh, kho đông)
   3. reservations          : loại hàng khách khai báo + mô tả
   4. handover_records      : check-in đã kiểm tra hàng khớp khai báo, không có hàng cấm (PR-C7 / BR-132)
   5. vouchers              : voucher áp cho 1 loại kho (BR-25 mở rộng)
   6. central_warehouses    : kho tổng giữ hàng của khách quá hạn (BR-134, không bán)
   7. held_goods            : hàng lưu giữ gắn với kho tổng

   sqlcmd: sqlcmd -S localhost -U sa -P 12345 -I -f 65001 -i sql_script/Update_hop_nhom_05_11.sql
   ============================================================ */

USE QueenKhoDB;
GO

/* ---------- 1. goods_categories ---------- */
IF OBJECT_ID('goods_categories', 'U') IS NULL
BEGIN
    CREATE TABLE goods_categories (
        id                    INT IDENTITY(1,1) PRIMARY KEY,
        code                  NVARCHAR(30)  NOT NULL UNIQUE,
        name                  NVARCHAR(100) NOT NULL,
        description           NVARCHAR(300) NULL,
        requires_cold_storage BIT NOT NULL DEFAULT 0,          -- chỉ gửi được ở kho lạnh / kho đông (vd thực phẩm)
        requires_note         BIT NOT NULL DEFAULT 0,          -- bắt buộc mô tả thêm (vd "Khác")
        sort_order            INT NOT NULL DEFAULT 0,
        status                NVARCHAR(20)  NOT NULL DEFAULT 'ACTIVE', -- ACTIVE / INACTIVE
        created_at            DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END
GO
IF NOT EXISTS (SELECT 1 FROM goods_categories)
    INSERT INTO goods_categories (code, name, description, requires_cold_storage, requires_note, sort_order) VALUES
    (N'HOUSEHOLD',  N'Gia dụng',        N'Đồ dùng gia đình, dụng cụ nhà bếp, thiết bị nhỏ', 0, 0, 1),
    (N'STATIONERY', N'Văn phòng phẩm',  N'Giấy tờ, hồ sơ, sách vở, dụng cụ văn phòng',     0, 0, 2),
    (N'FOOD',       N'Thực phẩm',       N'Chỉ gửi ở kho lạnh hoặc kho đông',                1, 0, 3),
    (N'CLOTHING',   N'Quần áo',         N'Quần áo, chăn màn, giày dép',                      0, 0, 4),
    (N'FURNITURE',  N'Nội thất',        N'Bàn ghế, tủ, giường, đồ gỗ',                       0, 0, 5),
    (N'ELECTRONICS',N'Điện tử',         N'Thiết bị điện, điện tử, máy tính',                 0, 0, 6),
    (N'OTHER',      N'Khác',            N'Ghi rõ loại hàng',                                 0, 1, 7);
GO

/* ---------- 2. unit_types ---------- */
IF COL_LENGTH('unit_types', 'temperature_class') IS NULL
    ALTER TABLE unit_types ADD temperature_class NVARCHAR(10) NOT NULL
        CONSTRAINT DF_unit_types_temperature DEFAULT 'NORMAL';             -- NORMAL / COLD (kho lạnh) / FROZEN (kho đông)
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_unit_types_temperature')
    ALTER TABLE unit_types ADD CONSTRAINT CK_unit_types_temperature CHECK (temperature_class IN ('NORMAL', 'COLD', 'FROZEN'));
GO

/* ---------- 3. reservations ---------- */
IF COL_LENGTH('reservations', 'goods_category_codes') IS NULL
    ALTER TABLE reservations ADD goods_category_codes NVARCHAR(300) NULL;  -- mã loại hàng, ngăn bởi dấu phẩy
GO
IF COL_LENGTH('reservations', 'goods_description') IS NULL
    ALTER TABLE reservations ADD goods_description NVARCHAR(500) NULL;
GO

/* ---------- 4. handover_records ---------- */
IF COL_LENGTH('handover_records', 'is_prohibited_goods_committed') IS NULL
    ALTER TABLE handover_records ADD is_prohibited_goods_committed BIT NOT NULL
        CONSTRAINT DF_handover_prohibited DEFAULT 0;                          -- PR-C7: đã kiểm tra hàng, không có hàng cấm
GO

/* ---------- 5. vouchers ---------- */
IF COL_LENGTH('vouchers', 'unit_type_id') IS NULL
BEGIN
    ALTER TABLE vouchers ADD unit_type_id INT NULL;                          -- NULL = mọi loại kho
    ALTER TABLE vouchers ADD CONSTRAINT FK_vouchers_unit_type FOREIGN KEY (unit_type_id) REFERENCES unit_types(id);
END
GO

/* ---------- 6. central_warehouses ---------- */
IF OBJECT_ID('central_warehouses', 'U') IS NULL
BEGIN
    CREATE TABLE central_warehouses (
        id         INT IDENTITY(1,1) PRIMARY KEY,
        name       NVARCHAR(150) NOT NULL,
        address    NVARCHAR(300) NOT NULL,
        hotline    NVARCHAR(20)  NULL,
        note       NVARCHAR(500) NULL,
        status     NVARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE / INACTIVE
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END
GO
IF NOT EXISTS (SELECT 1 FROM central_warehouses)
    INSERT INTO central_warehouses (name, address, hotline, note) VALUES
    (N'Kho tổng QueenKho', N'Lô C3, KCN Tân Bình, P. Tây Thạnh, Q. Tân Phú, TP.HCM', N'0281234567',
     N'Giữ hàng của khách quá hạn hợp đồng — không bán, khách đến nhận lại sau khi thanh toán');
GO

/* ---------- 7. held_goods ---------- */
IF COL_LENGTH('held_goods', 'central_warehouse_id') IS NULL
BEGIN
    ALTER TABLE held_goods ADD central_warehouse_id INT NULL;
    ALTER TABLE held_goods ADD CONSTRAINT FK_heldgoods_warehouse FOREIGN KEY (central_warehouse_id) REFERENCES central_warehouses(id);
END
GO

PRINT N'Đã cập nhật: loại hàng, kho lạnh / đông, voucher theo loại kho, kho tổng';
GO

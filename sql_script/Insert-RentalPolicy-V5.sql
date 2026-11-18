/* ============================================================================
   QUEENKHO — SCRIPT INSERT CHÍNH SÁCH THUÊ PHIÊN BẢN V5 (ĐIỀU KHOẢN V5)
   - Chèn bản ghi rental_policy version = 5 (liquidation_days = 5 ngày) cho toàn bộ cơ sở
     và kích hoạt is_active = 1 để hiển thị đồng bộ trên màn hình BOM (/bom/policies).
   - Giữ nguyên lịch sử các phiên bản cũ (v1 = 30 ngày, v2 = 15 ngày) để BOM xem đối chiếu
     hoặc chuyển lại trong mục "Lịch sử chính sách".
   - Các thông số chuẩn v5:
       * deposit_month_multiplier = 1 tháng
       * cancel_fee_percent = 50%, cancel_free_hours = 48 giờ
       * late_fee_percent_per_day = 10%/ngày, late_fee_max_percent = 50% cọc
       * liquidation_days = 5 ngày (quá 5 ngày tự động cưỡng chế; < 5 ngày cần 2 lần liên hệ)
       * booking_discount = 5% / 10% / 15%; renewal_discount = 0% / 5% / 10%
       * allow_late_fee_waiver = 1 (Cho phép FM miễn phí trễ)
       * overstay_percent = 150%, held_goods_fee_percent = 20%, goods_moving_fee_percent = 30%
   - Idempotent: Chạy lại nhiều lần không lỗi trùng khóa UQ_rentalpolicy_facility_version
     hay UX_rentalpolicy_active_facility.
   ============================================================================ */

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF DB_ID('QueenKhoDB') IS NULL
BEGIN
    RAISERROR(N'Chưa có database QueenKhoDB. Vui lòng kiểm tra kết nối SQL Server.', 16, 1);
    RETURN;
END
GO

USE QueenKhoDB;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

BEGIN TRANSACTION;

BEGIN TRY
    DECLARE @bomUserId INT = (
        SELECT TOP 1 u.id
        FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE r.name = 'BOM'
        ORDER BY u.id
    );

    DECLARE @now DATETIME2 = SYSDATETIME();

    -- Bước 1: Hạ is_active = 0 cho mọi phiên bản cũ (tránh vi phạm UX_rentalpolicy_active_facility)
    UPDATE rental_policy
    SET is_active = 0
    WHERE is_active = 1
      AND version <> 5;

    -- Bước 2: Nếu đã có version = 5 thì cập nhật chuẩn thông số v5 & kích hoạt lại
    UPDATE rp
    SET rp.policy_name              = LEFT(N'Chính sách ' + f.name + N' - Điều khoản v5', 150),
        rp.deposit_month_multiplier = 1,
        rp.cancel_fee_percent       = 50,
        rp.cancel_free_hours        = 48,
        rp.liquidation_days         = 5,
        rp.late_fee_percent_per_day = 10,
        rp.late_fee_max_percent     = 50,
        rp.booking_discount_3m      = 5,
        rp.booking_discount_6m      = 10,
        rp.booking_discount_12m     = 15,
        rp.renewal_discount_3m      = 0,
        rp.renewal_discount_6m      = 5,
        rp.renewal_discount_12m     = 10,
        rp.allow_late_fee_waiver    = 1,
        rp.overstay_percent         = 150,
        rp.held_goods_fee_percent   = 20,
        rp.goods_moving_fee_percent = 30,
        rp.created_by_user_id       = @bomUserId,
        rp.created_at               = @now,
        rp.is_active                = 1
    FROM rental_policy rp
    JOIN facilities f ON f.id = rp.facility_id
    WHERE rp.version = 5;

    -- Bước 3: Chèn mới version = 5 cho mọi cơ sở chưa có bản v5
    INSERT INTO rental_policy (
        facility_id,
        policy_name,
        deposit_month_multiplier,
        cancel_fee_percent,
        cancel_free_hours,
        liquidation_days,
        late_fee_percent_per_day,
        late_fee_max_percent,
        version,
        created_at,
        created_by_user_id,
        is_active,
        booking_discount_3m,
        booking_discount_6m,
        booking_discount_12m,
        renewal_discount_3m,
        renewal_discount_6m,
        renewal_discount_12m,
        allow_late_fee_waiver,
        overstay_percent,
        held_goods_fee_percent,
        goods_moving_fee_percent
    )
    SELECT
        f.id,
        LEFT(N'Chính sách ' + f.name + N' - Điều khoản v5', 150),
        1,    -- deposit_month_multiplier
        50,   -- cancel_fee_percent
        48,   -- cancel_free_hours
        5,    -- liquidation_days (Điều khoản v5: 5 ngày quá hạn)
        10,   -- late_fee_percent_per_day (10%/ngày)
        50,   -- late_fee_max_percent (tối đa 50% cọc)
        5,    -- version = 5 (v5)
        @now,
        @bomUserId,
        1,    -- is_active = 1
        5,    -- booking_discount_3m
        10,   -- booking_discount_6m
        15,   -- booking_discount_12m
        0,    -- renewal_discount_3m
        5,    -- renewal_discount_6m
        10,   -- renewal_discount_12m
        1,    -- allow_late_fee_waiver
        150,  -- overstay_percent
        20,   -- held_goods_fee_percent
        30    -- goods_moving_fee_percent
    FROM facilities f
    WHERE NOT EXISTS (
        SELECT 1
        FROM rental_policy rp
        WHERE rp.facility_id = f.id
          AND rp.version = 5
    );

    -- Bước 4: Đồng bộ rental_policy_id sang v5 cho các hợp đồng demo KH6 (vốn đã gắn terms_version = 'v5')
    UPDATE c
    SET c.rental_policy_id = rp.id
    FROM rental_contracts c
    JOIN storage_units su ON su.id = c.storage_unit_id
    JOIN rental_policy rp ON rp.facility_id = su.facility_id AND rp.version = 5
    WHERE c.contract_code LIKE 'HD-KH6%';

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

/* ============================================================================
   KIỂM TRA KẾT QUẢ CHÍNH SÁCH V5 ĐANG ÁP DỤNG TRÊN TOÀN BỘ CƠ SỞ
   ============================================================================ */
SELECT
    f.id                     AS [Facility ID],
    f.name                   AS [Cơ sở],
    rp.id                    AS [Policy ID],
    'v' + CAST(rp.version AS VARCHAR(10)) AS [Phiên bản],
    rp.liquidation_days      AS [Ngày cưỡng chế],
    rp.late_fee_percent_per_day AS [Phí trễ/ngày (%)],
    rp.late_fee_max_percent  AS [Trần phí (%)],
    rp.overstay_percent      AS [Chiếm dụng (%)],
    rp.is_active             AS [Đang áp dụng],
    ISNULL(u.full_name, N'Hệ thống') AS [Người tạo]
FROM rental_policy rp
JOIN facilities f ON f.id = rp.facility_id
LEFT JOIN users u ON u.id = rp.created_by_user_id
WHERE rp.is_active = 1
ORDER BY f.id;
GO

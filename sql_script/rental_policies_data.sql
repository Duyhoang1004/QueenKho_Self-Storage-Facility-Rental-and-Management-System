USE QueenKhoDB;
GO

/* Dữ liệu mẫu UC-07: chỉ thêm chính sách ban đầu nếu cơ sở chưa có.
   Không UPDATE chính sách cũ vì hợp đồng đã ký đang tham chiếu phiên bản đó. */
INSERT INTO rental_policy (
    facility_id, policy_name, deposit_month_multiplier, cancel_fee_percent,
    cancel_free_hours, late_fee_percent_per_day, late_fee_max_percent,
    liquidation_days, version, is_active
)
SELECT f.id, LEFT(N'Chính sách ' + f.name + N' - Tiêu chuẩn', 150), 1, 50, 24, 10, 50, 15, 1, 1
FROM facilities f
WHERE NOT EXISTS (SELECT 1 FROM rental_policy p WHERE p.facility_id = f.id);
GO

package com.queenkho.api.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

// UC-07 + Flow 4: các trường ưu đãi / miễn phí trễ không bắt buộc — bỏ trống thì giữ như phiên bản đang hiệu lực
public record RentalPolicyRequest(
    @NotNull @Min(1) @Max(3) Integer depositMonthMultiplier,
    @NotNull @Min(0) @Max(100) Integer cancelFeePercent,
    @NotNull @Min(0) Integer cancelFreeHours,
    @NotNull @Min(0) @Max(50) Integer lateFeePercentPerDay,
    @Min(0) @Max(50) Integer bookingDiscount3m,
    @Min(0) @Max(50) Integer bookingDiscount6m,
    @Min(0) @Max(50) Integer bookingDiscount12m,
    @Min(0) @Max(50) Integer renewalDiscount3m,
    @Min(0) @Max(50) Integer renewalDiscount6m,
    @Min(0) @Max(50) Integer renewalDiscount12m,
    Boolean allowLateFeeWaiver,
    // PR-Q14 / PR-Q15: % giá ngày tính phí chiếm dụng (100–300) và phí lưu giữ hàng sau thanh lý (0–100)
    @Min(100) @Max(300) Integer overstayPercent,
    @Min(0) @Max(100) Integer heldGoodsFeePercent
) {
    // Giữ tương thích chỗ gọi cũ chỉ có 4 trường gốc
    public RentalPolicyRequest(Integer depositMonthMultiplier, Integer cancelFeePercent,
                               Integer cancelFreeHours, Integer lateFeePercentPerDay) {
        this(depositMonthMultiplier, cancelFeePercent, cancelFreeHours, lateFeePercentPerDay,
                null, null, null, null, null, null, null);
    }

    // Giữ tương thích chỗ gọi trước khi có phí chiếm dụng / phí lưu giữ
    public RentalPolicyRequest(Integer depositMonthMultiplier, Integer cancelFeePercent,
                               Integer cancelFreeHours, Integer lateFeePercentPerDay,
                               Integer bookingDiscount3m, Integer bookingDiscount6m, Integer bookingDiscount12m,
                               Integer renewalDiscount3m, Integer renewalDiscount6m, Integer renewalDiscount12m,
                               Boolean allowLateFeeWaiver) {
        this(depositMonthMultiplier, cancelFeePercent, cancelFreeHours, lateFeePercentPerDay,
                bookingDiscount3m, bookingDiscount6m, bookingDiscount12m,
                renewalDiscount3m, renewalDiscount6m, renewalDiscount12m, allowLateFeeWaiver, null, null);
    }
}

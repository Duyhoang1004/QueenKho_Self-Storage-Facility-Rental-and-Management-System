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
    Boolean allowLateFeeWaiver
) {
    // Giữ tương thích chỗ gọi cũ chỉ có 4 trường gốc
    public RentalPolicyRequest(Integer depositMonthMultiplier, Integer cancelFeePercent,
                               Integer cancelFreeHours, Integer lateFeePercentPerDay) {
        this(depositMonthMultiplier, cancelFeePercent, cancelFreeHours, lateFeePercentPerDay,
                null, null, null, null, null, null, null);
    }
}

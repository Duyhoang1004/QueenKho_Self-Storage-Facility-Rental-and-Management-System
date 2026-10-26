package com.queenkho.api.dto;

import java.math.BigDecimal;
import java.util.List;

// Flow 1 / 4: chính sách giá đang áp dụng của 1 cơ sở — FE dùng để hiện gói thuê, ưu đãi, cọc, quy định huỷ
public record FacilityPricingResponse(
        Integer facilityId,
        Integer policyVersion,
        int depositMonthMultiplier,
        List<PackageOption> bookingPackages,
        List<PackageOption> renewalPackages,
        BigDecimal welcomeVoucher,
        int cancelFreeHours,
        int cancelFeePercent,
        int lateFeePercentPerDay,
        int lateFeeMaxPercent,
        int liquidationDays,
        boolean allowLateFeeWaiver
) {
    public record PackageOption(int months, int discountPercent) {}
}

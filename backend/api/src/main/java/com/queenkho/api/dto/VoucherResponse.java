package com.queenkho.api.dto;

import com.queenkho.api.entity.Voucher;

import java.math.BigDecimal;
import java.time.LocalDateTime;

// BR-25: voucher trong màn quản lý của BOM
public record VoucherResponse(
        Integer id,
        String code,
        String name,
        String discountType,
        BigDecimal discountValue,
        BigDecimal maxDiscount,
        Integer minMonths,
        Integer facilityId,
        String facilityName,
        LocalDateTime startAt,
        LocalDateTime endAt,
        Integer usageLimit,
        Integer perUserLimit,
        Integer usedCount,
        Boolean isDefault,
        String status,
        LocalDateTime createdAt
) {
    public static VoucherResponse of(Voucher v, String facilityName) {
        return new VoucherResponse(v.getId(), v.getCode(), v.getName(), v.getDiscountType(), v.getDiscountValue(),
                v.getMaxDiscount(), v.getMinMonths(), v.getFacilityId(), facilityName, v.getStartAt(), v.getEndAt(),
                v.getUsageLimit(), v.getPerUserLimit(), v.getUsedCount(), v.getIsDefault(), v.getStatus(), v.getCreatedAt());
    }
}

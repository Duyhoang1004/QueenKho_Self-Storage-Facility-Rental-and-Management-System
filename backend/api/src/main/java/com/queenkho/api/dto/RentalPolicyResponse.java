package com.queenkho.api.dto;

import java.time.LocalDateTime;

public record RentalPolicyResponse(
    Integer id, Integer facilityId, Integer version, boolean active,
    Integer depositMonthMultiplier, Integer cancelFeePercent, Integer cancelFreeHours,
    Integer lateFeePercentPerDay, Integer lateFeeMaxPercent, Integer liquidationDays,
    LocalDateTime createdAt, String createdBy,
    // Flow 4: ưu đãi gói đặt mới / gia hạn + quyền miễn phí trễ của FM
    Integer bookingDiscount3m, Integer bookingDiscount6m, Integer bookingDiscount12m,
    Integer renewalDiscount3m, Integer renewalDiscount6m, Integer renewalDiscount12m,
    boolean allowLateFeeWaiver,
    // PR-Q14 / PR-Q15
    Integer overstayPercent, Integer heldGoodsFeePercent
) {}

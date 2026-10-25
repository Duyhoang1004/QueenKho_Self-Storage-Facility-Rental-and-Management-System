package com.queenkho.api.dto;

import java.time.LocalDateTime;

public record RentalPolicyResponse(
    Integer id, Integer facilityId, Integer version, boolean active,
    Integer depositMonthMultiplier, Integer cancelFeePercent, Integer cancelFreeHours,
    Integer lateFeePercentPerDay, Integer lateFeeMaxPercent, Integer liquidationDays,
    LocalDateTime createdAt, String createdBy
) {}

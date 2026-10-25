package com.queenkho.api.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record RentalPolicyRequest(
    @NotNull @Min(1) @Max(3) Integer depositMonthMultiplier,
    @NotNull @Min(0) @Max(100) Integer cancelFeePercent,
    @NotNull @Min(0) Integer cancelFreeHours,
    @NotNull @Min(0) @Max(50) Integer lateFeePercentPerDay
) {}

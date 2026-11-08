package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CancelPreviewResponse {
    private BigDecimal totalPaid;
    private BigDecimal depositAmount;
    private BigDecimal penaltyAmount;
    private BigDecimal refundAmount;
    private LocalDateTime appointmentTime;
    private LocalDateTime paymentSuccessAt;
    private LocalDateTime calculatedAt;
    private LocalDateTime graceExpiresAt;
    private Long minutesUntilCheckIn;
    private String policyTier;
    private String policyDescription;
    private Boolean graceApplied;
    private Integer fullRefundHours;
    private Integer partialRefundHours;
    private Integer partialFeePercent;
    private Integer lateFeePercent;
    private Integer graceMinutes;
    // Tương thích client cũ: nay luôn là 48 giờ / 50% cọc.
    private Integer cancelFreeHours;
    private Integer cancelFeePercent;
}

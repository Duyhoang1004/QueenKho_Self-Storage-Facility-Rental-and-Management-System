package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CancelPreviewResponse {
    private BigDecimal depositAmount;
    private BigDecimal penaltyAmount;
    private BigDecimal refundAmount;
    private LocalDateTime appointmentTime;
}
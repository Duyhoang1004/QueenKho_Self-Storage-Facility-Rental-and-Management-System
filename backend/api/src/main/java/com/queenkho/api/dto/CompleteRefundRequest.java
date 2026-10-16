package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompleteRefundRequest {
    private String evidenceImageUrl;
    private String transactionRef;
    private BigDecimal refundAmount;
    private String notes;
}

package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RefundEvidenceResponse {
    private Integer taskId;
    private String paymentMethod;
    private String transactionCode;
    private String bankTransactionCode;
    private BigDecimal amount;
    private LocalDateTime completedAt;
    private String evidenceImageUrl;
    private String note;
}

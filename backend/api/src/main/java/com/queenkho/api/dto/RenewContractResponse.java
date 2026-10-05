package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RenewContractResponse {
    private Integer contractId;
    private String contractCode;
    private LocalDate newEndDate;
    private Integer monthsAdded;
    private BigDecimal amountPaid;
    private String message;
}


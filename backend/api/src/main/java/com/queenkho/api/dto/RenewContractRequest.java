package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RenewContractRequest {
    private Integer months;          // 1, 3, 6, 12
    private String paymentMethod;    // VIETQR, VNPAY, CASH, etc.
}


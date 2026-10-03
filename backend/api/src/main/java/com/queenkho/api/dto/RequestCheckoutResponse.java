package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RequestCheckoutResponse {
    private Integer contractId;
    private String contractCode;
    private LocalDate checkoutDate;
    private String status;
    private String message;
}


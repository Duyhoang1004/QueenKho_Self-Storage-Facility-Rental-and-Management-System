package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RequestCheckoutRequest {
    private LocalDate checkoutDate;
    private String bankName;
    private String bankAccountNumber;
    private String bankAccountName;
    private String notes;
}


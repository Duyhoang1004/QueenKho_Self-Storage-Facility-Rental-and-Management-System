package com.queenkho.api.dto;

import lombok.Data;

@Data
public class CancelReservationRequest {
    private String reason;
    private String otherReason;
    private String refundMethod; // BANK_TRANSFER | CASH
    private String bankName;
    private String bankAccountNumber;
    private String bankAccountName;
}

package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class PendingReservationResponse {
    private Integer id;
    private String reservationCode;
    private String customerName;
    private String customerPhone;
    private String unitTypeName;
    private LocalDate startDate;
    private Integer durationMonths;
    private BigDecimal depositAmount;
    private LocalDateTime createdAt;
}
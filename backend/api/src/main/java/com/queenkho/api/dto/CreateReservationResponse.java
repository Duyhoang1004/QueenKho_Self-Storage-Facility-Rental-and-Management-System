package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateReservationResponse {
    private Integer id;
    private String reservationCode;
    private BigDecimal depositAmount;
    private String status;
    private LocalDate startDate;
    private Integer durationMonths;
    private String message;
}

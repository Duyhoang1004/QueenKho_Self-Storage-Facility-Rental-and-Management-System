package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@AllArgsConstructor
public class MyReservationResponse {
    private Integer id;
    private String reservationCode;
    private String facilityName;
    private String unitTypeName;
    private LocalDate startDate;
    private Integer durationMonths;
    private BigDecimal depositAmount;
    private String status;
}
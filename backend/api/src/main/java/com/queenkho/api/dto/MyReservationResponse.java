package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class MyReservationResponse {
    private Integer id;
    private String reservationCode;
    private String facilityName;
    private String unitTypeName;
    private String storageUnitId;   // null cho tới khi FM gán ô kho (UC-14)
    private LocalDate startDate;
    private Integer durationMonths;
    private BigDecimal depositAmount;
    private String status;
    private LocalDateTime createdAt;
    private LocalDate endDate;
}
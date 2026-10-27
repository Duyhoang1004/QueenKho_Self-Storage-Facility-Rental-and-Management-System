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
    private String customerName;
    private String customerPhone;
    private String facilityName;
    private String facilityAddress;
    private String unitTypeName;
    private BigDecimal areaSqm;
    private String dimensions;
    private String storageUnitId;   // null cho tới khi FM gán ô kho (UC-14)
    private LocalDate startDate;
    private Integer durationMonths;
    private BigDecimal depositAmount;
    private String status;
    private LocalDateTime createdAt;
    private LocalDate endDate;
    private BigDecimal totalPaid; 
    private Integer contractId; 
    private String customerEmail;
    private String customerCccd;
    private String facilityHotline;
    private String storageUnitFloor;
    private String storageUnitZone;
    private String storageUnitRoomNumber;
}

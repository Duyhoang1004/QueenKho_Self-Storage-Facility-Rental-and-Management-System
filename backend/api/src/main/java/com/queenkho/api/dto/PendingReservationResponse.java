package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
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
    private String staffNote;
    private String staffName;
    private Boolean noShowEligible;
    private Integer failedContactCount;
    private String noShowIneligibleReason;

    public PendingReservationResponse(Integer id, String reservationCode, String customerName,
                                      String customerPhone, String unitTypeName, LocalDate startDate,
                                      Integer durationMonths, BigDecimal depositAmount, LocalDateTime createdAt) {
        this(id, reservationCode, customerName, customerPhone, unitTypeName, startDate, durationMonths, depositAmount, createdAt, null, null, null, null, null);
    }
}
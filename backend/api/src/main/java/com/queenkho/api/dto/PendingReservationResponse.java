package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class PendingReservationResponse {
    private Integer id;
    private String reservationCode;
    private String customerName;
    private String unitTypeName;
    private LocalDateTime createdAt;
}
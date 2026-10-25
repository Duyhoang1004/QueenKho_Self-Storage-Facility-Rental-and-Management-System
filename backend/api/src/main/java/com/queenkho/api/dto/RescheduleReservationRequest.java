package com.queenkho.api.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class RescheduleReservationRequest {

    private LocalDate newStartDate;
    private String reason;
    private Integer managerId; // UC-31 / PR-A8: FM thao tác, để ghi log đúng người
}

package com.queenkho.api.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class RescheduleReservationRequest {

    private LocalDate newStartDate;
    private String reason;
}

package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateReservationRequest {
    private Integer customerId;
    private Integer facilityId;
    private Integer unitTypeId;
    private LocalDate startDate;
    private Integer durationMonths;
}

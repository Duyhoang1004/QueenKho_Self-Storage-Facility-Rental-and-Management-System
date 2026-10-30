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
    private Boolean acceptedTerms; // Bắt buộc true: khách đồng ý điều khoản xử lý tài sản khi không trả kho
    private String phone;
    private String cccd;
}

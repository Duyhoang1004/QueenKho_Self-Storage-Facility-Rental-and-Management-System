package com.queenkho.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateStorageUnitStatusRequest {

    @NotBlank(message = "Trạng thái không được để trống")
    private String status; // AVAILABLE or MAINTENANCE

    private String note;
}


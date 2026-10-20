package com.queenkho.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateStorageUnitRequest {

    @NotNull(message = "unitTypeId không được để trống")
    private Integer unitTypeId;

    @NotBlank(message = "Tầng không được để trống")
    private String floor;

    @NotBlank(message = "Khu vực (zone) không được để trống")
    private String zone;

    @NotBlank(message = "Số phòng không được để trống")
    private String roomNumber;
}


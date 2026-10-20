package com.queenkho.api.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateStorageUnitRequest {

    @NotNull(message = "unitTypeId không được để trống")
    private Integer unitTypeId;

    private String floor;
    private String zone;
    private String roomNumber;
}


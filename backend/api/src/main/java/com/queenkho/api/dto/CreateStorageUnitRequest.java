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

    // UC-06: vị trí trên mặt bằng tầng (tuỳ chọn). mapW/mapH bỏ trống = kích thước mặc định theo loại kho
    private Integer mapX;
    private Integer mapY;
    private Integer mapW;
    private Integer mapH;
    private String mapDoor;
}


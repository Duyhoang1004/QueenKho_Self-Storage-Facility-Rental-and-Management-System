package com.queenkho.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// UC-06: vị trí 1 ô kho trên mặt bằng; x = null nghĩa là gỡ ô khỏi mặt bằng
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnitPlacementDto {

    @NotBlank(message = "Thiếu mã ô kho")
    private String unitId;

    private Integer x;
    private Integer y;
    private Integer w;
    private Integer h;
    private String door; // TOP / BOTTOM / LEFT / RIGHT
}

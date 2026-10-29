package com.queenkho.api.dto;

import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

// UC-06: lưu mặt bằng 1 tầng. fixtures = danh sách MỚI (thay toàn bộ); units = các ô cần đặt / dời / gỡ
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SaveFloorPlanRequest {

    @Valid
    @Builder.Default
    private List<UnitPlacementDto> units = new ArrayList<>();

    @Valid
    @Builder.Default
    private List<FloorFixtureDto> fixtures = new ArrayList<>();
}

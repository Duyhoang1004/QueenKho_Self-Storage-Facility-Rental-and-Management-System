package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// UC-06: mặt bằng 1 tầng (kích thước lưới + vật cố định); ô kho lấy từ GET /storage-units
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FloorLayoutResponse {
    private Integer id;
    private String name;
    private Integer gridWidth;
    private Integer gridHeight;
    private Integer sortOrder;
    private List<FloorFixtureDto> fixtures;
}

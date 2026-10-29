package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// UC-06: toàn bộ mặt bằng của 1 cơ sở
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FacilityLayoutResponse {
    private Integer facilityId;
    private double cellMeters; // 1 ô lưới = bao nhiêu mét (0.5)
    private List<FloorLayoutResponse> floors;
}

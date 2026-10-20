package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StorageUnitListResponse {
    private List<StorageUnitDetailResponse> units;
    private int totalUnits;
    private int availableUnits;
    private int occupiedUnits;
    private int maintenanceUnits;
    private int overdueUnits;
    private double occupancyRate;
    private List<String> floors;
    private Integer facilityId;
    private String facilityName;
}


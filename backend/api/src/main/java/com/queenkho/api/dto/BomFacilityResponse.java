package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BomFacilityResponse {
    private Integer id;
    private String code;
    private String name;
    private String city;
    private String district;
    private String address;
    private String hotline;
    private String status; // ACTIVE / INACTIVE

    // Aggregate statistics
    private int totalUnits;
    private int availableUnits;
    private int occupiedUnits;
    private int maintenanceUnits;
    private int activeContractsCount;
    private int pendingReservationsCount;

    // Assigned Facility Manager info (if any)
    private Integer managerId;
    private String managerName;
    private String managerEmail;
    private String managerPhone;
}

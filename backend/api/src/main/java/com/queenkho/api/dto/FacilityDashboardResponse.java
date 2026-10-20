package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FacilityDashboardResponse {

    private FacilityInfo facility;
    private KpiSummary kpi;
    private List<CapacityItem> zoneCapacities;
    private List<UnitTypeCapacityItem> unitTypeCapacities;
    private List<DashboardAlertItem> alerts;
    private LocalDateTime generatedAt;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class FacilityInfo {
        private Integer id;
        private String code;
        private String name;
        private String city;
        private String district;
        private String address;
        private String hotline;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class KpiSummary {
        private int totalUnits;
        private int occupiedUnits;
        private int availableUnits;
        private int maintenanceUnits;
        private int reservedUnits;
        private double occupancyRate;
        private int pendingReservationsCount;
        private int overdueContractsCount;
        private int activeContractsCount;
        private int openTasksCount;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CapacityItem {
        private String key;
        private String name;
        private String description;
        private int totalUnits;
        private int occupiedUnits;
        private int availableUnits;
        private int maintenanceUnits;
        private double occupancyRate;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UnitTypeCapacityItem {
        private Integer unitTypeId;
        private String unitTypeName;
        private BigDecimal areaSqm;
        private BigDecimal basePriceMonthly;
        private int totalUnits;
        private int availableUnits;
        private int occupiedUnits;
        private double occupancyRate;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DashboardAlertItem {
        private String id;
        private String type; // WARNING, CRITICAL, INFO
        private String category; // PENDING_RESERVATION, OVERDUE_CONTRACT, TASK_OVERDUE, MAINTENANCE
        private String title;
        private String message;
        private String actionText;
        private String actionUrl;
        private String timeAgo;
    }
}


package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StorageUnitDetailResponse {
    private String id;
    private Integer facilityId;
    private String facilityName;
    private String facilityCode;
    private Integer unitTypeId;
    private String unitTypeName;
    private BigDecimal areaSqm;
    private BigDecimal volumeCbm;
    private BigDecimal basePriceMonthly;
    private String floor;
    private String zone;
    private String roomNumber;
    private String status; // AVAILABLE, OCCUPIED, MAINTENANCE
    private boolean overdue; // true if current contract is OVERDUE
    private CurrentContractInfo currentContract;
    private boolean canDelete; // true only if never had any rental contract in history

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CurrentContractInfo {
        private Integer contractId;
        private String contractCode;
        private Integer customerId;
        private String customerName;
        private String customerPhone;
        private LocalDate startDate;
        private LocalDate endDate;
        private String contractStatus;
    }
}


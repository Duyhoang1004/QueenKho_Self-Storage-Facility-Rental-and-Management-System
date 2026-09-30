package com.queenkho.api.dto;

import lombok.*;
import java.math.BigDecimal;
import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class FacilityAvailabilityResponse {

    private FacilityInfo facility;
    private List<UnitTypeSlot> unitTypeAvailability;

    @NoArgsConstructor
    @AllArgsConstructor
    @Getter
    @Setter
    public static class FacilityInfo {
        private Integer id;
        private String name;
        private String city;
        private String district;
        private String address;
        private String hotline;
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @Getter
    @Setter
    public static class UnitTypeSlot {
        private Integer unitTypeId;
        private String unitTypeName;
        private BigDecimal areaSqm;
        private BigDecimal basePriceMonthly;
        private String dimensions;
        private String suggestedCapacity;
        private String features;
        private int totalUnits;
        private int availableCount;
    }
}

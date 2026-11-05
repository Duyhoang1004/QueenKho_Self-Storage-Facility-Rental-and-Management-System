package com.queenkho.api.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
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
        private Integer depositMonthMultiplier;
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
        private int totalBookings;
        private LocalDate availableFrom; // PR-R11: null = còn ô ngay; có giá trị = chỉ nhận được từ ngày này
        private String temperatureClass = "NORMAL"; // BR-131: NORMAL / COLD / FROZEN

        public UnitTypeSlot(Integer unitTypeId, String unitTypeName, BigDecimal areaSqm, BigDecimal basePriceMonthly,
                            String dimensions, String suggestedCapacity, String features, int totalUnits,
                            int availableCount, int totalBookings, LocalDate availableFrom) {
            this(unitTypeId, unitTypeName, areaSqm, basePriceMonthly, dimensions, suggestedCapacity, features, totalUnits,
                    availableCount, totalBookings, availableFrom, "NORMAL");
        }
    }
}


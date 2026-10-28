package com.queenkho.api.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class FacilitySearchResultItem {
    private Integer facilityId;
    private String facilityName;
    private String city;
    private String district;
    private String address;
    private String hotline;
    private Integer unitTypeId;
    private String unitTypeName;
    private BigDecimal areaSqm;
    private BigDecimal basePriceMonthly;
    private String dimensions;
    private String suggestedCapacity;
    private String features;
    private int availableCount;
    private int totalBookings;
    private LocalDate availableFrom; // PR-R11: hết ô trống nhưng có ô "sắp trống" → nhận kho được từ ngày này (null = có ô ngay)
}


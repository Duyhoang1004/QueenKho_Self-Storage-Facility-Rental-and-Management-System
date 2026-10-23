package com.queenkho.api.dto;

import lombok.*;
import java.math.BigDecimal;

@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@Builder
public class UnitTypeResponse {
    private Integer id;
    private String name;
    private BigDecimal areaSqm;
    private BigDecimal volumeCbm;
    private BigDecimal basePriceMonthly;
    private String suggestedCapacity;
    private String dimensions;
    private String features;
    private String status;

    public UnitTypeResponse(Integer id, String name, BigDecimal areaSqm, BigDecimal volumeCbm,
                            BigDecimal basePriceMonthly, String suggestedCapacity, String dimensions, String features) {
        this.id = id;
        this.name = name;
        this.areaSqm = areaSqm;
        this.volumeCbm = volumeCbm;
        this.basePriceMonthly = basePriceMonthly;
        this.suggestedCapacity = suggestedCapacity;
        this.dimensions = dimensions;
        this.features = features;
        this.status = "ACTIVE";
    }
}

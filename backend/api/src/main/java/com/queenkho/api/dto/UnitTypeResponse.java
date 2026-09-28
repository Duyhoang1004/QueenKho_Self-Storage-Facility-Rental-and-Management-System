package com.queenkho.api.dto;

import lombok.*;
import java.math.BigDecimal;

@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class UnitTypeResponse {
    private Integer id;
    private String name;
    private BigDecimal areaSqm;
    private BigDecimal volumeCbm;
    private BigDecimal basePriceMonthly;
    private String suggestedCapacity;
    private String dimensions;
    private String features;
}

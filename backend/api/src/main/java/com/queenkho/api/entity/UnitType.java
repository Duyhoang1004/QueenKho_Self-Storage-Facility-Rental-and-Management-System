package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "unit_types")
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class UnitType {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "area_sqm", nullable = false, precision = 8, scale = 2)
    private BigDecimal areaSqm;

    @Column(name = "volume_cbm", nullable = false, precision = 8, scale = 2)
    private BigDecimal volumeCbm;

    @Column(name = "base_price_monthly", nullable = false, precision = 12, scale = 2)
    private BigDecimal basePriceMonthly;

    @Column(name = "suggested_capacity", length = 150)
    private String suggestedCapacity;

    @Column(length = 100)
    private String dimensions;

    @Column(length = 500)
    private String features;
}
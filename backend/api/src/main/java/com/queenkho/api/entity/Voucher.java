package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

// BR-25 (sửa 02/11/2026): voucher đặt kho do BOM quản lý. NEWKHO là mã mặc định (is_default) tự áp khi khách không nhập mã.
@Entity
@Table(name = "vouchers")
@Getter
@Setter
@NoArgsConstructor
public class Voucher {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(name = "discount_type", nullable = false, length = 10)
    private String discountType;          // FIXED / PERCENT

    @Column(name = "discount_value", nullable = false, precision = 12, scale = 2)
    private BigDecimal discountValue;

    @Column(name = "max_discount", precision = 12, scale = 2)
    private BigDecimal maxDiscount;       // trần giảm cho PERCENT

    @Column(name = "min_months", nullable = false)
    private Integer minMonths = 1;

    @Column(name = "facility_id")
    private Integer facilityId;           // NULL = mọi cơ sở

    @Column(name = "start_at", nullable = false)
    private LocalDateTime startAt;

    @Column(name = "end_at")
    private LocalDateTime endAt;

    @Column(name = "usage_limit")
    private Integer usageLimit;

    @Column(name = "per_user_limit")
    private Integer perUserLimit;

    @Column(name = "used_count", nullable = false)
    private Integer usedCount = 0;

    @Column(name = "is_default", nullable = false)
    private Boolean isDefault = false;

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";     // ACTIVE / INACTIVE

    @Column(name = "created_by")
    private Integer createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}

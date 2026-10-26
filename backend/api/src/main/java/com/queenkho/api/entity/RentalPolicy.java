package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "rental_policy")
@Getter
@Setter
public class RentalPolicy {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "facility_id", nullable = false)
    private Facility facility;

    @Column(name = "policy_name", nullable = false, length = 150)
    private String policyName;

    @Column(name = "deposit_month_multiplier", nullable = false)
    private Integer depositMonthMultiplier;

    @Column(name = "cancel_fee_percent", nullable = false)
    private Integer cancelFeePercent;

    @Column(name = "cancel_free_hours", nullable = false)
    private Integer cancelFreeHours;

    @Column(name = "late_fee_percent_per_day", nullable = false)
    private Integer lateFeePercentPerDay;

    @Column(name = "late_fee_max_percent", nullable = false)
    private Integer lateFeeMaxPercent;

    @Column(name = "liquidation_days", nullable = false)
    private Integer liquidationDays;

    // Flow 4: % ưu đãi tiền thuê theo gói (gói 1 tháng luôn 0%)
    @Column(name = "booking_discount_3m", nullable = false)
    private Integer bookingDiscount3m = 5;

    @Column(name = "booking_discount_6m", nullable = false)
    private Integer bookingDiscount6m = 10;

    @Column(name = "booking_discount_12m", nullable = false)
    private Integer bookingDiscount12m = 15;

    @Column(name = "renewal_discount_3m", nullable = false)
    private Integer renewalDiscount3m = 0;

    @Column(name = "renewal_discount_6m", nullable = false)
    private Integer renewalDiscount6m = 5;

    @Column(name = "renewal_discount_12m", nullable = false)
    private Integer renewalDiscount12m = 10;

    // Flow 4/6: FM của cơ sở có được miễn phí trễ cho khách hay không
    @Column(name = "allow_late_fee_waiver", nullable = false)
    private boolean allowLateFeeWaiver = true;

    @Column(nullable = false)
    private Integer version;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    private User createdBy;
}

package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

// BR-126 → BR-128: hồ sơ bồi thường hàng của khách bị hư / mất trong thời gian thuê (sinh từ ticket hỗ trợ)
@Entity
@Table(name = "compensation_claims")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CompensationClaim {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "claim_code", nullable = false, length = 20)
    private String claimCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "support_request_id", nullable = false)
    private SupportRequest supportRequest;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_id", nullable = false)
    private RentalContract contract;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private User customer;

    @Column(name = "facility_id", nullable = false)
    private Integer facilityId;

    @Column(name = "claim_type", nullable = false, length = 20)
    private String claimType;            // GOODS_DAMAGE / GOODS_LOSS

    @Column(name = "incident_date")
    private LocalDate incidentDate;

    @Column(name = "items_description", nullable = false, length = 2000)
    private String itemsDescription;

    @Column(name = "claimed_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal claimedAmount;

    @Column(name = "customer_images")
    private String customerImages;

    @Column(nullable = false, length = 20)
    private String status = "SUBMITTED"; // SUBMITTED / INSPECTED / APPROVED / PAID / REJECTED / WITHDRAWN

    // Kiểm tra hiện trường (Staff)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inspected_by")
    private User inspectedBy;

    @Column(name = "inspected_at")
    private LocalDateTime inspectedAt;

    @Column(name = "inspection_note", length = 1000)
    private String inspectionNote;

    @Column(name = "inspection_images")
    private String inspectionImages;

    @Column(name = "preliminary_cause", length = 20)
    private String preliminaryCause;     // CUSTOMER / FACILITY / FORCE_MAJEURE / UNKNOWN

    // Quyết định (FM)
    @Column(name = "liable_party", length = 20)
    private String liableParty;          // CUSTOMER / FACILITY / FORCE_MAJEURE

    @Column(name = "assessed_value", precision = 15, scale = 2)
    private BigDecimal assessedValue;

    @Column(name = "damage_percent")
    private Integer damagePercent;

    @Column(name = "unusable_days")
    private Integer unusableDays;

    @Column(name = "coverage_cap", precision = 15, scale = 2)
    private BigDecimal coverageCap;

    @Column(name = "goods_compensation", precision = 15, scale = 2)
    private BigDecimal goodsCompensation;

    @Column(name = "penalty_amount", precision = 15, scale = 2)
    private BigDecimal penaltyAmount;

    @Column(name = "rent_refund_amount", precision = 15, scale = 2)
    private BigDecimal rentRefundAmount;

    @Column(name = "total_compensation", precision = 15, scale = 2)
    private BigDecimal totalCompensation;

    @Column(length = 20)
    private String resolution;           // CONTINUE / TERMINATE

    @Column(name = "decision_note", length = 1000)
    private String decisionNote;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "decided_by")
    private User decidedBy;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    // Chi trả (FM)
    @Column(name = "payment_method", length = 20)
    private String paymentMethod;        // BANK_TRANSFER / CASH

    @Column(name = "payment_evidence")
    private String paymentEvidence;

    @Column(name = "bank_transaction_code", length = 100)
    private String bankTransactionCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "paid_by")
    private User paidBy;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    // Hồ sơ đòi bên bảo hiểm (gói ADVANCED / PREMIUM)
    @Column(name = "insurance_status", length = 20)
    private String insuranceStatus;      // NOT_APPLICABLE / SUBMITTED / APPROVED / PAID / REJECTED

    @Column(name = "insurance_ref", length = 50)
    private String insuranceRef;

    @Column(name = "insurance_amount", precision = 15, scale = 2)
    private BigDecimal insuranceAmount;

    @Column(name = "insurance_updated_at")
    private LocalDateTime insuranceUpdatedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}

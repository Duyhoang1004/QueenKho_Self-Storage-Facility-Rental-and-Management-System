package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

// PR-Q10: hàng của khách lưu giữ sau thanh lý hợp đồng (lập khi "Dọn xong" task dọn kho)
@Entity
@Table(name = "held_goods")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class HeldGoods {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_id", nullable = false)
    private RentalContract contract;

    @Column(name = "facility_id", nullable = false)
    private Integer facilityId;

    @Column(name = "task_id")
    private Integer taskId;

    @Column(name = "inventory_note", nullable = false, length = 2000)
    private String inventoryNote;

    @Column(name = "evidence_image_urls")
    private String evidenceImageUrls;

    @Column(name = "witness_note", nullable = false, length = 500)
    private String witnessNote;

    @Column(name = "storage_location", nullable = false, length = 100)
    private String storageLocation;

    // HOLDING / RETURNED / SOLD / DESTROYED / HANDED_TO_AUTHORITY
    @Column(nullable = false, length = 30)
    private String status = "HOLDING";

    @Column(name = "hold_until", nullable = false)
    private LocalDate holdUntil;

    @Column(name = "proceeds_amount", precision = 12, scale = 2)
    private BigDecimal proceedsAmount;

    @Column(name = "debt_offset_amount", precision = 12, scale = 2)
    private BigDecimal debtOffsetAmount;

    @Column(name = "refund_amount", precision = 12, scale = 2)
    private BigDecimal refundAmount;

    @Column(name = "resolved_note", length = 1000)
    private String resolvedNote;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resolved_by")
    private User resolvedBy;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}

package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

// BR-122: lịch sử FM chuyển hợp đồng sang ô khác (không gắn cứng khách với 1 ô)
@Entity
@Table(name = "unit_transfers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UnitTransfer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_id", nullable = false)
    private RentalContract contract;

    @Column(name = "from_unit_id", nullable = false)
    private String fromUnitId;

    @Column(name = "to_unit_id", nullable = false)
    private String toUnitId;

    @Column(name = "reason_type", nullable = false)
    private String reasonType;      // FACILITY_ISSUE / CUSTOMER_REQUEST / REARRANGE

    @Column(nullable = false)
    private String reason;

    @Column(name = "old_unit_status", nullable = false)
    private String oldUnitStatus;   // AVAILABLE / MAINTENANCE

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "moved_by", nullable = false)
    private User movedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}

package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "facility_tasks")
public class StaffTask {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "facility_id", nullable = false)
    private Integer facilityId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_id")
    private RentalContract contract;

    @Column(name = "support_request_id")
    private Integer supportRequestId;

    @Column(name = "task_type", nullable = false)
    private String taskType;

    @Column(nullable = false)
    private String status = "OPEN";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "staff_id")
    private User staff;

    @Column(name = "due_at")
    private LocalDateTime dueAt;

    @Column(name = "note")
    private String note;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "claimed_at")
    private LocalDateTime claimedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "evidence_image_url")
    private String evidenceImageUrl;

    // Task MAINTENANCE: DAMAGE (sự cố sau trả kho) / LIQUIDATION (dọn kho sau thanh lý)
    @Column(name = "maintenance_reason", length = 20)
    private String maintenanceReason;
}

package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
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

    // ===== D-22 / PR-O25 → PR-O27: khách xác nhận đã nhận tiền hoàn (task REFUND) =====
    public static final String RECEIPT_WAITING = "WAITING_CUSTOMER";
    public static final String RECEIPT_CONFIRMED = "CONFIRMED";
    public static final String RECEIPT_AUTO_CONFIRMED = "AUTO_CONFIRMED";
    public static final String RECEIPT_DISPUTED = "DISPUTED";

    @Column(name = "customer_id")
    private Integer customerId;

    @Column(name = "refund_amount", precision = 15, scale = 2)
    private BigDecimal refundAmount;

    @Column(name = "receipt_status", length = 20)
    private String receiptStatus;

    @Column(name = "receipt_confirmed_at")
    private LocalDateTime receiptConfirmedAt;

    @Column(name = "receipt_auto_confirmed", nullable = false)
    private Boolean receiptAutoConfirmed = false;

    @Column(name = "receipt_dispute_reason", length = 500)
    private String receiptDisputeReason;

    @Column(name = "receipt_disputed_at")
    private LocalDateTime receiptDisputedAt;

    @Column(name = "receipt_round", nullable = false)
    private Integer receiptRound = 0;

    // 22/11/2026 — PR-T2: lý do task bị huỷ (khách huỷ đơn / khách huỷ yêu cầu hỗ trợ), hiện cho nhân viên
    @Column(name = "cancel_reason", length = 300)
    private String cancelReason;

    // Ngày hẹn gốc của thao tác giả lập: CHECK_OUT dùng để chốt quyết toán, CHECK_IN dùng để mở bàn giao
    // theo ngày hẹn mà không sửa ngày của đơn/hợp đồng. NULL = luồng thật.
    @Column(name = "simulated_checkout_date")
    private LocalDate simulatedCheckoutDate;
}

package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

// D-21 / PR-O19: bảng quyết toán trả kho — mỗi vòng (nghiệm thu, FM sửa / giữ nguyên, Staff kiểm tra lại) là 1 dòng,
// vòng cũ chuyển SUPERSEDED. Hợp đồng chỉ TERMINATED khi vòng hiện tại COMPLETED.
@Entity
@Table(name = "checkout_settlements")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CheckoutSettlement {

    public static final String WAITING_CLAIM = "WAITING_CLAIM";
    public static final String WAITING_CUSTOMER = "WAITING_CUSTOMER";
    public static final String DISPUTED = "DISPUTED";
    public static final String RECHECKING = "RECHECKING";
    public static final String AWAITING_PAYMENT = "AWAITING_PAYMENT";
    // D-23 / PR-O29: khách đã xác nhận, chờ FM chi tiền → FM đã chi, chờ khách xác nhận đã nhận
    public static final String REFUNDING = "REFUNDING";
    public static final String REFUND_SENT = "REFUND_SENT";
    public static final String COMPLETED = "COMPLETED";
    public static final String SUPERSEDED = "SUPERSEDED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_id", nullable = false)
    private RentalContract contract;

    @Column(name = "round_no", nullable = false)
    private Integer roundNo = 1;

    @Column(name = "check_out_task_id")
    private Integer checkOutTaskId;

    @Column(nullable = false, length = 30)
    private String status;

    @Column(name = "checkout_date", nullable = false)
    private LocalDate checkoutDate;

    @Column(name = "deposit_held", nullable = false, precision = 15, scale = 2)
    private BigDecimal depositHeld = BigDecimal.ZERO;

    @Column(name = "damage_fee", nullable = false, precision = 15, scale = 2)
    private BigDecimal damageFee = BigDecimal.ZERO;

    @Column(name = "late_fee", nullable = false, precision = 15, scale = 2)
    private BigDecimal lateFee = BigDecimal.ZERO;

    @Column(name = "overstay_fee", nullable = false, precision = 15, scale = 2)
    private BigDecimal overstayFee = BigDecimal.ZERO;

    @Column(name = "rent_refund", nullable = false, precision = 15, scale = 2)
    private BigDecimal rentRefund = BigDecimal.ZERO;

    @Column(name = "compensation_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal compensationAmount = BigDecimal.ZERO;

    @Column(name = "net_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal netAmount = BigDecimal.ZERO;

    @Column(name = "breakdown_note", length = 2000)
    private String breakdownNote;

    @Column(name = "staff_note", length = 1000)
    private String staffNote;

    @Column(name = "manager_note", length = 1000)
    private String managerNote;

    @Column(name = "dispute_reason", length = 500)
    private String disputeReason;

    @Column(name = "disputed_at")
    private LocalDateTime disputedAt;

    @Column(name = "customer_confirmed_at")
    private LocalDateTime customerConfirmedAt;

    @Column(name = "auto_confirmed", nullable = false)
    private Boolean autoConfirmed = false;

    @Column(name = "refund_method", length = 20)
    private String refundMethod;

    @Column(name = "debt_transaction_id")
    private Integer debtTransactionId;

    @Column(name = "refund_task_id")
    private Integer refundTaskId;

    @Column(name = "created_by")
    private Integer createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // D-22: tiền thuê / bảo hiểm kỳ hiện tại lúc nghiệm thu (RefundBreakdown.RentBasis dạng key=value)
    @Column(name = "rent_basis", length = 1000)
    private String rentBasis;

    // D-23 / PR-O31: số tiền hoàn dự kiến khách thấy lúc hẹn trả kho (chưa có sự cố / bồi thường) — để đối chiếu
    @Column(name = "expected_net", precision = 15, scale = 2)
    private BigDecimal expectedNet;

    @Column(name = "scheduled_checkout_date")
    private LocalDate scheduledCheckoutDate;

    /** Quyết toán âm → khách phải trả thêm (PR-O21) */
    public boolean customerPays() {
        return netAmount != null && netAmount.signum() < 0;
    }

    /** Vòng còn hiệu lực (chưa bị thay, chưa xong) */
    public boolean isOpen() {
        return !SUPERSEDED.equals(status) && !COMPLETED.equals(status);
    }
}

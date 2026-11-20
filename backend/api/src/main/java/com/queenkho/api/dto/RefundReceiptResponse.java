package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

// D-22 / PR-O25: khoản hoàn tiền cơ sở đã chi — khách xác nhận "Đã nhận được" / "Chưa nhận được"
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RefundReceiptResponse {
    private Integer taskId;
    private Integer contractId;
    private String contractCode;
    private String reservationCode;
    private String facilityName;
    private BigDecimal amount;
    private String paymentMethod;          // BANK_TRANSFER / CASH
    private String bankTransactionCode;
    private String evidenceImageUrl;
    private LocalDateTime completedAt;
    private String taskStatus;             // COMPLETED / IN_PROGRESS (đang xử lý phản hồi) / OVERDUE
    private String receiptStatus;          // WAITING_CUSTOMER / CONFIRMED / AUTO_CONFIRMED / DISPUTED
    private Integer receiptRound;
    private String disputeReason;
    private LocalDateTime confirmedAt;
    private LocalDateTime autoConfirmAt;
    private String managerNote;            // ghi chú / giải thích mới nhất của FM
    private boolean canConfirm;
    private boolean canDispute;
}

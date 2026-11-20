package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

// D-21 / PR-O19: bảng quyết toán trả kho (khách / Staff / FM cùng xem)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SettlementResponse {
    private Integer id;
    private Integer contractId;
    private String contractCode;
    private String contractStatus;
    private Integer reservationId;
    private Integer facilityId;
    private String unitId;
    private Integer customerId;
    private String customerName;
    private String customerPhone;

    private Integer roundNo;
    private String status;
    private LocalDate checkoutDate;
    private Integer checkOutTaskId;

    private BigDecimal depositHeld;
    private BigDecimal damageFee;
    private BigDecimal lateFee;           // phí trễ thực trừ (không vượt phần cọc còn lại — PR-Q3)
    private BigDecimal overstayFee;
    private BigDecimal rentRefund;
    private BigDecimal compensationAmount;
    private BigDecimal netAmount;          // > 0 cơ sở hoàn khách, < 0 khách trả thêm
    private String direction;              // REFUND_TO_CUSTOMER / CUSTOMER_PAYS
    private String refundMethod;           // BANK_TRANSFER / CASH

    private String breakdownNote;
    private String staffNote;
    private String managerNote;
    private String disputeReason;
    private LocalDateTime disputedAt;
    private LocalDateTime customerConfirmedAt;
    private Boolean autoConfirmed;
    private LocalDateTime createdAt;
    private LocalDateTime autoConfirmAt;   // PR-O23: hạn tự xác nhận (quyết toán dương chờ khách)

    private Integer refundTaskId;
    private Integer debtTransactionId;
    private Integer recheckTaskId;         // task kiểm tra lại đang mở (RECHECKING)

    private boolean canConfirm;
    private boolean canDispute;
    private boolean canPay;

    // D-22: bảng "Bạn đã đóng − Cơ sở giữ lại + Bồi thường = Hoàn"
    private List<MoneyLine> lines;
    private BigDecimal paidTotal;
    private BigDecimal keptTotal;
    private BigDecimal addedTotal;

    private List<DamageLine> damages;
    private List<ClaimLine> claims;
    private List<RoundLine> history;       // các vòng trước (mới nhất trước)

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DamageLine {
        private Integer id;
        private String title;
        private String description;
        private BigDecimal estimatedCost;
        private String liableParty;
        private List<String> evidenceImages;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ClaimLine {
        private Integer id;
        private String claimCode;
        private String claimType;
        private String status;
        private BigDecimal totalCompensation;
        private boolean includedInSettlement;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RoundLine {
        private Integer id;
        private Integer roundNo;
        private String status;
        private BigDecimal damageFee;
        private BigDecimal netAmount;
        private String staffNote;
        private String managerNote;
        private String disputeReason;
        private LocalDateTime createdAt;
    }
}

package com.queenkho.api.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

// UC-20 (PR-50): màn "Thanh toán" của khách — tổng quan, khoản cần trả và toàn bộ giao dịch
public record CustomerPaymentsResponse(
        Summary summary,
        List<PaymentItem> debts,
        List<OverdueItem> overdueContracts,
        List<PaymentItem> transactions
) {
    public record Summary(
            BigDecimal totalPaid,        // tiền khách đã chuyển: cọc, thuê, gia hạn, phí trễ, phí sự cố (không gồm khấu trừ cọc)
            BigDecimal totalRefunded,    // QueenKho đã hoàn
            BigDecimal pendingRefund,    // đang chờ quản lý hoàn
            BigDecimal outstandingDebt,  // phí sự cố vượt cọc chưa trả
            BigDecimal depositOffset     // phí đã trừ thẳng vào cọc
    ) {}

    public record PaymentItem(
            Integer id,
            String transactionCode,
            String bankTransactionCode,
            String paymentType,
            String paymentMethod,
            BigDecimal amount,
            String status,
            LocalDateTime paidAt,
            Integer renewalMonths,
            Integer reservationId,
            String reservationCode,
            Integer contractId,
            String contractCode,
            String facilityName,
            String unitTypeName,
            BigDecimal monthlyRentPrice,
            Integer durationMonths,
            BigDecimal baseRentAmount,
            Integer rentDiscountPercent,
            BigDecimal rentDiscountAmount,
            String voucherCode,
            BigDecimal voucherDiscount,
            BigDecimal actualRentPaid,
            BigDecimal depositAmount,
            String insurancePlan,
            BigDecimal insuranceAmount,
            String voucherDiscountType,
            Integer voucherDiscountPercent,
            // --- CÁC TRƯỜNG BÓC TÁCH HOÀN TIỀN & BỒI THƯỜNG ---
            BigDecimal goodsCompensation,
            BigDecimal penaltyCompensation,
            BigDecimal rentRefundCompensation,
            Integer damagePercent,
            String compensationReason,
            BigDecimal refundDepositAmount,
            BigDecimal earlyRentRefund,
            BigDecimal damageDeduction,
            BigDecimal lateFeeDeduction,
            BigDecimal overstayDeduction,
            BigDecimal breakFeeDeduction,
            String refundDescription
    ) {
        public PaymentItem(
                Integer id, String transactionCode, String bankTransactionCode, String paymentType,
                String paymentMethod, BigDecimal amount, String status, LocalDateTime paidAt,
                Integer renewalMonths, Integer reservationId, String reservationCode,
                Integer contractId, String contractCode, String facilityName, String unitTypeName
        ) {
            this(id, transactionCode, bankTransactionCode, paymentType, paymentMethod, amount, status, paidAt,
                    renewalMonths, reservationId, reservationCode, contractId, contractCode, facilityName, unitTypeName,
                    null, null, null, null, null, null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null, null, null);
        }

        public PaymentItem(
                Integer id, String transactionCode, String bankTransactionCode, String paymentType,
                String paymentMethod, BigDecimal amount, String status, LocalDateTime paidAt,
                Integer renewalMonths, Integer reservationId, String reservationCode,
                Integer contractId, String contractCode, String facilityName, String unitTypeName,
                BigDecimal monthlyRentPrice, Integer durationMonths, BigDecimal baseRentAmount,
                Integer rentDiscountPercent, BigDecimal rentDiscountAmount, String voucherCode,
                BigDecimal voucherDiscount, BigDecimal actualRentPaid, BigDecimal depositAmount,
                String insurancePlan, BigDecimal insuranceAmount
        ) {
            this(id, transactionCode, bankTransactionCode, paymentType, paymentMethod, amount, status, paidAt,
                    renewalMonths, reservationId, reservationCode, contractId, contractCode, facilityName, unitTypeName,
                    monthlyRentPrice, durationMonths, baseRentAmount, rentDiscountPercent, rentDiscountAmount,
                    voucherCode, voucherDiscount, actualRentPaid, depositAmount, insurancePlan, insuranceAmount,
                    null, null,
                    null, null, null, null, null, null, null, null, null, null, null, null);
        }

        public PaymentItem(
                Integer id, String transactionCode, String bankTransactionCode, String paymentType,
                String paymentMethod, BigDecimal amount, String status, LocalDateTime paidAt,
                Integer renewalMonths, Integer reservationId, String reservationCode,
                Integer contractId, String contractCode, String facilityName, String unitTypeName,
                BigDecimal monthlyRentPrice, Integer durationMonths, BigDecimal baseRentAmount,
                Integer rentDiscountPercent, BigDecimal rentDiscountAmount, String voucherCode,
                BigDecimal voucherDiscount, BigDecimal actualRentPaid, BigDecimal depositAmount,
                String insurancePlan, BigDecimal insuranceAmount,
                String voucherDiscountType, Integer voucherDiscountPercent
        ) {
            this(id, transactionCode, bankTransactionCode, paymentType, paymentMethod, amount, status, paidAt,
                    renewalMonths, reservationId, reservationCode, contractId, contractCode, facilityName, unitTypeName,
                    monthlyRentPrice, durationMonths, baseRentAmount, rentDiscountPercent, rentDiscountAmount,
                    voucherCode, voucherDiscount, actualRentPaid, depositAmount, insurancePlan, insuranceAmount,
                    voucherDiscountType, voucherDiscountPercent,
                    null, null, null, null, null, null, null, null, null, null, null, null);
        }
    }

    public record OverdueItem(
            Integer contractId,
            String contractCode,
            Integer reservationId,
            String facilityName,
            long overdueDays,
            BigDecimal lateFeeAmount,
            boolean lateFeeWaived,
            BigDecimal overstayFeeAmount // PR-Q14: phí chiếm dụng tính đến hôm nay
    ) {}
}

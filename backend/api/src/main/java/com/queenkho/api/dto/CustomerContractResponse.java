package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@AllArgsConstructor
public class CustomerContractResponse {
    private Integer contractId;
    private String contractCode;
    private Integer customerId;
    private String customerFullName;
    private String customerPhone;
    private String storageUnitId;
    private String unitTypeName;
    private BigDecimal areaSqm;
    private String floor;
    private String zone;
    private String roomNumber;
    private String status; // ACTIVE / OVERDUE / TERMINATED / LIQUIDATED
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer billingCycleMonths;
    private BigDecimal depositHeldAmount;
    private String reservationCode;
    private String accessPinCode;
    private String rfidCardCode;
    private BigDecimal basePriceMonthly;
    private Integer reservationId;
    private BigDecimal totalPaid;     // 🌟 Tổng thực tế đã đóng
    private BigDecimal rentPaid;
    private LocalDate scheduledCheckoutDate; // 🌟 Ngày đã hẹn trả kho (nếu TERMINATION_PENDING)
    private Long overdueDays;                 // Số ngày trễ hạn
    private BigDecimal lateFeeAmount;         // Phí phạt trễ hạn tính theo chính sách
    private BigDecimal estimatedDepositRefund;// Tiền hoàn cọc ước tính sau khi trừ phạt
    private BigDecimal originalDeposit;
    private BigDecimal refundAmount;
    private BigDecimal damageFee;
}

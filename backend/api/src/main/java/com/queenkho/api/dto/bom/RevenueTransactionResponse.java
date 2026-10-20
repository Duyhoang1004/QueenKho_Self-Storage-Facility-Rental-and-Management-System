package com.queenkho.api.dto.bom;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

// UC-29 (PR-O15): Bảng đối soát giao dịch chi tiết cho BOM audit
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RevenueTransactionResponse {

    private Integer id;

    // Mã giao dịch nội bộ (VNP..., REFUND-..., OFFSET-...)
    private String txnRef;

    private LocalDateTime paidAt;

    // Thông tin khách hàng
    private String customerName;
    private String customerPhone;

    // Cơ sở liên quan
    private String facilityName;

    // Mã hợp đồng liên quan (nếu có)
    private String contractCode;

    // Loại giao dịch: DEPOSIT / MONTHLY_RENT / LATE_FEE / DAMAGE_FEE / REFUND
    private String paymentType;

    // Phương thức: VNPAY / BANK_TRANSFER / CASH / DEPOSIT_OFFSET
    private String paymentMethod;

    // Mã FT ngân hàng (dùng đối soát PR-O15)
    private String bankTxnCode;

    private BigDecimal amount;

    // SUCCESS / PENDING / FAILED
    private String status;

    // URL ảnh biên lai hoàn tiền (nếu có — PR-O15)
    private String evidenceUrl;

    private String note;
}

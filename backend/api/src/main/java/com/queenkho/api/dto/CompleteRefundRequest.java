package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Yêu cầu hoàn tất task REFUND từ Facility Manager theo PR-O15 & L-24:
 * - Chuyển khoản (BANK_TRANSFER): bắt buộc mã FT ngân hàng (bankTransactionCode), link ảnh (tùy chọn).
 * - Tiền mặt (CASH): bắt buộc xác nhận khách đã ký nhận tiền (cashReceiptConfirmed = true).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CompleteRefundRequest {
    private String paymentMethod; // BANK_TRANSFER hoặc CASH
    private String bankTransactionCode; // Mã giao dịch ngân hàng (mã FT)
    private String evidenceImageUrl; // Link ảnh chụp ủy nhiệm chi / chuyển khoản
    private Boolean cashReceiptConfirmed; // Khách đã ký nhận tiền mặt tại quầy
    private String note; // Ghi chú thêm
    private String notes; // Alias tương thích ngược
    private java.math.BigDecimal refundAmount; // Số tiền hoàn tùy chỉnh (nếu có)
}

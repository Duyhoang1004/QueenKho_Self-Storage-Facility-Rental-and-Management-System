package com.queenkho.api.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// BR-128: FM xác nhận đã chi trả bồi thường cho khách (bằng chứng như hoàn tiền PR-O15)
@Getter
@Setter
@NoArgsConstructor
public class ClaimPaymentRequest {
    private String paymentMethod;          // BANK_TRANSFER / CASH
    private String evidenceImageUrl;       // bắt buộc khi chuyển khoản (ảnh ủy nhiệm chi)
    private String bankTransactionCode;    // mã FT, tuỳ chọn
    private Boolean cashReceiptConfirmed;  // tiền mặt: khách đã ký nhận
}

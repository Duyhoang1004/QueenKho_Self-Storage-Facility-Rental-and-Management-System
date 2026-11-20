package com.queenkho.api.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// D-21 / PR-O21: Staff / FM thu phần âm của quyết toán bằng tiền mặt tại quầy
@Getter
@Setter
@NoArgsConstructor
public class SettlementCashPaymentRequest {
    private Boolean cashReceiptConfirmed;  // khách đã ký nhận phiếu thu
    private String evidenceImageUrl;       // ảnh phiếu thu (tuỳ chọn)
    private String note;
}

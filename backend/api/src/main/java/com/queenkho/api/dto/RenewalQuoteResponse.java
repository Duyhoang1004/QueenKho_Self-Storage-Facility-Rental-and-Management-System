package com.queenkho.api.dto;

import java.math.BigDecimal;

// Flow 6: báo giá 1 gói gia hạn — đúng số tiền VNPAY sẽ thu (cùng 1 hàm tính với VnpayService)
public record RenewalQuoteResponse(
        int months,
        int discountPercent,
        BigDecimal monthlyPrice,
        BigDecimal subtotal,
        BigDecimal discountAmount,
        BigDecimal rentAmount,
        BigDecimal lateFeeAmount,
        boolean lateFeeWaived,
        BigDecimal totalAmount
) {}

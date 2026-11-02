package com.queenkho.api.dto;

import java.math.BigDecimal;

// BR-25: kết quả kiểm tra voucher cho 1 đơn (khách xem trước khi đặt). voucherId NULL = không có voucher nào áp được
public record VoucherQuoteResponse(
        Integer voucherId,
        String code,
        String name,
        BigDecimal discountAmount,
        BigDecimal rentAmount
) {
}

package com.queenkho.api.dto;

import java.math.BigDecimal;

// BR-127: bảng tính bồi thường (FM xem trước khi chốt; cùng hàm tính với lúc chốt)
public record CompensationQuoteResponse(
        String liableParty,
        BigDecimal goodsLoss,           // giá trị thẩm định × % hư hại (mất = 100%)
        BigDecimal coverageCap,         // trần theo gói bảo hiểm + giá trị khai báo
        BigDecimal goodsCompensation,   // tiền hàng được bồi thường (≤ trần)
        BigDecimal penaltyAmount,       // phạt vi phạm 1 tháng giá thuê (chỉ lỗi cơ sở)
        BigDecimal rentRefundAmount,    // hoàn tiền thuê những ngày ô không dùng được
        BigDecimal totalCompensation,
        boolean insuranceClaimable,     // gói có bảo hiểm → cơ sở chi trước rồi đòi lại tiền hàng
        String explanation
) {}

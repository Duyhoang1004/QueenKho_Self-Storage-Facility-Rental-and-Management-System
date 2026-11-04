package com.queenkho.api.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

// BR-127: FM chốt hồ sơ bồi thường
@Getter
@Setter
@NoArgsConstructor
public class ClaimDecisionRequest {
    private String liableParty;       // CUSTOMER / FACILITY / FORCE_MAJEURE
    private BigDecimal assessedValue; // giá trị hàng bị ảnh hưởng FM thẩm định (≤ số khách khai)
    private Integer damagePercent;    // 1–100 (mất hàng luôn 100)
    private Integer unusableDays;     // số ngày ô không dùng được (0–90)
    private String resolution;        // CONTINUE (tiếp tục thuê / chuyển ô) / TERMINATE (chấm dứt không phí phá HĐ)
    private String note;              // 10–1000 ký tự, gửi kèm thông báo cho khách
}

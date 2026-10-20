package com.queenkho.api.dto.bom;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

// UC-29: Mỗi điểm dữ liệu trên biểu đồ timeline (tháng / quý)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RevenueTimelineResponse {

    // Nhãn trục X — ví dụ "T1", "T2", "Q1 2026"
    private String label;

    // Tiền thuê (DEPOSIT + MONTHLY_RENT)
    private BigDecimal rent;

    // Phí phát sinh (LATE_FEE + DAMAGE_FEE)
    private BigDecimal fees;

    // Tiền hoàn cọc (REFUND)
    private BigDecimal refund;
}

package com.queenkho.api.dto.bom;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

// UC-29 (PR-M7): 8 chỉ số KPI tài chính tổng quan của BOM Dashboard
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RevenueOverviewResponse {

    // Doanh thu tiền thuê (DEPOSIT + MONTHLY_RENT đã SUCCESS)
    private BigDecimal rentalRevenue;

    // Phí phát sinh (LATE_FEE + DAMAGE_FEE đã SUCCESS)
    private BigDecimal feesRevenue;

    // Tổng tiền hoàn cọc đã giải ngân (REFUND đã SUCCESS)
    private BigDecimal refundDisbursed;

    // Quỹ cọc đang giữ — các HĐ đang ACTIVE / OVERDUE / TERMINATION_PENDING
    private BigDecimal depositsHeld;

    // Doanh thu ròng = rentalRevenue + feesRevenue - refundDisbursed
    private BigDecimal netRevenue;

    // % tăng trưởng so với kỳ trước cùng loại
    private double growthRate;

    // Số lượng giao dịch thu tiền thành công trong kỳ
    private long rentalCount;

    // Số lượng giao dịch hoàn tiền trong kỳ
    private long refundCount;
}

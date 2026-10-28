package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Kết quả tính toán quyết toán hoàn tiền trả kho theo bộ Business Rules mới:
 * - PR-O2 (D-10): Trả sớm hoàn tiền thuê (thu hồi ưu đãi + phạt 1 tháng hủy hợp đồng)
 * - PR-O14 (D-11): Phí ân hạn dọn đồ (ngày 1 miễn phí, ngày 2-5 tính giá theo ngày / 30)
 * - PR-Q3: Phí trễ hạn khi quá hạn quá 5 ngày (10%/ngày, trần 50% tiền cọc)
 * - PR-O11: Quyết toán hoàn cọc (trừ sự cố & phí trễ/ân hạn) + gộp hoàn tiền thuê
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RefundCalculationResult {
    private boolean earlyCheckout;
    private int usedMonths;
    private int cycleMonths;
    private BigDecimal baseMonthlyPrice;
    private BigDecimal rentPaid;
    private BigDecimal breakFee;
    private BigDecimal earlyRentRefund;

    private boolean overdueOrGrace;
    private long daysPastEndDate;
    private BigDecimal graceFee;
    private BigDecimal lateFee;
    private BigDecimal overstayFee;        // PR-Q14: phí chiếm dụng khi lỡ ân hạn (0 nếu đơn trước điều khoản v2)

    // Phân bổ cọc theo thứ tự: sự cố → ân hạn / phí trễ → phí chiếm dụng
    private BigDecimal damageOffset;
    private BigDecimal feeOffset;
    private BigDecimal overstayOffset;
    private BigDecimal damageDebtAmount;   // sự cố vượt cọc → nợ DAMAGE_FEE
    private BigDecimal overstayDebtAmount; // phí chiếm dụng vượt cọc → nợ OVERSTAY_FEE

    private BigDecimal depositHeld;
    private BigDecimal totalDamageCost;
    private BigDecimal depositRefund;

    private BigDecimal totalRefundAmount;
    private BigDecimal excessDebtAmount;

    private String breakdownDescription;
}

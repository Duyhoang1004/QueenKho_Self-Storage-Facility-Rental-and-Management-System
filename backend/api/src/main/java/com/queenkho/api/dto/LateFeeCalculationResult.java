package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Kết quả tính toán phí phạt trễ hạn và trạng thái chế tài hợp đồng quá hạn (UC-28 / PR-Q3 / PR-Q5 / PR-Q8)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LateFeeCalculationResult {
    /** Số ngày quá hạn (tính từ end_date + 1 đến ngày kiểm tra) */
    private long overdueDays;

    /** Số tiền phí trễ hạn phải nộp (10%/ngày, trần 50% cọc, tối đa 5 ngày phạt) */
    private BigDecimal lateFeeAmount;

    /** Mức phạt trần tối đa (50% tiền cọc an toàn đang giữ) */
    private BigDecimal maxLateFeeAmount;

    /** Đã chạm trần phạt tối đa (50%) hay chưa */
    private boolean isMaxLateFeeReached;

    /** Mã PIN SmartLock có bị khóa hay không (PR-Q5: hiển thị khóa khi OVERDUE) */
    private boolean isPinLocked;

    /** Đã đủ điều kiện để FM bấm Thanh lý kho hay chưa (quá mốc ngày trong chính sách) */
    private boolean canLiquidate;

    /** Ngưỡng số ngày quá hạn để kích hoạt thanh lý (mặc định 30 ngày từ chính sách) */
    private int liquidationDaysThreshold;

    /** Tiền cọc an toàn đang giữ */
    private BigDecimal depositHeldAmount;

    /** Tiền cọc ước tính hoàn lại sau khi trừ phí trễ (= max(0, cọc - phí trễ)) */
    private BigDecimal estimatedDepositRefund;

    /** Tỷ lệ phạt mỗi ngày (mặc định 0.10 tức 10%) */
    private BigDecimal ratePerDay;

    /** Tỷ lệ trần tối đa (mặc định 0.50 tức 50%) */
    private BigDecimal maxPercent;

    /** Flow 6: FM đã miễn phí trễ cho đợt quá hạn này → lateFeeAmount = 0 */
    private boolean lateFeeWaived;
}


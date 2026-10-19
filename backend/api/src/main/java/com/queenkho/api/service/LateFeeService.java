package com.queenkho.api.service;

import com.queenkho.api.dto.LateFeeCalculationResult;
import com.queenkho.api.entity.RentalContract;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Map;

/**
 * =========================================================================
 * LateFeeService — Dịch vụ tính toán duy nhất cho phí phạt trễ hạn (UC-28)
 * Quy tắc nghiệp vụ tuân thủ: PR-Q1, PR-Q2, PR-Q3, PR-Q4, PR-Q5, PR-Q8
 *
 * ⚠️ GIỚI HẠN NGHIỆP VỤ LIÊN QUAN ĐẾN [CHỐT-3]:
 * -------------------------------------------------------------------------
 * Do hệ thống hiện tại KHÔNG bổ sung thêm cột 'overdue_started_at' vào bảng
 * rental_contracts (nhằm tránh thay đổi schema DB), khi một hợp đồng đang ở
 * trạng thái OVERDUE mà khách hàng thực hiện hẹn lịch trả kho (UC-22 / PR-O1),
 * hợp đồng sẽ chuyển trạng thái sang TERMINATION_PENDING.
 * Khi đó, tại thời điểm nhân viên nghiệm thu trả kho (UC-23 trong calculateCheckoutRefund),
 * hệ thống hiện tại sẽ kiểm tra actualDate > endDate và áp dụng chính sách ân hạn 5 ngày
 * (ngày +1 miễn phí, ngày +2 -> +5 tính theo ngày = giá niêm yết/30) thay vì tiếp tục
 * tính theo biểu phí trễ 10%/ngày của OVERDUE.
 * Đây là giới hạn nghiệp vụ đã được thống nhất tại [CHỐT-3].
 * =========================================================================
 */
@Service
public class LateFeeService {

    // Hằng số nghiệp vụ định nghĩa tập trung ở một chỗ (PR-Q3)
    public static final java.time.ZoneId VIETNAM_ZONE = java.time.ZoneId.of("Asia/Ho_Chi_Minh");
    public static final BigDecimal RATE_PER_DAY = new BigDecimal("0.10"); // 10% mỗi ngày
    public static final BigDecimal MAX_PERCENT = new BigDecimal("0.50");  // Trần tối đa 50% tiền cọc
    public static final int DEFAULT_LIQUIDATION_DAYS = 30;                 // Mặc định 30 ngày nếu policy không có

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * Tính toán phí phạt trễ hạn tính đến ngày hiện tại
     */
    public LateFeeCalculationResult calculateLateFee(RentalContract contract) {
        return calculateLateFee(contract, LocalDate.now(VIETNAM_ZONE));
    }

    /**
     * Tính toán phí phạt trễ hạn và trạng thái chế tài tại một ngày mốc cụ thể
     *
     * @param contract Hợp đồng cần tính toán
     * @param asOfDate Ngày mốc kiểm tra (thường là ngày hôm nay hoặc ngày nghiệm thu)
     * @return LateFeeCalculationResult
     */
    public LateFeeCalculationResult calculateLateFee(RentalContract contract, LocalDate asOfDate) {
        if (contract == null) {
            throw new IllegalArgumentException("Hợp đồng không được để trống");
        }
        if (asOfDate == null) {
            asOfDate = LocalDate.now(VIETNAM_ZONE);
        }

        // 1. Lấy số ngày thanh lý từ rental_policy (chỉ đọc liquidation_days đã có trong schema)
        int liquidationDays = DEFAULT_LIQUIDATION_DAYS;
        if (contract.getRentalPolicyId() != null) {
            java.util.List<Integer> daysList = jdbcTemplate.query(
                    "SELECT liquidation_days FROM rental_policy WHERE id = ?",
                    (rs, rowNum) -> rs.getInt("liquidation_days"),
                    contract.getRentalPolicyId()
            );
            if (!daysList.isEmpty() && daysList.get(0) > 0) {
                liquidationDays = daysList.get(0);
            }
        }

        LocalDate endDate = contract.getEndDate();
        BigDecimal depositHeld = contract.getDepositHeldAmount() != null
                ? contract.getDepositHeldAmount()
                : BigDecimal.ZERO;

        // Nếu hợp đồng chưa có ngày kết thúc hoặc chưa quá hạn
        if (endDate == null || !asOfDate.isAfter(endDate)) {
            return LateFeeCalculationResult.builder()
                    .overdueDays(0)
                    .lateFeeAmount(BigDecimal.ZERO)
                    .maxLateFeeAmount(depositHeld.multiply(MAX_PERCENT).setScale(0, RoundingMode.HALF_UP))
                    .isMaxLateFeeReached(false)
                    .isPinLocked(false)
                    .canLiquidate(false)
                    .liquidationDaysThreshold(liquidationDays)
                    .depositHeldAmount(depositHeld)
                    .estimatedDepositRefund(depositHeld)
                    .ratePerDay(RATE_PER_DAY)
                    .maxPercent(MAX_PERCENT)
                    .build();
        }

        // 2. Tính số ngày quá hạn (PR-Q2: đếm từ end_date + 1 đến asOfDate)
        // Ví dụ: endDate = 10/10, asOfDate = 11/10 -> between là 1 ngày (ngày trễ thứ 1)
        long overdueDays = ChronoUnit.DAYS.between(endDate, asOfDate);

        // 3. Tính phí trễ hạn (PR-Q3):
        // Phí trễ = cọc đang giữ × min(số ngày quá hạn, 5) × RATE_PER_DAY, trần MAX_PERCENT
        long billableDays = Math.min(overdueDays, 5);
        BigDecimal calculatedFee = depositHeld
                .multiply(RATE_PER_DAY)
                .multiply(BigDecimal.valueOf(billableDays))
                .setScale(0, RoundingMode.HALF_UP);

        BigDecimal maxFee = depositHeld.multiply(MAX_PERCENT).setScale(0, RoundingMode.HALF_UP);
        BigDecimal lateFeeAmount = calculatedFee.min(maxFee).min(depositHeld);

        boolean isMaxReached = lateFeeAmount.compareTo(maxFee) >= 0;

        // PR-Q5: OVERDUE thì PIN bị khóa ở mức hiển thị
        boolean isPinLocked = "OVERDUE".equalsIgnoreCase(contract.getStatus());

        // PR-Q8: Đủ điều kiện thanh lý khi trạng thái là OVERDUE và số ngày quá hạn >= liquidationDays (mặc định 30 ngày)
        boolean canLiquidate = "OVERDUE".equalsIgnoreCase(contract.getStatus()) && overdueDays >= liquidationDays;

        BigDecimal estimatedRefund = depositHeld.subtract(lateFeeAmount).max(BigDecimal.ZERO);

        return LateFeeCalculationResult.builder()
                .overdueDays(overdueDays)
                .lateFeeAmount(lateFeeAmount)
                .maxLateFeeAmount(maxFee)
                .isMaxLateFeeReached(isMaxReached)
                .isPinLocked(isPinLocked)
                .canLiquidate(canLiquidate)
                .liquidationDaysThreshold(liquidationDays)
                .depositHeldAmount(depositHeld)
                .estimatedDepositRefund(estimatedRefund)
                .ratePerDay(RATE_PER_DAY)
                .maxPercent(MAX_PERCENT)
                .build();
    }
}


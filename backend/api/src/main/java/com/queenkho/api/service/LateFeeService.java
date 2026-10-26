package com.queenkho.api.service;

import com.queenkho.api.dto.LateFeeCalculationResult;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.RentalPolicy;
import com.queenkho.api.repository.RentalPolicyRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

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
    private RentalPolicyRepository rentalPolicyRepository;

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

        // PR-M5: phí trễ và ngày thanh lý theo phiên bản gắn với hợp đồng.
        int liquidationDays = DEFAULT_LIQUIDATION_DAYS;
        BigDecimal ratePerDay = RATE_PER_DAY;
        BigDecimal maxPercent = MAX_PERCENT;
        if (contract.getRentalPolicyId() != null) {
            RentalPolicy policy = rentalPolicyRepository.findById(contract.getRentalPolicyId()).orElse(null);
            if (policy != null) {
                liquidationDays = policy.getLiquidationDays();
                ratePerDay = BigDecimal.valueOf(policy.getLateFeePercentPerDay(), 2);
                maxPercent = BigDecimal.valueOf(policy.getLateFeeMaxPercent(), 2);
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
                    .maxLateFeeAmount(depositHeld.multiply(maxPercent).setScale(0, RoundingMode.HALF_UP))
                    .isMaxLateFeeReached(false)
                    .isPinLocked(false)
                    .canLiquidate(false)
                    .liquidationDaysThreshold(liquidationDays)
                    .depositHeldAmount(depositHeld)
                    .estimatedDepositRefund(depositHeld)
                    .ratePerDay(ratePerDay)
                    .maxPercent(maxPercent)
                    .build();
        }

        // 2. Tính số ngày quá hạn (PR-Q2: đếm từ end_date + 1 đến asOfDate)
        // Ví dụ: endDate = 10/10, asOfDate = 11/10 -> between là 1 ngày (ngày trễ thứ 1)
        long overdueDays = ChronoUnit.DAYS.between(endDate, asOfDate);

        // 3. Tính phí trễ hạn (PR-Q3):
        // Phí trễ = cọc đang giữ × số ngày quá hạn × tỷ lệ/ngày, giới hạn bởi mức trần.
        BigDecimal calculatedFee = depositHeld
                .multiply(ratePerDay)
                .multiply(BigDecimal.valueOf(overdueDays))
                .setScale(0, RoundingMode.HALF_UP);

        BigDecimal maxFee = depositHeld.multiply(maxPercent).setScale(0, RoundingMode.HALF_UP);
        BigDecimal lateFeeAmount = calculatedFee.min(maxFee).min(depositHeld);

        // Flow 6: FM đã miễn phí trễ cho đợt quá hạn này (chính sách cơ sở cho phép) → không thu phí trễ.
        // Số ngày quá hạn, khoá PIN, mốc thanh lý vẫn giữ nguyên.
        boolean waived = Boolean.TRUE.equals(contract.getLateFeeWaived());
        if (waived) {
            lateFeeAmount = BigDecimal.ZERO;
        }

        boolean isMaxReached = !waived && lateFeeAmount.compareTo(maxFee) >= 0;

        // PR-Q5: OVERDUE thì PIN bị khóa ở mức hiển thị
        boolean isPinLocked = "OVERDUE".equalsIgnoreCase(contract.getStatus());

        // PR-Q8: FM chỉ được thanh lý khi đã quá mốc liquidationDays.
        boolean canLiquidate = "OVERDUE".equalsIgnoreCase(contract.getStatus()) && overdueDays > liquidationDays;

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
                .ratePerDay(ratePerDay)
                .maxPercent(maxPercent)
                .lateFeeWaived(waived)
                .build();
    }
}


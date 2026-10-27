package com.queenkho.api.service;

import com.queenkho.api.dto.LateFeeCalculationResult;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.RentalPolicy;
import com.queenkho.api.repository.RentalPolicyRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
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
    public static final int DEFAULT_LIQUIDATION_DAYS = 15;                 // PR-Q8: mặc định 15 ngày nếu policy không có

    // PR-Q14 / PR-Q15: điều khoản từ phiên bản này trở đi khách đã đồng ý phí chiếm dụng + phí lưu giữ hàng
    public static final String OVERSTAY_TERMS_VERSION = "v2";
    public static final int DEFAULT_OVERSTAY_PERCENT = 150;
    public static final int DEFAULT_HELD_GOODS_FEE_PERCENT = 20;

    @Autowired
    private RentalPolicyRepository rentalPolicyRepository;

    // Tuỳ chọn: unit test tạo service bằng new → không có JdbcTemplate thì bỏ qua phần đọc thêm từ DB
    @Autowired(required = false)
    private JdbcTemplate jdbcTemplate;

    /** Khách đã đồng ý điều khoản có phí chiếm dụng / phí lưu giữ chưa ("v2", "v3"... đều được) */
    public static boolean acceptsOverstayTerms(String termsVersion) {
        return termsVersion != null && termsVersion.compareTo(OVERSTAY_TERMS_VERSION) >= 0;
    }

    /** Giá 1 ngày = giá niêm yết tháng / 30, làm tròn đồng (cùng cách tính phí ân hạn PR-O14) */
    public static BigDecimal dailyRate(BigDecimal monthlyPrice) {
        if (monthlyPrice == null) return BigDecimal.ZERO;
        return monthlyPrice.divide(BigDecimal.valueOf(30), 0, RoundingMode.HALF_UP);
    }

    /**
     * PR-Q14: phí chiếm dụng cho {@code days} ngày quá hạn. Trả 0 nếu khách chưa đồng ý điều khoản v2.
     * FM đã miễn phí trễ (Flow 6) → chỉ tính 100% giá ngày (bỏ phần phạt), không miễn tiền thuê những ngày đã chiếm.
     */
    public BigDecimal overstayFee(RentalContract contract, long days) {
        if (contract == null || days <= 0) return BigDecimal.ZERO;
        OverstayBasis basis = overstayBasis(contract);
        if (!acceptsOverstayTerms(basis.termsVersion())) return BigDecimal.ZERO;
        int percent = Boolean.TRUE.equals(contract.getLateFeeWaived()) ? 100 : overstayPercent(contract);
        return overstayDaily(basis.monthlyPrice(), percent).multiply(BigDecimal.valueOf(days));
    }

    /** % phí lưu giữ hàng sau thanh lý theo chính sách gắn hợp đồng (PR-Q15) */
    public int heldGoodsFeePercent(RentalContract contract) {
        RentalPolicy policy = policyOf(contract);
        return policy != null && policy.getHeldGoodsFeePercent() != null
                ? policy.getHeldGoodsFeePercent() : DEFAULT_HELD_GOODS_FEE_PERCENT;
    }

    /** Điều khoản khách đã đồng ý + giá niêm yết tháng của loại ô — đọc từ entity, thiếu thì hỏi DB */
    public OverstayBasis overstayBasis(RentalContract contract) {
        String terms = null;
        BigDecimal monthly = null;
        try {
            if (contract.getReservation() != null) terms = contract.getReservation().getTermsVersion();
        } catch (RuntimeException ignored) {
            // Quan hệ LAZY ngoài transaction → đọc lại bằng SQL bên dưới
        }
        try {
            if (contract.getStorageUnit() != null && contract.getStorageUnit().getUnitType() != null) {
                monthly = contract.getStorageUnit().getUnitType().getBasePriceMonthly();
            }
        } catch (RuntimeException ignored) {
        }
        if ((terms == null || monthly == null) && jdbcTemplate != null && contract.getId() != null) {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    "SELECT r.terms_version, ut.base_price_monthly FROM rental_contracts c " +
                            "LEFT JOIN reservations r ON r.id = c.reservation_id " +
                            "LEFT JOIN storage_units su ON su.id = c.storage_unit_id " +
                            "LEFT JOIN unit_types ut ON ut.id = su.unit_type_id WHERE c.id = ?",
                    contract.getId());
            if (!rows.isEmpty()) {
                if (terms == null) terms = (String) rows.get(0).get("terms_version");
                if (monthly == null) monthly = (BigDecimal) rows.get(0).get("base_price_monthly");
            }
        }
        return new OverstayBasis(terms, monthly != null ? monthly : BigDecimal.ZERO);
    }

    public record OverstayBasis(String termsVersion, BigDecimal monthlyPrice) {}

    private int overstayPercent(RentalContract contract) {
        RentalPolicy policy = policyOf(contract);
        return policy != null && policy.getOverstayPercent() != null ? policy.getOverstayPercent() : DEFAULT_OVERSTAY_PERCENT;
    }

    private static BigDecimal overstayDaily(BigDecimal monthlyPrice, int percent) {
        return dailyRate(monthlyPrice).multiply(BigDecimal.valueOf(percent))
                .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
    }

    private RentalPolicy policyOf(RentalContract contract) {
        if (contract == null || contract.getRentalPolicyId() == null || rentalPolicyRepository == null) return null;
        return rentalPolicyRepository.findById(contract.getRentalPolicyId()).orElse(null);
    }

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
        RentalPolicy policy = null;
        if (contract.getRentalPolicyId() != null) {
            policy = rentalPolicyRepository.findById(contract.getRentalPolicyId()).orElse(null);
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
                    .overstayFeeAmount(BigDecimal.ZERO)
                    .overstayDailyAmount(BigDecimal.ZERO)
                    .totalOverdueCharge(BigDecimal.ZERO)
                    .amountBeyondDeposit(BigDecimal.ZERO)
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

        // PR-Q14: phí chiếm dụng — mỗi ngày quá hạn trả tiền ô theo ngày × overstay_percent, KHÔNG có trần,
        // để quá hạn luôn đắt hơn gia hạn. Chỉ áp dụng khi đang OVERDUE và khách đã đồng ý điều khoản v2.
        boolean overstayApplied = false;
        int overstayPct = 0;
        BigDecimal overstayDaily = BigDecimal.ZERO;
        BigDecimal overstayFee = BigDecimal.ZERO;
        if ("OVERDUE".equalsIgnoreCase(contract.getStatus())) {
            OverstayBasis basis = overstayBasis(contract);
            if (acceptsOverstayTerms(basis.termsVersion())) {
                overstayApplied = true;
                overstayPct = waived ? 100 : (policy != null && policy.getOverstayPercent() != null
                        ? policy.getOverstayPercent() : DEFAULT_OVERSTAY_PERCENT);
                overstayDaily = overstayDaily(basis.monthlyPrice(), overstayPct);
                overstayFee = overstayDaily.multiply(BigDecimal.valueOf(overdueDays));
            }
        }
        BigDecimal totalCharge = lateFeeAmount.add(overstayFee);
        BigDecimal estimatedRefund = depositHeld.subtract(totalCharge).max(BigDecimal.ZERO);

        return LateFeeCalculationResult.builder()
                .overstayApplied(overstayApplied)
                .overstayPercent(overstayPct)
                .overstayDailyAmount(overstayDaily)
                .overstayFeeAmount(overstayFee)
                .totalOverdueCharge(totalCharge)
                .amountBeyondDeposit(totalCharge.subtract(depositHeld).max(BigDecimal.ZERO))
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


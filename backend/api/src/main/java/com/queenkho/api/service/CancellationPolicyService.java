package com.queenkho.api.service;

import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;

/**
 * Quy tắc hủy đặt chỗ áp dụng thống nhất toàn hệ thống.
 * Số tiền được tính và đóng băng tại thời điểm khách xác nhận hủy; FM chỉ thực hiện khoản hoàn đã chốt.
 * (08/11/2026) Ân hạn 30 phút sau thanh toán áp cho MỌI đơn (BR-32a); hủy sau giờ hẹn mà chưa check-in
 * tính như No-Show: giữ cọc + 1 tháng tiền thuê (BR-32, PR-X1). Tiền No-Show cũng tính ở đây ({@link #noShow}).
 */
@Service
public class CancellationPolicyService {

    public static final int FULL_REFUND_HOURS = 48;
    public static final int PARTIAL_REFUND_HOURS = 24;
    public static final int PARTIAL_DEPOSIT_PENALTY_PERCENT = 50;
    public static final int LATE_DEPOSIT_PENALTY_PERCENT = 100;
    public static final int BOOKING_GRACE_MINUTES = 30;
    // PR-X1: No-Show / hủy sau giờ hẹn giữ thêm số tháng tiền thuê này (ngoài cọc)
    public static final int NO_SHOW_RENT_MONTHS_KEPT = 1;

    public Decision calculate(BigDecimal totalPaid,
                              BigDecimal depositAmount,
                              int durationMonths,
                              LocalDateTime appointmentTime,
                              LocalDateTime paymentSuccessAt,
                              LocalDateTime cancelledAt,
                              boolean facilityUnableToServe) {
        BigDecimal paid = money(totalPaid);
        BigDecimal deposit = money(depositAmount).min(paid);
        long minutesUntilCheckIn = appointmentTime == null
                ? Long.MIN_VALUE
                : Duration.between(cancelledAt, appointmentTime).toMinutes();

        if (paid.signum() <= 0) {
            return decision("UNPAID", "Đơn chưa phát sinh thanh toán", paid, deposit,
                    BigDecimal.ZERO, BigDecimal.ZERO, minutesUntilCheckIn, false, null);
        }

        if (facilityUnableToServe) {
            return decision("FACILITY_FAULT", "Cơ sở không thể bàn giao ô đúng hẹn", paid, deposit,
                    BigDecimal.ZERO, paid, minutesUntilCheckIn, false, null);
        }

        // BR-32a: hủy trong 30 phút sau khi thanh toán thành công (và vẫn trước giờ hẹn) → hoàn 100%, mọi đơn
        LocalDateTime graceExpiresAt = paymentSuccessAt == null
                ? null
                : paymentSuccessAt.plusMinutes(BOOKING_GRACE_MINUTES);
        boolean graceApplied = paymentSuccessAt != null
                && !cancelledAt.isBefore(paymentSuccessAt)
                && !cancelledAt.isAfter(graceExpiresAt)
                && (appointmentTime == null || cancelledAt.isBefore(appointmentTime));

        if (graceApplied) {
            return decision("BOOKING_GRACE", "Hủy trong 30 phút sau khi thanh toán, hoàn 100%", paid, deposit,
                    BigDecimal.ZERO, paid, minutesUntilCheckIn, true, graceExpiresAt);
        }

        if (appointmentTime != null && !appointmentTime.isBefore(cancelledAt.plusHours(FULL_REFUND_HOURS))) {
            return decision("FULL_REFUND", "Hủy trước giờ nhận kho từ 48 giờ trở lên", paid, deposit,
                    BigDecimal.ZERO, paid, minutesUntilCheckIn, false, graceExpiresAt);
        }

        if (appointmentTime != null && !appointmentTime.isBefore(cancelledAt.plusHours(PARTIAL_REFUND_HOURS))) {
            BigDecimal penalty = percentage(deposit, PARTIAL_DEPOSIT_PENALTY_PERCENT).min(paid);
            return decision("HALF_DEPOSIT", "Hủy từ 24 giờ đến dưới 48 giờ, giữ 50% cọc", paid, deposit,
                    penalty, paid.subtract(penalty), minutesUntilCheckIn, false, graceExpiresAt);
        }

        if (appointmentTime != null && cancelledAt.isBefore(appointmentTime)) {
            BigDecimal penalty = percentage(deposit, LATE_DEPOSIT_PENALTY_PERCENT).min(paid);
            return decision("FULL_DEPOSIT", "Hủy dưới 24 giờ trước giờ hẹn, giữ 100% cọc", paid, deposit,
                    penalty, paid.subtract(penalty), minutesUntilCheckIn, false, graceExpiresAt);
        }

        // Đã qua giờ hẹn mà chưa check-in: khách tự hủy cũng tính như No-Show (không rẻ hơn bị No-Show)
        BigDecimal penalty = deposit.add(monthlyRent(paid, deposit, durationMonths)).min(paid);
        return decision("AFTER_APPOINTMENT", "Hủy sau giờ hẹn nhận kho, giữ cọc + 1 tháng tiền thuê như khách không đến nhận kho",
                paid, deposit, penalty, paid.subtract(penalty), minutesUntilCheckIn, false, graceExpiresAt);
    }

    /**
     * PR-X1 (08/11/2026): No-Show giữ 100% cọc + 1 tháng tiền thuê, hoàn tiền thuê các tháng còn lại.
     * FM "Miễn phạt" → hoàn toàn bộ. Gói 1 tháng thì không còn gì để hoàn.
     */
    public Decision noShow(BigDecimal totalPaid, BigDecimal depositAmount, int durationMonths, boolean waivePenalty) {
        BigDecimal paid = money(totalPaid);
        BigDecimal deposit = money(depositAmount).min(paid);
        if (waivePenalty) {
            return decision("NO_SHOW_WAIVED", "No-Show được miễn phạt, hoàn toàn bộ", paid, deposit,
                    BigDecimal.ZERO, paid, 0, false, null);
        }
        BigDecimal penalty = deposit.add(monthlyRent(paid, deposit, durationMonths)).min(paid);
        return decision("NO_SHOW", "Khách không đến nhận kho, giữ cọc + 1 tháng tiền thuê", paid, deposit,
                penalty, paid.subtract(penalty), 0, false, null);
    }

    /** Tiền thuê 1 tháng khách đã trả = (đã trả − cọc) / số tháng của gói (đã gồm ưu đãi, voucher, bảo hiểm). */
    BigDecimal monthlyRent(BigDecimal paid, BigDecimal deposit, int durationMonths) {
        BigDecimal rentPaid = paid.subtract(deposit).max(BigDecimal.ZERO);
        int months = Math.max(1, durationMonths);
        return rentPaid.multiply(BigDecimal.valueOf(NO_SHOW_RENT_MONTHS_KEPT))
                .divide(BigDecimal.valueOf(months), 0, RoundingMode.HALF_UP)
                .min(rentPaid);
    }

    private Decision decision(String tier,
                              String description,
                              BigDecimal totalPaid,
                              BigDecimal depositAmount,
                              BigDecimal penaltyAmount,
                              BigDecimal refundAmount,
                              long minutesUntilCheckIn,
                              boolean graceApplied,
                              LocalDateTime graceExpiresAt) {
        return new Decision(tier, description, totalPaid, depositAmount, penaltyAmount,
                refundAmount.max(BigDecimal.ZERO), minutesUntilCheckIn, graceApplied, graceExpiresAt);
    }

    private BigDecimal percentage(BigDecimal value, int percent) {
        return value.multiply(BigDecimal.valueOf(percent))
                .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
    }

    private BigDecimal money(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value.max(BigDecimal.ZERO);
    }

    public record Decision(
            String tier,
            String description,
            BigDecimal totalPaid,
            BigDecimal depositAmount,
            BigDecimal penaltyAmount,
            BigDecimal refundAmount,
            long minutesUntilCheckIn,
            boolean graceApplied,
            LocalDateTime graceExpiresAt
    ) {}
}

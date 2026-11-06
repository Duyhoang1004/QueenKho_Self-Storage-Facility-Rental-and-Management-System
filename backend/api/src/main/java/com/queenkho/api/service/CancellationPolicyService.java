package com.queenkho.api.service;

import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;

/**
 * Quy tắc hủy đặt chỗ áp dụng thống nhất toàn hệ thống.
 * Số tiền được tính và đóng băng tại thời điểm khách xác nhận hủy; FM chỉ thực hiện khoản hoàn đã chốt.
 */
@Service
public class CancellationPolicyService {

    public static final int FULL_REFUND_HOURS = 48;
    public static final int PARTIAL_REFUND_HOURS = 24;
    public static final int PARTIAL_DEPOSIT_PENALTY_PERCENT = 50;
    public static final int LATE_DEPOSIT_PENALTY_PERCENT = 100;
    public static final int LAST_MINUTE_BOOKING_HOURS = 48;
    public static final int LAST_MINUTE_GRACE_MINUTES = 30;

    public Decision calculate(BigDecimal totalPaid,
                              BigDecimal depositAmount,
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

        LocalDateTime graceExpiresAt = paymentSuccessAt == null
                ? null
                : paymentSuccessAt.plusMinutes(LAST_MINUTE_GRACE_MINUTES);
        boolean lastMinuteBooking = paymentSuccessAt != null
                && appointmentTime != null
                && paymentSuccessAt.isBefore(appointmentTime)
                && Duration.between(paymentSuccessAt, appointmentTime).compareTo(Duration.ofHours(LAST_MINUTE_BOOKING_HOURS)) < 0;
        boolean graceApplied = lastMinuteBooking
                && !cancelledAt.isBefore(paymentSuccessAt)
                && !cancelledAt.isAfter(graceExpiresAt)
                && cancelledAt.isBefore(appointmentTime);

        if (graceApplied) {
            return decision("LAST_MINUTE_GRACE", "Hủy trong 30 phút sau thanh toán của đơn đặt sát giờ", paid, deposit,
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

        BigDecimal penalty = percentage(deposit, LATE_DEPOSIT_PENALTY_PERCENT).min(paid);
        return decision("FULL_DEPOSIT", "Hủy dưới 24 giờ hoặc sau giờ hẹn, giữ 100% cọc", paid, deposit,
                penalty, paid.subtract(penalty), minutesUntilCheckIn, false, graceExpiresAt);
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

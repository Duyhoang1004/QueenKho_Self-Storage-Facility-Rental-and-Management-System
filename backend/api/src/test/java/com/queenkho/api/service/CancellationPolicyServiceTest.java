package com.queenkho.api.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class CancellationPolicyServiceTest {

    private final CancellationPolicyService policy = new CancellationPolicyService();
    private final BigDecimal paid = new BigDecimal("5000000");
    private final BigDecimal deposit = new BigDecimal("2000000");
    private final LocalDateTime appointment = LocalDateTime.of(2026, 11, 21, 9, 0);

    @Test
    @DisplayName("Đặt sát giờ: hủy đúng phút thứ 30 sau thanh toán vẫn hoàn 100%")
    void lastMinuteGraceIncludesMinuteThirty() {
        LocalDateTime paidAt = appointment.minusHours(12);

        var result = policy.calculate(paid, deposit, appointment, paidAt, paidAt.plusMinutes(30), false);

        assertEquals("LAST_MINUTE_GRACE", result.tier());
        assertEquals(0, paid.compareTo(result.refundAmount()));
        assertEquals(0, BigDecimal.ZERO.compareTo(result.penaltyAmount()));
        assertTrue(result.graceApplied());
    }

    @Test
    @DisplayName("Đặt sát giờ nhưng hủy sau 30 phút: áp dụng mốc thời gian thông thường")
    void lastMinuteGraceExpiresAfterThirtyMinutes() {
        LocalDateTime paidAt = appointment.minusHours(12);

        var result = policy.calculate(paid, deposit, appointment, paidAt, paidAt.plusMinutes(31), false);

        assertEquals("FULL_DEPOSIT", result.tier());
        assertEquals(0, deposit.compareTo(result.penaltyAmount()));
        assertEquals(0, new BigDecimal("3000000").compareTo(result.refundAmount()));
    }

    @Test
    @DisplayName("Thanh toán đúng 48 giờ trước check-in không thuộc ân hạn đặt sát giờ")
    void exactlyFortyEightHoursIsNotLastMinuteBooking() {
        LocalDateTime paidAt = appointment.minusHours(48);

        var result = policy.calculate(paid, deposit, appointment, paidAt, paidAt.plusMinutes(20), false);

        assertEquals("HALF_DEPOSIT", result.tier());
        assertFalse(result.graceApplied());
    }

    @Test
    @DisplayName("Hủy đúng mốc 48 giờ: hoàn 100%")
    void exactlyFortyEightHoursGetsFullRefund() {
        LocalDateTime cancelledAt = appointment.minusHours(48);

        var result = policy.calculate(paid, deposit, appointment, appointment.minusDays(5), cancelledAt, false);

        assertEquals("FULL_REFUND", result.tier());
        assertEquals(0, paid.compareTo(result.refundAmount()));
    }

    @Test
    @DisplayName("Hủy đúng mốc 24 giờ: giữ 50% cọc")
    void exactlyTwentyFourHoursKeepsHalfDeposit() {
        var result = policy.calculate(paid, deposit, appointment, appointment.minusDays(5),
                appointment.minusHours(24), false);

        assertEquals("HALF_DEPOSIT", result.tier());
        assertEquals(0, new BigDecimal("1000000").compareTo(result.penaltyAmount()));
        assertEquals(0, new BigDecimal("4000000").compareTo(result.refundAmount()));
    }

    @Test
    @DisplayName("Hủy dưới 24 giờ hoặc sau giờ hẹn: giữ toàn bộ cọc, hoàn phần tiền còn lại")
    void lateCancellationKeepsFullDeposit() {
        var before = policy.calculate(paid, deposit, appointment, appointment.minusDays(5),
                appointment.minusHours(23), false);
        var after = policy.calculate(paid, deposit, appointment, appointment.minusDays(5),
                appointment.plusMinutes(1), false);

        assertAll(
                () -> assertEquals("FULL_DEPOSIT", before.tier()),
                () -> assertEquals(0, deposit.compareTo(before.penaltyAmount())),
                () -> assertEquals(0, new BigDecimal("3000000").compareTo(before.refundAmount())),
                () -> assertEquals("FULL_DEPOSIT", after.tier()),
                () -> assertEquals(0, new BigDecimal("3000000").compareTo(after.refundAmount()))
        );
    }

    @Test
    @DisplayName("Cơ sở không thể bàn giao ô đúng hẹn: hoàn 100%")
    void facilityFaultGetsFullRefund() {
        var result = policy.calculate(paid, deposit, appointment, appointment.minusDays(2),
                appointment.plusMinutes(1), true);

        assertEquals("FACILITY_FAULT", result.tier());
        assertEquals(0, paid.compareTo(result.refundAmount()));
    }
}

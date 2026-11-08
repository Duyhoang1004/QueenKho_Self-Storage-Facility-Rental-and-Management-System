package com.queenkho.api.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class CancellationPolicyServiceTest {

    private final CancellationPolicyService policy = new CancellationPolicyService();
    // Gói 3 tháng: cọc 2.000.000 + tiền thuê 3.000.000 (1.000.000 / tháng)
    private final BigDecimal paid = new BigDecimal("5000000");
    private final BigDecimal deposit = new BigDecimal("2000000");
    private final int months = 3;
    private final LocalDateTime appointment = LocalDateTime.of(2026, 11, 21, 9, 0);

    @Test
    @DisplayName("BR-32a: hủy đúng phút thứ 30 sau thanh toán vẫn hoàn 100%")
    void graceIncludesMinuteThirty() {
        LocalDateTime paidAt = appointment.minusHours(12);

        var result = policy.calculate(paid, deposit, months, appointment, paidAt, paidAt.plusMinutes(30), false);

        assertEquals("BOOKING_GRACE", result.tier());
        assertEquals(0, paid.compareTo(result.refundAmount()));
        assertEquals(0, BigDecimal.ZERO.compareTo(result.penaltyAmount()));
        assertTrue(result.graceApplied());
    }

    @Test
    @DisplayName("BR-32a: hủy sau 30 phút thì áp mốc thời gian thông thường")
    void graceExpiresAfterThirtyMinutes() {
        LocalDateTime paidAt = appointment.minusHours(12);

        var result = policy.calculate(paid, deposit, months, appointment, paidAt, paidAt.plusMinutes(31), false);

        assertEquals("FULL_DEPOSIT", result.tier());
        assertEquals(0, deposit.compareTo(result.penaltyAmount()));
        assertEquals(0, new BigDecimal("3000000").compareTo(result.refundAmount()));
    }

    @Test
    @DisplayName("BR-32a (08/11): ân hạn 30 phút áp cho mọi đơn, kể cả thanh toán đúng 48 giờ trước check-in")
    void graceAppliesToEveryBooking() {
        LocalDateTime paidAt = appointment.minusHours(48);

        var result = policy.calculate(paid, deposit, months, appointment, paidAt, paidAt.plusMinutes(20), false);

        assertEquals("BOOKING_GRACE", result.tier());
        assertEquals(0, paid.compareTo(result.refundAmount()));
        assertTrue(result.graceApplied());
    }

    @Test
    @DisplayName("BR-32a: ân hạn không áp khi đã qua giờ hẹn")
    void graceDoesNotApplyAfterAppointment() {
        LocalDateTime paidAt = appointment.minusMinutes(10);

        var result = policy.calculate(paid, deposit, months, appointment, paidAt, paidAt.plusMinutes(15), false);

        assertEquals("AFTER_APPOINTMENT", result.tier());
        assertFalse(result.graceApplied());
    }

    @Test
    @DisplayName("Hủy đúng mốc 48 giờ: hoàn 100%")
    void exactlyFortyEightHoursGetsFullRefund() {
        LocalDateTime cancelledAt = appointment.minusHours(48);

        var result = policy.calculate(paid, deposit, months, appointment, appointment.minusDays(5), cancelledAt, false);

        assertEquals("FULL_REFUND", result.tier());
        assertEquals(0, paid.compareTo(result.refundAmount()));
    }

    @Test
    @DisplayName("Hủy đúng mốc 24 giờ: giữ 50% cọc")
    void exactlyTwentyFourHoursKeepsHalfDeposit() {
        var result = policy.calculate(paid, deposit, months, appointment, appointment.minusDays(5),
                appointment.minusHours(24), false);

        assertEquals("HALF_DEPOSIT", result.tier());
        assertEquals(0, new BigDecimal("1000000").compareTo(result.penaltyAmount()));
        assertEquals(0, new BigDecimal("4000000").compareTo(result.refundAmount()));
    }

    @Test
    @DisplayName("Hủy dưới 24 giờ: giữ toàn bộ cọc, hoàn tiền thuê")
    void lateCancellationKeepsFullDeposit() {
        var result = policy.calculate(paid, deposit, months, appointment, appointment.minusDays(5),
                appointment.minusHours(23), false);

        assertEquals("FULL_DEPOSIT", result.tier());
        assertEquals(0, deposit.compareTo(result.penaltyAmount()));
        assertEquals(0, new BigDecimal("3000000").compareTo(result.refundAmount()));
    }

    @Test
    @DisplayName("Hủy sau giờ hẹn mà chưa check-in: giữ cọc + 1 tháng thuê như No-Show")
    void cancelAfterAppointmentCostsLikeNoShow() {
        var result = policy.calculate(paid, deposit, months, appointment, appointment.minusDays(5),
                appointment.plusMinutes(1), false);
        var noShow = policy.noShow(paid, deposit, months, false);

        assertAll(
                () -> assertEquals("AFTER_APPOINTMENT", result.tier()),
                () -> assertEquals(0, new BigDecimal("3000000").compareTo(result.penaltyAmount())),
                () -> assertEquals(0, new BigDecimal("2000000").compareTo(result.refundAmount())),
                () -> assertEquals(0, noShow.refundAmount().compareTo(result.refundAmount()))
        );
    }

    @Test
    @DisplayName("Cơ sở không thể bàn giao ô đúng hẹn: hoàn 100%")
    void facilityFaultGetsFullRefund() {
        var result = policy.calculate(paid, deposit, months, appointment, appointment.minusDays(2),
                appointment.plusMinutes(1), true);

        assertEquals("FACILITY_FAULT", result.tier());
        assertEquals(0, paid.compareTo(result.refundAmount()));
    }

    @Test
    @DisplayName("PR-X1: No-Show giữ cọc + 1 tháng thuê, hoàn các tháng còn lại")
    void noShowKeepsDepositAndOneMonth() {
        var result = policy.noShow(paid, deposit, months, false);

        assertEquals("NO_SHOW", result.tier());
        assertEquals(0, new BigDecimal("3000000").compareTo(result.penaltyAmount()));
        assertEquals(0, new BigDecimal("2000000").compareTo(result.refundAmount()));
    }

    @Test
    @DisplayName("PR-X1: No-Show gói 1 tháng thì không còn tiền hoàn")
    void noShowOneMonthPackageRefundsNothing() {
        var result = policy.noShow(new BigDecimal("3000000"), deposit, 1, false);

        assertEquals(0, new BigDecimal("3000000").compareTo(result.penaltyAmount()));
        assertEquals(0, BigDecimal.ZERO.compareTo(result.refundAmount()));
    }

    @Test
    @DisplayName("PR-X1: FM miễn phạt No-Show thì hoàn toàn bộ")
    void noShowWaivedRefundsEverything() {
        var result = policy.noShow(paid, deposit, months, true);

        assertEquals("NO_SHOW_WAIVED", result.tier());
        assertEquals(0, paid.compareTo(result.refundAmount()));
        assertEquals(0, BigDecimal.ZERO.compareTo(result.penaltyAmount()));
    }
}

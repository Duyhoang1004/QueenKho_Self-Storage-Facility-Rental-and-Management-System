package com.queenkho.api.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

// Rule bổ sung sau đợt test 02/11/2026: trả kho sớm (PR-O2a, PR-O2c), mốc nhắc gia hạn (PR-R9), che CCCD (UC-13)
class BugFixRulesTest {

    private static final BigDecimal PRICE = new BigDecimal("1850000");

    @Test
    @DisplayName("PR-O2: gói 12T đã trả 18.870.000, dùng 2 tháng → hoàn 18.870.000 − 2×1.850.000 − 1.850.000 = 13.320.000")
    void earlyReturnBusinessRuleExample() {
        LocalDate start = LocalDate.of(2026, 1, 1);
        StaffTaskService.EarlyReturn r = StaffTaskService.earlyReturn(
                start, 12, LocalDate.of(2026, 2, 20), PRICE, new BigDecimal("18870000"));

        assertEquals(2, r.usedMonths());
        assertEquals(0, PRICE.compareTo(r.breakFee()));
        assertEquals(0, new BigDecimal("13320000").compareTo(r.refund()));
    }

    @Test
    @DisplayName("PR-O2a: trả trong tháng cuối của kỳ → không hoàn tiền thuê, không thu phí phá HĐ")
    void earlyReturnInLastMonthHasNoBreakFee() {
        LocalDate start = LocalDate.of(2026, 1, 1);
        // Gói 3 tháng (hết hạn 01/04), trả ngày 15/03 → đã dùng làm tròn lên = 3 tháng
        StaffTaskService.EarlyReturn r = StaffTaskService.earlyReturn(
                start, 3, LocalDate.of(2026, 3, 15), PRICE, new BigDecimal("5272500"));

        assertEquals(3, r.usedMonths());
        assertEquals(0, BigDecimal.ZERO.compareTo(r.breakFee()));
        assertEquals(0, BigDecimal.ZERO.compareTo(r.refund()));
    }

    @Test
    @DisplayName("PR-O2: trả quá sớm (tuần đầu) → tính tối thiểu 1 tháng + 1 tháng phí phá HĐ, hoàn phần còn lại")
    void earlyReturnTooEarlyCountsOneMonth() {
        LocalDate start = LocalDate.of(2026, 1, 1);
        StaffTaskService.EarlyReturn r = StaffTaskService.earlyReturn(
                start, 6, LocalDate.of(2026, 1, 5), PRICE, new BigDecimal("9990000"));

        assertEquals(1, r.usedMonths());
        assertEquals(0, new BigDecimal("6290000").compareTo(r.refund()));
    }

    @Test
    @DisplayName("PR-O2: số tiền hoàn không bao giờ âm")
    void earlyReturnNeverNegative() {
        StaffTaskService.EarlyReturn r = StaffTaskService.earlyReturn(
                LocalDate.of(2026, 1, 1), 3, LocalDate.of(2026, 1, 20), PRICE, new BigDecimal("1000000"));

        assertEquals(0, BigDecimal.ZERO.compareTo(r.refund()));
    }

    @Test
    @DisplayName("PR-R9 (sửa 05/11/2026): mốc nhắc 15/10/7/3/1 ngày — còn 12 ngày gửi mốc 15, còn 8 gửi mốc 10, hôm nay hết hạn gửi mốc 1")
    void renewalMilestones() {
        assertNull(RenewalReminderService.milestoneFor(16));
        assertEquals(15, RenewalReminderService.milestoneFor(15));
        assertEquals(15, RenewalReminderService.milestoneFor(12));
        assertEquals(10, RenewalReminderService.milestoneFor(10));
        assertEquals(10, RenewalReminderService.milestoneFor(8));
        assertEquals(7, RenewalReminderService.milestoneFor(7));
        assertEquals(7, RenewalReminderService.milestoneFor(5));
        assertEquals(3, RenewalReminderService.milestoneFor(3));
        assertEquals(3, RenewalReminderService.milestoneFor(2));
        assertEquals(1, RenewalReminderService.milestoneFor(1));
        assertEquals(1, RenewalReminderService.milestoneFor(0));
        assertNull(RenewalReminderService.milestoneFor(-1));
    }

    @Test
    @DisplayName("UC-13: CCCD che giữa khi FM xem chi tiết đơn")
    void maskCccd() {
        assertEquals("079******123", ReservationService.maskCccd("079200000123"));
        assertNull(ReservationService.maskCccd(null));
        assertEquals("****", ReservationService.maskCccd("1234"));
    }
}

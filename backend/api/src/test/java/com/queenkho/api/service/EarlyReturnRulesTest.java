package com.queenkho.api.service;

import com.queenkho.api.dto.MoneyLine;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

// 27/11/2026: trả sớm — lỗi cơ sở tối thiểu 1 ngày; khách tự trả trong 3 ngày đầu chỉ tính ngày đã dùng (PR-O2e)
class EarlyReturnRulesTest {

    private static BigDecimal m(long v) { return BigDecimal.valueOf(v); }

    private static final LocalDate START = LocalDate.of(2026, 11, 28);

    @Test void faultSameDayStillCountsOneDay() {
        // HĐ 3 tháng 1.325.000, nhận kho và trả kho cùng ngày 28/11 → giữ 1 ngày (1.325.000 ÷ 92 ≈ 14.402)
        var r = StaffTaskService.faultTerminationReturn(START, START.plusMonths(3), START, m(1_325_000));
        assertEquals(m(1_310_598), r.refund());
        assertEquals(BigDecimal.ZERO, r.breakFee());
    }

    @Test void faultNextDayUnchanged() {
        // ca cũ 24/11 → 25/11 vẫn là 1 ngày
        var start = LocalDate.of(2026, 11, 24);
        var r = StaffTaskService.faultTerminationReturn(start, start.plusMonths(3), start.plusDays(1), m(8_165_000));
        assertEquals(m(8_076_250), r.refund());
    }

    @Test void trialSameDayChargesOneDayAtListPrice() {
        // giá niêm yết 500.000 / tháng → 16.667 / ngày; tiền thuê đã đóng 1.325.000 → hoàn 1.308.333
        var r = StaffTaskService.trialReturn(START, START, m(500_000), m(1_325_000));
        assertEquals(m(1_308_333), r.refund());
        assertEquals(BigDecimal.ZERO, r.breakFee());
    }

    @Test void trialNextDayChargesTwoDays() {
        // nhận 28, trả 29 → 2 ngày (đếm cả ngày nhận kho)
        var r = StaffTaskService.trialReturn(START, START.plusDays(1), m(500_000), m(1_325_000));
        assertEquals(m(1_325_000 - 2 * 16_667), r.refund());
    }

    @Test void trialThirdDayChargesThreeDays() {
        // nhận 28, trả 30 → 3 ngày
        var r = StaffTaskService.trialReturn(START, START.plusDays(2), m(500_000), m(1_325_000));
        assertEquals(m(1_325_000 - 3 * 16_667), r.refund());
    }

    @Test void trialWindowIsFirstThreeDaysOfOriginalPeriod() {
        assertTrue(StaffTaskService.inTrialWindow(START, START, START));
        assertTrue(StaffTaskService.inTrialWindow(START, START, START.plusDays(2)));
        assertFalse(StaffTaskService.inTrialWindow(START, START, START.plusDays(3)));
        // kỳ gia hạn (periodStart khác ngày bắt đầu HĐ) không có dùng thử
        assertFalse(StaffTaskService.inTrialWindow(START, START.plusMonths(3), START.plusMonths(3)));
    }

    @Test void trialLinesShowDayMathAndNoBreakFee() {
        var basis = new RefundBreakdown.RentBasis(m(1_325_000), BigDecimal.ZERO, 3, START, true, false, 1, m(500_000),
                BigDecimal.ZERO, 0, BigDecimal.ZERO, 0, null, true);
        List<MoneyLine> lines = RefundBreakdown.lines(m(500_000), basis, m(1_308_333),
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
        MoneyLine kept = lines.stream().filter(l -> MoneyLine.KEPT.equals(l.group())).findFirst().orElseThrow();
        assertEquals("Tiền thuê những ngày đã dùng", kept.label());
        assertEquals(m(16_667), kept.amount());
        assertTrue(kept.note().startsWith("1 ngày đã dùng × 16.667đ/ngày (giá niêm yết 500.000đ ÷ 30)"), kept.note());
        assertTrue(lines.stream().noneMatch(l -> l.label().startsWith("Phí phá hợp đồng")));
        assertEquals(m(1_808_333), RefundBreakdown.totals(lines).net());
    }

    @Test void rentBasisRoundTripsTrialFlag() {
        var basis = new RefundBreakdown.RentBasis(m(1_325_000), BigDecimal.ZERO, 3, START, true, false, 1, m(500_000),
                BigDecimal.ZERO, 0, BigDecimal.ZERO, 0, null, true);
        assertTrue(RefundBreakdown.RentBasis.parse(basis.toText()).trial());
        // bảng quyết toán cũ chưa lưu cờ → false
        assertFalse(RefundBreakdown.RentBasis.parse("rentPaid=1;insurance=0;periodMonths=1;early=true;fault=false").trial());
    }
}

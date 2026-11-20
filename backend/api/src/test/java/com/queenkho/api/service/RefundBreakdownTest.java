package com.queenkho.api.service;

import com.queenkho.api.dto.MoneyLine;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

// D-22: bảng "Bạn đã đóng − Cơ sở giữ lại + Bồi thường = Hoàn" phải ra đúng số của công thức quyết toán PR-O19
class RefundBreakdownTest {

    private static BigDecimal m(long v) {
        return BigDecimal.valueOf(v);
    }

    private static void assertMoney(long expected, BigDecimal actual) {
        assertEquals(0, m(expected).compareTo(actual), "mong đợi " + expected + " nhưng là " + actual);
    }

    private static BigDecimal net(long deposit, RefundBreakdown.RentBasis basis, long rentRefund, long damage, long late,
                                  long overstay, long compensation) {
        var a = CheckoutSettlementService.allocate(m(deposit), m(damage), m(late), m(overstay), m(rentRefund), m(compensation));
        List<MoneyLine> lines = RefundBreakdown.lines(m(deposit), basis, m(rentRefund), m(damage), a.lateOffset(), m(overstay),
                m(compensation));
        BigDecimal net = RefundBreakdown.totals(lines).net();
        assertEquals(0, a.net().compareTo(net), "bảng dòng tiền lệch công thức quyết toán: " + net + " ≠ " + a.net());
        return net;
    }

    @Test
    @DisplayName("Trả sớm sau 2 tháng gói 3 tháng (HĐ-F7-03): đã đóng 11.215.000 − giữ 8.315.000 = hoàn 2.900.000")
    void earlyReturnCappedAtRentPaid() {
        var basis = new RefundBreakdown.RentBasis(m(8_165_000), m(150_000), 3, LocalDate.of(2026, 10, 19), true, false,
                2, m(2_900_000), m(2_900_000), 0);
        List<MoneyLine> lines = RefundBreakdown.lines(m(2_900_000), basis, m(0), m(0), m(0), m(0), m(0));
        var t = RefundBreakdown.totals(lines);
        assertMoney(11_215_000, t.paid());
        assertMoney(8_315_000, t.kept());
        assertMoney(2_900_000, t.net());
        assertTrue(lines.stream().anyMatch(l -> l.amount().signum() < 0), "phải có dòng giảm do không vượt tiền thuê đã đóng");
        net(2_900_000, basis, 0, 0, 0, 0, 0);
    }

    @Test
    @DisplayName("Trả sớm gói 12 tháng (HĐ-F6-04): đã đóng 50.300.000 − giữ 18.000.000 = hoàn 32.300.000")
    void earlyReturnWithRentRefund() {
        var basis = new RefundBreakdown.RentBasis(m(45_800_000), m(0), 12, LocalDate.of(2026, 9, 14), true, false,
                3, m(4_500_000), m(4_500_000), 0);
        assertMoney(32_300_000, net(4_500_000, basis, 27_800_000, 0, 0, 0, 0));
    }

    @Test
    @DisplayName("Trả đúng hạn có sự cố + quá hạn + bồi thường: tổng khớp công thức (gồm phí trễ chặn trong cọc)")
    void onTimeWithFeesAndCompensation() {
        var basis = new RefundBreakdown.RentBasis(m(5_400_000), m(150_000), 3, LocalDate.of(2026, 8, 1), false, false,
                3, m(1_850_000), m(0), 4);
        net(1_850_000, basis, 0, 1_500_000, 740_000, 1_100_000, 3_000_000);
        net(1_850_000, basis, 0, 3_000_000, 740_000, 0, 0);
    }

    @Test
    @DisplayName("Trả trong tháng cuối (PR-O2a) và chấm dứt do lỗi cơ sở (BR-127) đều khớp công thức")
    void lastMonthAndFaultTermination() {
        var lastMonth = new RefundBreakdown.RentBasis(m(5_000_000), m(0), 3, LocalDate.of(2026, 9, 1), true, false,
                3, m(1_850_000), m(0), 0);
        assertMoney(1_850_000, net(1_850_000, lastMonth, 0, 0, 0, 0, 0));
        var fault = new RefundBreakdown.RentBasis(m(5_000_000), m(300_000), 3, LocalDate.of(2026, 9, 1), true, true,
                1, m(1_850_000), m(0), 0);
        net(1_850_000, fault, 3_500_000, 0, 0, 0, 2_000_000);
    }

    @Test
    @DisplayName("RentBasis lưu / đọc lại được từ checkout_settlements.rent_basis")
    void rentBasisRoundTrip() {
        var basis = new RefundBreakdown.RentBasis(m(8_165_000), m(150_000), 3, LocalDate.of(2026, 10, 19), true, false,
                2, m(2_900_000), m(2_900_000), 0);
        assertEquals(basis.toText(), RefundBreakdown.RentBasis.parse(basis.toText()).toText());
        assertNull(RefundBreakdown.RentBasis.parse(null));
    }

    @Test
    @DisplayName("Bảng phí: mốc ví dụ trả sớm")
    void sampleMonths() {
        assertEquals(List.of(1, 2), PolicySummaryService.sampleMonths(3));
        assertEquals(List.of(1, 2, 6, 11), PolicySummaryService.sampleMonths(12));
        assertEquals(List.of(), PolicySummaryService.sampleMonths(1));
    }
}

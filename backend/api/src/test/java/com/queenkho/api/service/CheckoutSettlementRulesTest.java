package com.queenkho.api.service;

import com.queenkho.api.entity.StaffTask;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

// D-21 / PR-O19: công thức bảng quyết toán trả kho (cọc − phí + hoàn tiền thuê + bồi thường)
class CheckoutSettlementRulesTest {

    private static BigDecimal m(long v) {
        return BigDecimal.valueOf(v);
    }

    private static void assertMoney(long expected, BigDecimal actual) {
        assertEquals(0, m(expected).compareTo(actual), "mong đợi " + expected + " nhưng là " + actual);
    }

    @Test
    @DisplayName("PR-O19: trả đúng hạn, không sự cố → hoàn đủ cọc")
    void cleanReturnRefundsWholeDeposit() {
        var a = CheckoutSettlementService.allocate(m(1_500_000), m(0), m(0), m(0), m(0), m(0));
        assertMoney(1_500_000, a.net());
        assertMoney(1_500_000, a.depositRefund());
        assertMoney(0, a.feesBeyond());
    }

    @Test
    @DisplayName("PR-O11: cọc trừ lần lượt sự cố → phí trễ → phí chiếm dụng")
    void depositOffsetsInOrder() {
        var a = CheckoutSettlementService.allocate(m(1_000_000), m(300_000), m(200_000), m(100_000), m(0), m(0));
        assertMoney(300_000, a.damageOffset());
        assertMoney(200_000, a.lateOffset());
        assertMoney(100_000, a.overstayOffset());
        assertMoney(400_000, a.net());
    }

    @Test
    @DisplayName("PR-Q3: phí trễ chỉ trừ trong phần cọc còn lại, không bao giờ thành nợ")
    void lateFeeNeverBecomesDebt() {
        var a = CheckoutSettlementService.allocate(m(1_000_000), m(900_000), m(500_000), m(0), m(0), m(0));
        assertMoney(100_000, a.lateOffset());
        assertMoney(0, a.net());
        assertMoney(0, a.feesBeyond());
    }

    @Test
    @DisplayName("PR-O21: sự cố vượt cọc → âm, khách phải trả thêm")
    void damageBeyondDepositIsNegative() {
        var a = CheckoutSettlementService.allocate(m(1_000_000), m(1_800_000), m(0), m(0), m(0), m(0));
        assertMoney(-800_000, a.net());
        assertMoney(800_000, a.damageBeyond());
    }

    @Test
    @DisplayName("PR-O21: phí chiếm dụng vượt cọc → âm (không có trần như phí trễ)")
    void overstayBeyondDepositIsNegative() {
        var a = CheckoutSettlementService.allocate(m(500_000), m(0), m(250_000), m(600_000), m(0), m(0));
        assertMoney(250_000, a.lateOffset());
        assertMoney(250_000, a.overstayOffset());
        assertMoney(350_000, a.overstayBeyond());
        assertMoney(-350_000, a.net());
    }

    @Test
    @DisplayName("PR-O2 + PR-O21: hoàn tiền thuê trả sớm bù phần phí vượt cọc")
    void rentRefundCoversFeesBeyondDeposit() {
        var a = CheckoutSettlementService.allocate(m(1_000_000), m(1_500_000), m(0), m(0), m(2_000_000), m(0));
        assertMoney(1_500_000, a.net());
    }

    @Test
    @DisplayName("D-21: tiền bồi thường hàng gộp vào quyết toán, có thể biến âm thành dương")
    void compensationTurnsNegativeIntoRefund() {
        var negative = CheckoutSettlementService.allocate(m(1_000_000), m(3_000_000), m(0), m(0), m(0), m(0));
        assertMoney(-2_000_000, negative.net());
        var withClaim = CheckoutSettlementService.allocate(m(1_000_000), m(3_000_000), m(0), m(0), m(0), m(5_000_000));
        assertMoney(3_000_000, withClaim.net());
    }

    @Test
    @DisplayName("PR-O22: task CHECK_OUT có ghi chú [RECHECK] là kiểm tra lại, không phải nghiệm thu bàn giao")
    void recheckTaskIsRecognisedByTag() {
        StaffTask recheck = new StaffTask();
        recheck.setNote(CheckoutSettlementService.RECHECK_TAG + " Kiểm tra lại quyết toán HĐ HD-1");
        StaffTask normal = new StaffTask();
        normal.setNote("Yêu cầu trả kho ngày 20/11/2026 | Hoàn tiền: Nhận tiền mặt trực tiếp tại quầy");
        assertTrue(CheckoutSettlementService.isRecheckTask(recheck));
        assertFalse(CheckoutSettlementService.isRecheckTask(normal));
        assertFalse(CheckoutSettlementService.isRecheckTask(new StaffTask()));
    }
}

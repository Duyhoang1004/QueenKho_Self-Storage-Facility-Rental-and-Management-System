package com.queenkho.api.service;

import com.queenkho.api.dto.CompensationQuoteResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

// BR-125 → BR-129 (04/11/2026): gói bảo hiểm, bảng tính bồi thường hàng hư / mất, chấm dứt do lỗi cơ sở, ngưỡng cảm biến
class CompensationRulesTest {

    private static final BigDecimal PRICE = new BigDecimal("1500000"); // giá thuê tháng → giá ngày 50.000đ

    private static void assertMoney(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual), "mong đợi " + expected + " nhưng là " + actual);
    }

    @Test
    @DisplayName("BR-125: trần = min(giá trị khai báo, trần gói); không khai báo → 5 triệu")
    void coverageCap() {
        assertMoney("5000000", InsurancePlan.BASIC.coverageCap(null));
        assertMoney("20000000", InsurancePlan.BASIC.coverageCap(new BigDecimal("80000000")));
        assertMoney("80000000", InsurancePlan.ADVANCED.coverageCap(new BigDecimal("80000000")));
        assertMoney("500000000", InsurancePlan.PREMIUM.coverageCap(new BigDecimal("900000000")));
        assertEquals(InsurancePlan.BASIC, InsurancePlan.of("lạ"));
        assertFalse(InsurancePlan.BASIC.insured());
    }

    @Test
    @DisplayName("BR-127 lỗi cơ sở: tiền hàng (≤ trần) + phạt 1 tháng tiền thuê + hoàn tiền thuê ngày không dùng được")
    void facilityFault() {
        // hư 50% lô hàng 30 triệu, gói Nâng cao khai báo 100 triệu → 15 triệu; phạt 1,5 triệu; 4 ngày × 50.000
        CompensationQuoteResponse q = CompensationClaimService.compute("FACILITY", "GOODS_DAMAGE",
                new BigDecimal("30000000"), 50, 4, InsurancePlan.ADVANCED, new BigDecimal("100000000"), PRICE);
        assertMoney("15000000", q.goodsCompensation());
        assertMoney("1500000", q.penaltyAmount());
        assertMoney("200000", q.rentRefundAmount());
        assertMoney("16700000", q.totalCompensation());
        assertTrue(q.insuranceClaimable());
    }

    @Test
    @DisplayName("BR-127: tiền hàng bị chặn bởi trần — gói Cơ bản không khai báo chỉ 5 triệu dù mất 40 triệu")
    void capApplied() {
        CompensationQuoteResponse q = CompensationClaimService.compute("FACILITY", "GOODS_LOSS",
                new BigDecimal("40000000"), null, 0, InsurancePlan.BASIC, null, PRICE);
        assertMoney("40000000", q.goodsLoss());
        assertMoney("5000000", q.goodsCompensation());
        assertMoney("6500000", q.totalCompensation());
        assertFalse(q.insuranceClaimable(), "gói Cơ bản không có bên bảo hiểm để đòi lại");
    }

    @Test
    @DisplayName("BR-127 bất khả kháng: gói Cơ bản không được tiền hàng, gói có bảo hiểm thì được; không phạt vi phạm")
    void forceMajeure() {
        CompensationQuoteResponse basic = CompensationClaimService.compute("FORCE_MAJEURE", "GOODS_DAMAGE",
                new BigDecimal("10000000"), 100, 2, InsurancePlan.BASIC, new BigDecimal("10000000"), PRICE);
        assertMoney("0", basic.goodsCompensation());
        assertMoney("0", basic.penaltyAmount());
        assertMoney("100000", basic.totalCompensation());

        CompensationQuoteResponse premium = CompensationClaimService.compute("FORCE_MAJEURE", "GOODS_DAMAGE",
                new BigDecimal("10000000"), 100, 0, InsurancePlan.PREMIUM, new BigDecimal("10000000"), PRICE);
        assertMoney("10000000", premium.goodsCompensation());
        assertMoney("0", premium.penaltyAmount());
        assertTrue(premium.insuranceClaimable());
    }

    @Test
    @DisplayName("BR-127 lỗi khách: không bồi thường")
    void customerFault() {
        CompensationQuoteResponse q = CompensationClaimService.compute("CUSTOMER", "GOODS_DAMAGE",
                new BigDecimal("10000000"), 80, 5, InsurancePlan.PREMIUM, new BigDecimal("10000000"), PRICE);
        assertMoney("0", q.totalCompensation());
        assertFalse(q.insuranceClaimable());
    }

    @Test
    @DisplayName("BR-127 chấm dứt do lỗi cơ sở: không phí phá HĐ, hoàn tiền thuê theo số ngày còn lại")
    void faultTerminationRefundsRemainingDays() {
        LocalDate start = LocalDate.of(2026, 1, 1);
        LocalDate end = LocalDate.of(2026, 7, 1);         // 181 ngày
        LocalDate checkout = LocalDate.of(2026, 3, 1);    // còn 122 ngày
        var r = StaffTaskService.faultTerminationReturn(start, end, checkout, new BigDecimal("8100000"));
        assertMoney("0", r.breakFee());
        assertMoney("5459669", r.refund());               // 8.100.000 × 122 / 181
        // so với trả sớm thường (PR-O2): dùng 2 tháng + phạt 1 tháng
        var normal = StaffTaskService.earlyReturn(start, 6, checkout, PRICE, new BigDecimal("8100000"));
        assertTrue(r.refund().compareTo(normal.refund()) > 0);
    }

    @Test
    @DisplayName("BR-129: ngưỡng cảm biến 15–30°C, độ ẩm ≤ 75%")
    void sensorThresholds() {
        assertFalse(UnitSensorService.isAlert(new BigDecimal("25"), new BigDecimal("60")));
        assertTrue(UnitSensorService.isAlert(new BigDecimal("31"), new BigDecimal("60")));
        assertTrue(UnitSensorService.isAlert(new BigDecimal("14.5"), new BigDecimal("60")));
        assertTrue(UnitSensorService.isAlert(new BigDecimal("25"), new BigDecimal("80")));
    }
}

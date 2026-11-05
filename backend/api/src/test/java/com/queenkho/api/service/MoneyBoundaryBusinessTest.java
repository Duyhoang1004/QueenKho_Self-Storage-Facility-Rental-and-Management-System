package com.queenkho.api.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import static org.junit.jupiter.api.Assertions.*;
import static com.queenkho.api.service.BusinessFixtures.*;

class MoneyBoundaryBusinessTest {
    @ParameterizedTest @CsvSource({"1,0,1000000", "3,5,2850000", "6,10,5400000", "12,15,10200000"})
    void bookingRentMatchesPublishedPackages(int months, int percent, String total) {
        assertEquals(0, money(total).compareTo(PricingService.discountedRent(money("1000000"), months, percent)));
    }

    @ParameterizedTest @EnumSource(InsurancePlan.class)
    void undeclaredGoodsNeverReceiveFullAdvertisedCoverage(InsurancePlan plan) {
        assertEquals(0, money("5000000").compareTo(plan.coverageCap(null)));
        assertEquals(0, money("5000000").compareTo(plan.coverageCap(BigDecimal.ZERO)));
    }

    @ParameterizedTest @CsvSource({"BASIC,20000000", "ADVANCED,200000000", "PREMIUM,500000000"})
    void declarationAbovePlanLimitIsCapped(String code, String cap) {
        assertEquals(0, money(cap).compareTo(InsurancePlan.valueOf(code).coverageCap(money("1000000000"))));
    }

    @ParameterizedTest @ValueSource(ints = {1, 25, 50, 99, 100})
    void customerFaultNeverPaysCompensationRegardlessOfDamage(int percent) {
        var q = CompensationClaimService.compute("CUSTOMER", "GOODS_DAMAGE", money("10000000"),
                percent, 30, InsurancePlan.PREMIUM, money("10000000"), money("1000000"));
        assertEquals(0, q.totalCompensation().signum());
        assertFalse(q.insuranceClaimable());
    }

    @ParameterizedTest @EnumSource(InsurancePlan.class)
    void goodsLossCompensationDoesNotDependOnEnteredDamagePercentage(InsurancePlan plan) {
        var q = CompensationClaimService.compute("FACILITY", "GOODS_LOSS", money("3000000"),
                1, 0, plan, money("3000000"), money("1000000"));
        assertEquals(0, money("3000000").compareTo(q.goodsCompensation()));
    }

    @ParameterizedTest @EnumSource(InsurancePlan.class)
    void forceMajeureHasNoBreachPenalty(InsurancePlan plan) {
        var q = CompensationClaimService.compute("FORCE_MAJEURE", "GOODS_LOSS", money("3000000"),
                100, 0, plan, money("3000000"), money("1000000"));
        assertEquals(0, q.penaltyAmount().signum());
        assertEquals(plan.insured(), q.goodsCompensation().signum() > 0);
    }

    @ParameterizedTest @ValueSource(ints = {1, 3, 6, 12})
    void ordinaryEarlyRefundNeverExceedsPaidRent(int months) {
        var paid = money("1000000").multiply(BigDecimal.valueOf(months));
        var start = LocalDate.of(2026, 1, 1);
        var result = StaffTaskService.earlyReturn(start, months, start.plusDays(1), money("1000000"), paid);
        assertTrue(result.refund().signum() >= 0);
        assertTrue(result.refund().compareTo(paid) <= 0);
    }

    @ParameterizedTest @ValueSource(ints = {1, 3, 6, 12})
    void finalMonthDoesNotChargeContractBreakFee(int months) {
        var start = LocalDate.of(2026, 1, 1);
        var result = StaffTaskService.earlyReturn(start, months, start.plusMonths(months).minusDays(1),
                money("1000000"), money("1000000").multiply(BigDecimal.valueOf(months)));
        assertEquals(0, result.breakFee().signum());
        assertEquals(0, result.refund().signum());
    }

    @ParameterizedTest @CsvSource({"15,75,false", "30,75,false", "14.9,50,true", "30.1,50,true", "24,75.1,true"})
    void sensorAlarmHonorsExactSafetyBoundaries(String temperature, String humidity, boolean expected) {
        assertEquals(expected, UnitSensorService.isAlert(money(temperature), money(humidity)));
    }

    @Test void faultTerminationWithinPeriodRefundsOnlyUnusedDays() {
        var r = StaffTaskService.faultTerminationReturn(LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 1, 31), LocalDate.of(2026, 1, 16), money("3000000"));
        assertEquals(0, money("1500000").compareTo(r.refund()));
        assertEquals(0, r.breakFee().signum());
    }
}

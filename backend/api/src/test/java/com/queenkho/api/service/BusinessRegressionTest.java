package com.queenkho.api.service;

import com.queenkho.api.entity.*;
import com.queenkho.api.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Review probes: expected business invariants, intentionally red on reviewed HEAD 9d7dd5c.
 * Active regression tests: failures identify bugs; do not weaken expectations.
 * No SQL Server, payment gateway or running application required.
 */
@org.junit.jupiter.api.Tag("regression")
class BusinessRegressionTest {
    private static BigDecimal money(String s) { return new BigDecimal(s); }
    private static void sameMoney(String expected, BigDecimal actual) {
        assertEquals(0, money(expected).compareTo(actual), "expected=" + expected + ", actual=" + actual);
    }
    private RentalContract contract(String status, LocalDate start, LocalDate end) {
        UnitType type = new UnitType();
        type.setBasePriceMonthly(money("1000000"));
        StorageUnit unit = new StorageUnit();
        unit.setId("AUDIT-A");
        unit.setUnitType(type);
        unit.setStatus("OCCUPIED");
        User customer = new User();
        customer.setId(10);
        Reservation reservation = new Reservation();
        reservation.setId(20);
        reservation.setDurationMonths(3);
        reservation.setRentDiscountPercent(5);
        reservation.setDepositAmount(money("1000000"));
        reservation.setInsurancePremiumMonthly(BigDecimal.ZERO);
        RentalContract c = new RentalContract();
        c.setId(30);
        c.setContractCode("AUDIT-HD");
        c.setCustomer(customer);
        c.setReservation(reservation);
        c.setStorageUnit(unit);
        c.setStartDate(start);
        c.setEndDate(end);
        c.setDepositHeldAmount(money("1000000"));
        c.setBillingCycleMonths(3);
        c.setStatus(status);
        return c;
    }
    private StaffTaskService refundService(JdbcTemplate jdbc) {
        StaffTaskService service = new StaffTaskService();
        ReflectionTestUtils.setField(service, "jdbcTemplate", jdbc);
        LateFeeService late = mock(LateFeeService.class);
        when(late.overstayFee(any(), anyLong())).thenReturn(BigDecimal.ZERO);
        ReflectionTestUtils.setField(service, "lateFeeService", late);
        return service;
    }
    @Test void catalogPriceChangeMustNotRewriteAnExistingPaidPeriod() {
        RentalContract c = contract("ACTIVE", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 4, 1));
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());
        when(jdbc.queryForObject(anyString(), eq(BigDecimal.class), any(Object[].class))).thenReturn(money("3850000"));
        StaffTaskService service = refundService(jdbc);
        sameMoney("850000", service.calculateCheckoutRefund(c, LocalDate.of(2026, 1, 15), BigDecimal.ZERO).getEarlyRentRefund());
        c.getStorageUnit().getUnitType().setBasePriceMonthly(money("2000000"));
        sameMoney("850000", service.calculateCheckoutRefund(c, LocalDate.of(2026, 1, 15), BigDecimal.ZERO).getEarlyRentRefund());
    }
    @Test void faultTerminationRefundMustNotExceedThePaidFuturePeriod() {
        var result = StaffTaskService.faultTerminationReturn(LocalDate.of(2027, 1, 1),
                LocalDate.of(2027, 4, 1), LocalDate.of(2026, 11, 5), money("3000000"));
        assertTrue(result.refund().compareTo(money("3000000")) <= 0,
                "Future period cost=3000000, refund=" + result.refund());
    }
    @Test void successfulCallbackMustRejectAnAlreadyTerminatedContract() {
        RentalContract c = contract("TERMINATED", LocalDate.now().minusMonths(3), LocalDate.now().plusDays(10));
        RentalContractRepository repo = mock(RentalContractRepository.class);
        when(repo.findDetailById(30)).thenReturn(Optional.of(c));
        VnpayService service = new VnpayService(mock(PaymentRepository.class), repo,
                mock(ReservationRepository.class), mock(StaffTaskService.class), mock(PricingService.class),
                mock(JdbcTemplate.class), mock(RenewalPolicyService.class));
        String error = ReflectionTestUtils.invokeMethod(service, "settleRenewal", "AUDIT-REF",
                Map.of("contract_id", 30, "renewal_months", 1));
        assertNotNull(error, "Closed contract must go through late-payment refund, not settle a new rental period");
    }
    @Test void renewalCallbackMustNotExtendUnitReservedForAnotherBooking() {
        RentalContract c = contract("ACTIVE", LocalDate.now().minusMonths(1), LocalDate.now().plusDays(2));
        RentalContractRepository repo = mock(RentalContractRepository.class);
        when(repo.findDetailById(30)).thenReturn(Optional.of(c));
        RenewalPolicyService policy = mock(RenewalPolicyService.class);
        doThrow(new com.queenkho.api.exception.ContractException(org.springframework.http.HttpStatus.CONFLICT,
                "RENEWAL_UNIT_RESERVED", "Another paid booking requires this unit"))
                .when(policy).assertRenewable(c);
        VnpayService service = new VnpayService(mock(PaymentRepository.class), repo,
                mock(ReservationRepository.class), mock(StaffTaskService.class), mock(PricingService.class),
                mock(JdbcTemplate.class), policy);
        LocalDate alreadyPaidUntil = c.getEndDate();
        try {
            ReflectionTestUtils.invokeMethod(service, "settleRenewal", "AUDIT-REF",
                    Map.of("contract_id", 30, "renewal_months", 1));
        } catch (com.queenkho.api.exception.ContractException ex) {
            assertEquals("RENEWAL_UNIT_RESERVED", ex.getCode());
        }
        assertEquals(alreadyPaidUntil, c.getEndDate(), "Callback must not consume another customer's slot");
    }
    @Test void anotherUnitReleasedTooLateMustNotCoverAnEarlierPaidBooking() {
        RentalContract c = contract("ACTIVE", LocalDate.now().minusMonths(1), LocalDate.now().plusDays(2));
        Facility facility = new Facility();
        facility.setId(1);
        c.getStorageUnit().setFacility(facility);
        c.getStorageUnit().getUnitType().setId(2);
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        // No AVAILABLE unit; one new customer already holds a slot expecting this unit soon.
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(Object[].class))).thenReturn(-1);
        // Only alternative unit becomes free much later than that new customer's start date.
        when(jdbc.query(anyString(), org.mockito.ArgumentMatchers.<RowMapper<LocalDate>>any(), any(Object[].class)))
                .thenReturn(List.of(LocalDate.now().plusDays(20)));
        assertTrue(new RenewalPolicyService(jdbc).unitNeededByOthers(c),
                "Later release dates cannot satisfy a booking due before those dates");
    }
}

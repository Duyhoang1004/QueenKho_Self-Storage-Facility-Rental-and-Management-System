package com.queenkho.api.service;

import com.queenkho.api.entity.Voucher;
import com.queenkho.api.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.springframework.jdbc.core.JdbcTemplate;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.queenkho.api.service.BusinessFixtures.*;

class VoucherBusinessTest {
    final VoucherRepository vouchers = mock(VoucherRepository.class);
    final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    final VoucherService service = new VoucherService(vouchers, mock(UnitTypeRepository.class), mock(PricingService.class), jdbc);
    Voucher voucher;

    @BeforeEach void setup() {
        voucher = new Voucher();
        voucher.setId(1); voucher.setCode("TEST"); voucher.setName("Test voucher");
        voucher.setDiscountType("FIXED"); voucher.setDiscountValue(money("100000"));
        voucher.setStartAt(LocalDateTime.now().minusDays(1));
        when(vouchers.findByCode("TEST")).thenReturn(Optional.of(voucher));
    }

    @ParameterizedTest @ValueSource(strings = {"0", "50000", "100000", "200000"})
    void fixedVoucherCannotReduceDepositWhenRentIsSmallerThanDiscount(String rent) {
        var discount = (BigDecimal) service.quote("TEST", 10, 1, 3, money(rent)).get("discount");
        assertEquals(0, money(rent).min(money("100000")).compareTo(discount));
    }

    @Test void percentVoucherRespectsItsMonetaryCap() {
        voucher.setDiscountType("PERCENT"); voucher.setDiscountValue(money("50"));
        voucher.setMaxDiscount(money("200000"));
        assertEquals(0, money("200000").compareTo((BigDecimal) service.quote(" test ", 10, 1, 3, money("1000000")).get("discount")));
    }

    @Test void inactiveVoucherExplicitlyEnteredByCustomerIsRejected() {
        voucher.setStatus("INACTIVE");
        assertThrows(RuntimeException.class, () -> service.quote("TEST", 10, 1, 3, money("1000000")));
    }

    @Test void expiredVoucherIsRejected() {
        voucher.setEndAt(LocalDateTime.now().minusSeconds(1));
        assertThrows(RuntimeException.class, () -> service.quote("TEST", 10, 1, 3, money("1000000")));
    }

    @Test void futureVoucherIsNotActiveEarly() {
        voucher.setStartAt(LocalDateTime.now().plusDays(1));
        assertThrows(RuntimeException.class, () -> service.quote("TEST", 10, 1, 3, money("1000000")));
    }

    @Test void voucherRestrictedToAnotherFacilityIsRejected() {
        voucher.setFacilityId(2);
        assertThrows(RuntimeException.class, () -> service.quote("TEST", 10, 1, 3, money("1000000")));
    }

    @Test void packageShorterThanMinimumCannotUseVoucher() {
        voucher.setMinMonths(6);
        assertThrows(RuntimeException.class, () -> service.quote("TEST", 10, 1, 3, money("1000000")));
    }

    @Test void heldLastUsageCountsBeforePaymentCompletes() {
        voucher.setUsageLimit(1);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(1))).thenReturn(1);
        assertThrows(RuntimeException.class, () -> service.quote("TEST", 10, 1, 3, money("1000000")));
    }

    @Test void perCustomerUsageCannotBeBypassedByAnotherBooking() {
        voucher.setPerUserLimit(1);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(1), eq(10))).thenReturn(1);
        assertThrows(RuntimeException.class, () -> service.quote("TEST", 10, 1, 3, money("1000000")));
    }

    @Test void unusableDefaultVoucherDoesNotBlockOtherwiseValidBooking() {
        voucher.setEndAt(LocalDateTime.now().minusDays(1));
        when(vouchers.findFirstByIsDefaultTrueAndStatusOrderByIdAsc("ACTIVE")).thenReturn(Optional.of(voucher));
        assertEquals(0, ((BigDecimal) service.quote(null, 10, 1, 3, money("1000000")).get("discount")).signum());
    }
}

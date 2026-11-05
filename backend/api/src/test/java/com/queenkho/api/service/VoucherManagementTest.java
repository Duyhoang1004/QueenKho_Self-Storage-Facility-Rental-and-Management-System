package com.queenkho.api.service;

import com.queenkho.api.dto.VoucherRequest;
import com.queenkho.api.entity.Voucher;
import com.queenkho.api.exception.ReservationException;
import com.queenkho.api.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class VoucherManagementTest {
    final VoucherRepository vouchers = mock(VoucherRepository.class);
    final UnitTypeRepository types = mock(UnitTypeRepository.class);
    final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    final VoucherService service = new VoucherService(vouchers, types, mock(PricingService.class), jdbc);

    VoucherRequest valid() {
        var request = new VoucherRequest();
        request.setCode("WELCOME"); request.setName("Welcome voucher");
        request.setDiscountType("FIXED"); request.setDiscountValue(new BigDecimal("100000"));
        return request;
    }

    static Stream<Arguments> invalidRequests() {
        return Stream.of(
                bad("short code", r -> r.setCode("AB")),
                bad("long code", r -> r.setCode("A".repeat(31))),
                bad("code with spaces", r -> r.setCode("NEW KHO")),
                bad("missing code", r -> r.setCode(null)),
                bad("missing name", r -> r.setName(null)),
                bad("blank name", r -> r.setName("  ")),
                bad("long name", r -> r.setName("N".repeat(151))),
                bad("unknown discount type", r -> r.setDiscountType("FREE")),
                bad("missing value", r -> r.setDiscountValue(null)),
                bad("zero discount", r -> r.setDiscountValue(BigDecimal.ZERO)),
                bad("negative discount", r -> r.setDiscountValue(BigDecimal.ONE.negate())),
                bad("percent above 100", r -> { r.setDiscountType("PERCENT"); r.setDiscountValue(new BigDecimal("101")); }),
                bad("zero cap", r -> r.setMaxDiscount(BigDecimal.ZERO)),
                bad("negative cap", r -> r.setMaxDiscount(BigDecimal.ONE.negate())),
                bad("invalid minimum months", r -> r.setMinMonths(2)),
                bad("zero usage limit", r -> r.setUsageLimit(0)),
                bad("negative per-user limit", r -> r.setPerUserLimit(-1)),
                bad("end equals start", r -> { r.setStartAt(LocalDateTime.of(2026, 1, 1, 0, 0)); r.setEndAt(r.getStartAt()); }),
                bad("end before start", r -> { r.setStartAt(LocalDateTime.of(2026, 1, 1, 0, 0)); r.setEndAt(r.getStartAt().minusDays(1)); })
        );
    }

    static Arguments bad(String name, Consumer<VoucherRequest> mutation) { return Arguments.of(name, mutation); }

    @ParameterizedTest(name = "{0}") @MethodSource("invalidRequests")
    void invalidVoucherIsNeverPersisted(String name, Consumer<VoucherRequest> mutation) {
        var request = valid(); mutation.accept(request);
        var error = assertThrows(ReservationException.class, () -> service.create(request, 8));
        assertEquals("INVALID_INPUT", error.getCode());
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatus());
        verify(vouchers, never()).save(any());
        verify(jdbc, never()).update(anyString(), anyInt());
    }

    @Test void missingBodyCannotCreateVoucher() {
        assertEquals("INVALID_INPUT", assertThrows(ReservationException.class, () -> service.create(null, 8)).getCode());
        verifyNoInteractions(vouchers);
    }

    @Test void duplicateCodeCannotCreateSecondVoucher() {
        when(vouchers.existsByCode("WELCOME")).thenReturn(true);
        assertEquals("DUPLICATE_CODE", assertThrows(ReservationException.class, () -> service.create(valid(), 8)).getCode());
        verify(vouchers, never()).save(any());
    }

    @Test void creationNormalizesInputAndInitializesAuditAndUsage() {
        var request = valid(); request.setCode(" welcome "); request.setName(" Welcome "); request.setDiscountType(" fixed ");
        when(vouchers.save(any())).thenAnswer(invocation -> { Voucher v = invocation.getArgument(0); v.setId(5); return v; });
        var response = service.create(request, 8);
        var saved = org.mockito.ArgumentCaptor.forClass(Voucher.class);
        verify(vouchers).save(saved.capture());
        assertAll(() -> assertEquals("WELCOME", response.code()),
                () -> assertEquals("Welcome", response.name()),
                () -> assertEquals("FIXED", response.discountType()),
                () -> assertEquals("ACTIVE", response.status()),
                () -> assertEquals(0, response.usedCount()),
                () -> assertEquals(1, response.minMonths()),
                () -> assertEquals(8, saved.getValue().getCreatedBy()),
                () -> assertNotNull(response.createdAt()));
    }

    @Test void nonexistentFacilityIsRejectedBeforeSave() {
        var request = valid(); request.setFacilityId(999);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(999))).thenReturn(0);
        assertThrows(ReservationException.class, () -> service.create(request, 8));
        verify(vouchers, never()).save(any());
    }

    @Test void nonexistentUnitTypeIsRejectedBeforeSave() {
        var request = valid(); request.setUnitTypeId(999);
        assertThrows(ReservationException.class, () -> service.create(request, 8));
        verify(vouchers, never()).save(any());
    }

    Voucher existing(int used) {
        Voucher voucher = new Voucher(); voucher.setId(5); voucher.setCode("WELCOME"); voucher.setUsedCount(used);
        when(vouchers.findById(5)).thenReturn(Optional.of(voucher));
        when(vouchers.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        return voucher;
    }

    @Test void usedVoucherCodeIsImmutable() {
        existing(1); var request = valid(); request.setCode("NEWCODE");
        assertEquals("VOUCHER_IN_USE", assertThrows(ReservationException.class, () -> service.update(5, request)).getCode());
        verify(vouchers, never()).save(any());
    }

    @Test void usedVoucherCanStillChangeDisplayNameWithoutChangingUsage() {
        existing(2); var request = valid(); request.setName("New display name");
        var response = service.update(5, request);
        assertEquals("New display name", response.name());
        assertEquals(2, response.usedCount());
        verify(vouchers, never()).existsByCode(anyString());
    }

    @Test void usageLimitCannotDropBelowAlreadyRedeemedCount() {
        existing(5); var request = valid(); request.setUsageLimit(4);
        assertThrows(ReservationException.class, () -> service.update(5, request));
        verify(vouchers, never()).save(any());
    }

    @Test void newDefaultClearsOtherDefaultBeforeSavingIt() {
        var request = valid(); request.setIsDefault(true);
        when(vouchers.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        service.create(request, 8);
        var order = inOrder(jdbc, vouchers);
        order.verify(jdbc).update(contains("is_default = 0"), eq(-1));
        order.verify(vouchers).save(argThat(v -> Boolean.TRUE.equals(v.getIsDefault())));
    }

    @Test void updatingDefaultKeepsItsOwnDefaultFlag() {
        existing(0); var request = valid(); request.setIsDefault(true);
        service.update(5, request);
        verify(jdbc).update(contains("is_default = 0"), eq(5));
    }

    @ParameterizedTest @NullAndEmptySource @ValueSource(strings = {"DELETED", "PENDING"})
    void unsupportedStatusCannotMutateVoucher(String status) {
        assertThrows(ReservationException.class, () -> service.setStatus(5, status));
        verifyNoInteractions(vouchers);
    }

    @Test void statusNormalizesWhitespaceAndCase() {
        existing(2);
        assertEquals("INACTIVE", service.setStatus(5, " inactive ").status());
    }

    @Test void missingVoucherReturnsNotFound() {
        var error = assertThrows(ReservationException.class, () -> service.update(999, valid()));
        assertEquals(HttpStatus.NOT_FOUND, error.getStatus());
        assertEquals("VOUCHER_NOT_FOUND", error.getCode());
    }
}

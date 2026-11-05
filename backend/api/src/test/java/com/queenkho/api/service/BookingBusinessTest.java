package com.queenkho.api.service;

import com.queenkho.api.dto.CreateReservationRequest;
import com.queenkho.api.entity.*;
import com.queenkho.api.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.queenkho.api.service.BusinessFixtures.*;

class BookingBusinessTest {
    final ReservationRepository reservations = mock(ReservationRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final FacilityRepository facilities = mock(FacilityRepository.class);
    final UnitTypeRepository types = mock(UnitTypeRepository.class);
    final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    final ReservationService service = new ReservationService();
    Facility facility;
    UnitType type;

    @BeforeEach void setup() {
        facility = facility(1);
        type = unit("TEST", 1, 1).getUnitType();
        when(users.findById(10)).thenReturn(Optional.of(user(10, "CUSTOMER", null)));
        when(facilities.findById(1)).thenReturn(Optional.of(facility));
        when(types.findById(1)).thenReturn(Optional.of(type));
        when(jdbc.queryForMap(anyString(), any(), any(), any()))
                .thenReturn(Map.of("overdue_count", 0, "damage_count", 0));
        when(jdbc.queryForObject(contains("FROM facilities WITH"), eq(Integer.class), any())).thenReturn(1);
        when(jdbc.queryForObject(contains("FROM storage_units WHERE"), eq(Integer.class), any(), any(), any(), any()))
                .thenReturn(1);
        when(reservations.save(any())).thenAnswer(inv -> {
            Reservation r = inv.getArgument(0); r.setId(20); return r;
        });
        ReflectionTestUtils.setField(service, "reservationRepository", reservations);
        ReflectionTestUtils.setField(service, "userRepository", users);
        ReflectionTestUtils.setField(service, "facilityRepository", facilities);
        ReflectionTestUtils.setField(service, "unitTypeRepository", types);
        ReflectionTestUtils.setField(service, "jdbcTemplate", jdbc);
        ReflectionTestUtils.setField(service, "pricingService", mock(PricingService.class));
        ReflectionTestUtils.setField(service, "renewalPolicyService", mock(RenewalPolicyService.class));
        ReflectionTestUtils.setField(service, "activityLogService", mock(ActivityLogService.class));
    }

    CreateReservationRequest request() {
        CreateReservationRequest r = new CreateReservationRequest();
        r.setCustomerId(10); r.setFacilityId(1); r.setUnitTypeId(1);
        r.setStartDate(LocalDate.now().plusDays(2));
        r.setDurationMonths(3); r.setAcceptedTerms(true);
        return r;
    }

    @ParameterizedTest @NullSource @ValueSource(ints = {0, -1})
    void nonPositiveDurationCannotHoldCapacity(Integer months) {
        var r = request(); r.setDurationMonths(months);
        assertThrows(IllegalArgumentException.class, () -> service.createReservation(r));
        verify(reservations, never()).save(any());
    }

    @Test void bookingInPastCannotHoldCapacity() {
        var r = request(); r.setStartDate(LocalDate.now().minusDays(1));
        assertThrows(IllegalArgumentException.class, () -> service.createReservation(r));
        verifyNoInteractions(reservations);
    }

    @ParameterizedTest @NullSource @ValueSource(booleans = false)
    void termsMustBeExplicitlyAccepted(Boolean accepted) {
        var r = request(); r.setAcceptedTerms(accepted);
        assertThrows(RuntimeException.class, () -> service.createReservation(r));
        verifyNoInteractions(reservations);
    }

    @ParameterizedTest @ValueSource(strings = {"GOLD", "FREE", "PREMIUM_PLUS"})
    void unknownInsuranceCannotBeSilentlyDowngraded(String plan) {
        var r = request(); r.setInsurancePlan(plan);
        assertThrows(RuntimeException.class, () -> service.createReservation(r));
        verifyNoInteractions(reservations);
    }

    @ParameterizedTest @ValueSource(strings = {"-1", "10000000001"})
    void goodsDeclarationMustBeWithinSupportedRange(String value) {
        var r = request(); r.setDeclaredGoodsValue(money(value));
        assertThrows(RuntimeException.class, () -> service.createReservation(r));
        verifyNoInteractions(reservations);
    }

    @ParameterizedTest @CsvSource({"BASIC,0", "ADVANCED,50000", "PREMIUM,120000"})
    void bookingStoresInsurancePriceAndTermsSnapshot(String plan, String premium) {
        var r = request(); r.setInsurancePlan(plan); r.setDeclaredGoodsValue(money("30000000"));
        service.createReservation(r);
        var captured = org.mockito.ArgumentCaptor.forClass(Reservation.class);
        verify(reservations).save(captured.capture());
        var saved = captured.getValue();
        assertAll(() -> assertEquals("PENDING", saved.getStatus()),
                () -> assertNull(saved.getStorageUnitId()),
                () -> assertEquals(plan, saved.getInsurancePlan()),
                () -> assertEquals(0, money(premium).compareTo(saved.getInsurancePremiumMonthly())),
                () -> assertEquals("v3", saved.getTermsVersion()),
                () -> assertNotNull(saved.getTermsAcceptedAt()),
                () -> assertEquals(0, saved.getTotalDepositPaid().signum()));
    }

    @Test void inactiveFacilityCannotReceiveNewBookings() {
        facility.setStatus("INACTIVE");
        assertThrows(IllegalArgumentException.class, () -> service.createReservation(request()));
        verifyNoInteractions(reservations);
    }

    @Test void inactiveUnitTypeCannotReceiveNewBookings() {
        type.setStatus("INACTIVE");
        assertThrows(IllegalArgumentException.class, () -> service.createReservation(request()));
        verifyNoInteractions(reservations);
    }

    @ParameterizedTest @CsvSource({"1,0", "0,1"})
    void overdueContractsOrUnpaidDebtBlockNewBooking(int overdue, int debt) {
        when(jdbc.queryForMap(anyString(), any(), any(), any()))
                .thenReturn(Map.of("overdue_count", overdue, "damage_count", debt));
        assertThrows(RuntimeException.class, () -> service.createReservation(request()));
        verifyNoInteractions(reservations);
    }
}

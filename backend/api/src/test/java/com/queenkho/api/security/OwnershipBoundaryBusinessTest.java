package com.queenkho.api.security;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OwnershipBoundaryBusinessTest {
    final CurrentUserProvider provider = mock(CurrentUserProvider.class);
    final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    final OwnershipGuard guard = new OwnershipGuard(provider, jdbc);

    void actor(String role, int id, Integer facility) {
        when(provider.require()).thenReturn(new CurrentUser(id, role, facility, "Test", "test@example.invalid"));
        when(jdbc.queryForList(anyString(), eq(30))).thenReturn(List.of(Map.of("customer_id", 10, "facility_id", 1)));
    }

    @Test void customerCanReadOwnContract() {
        actor("CUSTOMER", 10, null);
        assertDoesNotThrow(() -> guard.checkContract(30));
    }

    @Test void guessingContractIdDoesNotGrantAccessToAnotherCustomer() {
        actor("CUSTOMER", 99, null);
        assertThrows(AccessException.class, () -> guard.checkContract(30));
    }

    @ParameterizedTest @ValueSource(strings = {"STAFF", "FACILITY_MANAGER"})
    void facilityRolesCannotReadOtherFacilityContract(String role) {
        actor(role, 6, 2);
        assertThrows(AccessException.class, () -> guard.checkContract(30));
    }

    @ParameterizedTest @ValueSource(strings = {"STAFF", "FACILITY_MANAGER"})
    void facilityRolesCanReadTheirFacilityContract(String role) {
        actor(role, 6, 1);
        assertDoesNotThrow(() -> guard.checkContract(30));
    }

    @ParameterizedTest @ValueSource(strings = {"BOM", "ADMIN"})
    void chainRolesHaveChainScopeAfterEndpointAuthorization(String role) {
        actor(role, 6, null);
        assertDoesNotThrow(() -> guard.checkContract(30));
    }

    @Test void foreignReservationIsAlsoProtected() {
        actor("CUSTOMER", 99, null);
        assertThrows(AccessException.class, () -> guard.checkReservation(30));
    }

    @Test void missingRecordIsLeftForServiceToReturnNotFound() {
        actor("CUSTOMER", 99, null);
        when(jdbc.queryForList(anyString(), eq(30))).thenReturn(List.of());
        assertDoesNotThrow(() -> guard.checkContract(30));
    }
}

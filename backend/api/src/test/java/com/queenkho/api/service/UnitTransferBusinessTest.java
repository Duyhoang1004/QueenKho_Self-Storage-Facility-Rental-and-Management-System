package com.queenkho.api.service;

import com.queenkho.api.dto.TransferUnitRequest;
import com.queenkho.api.entity.*;
import com.queenkho.api.exception.ContractException;
import com.queenkho.api.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.queenkho.api.service.BusinessFixtures.*;

class UnitTransferBusinessTest {
    final RentalContractRepository contracts = mock(RentalContractRepository.class);
    final StorageUnitRepository units = mock(StorageUnitRepository.class);
    final ReservationRepository reservations = mock(ReservationRepository.class);
    final UnitTransferRepository history = mock(UnitTransferRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    final NotificationService notifications = mock(NotificationService.class);
    final UnitTransferService service = new UnitTransferService(contracts, units, reservations,
            history, users, mock(ActivityLogService.class), notifications, jdbc);
    RentalContract contract;
    StorageUnit target;
    User manager;

    @BeforeEach void setup() {
        contract = contract("ACTIVE");
        target = unit("TEST-B", 1, 1);
        manager = user(6, "FACILITY_MANAGER", 1);
        when(users.findById(6)).thenReturn(Optional.of(manager));
        when(contracts.findDetailById(30)).thenReturn(Optional.of(contract));
        when(units.findById("TEST-B")).thenReturn(Optional.of(target));
        when(jdbc.update(anyString(), eq("TEST-B"))).thenReturn(1);
        when(units.countByFacility_IdAndUnitType_IdAndStatus(1, 1, "AVAILABLE")).thenReturn(2);
    }

    TransferUnitRequest request(String reason) {
        TransferUnitRequest r = new TransferUnitRequest();
        r.setToUnitId("TEST-B");
        r.setReasonType(reason);
        r.setReason("Customer move confirmed with facility");
        return r;
    }

    @ParameterizedTest @ValueSource(strings = {"ACTIVE", "PENDING_CHECK_IN", "TERMINATION_PENDING"})
    void transferPreservesPriceDatesPinAndSynchronizesReservation(String status) {
        contract.setStatus(status);
        var oldUnit = contract.getStorageUnit();
        var end = contract.getEndDate();
        service.transferUnit(30, 6, request("CUSTOMER_REQUEST"));
        assertAll(() -> assertEquals(target, contract.getStorageUnit()),
                () -> assertEquals("TEST-B", contract.getReservation().getStorageUnitId()),
                () -> assertEquals("135790", contract.getAccessPinCode()),
                () -> assertEquals(end, contract.getEndDate()),
                () -> assertEquals(status, contract.getStatus()),
                () -> assertEquals("AVAILABLE", oldUnit.getStatus()),
                () -> assertEquals("OCCUPIED", target.getStatus()));
        var captured = org.mockito.ArgumentCaptor.forClass(UnitTransfer.class);
        verify(history).saveAndFlush(captured.capture());
        assertEquals("TEST-A", captured.getValue().getFromUnitId());
        assertEquals("TEST-B", captured.getValue().getToUnitId());
    }

    @ParameterizedTest @ValueSource(strings = {"OVERDUE", "TERMINATED", "LIQUIDATED"})
    void closedOrOverdueContractCannotMove(String status) {
        contract.setStatus(status);
        assertEquals("CONTRACT_NOT_TRANSFERABLE", assertThrows(ContractException.class,
                () -> service.transferUnit(30, 6, request("REARRANGE"))).getCode());
        verifyNoInteractions(history);
    }

    @Test void managerCannotMoveContractFromAnotherFacility() {
        manager.setFacilityId(2);
        assertEquals("FORBIDDEN_FACILITY", assertThrows(ContractException.class,
                () -> service.transferUnit(30, 6, request("REARRANGE"))).getCode());
    }

    @Test void targetMustBelongToSameFacility() {
        target.setFacility(facility(2));
        assertEquals("UNIT_NOT_IN_FACILITY", assertThrows(ContractException.class,
                () -> service.transferUnit(30, 6, request("REARRANGE"))).getCode());
    }

    @Test void concurrentLossOfTargetDoesNotReleaseOriginalUnit() {
        when(jdbc.update(anyString(), eq("TEST-B"))).thenReturn(0);
        assertEquals("UNIT_NOT_AVAILABLE", assertThrows(ContractException.class,
                () -> service.transferUnit(30, 6, request("REARRANGE"))).getCode());
        assertEquals("TEST-A", contract.getStorageUnit().getId());
        assertEquals("OCCUPIED", contract.getStorageUnit().getStatus());
        verifyNoInteractions(history);
    }

    @Test void facilityFaultForcesOldUnitIntoMaintenance() {
        var oldUnit = contract.getStorageUnit();
        service.transferUnit(30, 6, request("FACILITY_ISSUE"));
        assertEquals("MAINTENANCE", oldUnit.getStatus());
        assertNotNull(oldUnit.getMaintenanceSince());
        assertTrue(oldUnit.getMaintenanceNote().contains("TEST-B"));
    }

    @ParameterizedTest @ValueSource(strings = {"", "short"})
    void reasonMustBeAuditable(String reason) {
        var r = request("REARRANGE");
        r.setReason(reason);
        assertThrows(ContractException.class, () -> service.transferUnit(30, 6, r));
        verifyNoInteractions(history);
    }
}

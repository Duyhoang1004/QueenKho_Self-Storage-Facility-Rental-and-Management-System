package com.queenkho.api.service;

import com.queenkho.api.dto.*;
import com.queenkho.api.entity.*;
import com.queenkho.api.exception.FacilityException;
import com.queenkho.api.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.queenkho.api.service.BusinessFixtures.*;

class StorageUnitBusinessTest {
    final StorageUnitRepository units = mock(StorageUnitRepository.class);
    final ReservationRepository reservations = mock(ReservationRepository.class);
    final StaffTaskService tasks = mock(StaffTaskService.class);
    final StorageUnitService service = spy(new StorageUnitService(units, mock(FacilityRepository.class),
            mock(UnitTypeRepository.class), mock(RentalContractRepository.class), reservations,
            mock(ActivityLogService.class), tasks, mock(FloorPlanService.class), mock(RenewalPolicyService.class)));
    StorageUnit unit;

    @BeforeEach void setup() {
        unit = unit("TEST-A", 1, 1);
        when(units.findById("TEST-A")).thenReturn(Optional.of(unit));
        // Read-model formatting is outside these state-transition tests.
        doReturn(mock(StorageUnitDetailResponse.class)).when(service).getStorageUnitDetail("TEST-A");
        when(units.countByFacility_IdAndUnitType_IdAndStatus(1, 1, "AVAILABLE")).thenReturn(2);
    }

    @ParameterizedTest @ValueSource(strings = {"OCCUPIED", "DELETED", "UNKNOWN"})
    void managerCannotInventArbitraryUnitStatus(String target) {
        assertThrows(FacilityException.class, () -> service.updateStorageUnitStatus("TEST-A",
                new UpdateStorageUnitStatusRequest(target, "Detailed maintenance request"), 6));
        verify(units, never()).save(any());
    }

    @Test void occupiedUnitCannotBeManuallyReleased() {
        unit.setStatus("OCCUPIED");
        assertThrows(FacilityException.class, () -> service.updateStorageUnitStatus("TEST-A",
                new UpdateStorageUnitStatusRequest("AVAILABLE", ""), 6));
        assertEquals("OCCUPIED", unit.getStatus());
    }

    @ParameterizedTest @ValueSource(strings = {"", "short"})
    void maintenanceNeedsAuditableReason(String note) {
        assertThrows(FacilityException.class, () -> service.updateStorageUnitStatus("TEST-A",
                new UpdateStorageUnitStatusRequest("MAINTENANCE", note), 6));
    }

    @Test void bookedCapacityCannotBeRemovedForMaintenance() {
        when(units.countByFacility_IdAndUnitType_IdAndStatus(1, 1, "AVAILABLE")).thenReturn(1);
        when(reservations.countByFacility_IdAndUnitType_IdAndStatusInAndStorageUnitIdIsNull(eq(1), eq(1), any()))
                .thenReturn(1);
        assertEquals("SLOT_IN_USE", assertThrows(FacilityException.class,
                () -> service.updateStorageUnitStatus("TEST-A",
                        new UpdateStorageUnitStatusRequest("MAINTENANCE", "Air conditioner needs replacement"), 6)).getCode());
    }

    @Test void maintenanceStoresReasonAndStartTime() {
        service.updateStorageUnitStatus("TEST-A",
                new UpdateStorageUnitStatusRequest("MAINTENANCE", "Air conditioner needs replacement"), 6);
        assertEquals("MAINTENANCE", unit.getStatus());
        assertNotNull(unit.getMaintenanceSince());
        assertEquals("Air conditioner needs replacement", unit.getMaintenanceNote());
    }

    @Test @Tag("regression")
    void B10_liquidationCleanupCannotBeBypassedByManuallyReopeningUnit() {
        unit.setStatus("MAINTENANCE");
        StaffTask cleanup = new StaffTask();
        cleanup.setTaskType("MAINTENANCE");
        cleanup.setMaintenanceReason("LIQUIDATION");
        cleanup.setStatus("OPEN");
        when(tasks.findOpenMaintenanceTask("TEST-A")).thenReturn(Optional.of(cleanup));
        try {
            service.updateStorageUnitStatus("TEST-A", new UpdateStorageUnitStatusRequest("AVAILABLE", ""), 6);
        } catch (FacilityException ex) {
            assertEquals("MAINTENANCE", unit.getStatus());
        }
        assertEquals("MAINTENANCE", unit.getStatus(), "Goods must be inventoried before resale of the unit");
        verify(tasks, never()).closeOpenMaintenanceForUnit("TEST-A", 6);
    }
}

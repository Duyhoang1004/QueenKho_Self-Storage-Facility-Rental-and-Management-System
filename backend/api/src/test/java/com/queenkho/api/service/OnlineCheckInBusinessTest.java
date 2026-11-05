package com.queenkho.api.service;

import com.queenkho.api.dto.OnlineCheckInRequest;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.repository.RentalContractRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.queenkho.api.service.BusinessFixtures.*;

class OnlineCheckInBusinessTest {
    final RentalContractRepository contracts = mock(RentalContractRepository.class);
    final StaffTaskService service = new StaffTaskService();
    RentalContract contract;

    @BeforeEach void setup() {
        contract = contract("PENDING_CHECK_IN");
        when(contracts.findDetailById(30)).thenReturn(Optional.of(contract));
        ReflectionTestUtils.setField(service, "rentalContractRepository", contracts);
    }

    OnlineCheckInRequest request() {
        OnlineCheckInRequest r = new OnlineCheckInRequest();
        r.setCccd("079000000001");
        r.setUnitEmpty(true); r.setUnitClean(true); r.setLockIntact(true);
        r.setProhibitedGoodsCommitted(true);
        r.setEvidenceImages(List.of("https://example.invalid/unit.jpg"));
        return r;
    }

    void error(String code, OnlineCheckInRequest r, int customer) {
        assertEquals(code, assertThrows(StaffTaskException.class,
                () -> service.onlineCheckIn(30, customer, r)).getCode());
        verify(contracts, never()).save(any());
        assertNull(contract.getRfidCardCode());
    }

    @Test void wrongCustomerCannotCollectUnitEvenKnowingIdentityNumber() {
        error("FORBIDDEN_OWNER", request(), 99);
    }

    @ParameterizedTest @ValueSource(strings = {"ACTIVE", "OVERDUE", "TERMINATED", "LIQUIDATED", "TERMINATION_PENDING"})
    void checkInCannotBeRepeatedOrAppliedToClosedRental(String status) {
        contract.setStatus(status);
        error("CONTRACT_STATUS_INVALID", request(), 10);
    }

    @Test void wrongIdentityCannotActivateContract() {
        var r = request(); r.setCccd("079000000099");
        error("IDENTITY_MISMATCH", r, 10);
    }

    @Test void missingStoredIdentityRequiresCounterCheckIn() {
        contract.getCustomer().setCccd(null);
        error("IDENTITY_MISSING", request(), 10);
    }

    @Test void cannotCollectBeforeAppointmentDate() {
        contract.getReservation().setExpectedAppointmentTime(LocalDate.now().plusDays(1).atTime(9, 0));
        error("CHECK_IN_TOO_EARLY", request(), 10);
    }

    @ParameterizedTest @ValueSource(strings = {"empty", "clean", "lock", "commitment"})
    void everyPhysicalCheckAndCommitmentIsRequired(String field) {
        var r = request();
        switch (field) {
            case "empty" -> r.setUnitEmpty(false);
            case "clean" -> r.setUnitClean(false);
            case "lock" -> r.setLockIntact(false);
            default -> r.setProhibitedGoodsCommitted(false);
        }
        assertThrows(StaffTaskException.class, () -> service.onlineCheckIn(30, 10, r));
        verify(contracts, never()).save(any());
    }

    @Test void photosAreRequiredAndBounded() {
        var r = request(); r.setEvidenceImages(List.of());
        error("HANDOVER_PHOTO_REQUIRED", r, 10);
        r.setEvidenceImages(Collections.nCopies(11, "image.jpg"));
        assertThrows(StaffTaskException.class, () -> service.onlineCheckIn(30, 10, r));
    }
}

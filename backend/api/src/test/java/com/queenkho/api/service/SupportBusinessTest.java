package com.queenkho.api.service;

import com.queenkho.api.dto.CreateSupportRequestDto;
import com.queenkho.api.entity.*;
import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.queenkho.api.service.BusinessFixtures.*;

class SupportBusinessTest {
    final UserRepository users = mock(UserRepository.class);
    final RentalContractRepository contracts = mock(RentalContractRepository.class);
    final SupportRequestRepository tickets = mock(SupportRequestRepository.class);
    final StaffTaskRepository tasks = mock(StaffTaskRepository.class);
    final SupportRequestService service = new SupportRequestService();
    RentalContract contract;

    @BeforeEach void setup() {
        contract = contract("ACTIVE");
        when(users.findById(10)).thenReturn(Optional.of(contract.getCustomer()));
        when(contracts.findDetailById(30)).thenReturn(Optional.of(contract));
        ReflectionTestUtils.setField(service, "userRepository", users);
        ReflectionTestUtils.setField(service, "rentalContractRepository", contracts);
        ReflectionTestUtils.setField(service, "supportRequestRepository", tickets);
        ReflectionTestUtils.setField(service, "staffTaskRepository", tasks);
    }

    CreateSupportRequestDto request() {
        CreateSupportRequestDto r = new CreateSupportRequestDto();
        r.setContractId(30);
        r.setIssueType("LOCK_ISSUE");
        r.setDescription("The lock cannot open although the correct PIN is entered");
        return r;
    }

    void error(String code, CreateSupportRequestDto request) {
        assertEquals(code, assertThrows(StaffTaskException.class,
                () -> service.createTicket(10, request)).getCode());
        verify(tickets, never()).save(any());
        verifyNoInteractions(tasks);
    }

    @Test void missingRequestDoesNotCreateTask() { error("INVALID_INPUT", null); }

    @Test void contractIsRequired() {
        var r = request(); r.setContractId(null);
        error("INVALID_INPUT", r);
    }

    @ParameterizedTest @ValueSource(strings = {"", "PIN", "PAYMENT", "ADMIN"})
    void unsupportedIssueTypeIsRejected(String issue) {
        var r = request(); r.setIssueType(issue);
        error("INVALID_INPUT", r);
    }

    @ParameterizedTest @ValueSource(ints = {0, 1, 9, 2001})
    void descriptionMustBeUsefulAndBounded(int length) {
        var r = request(); r.setDescription("x".repeat(length));
        error("INVALID_INPUT", r);
    }

    @Test void cannotOpenTicketOnAnotherCustomersContract() {
        contract.setCustomer(user(99, "CUSTOMER", null));
        error("FORBIDDEN_CONTRACT", request());
    }

    @ParameterizedTest @ValueSource(strings = {"PENDING_CHECK_IN", "TERMINATED", "LIQUIDATED"})
    void onlyContractsHoldingGoodsCanRequestSupport(String status) {
        contract.setStatus(status);
        error("CONTRACT_STATUS_INVALID", request());
    }

    @Test void duplicateOpenIssueCannotProduceAnotherTask() {
        when(tickets.existsByContract_IdAndIssueTypeAndStatusIn(eq(30), eq("LOCK_ISSUE"), any()))
                .thenReturn(true);
        error("DUPLICATE_ISSUE_TYPE", request());
    }

    @Test void threeOpenTicketsEnforcePerContractLimit() {
        when(tickets.countByContract_IdAndStatusIn(eq(30), any())).thenReturn(3L);
        error("MAX_OPEN_TICKETS_REACHED", request());
    }

    @ParameterizedTest @ValueSource(strings = {"LOCKED", "DISABLED"})
    void blockedAccountCannotRequestSupport(String status) {
        contract.getCustomer().setStatus(status);
        error("ACCOUNT_LOCKED", request());
    }
}

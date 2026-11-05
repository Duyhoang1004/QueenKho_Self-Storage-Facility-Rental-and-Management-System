package com.queenkho.api.service;

import com.queenkho.api.dto.RequestCheckoutRequest;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.LocalDate;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.queenkho.api.service.BusinessFixtures.*;

class CheckoutBusinessTest {
    final RentalContractRepository contracts = mock(RentalContractRepository.class);
    final ReservationRepository reservations = mock(ReservationRepository.class);
    final StaffTaskService tasks = mock(StaffTaskService.class);
    final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    final ContractService service = new ContractService();
    RentalContract contract;

    @BeforeEach void setup() {
        contract = contract("ACTIVE");
        when(contracts.findDetailById(30)).thenReturn(Optional.of(contract));
        ReflectionTestUtils.setField(service, "rentalContractRepository", contracts);
        ReflectionTestUtils.setField(service, "reservationRepository", reservations);
        ReflectionTestUtils.setField(service, "staffTaskService", tasks);
        ReflectionTestUtils.setField(service, "jdbcTemplate", jdbc);
    }

    RequestCheckoutRequest request(LocalDate date, String method) {
        RequestCheckoutRequest r = new RequestCheckoutRequest();
        r.setCheckoutDate(date);
        r.setRefundMethod(method);
        r.setBankName("Test bank");
        r.setBankAccountNumber("0123456789");
        r.setBankAccountName("Test customer");
        return r;
    }

    @ParameterizedTest @ValueSource(strings = {"PENDING_CHECK_IN", "TERMINATED", "LIQUIDATED"})
    void onlyLiveContractsCanScheduleCheckout(String status) {
        contract.setStatus(status);
        assertThrows(IllegalStateException.class,
                () -> service.requestCheckout(30, request(LocalDate.now().plusDays(1), "CASH")));
        verifyNoInteractions(tasks);
        verify(contracts, never()).save(any());
    }

    @ParameterizedTest @ValueSource(ints = {-7, -1, 0})
    void schedulingMustGiveAtLeastOneDayNotice(int days) {
        assertThrows(IllegalArgumentException.class,
                () -> service.requestCheckout(30, request(LocalDate.now().plusDays(days), "CASH")));
        verifyNoInteractions(tasks);
    }

    @ParameterizedTest @NullAndEmptySource @ValueSource(strings = {"CARD", "VNPAY", "UNKNOWN"})
    void invalidRefundMethodCannotChangeContract(String method) {
        assertThrows(RuntimeException.class,
                () -> service.requestCheckout(30, request(LocalDate.now().plusDays(1), method)));
        assertEquals("ACTIVE", contract.getStatus());
    }

    @ParameterizedTest @ValueSource(strings = {"", "12345", "123456789012345678901", "ABC123456", "123 456"})
    void transferNeedsValidAccountNumber(String number) {
        var r = request(LocalDate.now().plusDays(1), "BANK_TRANSFER");
        r.setBankAccountNumber(number);
        assertThrows(RuntimeException.class, () -> service.requestCheckout(30, r));
        verifyNoInteractions(tasks);
    }

    @ParameterizedTest @ValueSource(strings = {"CASH", "BANK_TRANSFER"})
    void validScheduleUpdatesContractAndReservationTogether(String method) {
        LocalDate appointment = LocalDate.now().plusDays(1);
        service.requestCheckout(30, request(appointment, method));
        assertEquals("TERMINATION_PENDING", contract.getStatus());
        assertEquals("TERMINATION_PENDING", contract.getReservation().getStatus());
        verify(tasks).createCheckOutTask(eq(contract), eq(appointment), contains(method.equals("CASH") ? "tiền mặt" : "0123456789"));
    }

    @Test void activeContractCannotReserveBeyondFiveDayGrace() {
        assertThrows(IllegalArgumentException.class, () -> service.requestCheckout(30,
                request(contract.getEndDate().plusDays(6), "CASH")));
    }

    @Test void overdueContractCanOnlyScheduleWithinThreeDays() {
        contract.setStatus("OVERDUE");
        assertThrows(IllegalArgumentException.class, () -> service.requestCheckout(30,
                request(LocalDate.now().plusDays(4), "CASH")));
    }

    @Test void cancellingScheduleBeforeInspectionRestoresActiveContract() {
        contract.setStatus("TERMINATION_PENDING");
        service.cancelCheckout(30);
        assertEquals("ACTIVE", contract.getStatus());
        assertEquals("UNIT_ASSIGNED", contract.getReservation().getStatus());
        verify(tasks).cancelOpenTasks(30, "CHECK_OUT");
        verify(tasks, never()).closeOpenSupportTicketsAndTasks(anyInt());
    }

    @Test void cancellingExpiredScheduleRestoresOverdueInsteadOfActive() {
        contract.setStatus("TERMINATION_PENDING");
        contract.setEndDate(LocalDate.now().minusDays(1));
        service.cancelCheckout(30);
        assertEquals("OVERDUE", contract.getStatus());
    }
}

package com.queenkho.api.service;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ReservationCleanupWorkflowTest {
    final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    final NotificationService notifications = mock(NotificationService.class);
    final ReservationCleanupService service = new ReservationCleanupService(jdbc, notifications);

    @Test void noExpiredReservationDoesNotNotifyAnyone() {
        when(jdbc.queryForList(anyString())).thenReturn(List.of());
        service.cancelExpiredReservations();
        verifyNoInteractions(notifications);
    }

    @Test void onlyReservationsActuallyExpiredByThisRunAreNotified() {
        when(jdbc.queryForList(anyString())).thenReturn(List.of(
                Map.of("customer_id", 10, "reservation_code", "RES-A"),
                Map.of("customer_id", 11L, "reservation_code", "RES-B")));
        service.cancelExpiredReservations();
        verify(notifications).notifyCustomer(eq(10), contains("RES-A"), contains("15 phút"), eq("BOOKING"), eq("/tim-va-dat-kho"));
        verify(notifications).notifyCustomer(eq(11), contains("RES-B"), contains("15 phút"), eq("BOOKING"), eq("/tim-va-dat-kho"));
        verifyNoMoreInteractions(notifications);
    }

    @Test void missingCustomerDoesNotPreventOtherExpirationNotifications() {
        Map<String, Object> orphan = new HashMap<>();
        orphan.put("customer_id", null);
        orphan.put("reservation_code", "ORPHAN");
        when(jdbc.queryForList(anyString())).thenReturn(List.of(orphan,
                Map.of("customer_id", 10, "reservation_code", "RES-A")));
        service.cancelExpiredReservations();
        verify(notifications, only()).notifyCustomer(eq(10), contains("RES-A"), anyString(), eq("BOOKING"), anyString());
    }

    @Test void pendingPaymentIsInvalidatedBeforeCustomerIsNotified() {
        when(jdbc.queryForList(anyString())).thenReturn(List.of(Map.of("customer_id", 10, "reservation_code", "RES-A")));
        service.cancelExpiredReservations();
        var order = inOrder(jdbc, notifications);
        order.verify(jdbc).update(contains("UPDATE payment_transactions"));
        order.verify(jdbc).queryForList(contains("UPDATE reservations"));
        order.verify(notifications).notifyCustomer(eq(10), anyString(), anyString(), eq("BOOKING"), anyString());
    }

    @Test void databaseFailureCannotProduceFalseExpirationNotification() {
        when(jdbc.update(anyString())).thenThrow(new DataAccessResourceFailureException("offline"));
        assertThrows(DataAccessResourceFailureException.class, service::cancelExpiredReservations);
        verifyNoInteractions(notifications);
        verify(jdbc, never()).queryForList(anyString());
    }

    @Test void retryDoesNotNotifyAnAlreadyExpiredReservationAgain() {
        when(jdbc.queryForList(anyString())).thenReturn(
                List.of(Map.of("customer_id", 10, "reservation_code", "RES-A")), List.of());
        service.cancelExpiredReservations();
        service.cancelExpiredReservations();
        verify(notifications, times(1)).notifyCustomer(eq(10), anyString(), anyString(), eq("BOOKING"), anyString());
    }
}

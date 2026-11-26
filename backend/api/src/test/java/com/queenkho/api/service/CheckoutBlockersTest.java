package com.queenkho.api.service;

import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

// PR-O17a (26/11/2026): danh sách yêu cầu hỗ trợ / hồ sơ đang chặn nghiệm thu — dùng chung cho màn Staff và lúc nộp
class CheckoutBlockersTest {
    final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    final NotificationService notifications = mock(NotificationService.class);
    CheckoutSettlementService service;

    @BeforeEach void setup() {
        service = new CheckoutSettlementService(mock(CheckoutSettlementRepository.class), mock(RentalContractRepository.class),
                mock(ReservationRepository.class), mock(CompensationClaimRepository.class), mock(DamageCaseRepository.class),
                mock(StaffTaskRepository.class), mock(UserRepository.class), jdbc, mock(ActivityLogService.class),
                mock(PlatformTransactionManager.class), false);
        ReflectionTestUtils.setField(service, "notificationService", notifications);
    }

    private void tickets(List<Map<String, Object>> rows) {
        when(jdbc.queryForList(contains("FROM support_requests sr WHERE"), eq(9))).thenReturn(rows);
    }

    private void claims(List<Map<String, Object>> rows) {
        when(jdbc.queryForList(contains("FROM compensation_claims c"), eq(9))).thenReturn(rows);
    }

    @Test void listsOpenTicketsAndUninspectedClaims() {
        tickets(List.of(Map.of("id", 3, "ticket_code", "SR-1", "issue_type", "LOCK_RFID_ERROR", "status", "IN_PROGRESS", "task_id", 41)));
        claims(List.of(Map.of("claim_code", "BT-1", "ticket_id", 4, "issue_type", "GOODS_DAMAGE", "task_id", 42)));
        List<Map<String, Object>> b = service.checkoutBlockers(9);
        assertEquals(2, b.size());
        assertEquals("TICKET", b.get(0).get("kind"));
        assertEquals(41, b.get(0).get("supportTaskId"));
        assertEquals("CLAIM_UNINSPECTED", b.get(1).get("kind"));
        assertEquals("BT-1", b.get(1).get("code"));
    }

    @Test void assertUsesSameListOpenTicketFirst() {
        tickets(List.of(Map.of("id", 3, "ticket_code", "SR-1", "issue_type", "OTHER", "status", "OPEN")));
        claims(List.of());
        assertEquals("OPEN_TICKETS_PENDING", assertThrows(StaffTaskException.class, () -> service.assertReadyForCheckout(9)).getCode());
    }

    @Test void uninspectedClaimBlocksWithItsOwnCode() {
        tickets(List.of());
        claims(List.of(Map.of("claim_code", "BT-1", "ticket_id", 4, "issue_type", "GOODS_LOSS")));
        assertEquals("CLAIM_INSPECTION_PENDING", assertThrows(StaffTaskException.class, () -> service.assertReadyForCheckout(9)).getCode());
    }

    @Test void noBlockersPassesAndNotifiesCheckoutStaff() {
        tickets(List.of());
        claims(List.of());
        assertDoesNotThrow(() -> service.assertReadyForCheckout(9));
        when(jdbc.queryForList(contains("task_type = 'CHECK_OUT'"), eq(9)))
                .thenReturn(List.of(Map.of("id", 17, "staff_id", 21, "contract_code", "HD-1")));
        service.notifyCheckoutUnblocked(9);
        verify(notifications).notifyStaff(eq(21), contains("HD-1"), anyString(), eq("CHECKOUT"), eq("/staff/tasks/17"));
    }

    @Test void stillBlockedDoesNotNotify() {
        tickets(List.of(Map.of("id", 3, "ticket_code", "SR-1", "issue_type", "OTHER", "status", "OPEN")));
        claims(List.of());
        service.notifyCheckoutUnblocked(9);
        verifyNoInteractions(notifications);
    }
}

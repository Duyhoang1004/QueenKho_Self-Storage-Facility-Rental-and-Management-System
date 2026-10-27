package com.queenkho.api.service;

import com.queenkho.api.security.AccessException;
import com.queenkho.api.security.CurrentUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

// Demo: nút "⚡ Giả lập" — chỉ sửa mốc thời gian, đúng trạng thái, đúng quyền, tắt được
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DemoSimulationServiceTest {

    @Mock JdbcTemplate jdbcTemplate;
    @Mock ReservationCleanupService cleanupService;
    @Mock SupportRequestService supportRequestService;
    @Mock ActivityLogService activityLogService;

    DemoSimulationService service;
    final CurrentUser fm = new CurrentUser(6, "FACILITY_MANAGER", 1, "FM Tân Bình", "fm@x.com");
    final CurrentUser staff = new CurrentUser(12, "STAFF", 1, "Staff 1", "st@x.com");
    final CurrentUser customer = new CurrentUser(1, "CUSTOMER", null, "Khách 1", "kh@x.com");

    @Mock jakarta.persistence.EntityManager entityManager;

    @BeforeEach
    void setUp() {
        service = new DemoSimulationService(jdbcTemplate, cleanupService, supportRequestService, activityLogService, true);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "entityManager", entityManager);
    }

    private static Map<String, Object> map(Object... kv) {
        Map<String, Object> m = new HashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            m.put((String) kv[i], kv[i + 1]);
        }
        return m;
    }

    private void rows(String sqlFragment, Map<String, Object> row) {
        when(jdbcTemplate.queryForList(contains(sqlFragment), any(Object.class))).thenReturn(List.of(row));
    }

    private static String code(Runnable call) {
        return assertThrows(AccessException.class, call::run).getCode();
    }

    // ---------- bật / tắt ----------

    @Test
    @DisplayName("Tắt queenkho.simulation.enabled → 404 SIMULATION_DISABLED, không đụng DB")
    void disabledReturns404() {
        DemoSimulationService off = new DemoSimulationService(jdbcTemplate, cleanupService, supportRequestService, activityLogService, false);
        AccessException ex = assertThrows(AccessException.class, () -> off.makeOverdue(1, 3, fm));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
        assertEquals("SIMULATION_DISABLED", ex.getCode());
        assertFalse(off.isEnabled());
        verifyNoInteractions(jdbcTemplate);
    }

    // ---------- 1. khách tới hôm nay ----------

    private void checkInTask(String taskType, String contractStatus, int facilityId) {
        rows("FROM facility_tasks", map("id", 50, "task_type", taskType, "status", "OVERDUE", "contract_id", 9, "facility_id", facilityId));
        rows("FROM rental_contracts", map("id", 9, "contract_code", "HD-1", "status", contractStatus, "reservation_id", 4));
        when(jdbcTemplate.queryForObject(contains("duration_months"), eq(Integer.class), eq(4))).thenReturn(3);
    }

    @Test
    @DisplayName("Khách tới hôm nay: đơn + HĐ dời về hôm nay (giữ 3 tháng), task quá hạn được mở lại, có log")
    void arriveTodayMovesDatesToToday() {
        checkInTask("CHECK_IN", "PENDING_CHECK_IN", 1);

        service.arriveToday(50, staff);

        LocalDate today = LocalDate.now();
        verify(jdbcTemplate).update(contains("UPDATE reservations SET start_date"), eq(today), any(), eq(4));
        verify(jdbcTemplate).update(contains("UPDATE rental_contracts SET start_date"), eq(today), eq(today.plusMonths(3)), eq(9));
        verify(jdbcTemplate).update(contains("WHEN status = 'OVERDUE'"), any(Timestamp.class), eq(50));
        verify(activityLogService).log(eq(12), startsWith("[SIMULATION]"), eq("facility_tasks"), eq("50"));
    }

    @Test
    @DisplayName("Khách tới hôm nay: sai loại task / HĐ đã check-in / khác cơ sở → bị chặn")
    void arriveTodayGuards() {
        checkInTask("CHECK_OUT", "PENDING_CHECK_IN", 1);
        assertEquals("SIMULATION_NOT_APPLICABLE", code(() -> service.arriveToday(50, staff)));

        checkInTask("CHECK_IN", "ACTIVE", 1);
        assertEquals("SIMULATION_NOT_APPLICABLE", code(() -> service.arriveToday(50, staff)));

        checkInTask("CHECK_IN", "PENDING_CHECK_IN", 2);
        assertEquals("FORBIDDEN_FACILITY", code(() -> service.arriveToday(50, staff)));
    }

    // ---------- 2. quá 15 phút giữ chỗ ----------

    @Test
    @DisplayName("Quá 15p: lùi giờ tạo đơn rồi chạy NGAY job huỷ giữ chỗ")
    void expireHoldRunsCleanupImmediately() {
        rows("FROM reservations", map("id", 4, "reservation_code", "RES-1", "status", "PENDING", "customer_id", 1, "facility_id", 1, "duration_months", 1));
        when(jdbcTemplate.queryForObject(contains("SELECT status FROM reservations"), eq(String.class), eq(4))).thenReturn("EXPIRED");

        Map<String, Object> result = service.expireHold(4, customer);

        assertEquals("EXPIRED", result.get("status"));
        verify(jdbcTemplate).update(contains("DATEADD(MINUTE, -16"), eq(4));
        verify(cleanupService).cancelExpiredReservations();
    }

    @Test
    @DisplayName("Quá 15p: đơn của khách khác → 403; đơn đã cọc → 409")
    void expireHoldGuards() {
        rows("FROM reservations", map("id", 4, "reservation_code", "RES-1", "status", "PENDING", "customer_id", 2, "facility_id", 1, "duration_months", 1));
        assertEquals("FORBIDDEN_OWNER", code(() -> service.expireHold(4, customer)));

        rows("FROM reservations", map("id", 4, "reservation_code", "RES-1", "status", "DEPOSIT_PAID", "customer_id", 1, "facility_id", 1, "duration_months", 1));
        assertEquals("SIMULATION_NOT_APPLICABLE", code(() -> service.expireHold(4, customer)));
        verify(cleanupService, never()).cancelExpiredReservations();
    }

    // ---------- 3. No-Show ----------

    @Test
    @DisplayName("No-Show: giờ hẹn lùi 49h, ngày bắt đầu < hôm nay, 2 log [CONTACT][FAILED] cách nhau ≥ 24h")
    void triggerNoShowPreparesEligibility() {
        rows("FROM reservations", map("id", 4, "reservation_code", "RES-1", "status", "UNIT_ASSIGNED", "customer_id", 1, "facility_id", 1, "duration_months", 3));
        rows("FROM rental_contracts", map("id", 9, "contract_code", "HD-1", "status", "PENDING_CHECK_IN"));

        service.triggerNoShow(4, fm);

        ArgumentCaptor<LocalDate> start = ArgumentCaptor.forClass(LocalDate.class);
        verify(jdbcTemplate).update(contains("UPDATE reservations SET start_date"), start.capture(), any(Timestamp.class), eq(4));
        assertTrue(start.getValue().isBefore(LocalDate.now()), "Ngày bắt đầu phải < hôm nay để hiện ở tab No-Show");

        ArgumentCaptor<Timestamp> at = ArgumentCaptor.forClass(Timestamp.class);
        verify(jdbcTemplate, times(2)).update(contains("INSERT INTO activity_logs"), eq(6),
                startsWith("[CONTACT][FAILED]"), eq("4"), at.capture());
        long gapHours = Duration.between(at.getAllValues().get(0).toLocalDateTime(), at.getAllValues().get(1).toLocalDateTime()).toHours();
        assertTrue(gapHours >= 24, "2 lần gọi phải cách nhau ≥ 24h, thực tế " + gapHours);
    }

    @Test
    @DisplayName("No-Show: khách đã check-in → 409")
    void triggerNoShowRequiresPendingCheckIn() {
        rows("FROM reservations", map("id", 4, "reservation_code", "RES-1", "status", "UNIT_ASSIGNED", "customer_id", 1, "facility_id", 1, "duration_months", 3));
        rows("FROM rental_contracts", map("id", 9, "contract_code", "HD-1", "status", "ACTIVE"));
        assertEquals("SIMULATION_NOT_APPLICABLE", code(() -> service.triggerNoShow(4, fm)));
    }

    // ---------- 4 + 5. quá hạn / thanh lý ----------

    private void activeContract(String status, int facilityId) {
        rows("FROM rental_contracts rc", map("id", 9, "contract_code", "HD-1", "status", status,
                "billing_cycle_months", 6, "customer_id", 1, "facility_id", facilityId));
    }

    @Test
    @DisplayName("Quá hạn 31 ngày: end = hôm nay − 31, start = end − 6 tháng (giữ kỳ thuê), OVERDUE, tắt miễn phí trễ, huỷ link gia hạn cũ")
    void makeOverdueKeepsTermLength() {
        activeContract("ACTIVE", 1);

        Map<String, Object> result = service.makeOverdue(9, 31, fm);

        LocalDate end = LocalDate.now().minusDays(31);
        verify(jdbcTemplate).update(contains("status = 'OVERDUE', late_fee_waived = 0"), eq(end.minusMonths(6)), eq(end), eq(9));
        verify(jdbcTemplate).update(contains("payment_type IN ('MONTHLY_RENT', 'LATE_FEE')"), eq(9));
        assertTrue(String.valueOf(result.get("message")).contains("thanh lý"));
    }

    @Test
    @DisplayName("Quá hạn: số ngày ngoài 1–90 → 400; HĐ đã kết thúc → 409; HĐ cơ sở khác → 403")
    void makeOverdueGuards() {
        assertEquals("INVALID_INPUT", code(() -> service.makeOverdue(9, 0, fm)));
        assertEquals("INVALID_INPUT", code(() -> service.makeOverdue(9, 91, fm)));

        activeContract("TERMINATED", 1);
        assertEquals("SIMULATION_NOT_APPLICABLE", code(() -> service.makeOverdue(9, 3, fm)));

        activeContract("ACTIVE", 2);
        assertEquals("FORBIDDEN_FACILITY", code(() -> service.makeOverdue(9, 3, fm)));
    }

    @Test
    @DisplayName("Khách không tới trả kho 31 ngày: OVERDUE, đơn về UNIT_ASSIGNED, huỷ task CHECK_OUT (giống job PR-Q1)")
    void makeOverdueFromMissedCheckout() {
        activeContract("TERMINATION_PENDING", 1);

        service.makeOverdue(9, 31, fm);

        verify(jdbcTemplate).update(contains("status = 'OVERDUE', late_fee_waived = 0"), any(LocalDate.class), any(LocalDate.class), eq(9));
        verify(jdbcTemplate).update(contains("UPDATE reservations SET status = 'UNIT_ASSIGNED'"), eq(9));
        verify(jdbcTemplate).update(contains("task_type = 'CHECK_OUT'"), eq(9));
        verify(activityLogService).log(eq(6), contains("không tới trả kho"), eq("rental_contracts"), eq("9"));
    }

    @Test
    @DisplayName("Khách không tới trả kho: còn trong 5 ngày ân hạn → 400, chưa đổi gì")
    void makeOverdueMissedCheckoutRespectsGrace() {
        activeContract("TERMINATION_PENDING", 1);
        assertEquals("INVALID_INPUT", code(() -> service.makeOverdue(9, 5, fm)));
        verify(jdbcTemplate, never()).update(contains("UPDATE rental_contracts"), any(), any(), any());
    }

    // ---------- 1b. khách tới trả kho hôm nay ----------

    @Test
    @DisplayName("Khách tới trả kho hôm nay: hạn task CHECK_OUT về 21:00, task quá hạn được mở lại, có log")
    void checkoutTodayMovesDueDate() {
        rows("FROM facility_tasks", map("id", 51, "task_type", "CHECK_OUT", "status", "OVERDUE", "contract_id", 9, "facility_id", 1));
        rows("FROM rental_contracts", map("id", 9, "contract_code", "HD-1", "status", "TERMINATION_PENDING"));

        service.checkoutToday(51, staff);

        verify(jdbcTemplate).update(contains("WHEN status = 'OVERDUE'"), any(Timestamp.class), eq(51));
        verify(activityLogService).log(eq(12), contains("trả kho hôm nay"), eq("facility_tasks"), eq("51"));
    }

    @Test
    @DisplayName("Khách tới trả kho hôm nay: task CHECK_IN / HĐ không chờ trả kho → 409")
    void checkoutTodayGuards() {
        rows("FROM facility_tasks", map("id", 51, "task_type", "CHECK_IN", "status", "OPEN", "contract_id", 9, "facility_id", 1));
        assertEquals("SIMULATION_NOT_APPLICABLE", code(() -> service.checkoutToday(51, staff)));

        rows("FROM facility_tasks", map("id", 51, "task_type", "CHECK_OUT", "status", "OPEN", "contract_id", 9, "facility_id", 1));
        rows("FROM rental_contracts", map("id", 9, "contract_code", "HD-1", "status", "ACTIVE"));
        assertEquals("SIMULATION_NOT_APPLICABLE", code(() -> service.checkoutToday(51, staff)));
    }

    // ---------- 5b. đủ 3 lần liên hệ trước thanh lý ----------

    @Test
    @DisplayName("Ghi 3 lần liên hệ thất bại: 3 log [OVERDUE_CONTACT] đúng định dạng ContractService")
    void addFailedContactsWritesThreeLogs() {
        rows("FROM rental_contracts rc", map("id", 9, "contract_code", "HD-1", "status", "OVERDUE", "facility_id", 1));

        service.addFailedContacts(9, fm);

        verify(jdbcTemplate, times(3)).update(contains("INSERT INTO activity_logs"), eq(6),
                startsWith("[OVERDUE_CONTACT] HĐ HD-1: "), eq("9"), any(Timestamp.class));
    }

    @Test
    @DisplayName("Ghi liên hệ: HĐ không quá hạn → 409, HĐ cơ sở khác → 403")
    void addFailedContactsGuards() {
        rows("FROM rental_contracts rc", map("id", 9, "contract_code", "HD-1", "status", "ACTIVE", "facility_id", 1));
        assertEquals("SIMULATION_NOT_APPLICABLE", code(() -> service.addFailedContacts(9, fm)));

        rows("FROM rental_contracts rc", map("id", 9, "contract_code", "HD-1", "status", "OVERDUE", "facility_id", 2));
        assertEquals("FORBIDDEN_FACILITY", code(() -> service.addFailedContacts(9, fm)));
    }

    // ---------- 5c. hàng lưu giữ hết hạn ----------

    @Test
    @DisplayName("Hết hạn lưu giữ: hold_until = hôm qua; hồ sơ đã xử lý → 409; cơ sở khác → 403")
    void expireHeldGoods() {
        rows("FROM held_goods", map("id", 5, "status", "HOLDING", "facility_id", 1, "contract_code", "HD-1"));
        service.expireHeldGoods(5, fm);
        verify(jdbcTemplate).update(contains("UPDATE held_goods SET hold_until"), eq(LocalDate.now().minusDays(1)), eq(5));

        rows("FROM held_goods", map("id", 5, "status", "SOLD", "facility_id", 1, "contract_code", "HD-1"));
        assertEquals("SIMULATION_NOT_APPLICABLE", code(() -> service.expireHeldGoods(5, fm)));

        rows("FROM held_goods", map("id", 5, "status", "HOLDING", "facility_id", 2, "contract_code", "HD-1"));
        assertEquals("FORBIDDEN_FACILITY", code(() -> service.expireHeldGoods(5, fm)));
    }

    // ---------- 6. ticket tự đóng ----------

    @Test
    @DisplayName("Ticket quá 3 ngày: lùi resolved_at 4 ngày rồi chạy NGAY job tự đóng")
    void autoCloseTicketRunsJob() {
        rows("FROM support_requests", map("id", 3, "ticket_code", "SR-1", "status", "RESOLVED", "customer_id", 1, "facility_id", 1));
        when(jdbcTemplate.queryForObject(contains("SELECT status FROM support_requests"), eq(String.class), eq(3))).thenReturn("CLOSED");

        assertEquals("CLOSED", service.autoCloseTicket(3, customer).get("status"));
        verify(supportRequestService).autoCloseResolvedTickets();
        verify(entityManager).flush(); // thay đổi của job (JPA) phải xuống DB trước khi đọc lại trạng thái
    }

    @Test
    @DisplayName("Ticket chưa xử lý xong → 409")
    void autoCloseRequiresResolved() {
        rows("FROM support_requests", map("id", 3, "ticket_code", "SR-1", "status", "IN_PROGRESS", "customer_id", 1, "facility_id", 1));
        assertEquals("SIMULATION_NOT_APPLICABLE", code(() -> service.autoCloseTicket(3, customer)));
        verify(supportRequestService, never()).autoCloseResolvedTickets();
    }
}

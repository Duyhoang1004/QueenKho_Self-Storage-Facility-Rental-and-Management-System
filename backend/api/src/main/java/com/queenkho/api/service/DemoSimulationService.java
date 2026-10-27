package com.queenkho.api.service;

import com.queenkho.api.security.AccessException;
import com.queenkho.api.security.CurrentUser;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Demo: "tua thời gian" để trình diễn các quy tắc phụ thuộc thời gian trong 15 phút
 * (check-in đúng ngày hẹn, giữ chỗ 15 phút, No-Show 48h, quá hạn / thanh lý, tự đóng ticket 3 ngày).
 *  - Chỉ sửa MỐC THỜI GIAN rồi để nghiệp vụ thật xử lý tiếp (job, nút No-Show, nút thanh lý...) → demo đúng logic thật.
 *  - Bật / tắt bằng queenkho.simulation.enabled (tắt → 404 SIMULATION_DISABLED).
 *  - Mỗi lần giả lập ghi log [SIMULATION] kèm người bấm → hội đồng thấy rõ đây là thao tác tua thời gian.
 */
@Service
public class DemoSimulationService {

    private static final LocalTime CLOSING_TIME = LocalTime.of(21, 0);
    private static final LocalTime APPOINTMENT_TIME = LocalTime.of(9, 0);
    public static final int MAX_OVERDUE_DAYS = 90;
    private static final int CHECKOUT_GRACE_DAYS = 5;

    private final JdbcTemplate jdbcTemplate;
    private final ReservationCleanupService reservationCleanupService;
    private final SupportRequestService supportRequestService;
    private final ActivityLogService activityLogService;
    private final boolean enabled;

    @PersistenceContext
    private EntityManager entityManager;

    public DemoSimulationService(JdbcTemplate jdbcTemplate,
                                 ReservationCleanupService reservationCleanupService,
                                 SupportRequestService supportRequestService,
                                 ActivityLogService activityLogService,
                                 @Value("${queenkho.simulation.enabled:false}") boolean enabled) {
        this.jdbcTemplate = jdbcTemplate;
        this.reservationCleanupService = reservationCleanupService;
        this.supportRequestService = supportRequestService;
        this.activityLogService = activityLogService;
        this.enabled = enabled;
    }

    public boolean isEnabled() {
        return enabled;
    }

    // ---------- 1. Flow 2: khách tới nhận kho HÔM NAY ----------
    // Dời ngày hẹn của đơn + ngày bắt đầu/kết thúc HĐ về hôm nay (giữ số tháng), task CHECK_IN hạn 21:00.
    @Transactional
    public Map<String, Object> arriveToday(Integer taskId, CurrentUser actor) {
        requireEnabled();
        Map<String, Object> task = row("SELECT id, task_type, status, contract_id, facility_id FROM facility_tasks WHERE id = ?",
                taskId, "Không tìm thấy task");
        requireSameFacility(actor, toInt(task.get("facility_id")));
        if (!"CHECK_IN".equals(task.get("task_type"))) {
            throw notApplicable("Chỉ giả lập được cho task bàn giao (CHECK_IN)");
        }
        if (!List.of("OPEN", "IN_PROGRESS", "OVERDUE").contains(String.valueOf(task.get("status")))) {
            throw notApplicable("Task đã đóng, không cần giả lập");
        }
        Map<String, Object> contract = row("SELECT id, contract_code, status, reservation_id FROM rental_contracts WHERE id = ?",
                task.get("contract_id"), "Không tìm thấy hợp đồng của task");
        if (!"PENDING_CHECK_IN".equals(contract.get("status"))) {
            throw notApplicable("Hợp đồng không còn chờ check-in");
        }
        int months = durationMonths(toInt(contract.get("reservation_id")));

        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        // Giống StaffTaskService.computeDueAt: sau 21:00 thì hạn sang 21:00 ngày mai
        LocalDateTime dueAt = now.toLocalTime().isBefore(CLOSING_TIME)
                ? today.atTime(CLOSING_TIME) : today.plusDays(1).atTime(CLOSING_TIME);

        jdbcTemplate.update("UPDATE reservations SET start_date = ?, expected_appointment_time = ? WHERE id = ?",
                today, today.atTime(APPOINTMENT_TIME), contract.get("reservation_id"));
        jdbcTemplate.update("UPDATE rental_contracts SET start_date = ?, end_date = ? WHERE id = ?",
                today, today.plusMonths(months), contract.get("id"));
        // Task đã bị job đánh quá hạn → mở lại: chưa ai nhận = OPEN, đã có người = IN_PROGRESS
        jdbcTemplate.update(
                "UPDATE facility_tasks SET due_at = ?, status = CASE WHEN status = 'OVERDUE' " +
                        "THEN (CASE WHEN staff_id IS NULL THEN 'OPEN' ELSE 'IN_PROGRESS' END) ELSE status END WHERE id = ?",
                Timestamp.valueOf(dueAt), taskId);

        log(actor, "Khách tới nhận kho hôm nay — HĐ " + contract.get("contract_code") + ", task #" + taskId,
                "facility_tasks", taskId);
        return result("Đã dời lịch hẹn về hôm nay, có thể check-in ngay", "dueAt", dueAt);
    }

    // ---------- 1b. Flow 3: khách tới TRẢ kho hôm nay ----------
    // Ngày hẹn trả kho = due_at của task CHECK_OUT → dời về 21:00 hôm nay để Staff nghiệm thu ngay (PR-O5).
    @Transactional
    public Map<String, Object> checkoutToday(Integer taskId, CurrentUser actor) {
        requireEnabled();
        Map<String, Object> task = row("SELECT id, task_type, status, contract_id, facility_id FROM facility_tasks WHERE id = ?",
                taskId, "Không tìm thấy task");
        requireSameFacility(actor, toInt(task.get("facility_id")));
        if (!"CHECK_OUT".equals(task.get("task_type"))) {
            throw notApplicable("Chỉ giả lập được cho task nghiệm thu trả kho (CHECK_OUT)");
        }
        if (!List.of("OPEN", "IN_PROGRESS", "OVERDUE").contains(String.valueOf(task.get("status")))) {
            throw notApplicable("Task đã đóng, không cần giả lập");
        }
        Map<String, Object> contract = row("SELECT id, contract_code, status FROM rental_contracts WHERE id = ?",
                task.get("contract_id"), "Không tìm thấy hợp đồng của task");
        if (!"TERMINATION_PENDING".equals(contract.get("status"))) {
            throw notApplicable("Hợp đồng không còn chờ trả kho");
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime dueAt = now.toLocalTime().isBefore(CLOSING_TIME)
                ? LocalDate.now().atTime(CLOSING_TIME) : LocalDate.now().plusDays(1).atTime(CLOSING_TIME);
        jdbcTemplate.update(
                "UPDATE facility_tasks SET due_at = ?, status = CASE WHEN status = 'OVERDUE' " +
                        "THEN (CASE WHEN staff_id IS NULL THEN 'OPEN' ELSE 'IN_PROGRESS' END) ELSE status END WHERE id = ?",
                Timestamp.valueOf(dueAt), taskId);

        log(actor, "Khách tới trả kho hôm nay — HĐ " + contract.get("contract_code") + ", task #" + taskId,
                "facility_tasks", taskId);
        return result("Đã dời ngày trả kho về hôm nay, có thể nghiệm thu ngay", "dueAt", dueAt);
    }

    // ---------- 5b. Flow 6: FM đã gọi khách quá hạn 3 lần không được ----------
    // Ghi 3 log [OVERDUE_CONTACT] (cùng định dạng ContractService) để đủ điều kiện thanh lý theo điều khoản.
    @Transactional
    public Map<String, Object> addFailedContacts(Integer contractId, CurrentUser actor) {
        requireEnabled();
        Map<String, Object> contract = row(
                "SELECT rc.id, rc.contract_code, rc.status, su.facility_id FROM rental_contracts rc " +
                        "JOIN storage_units su ON su.id = rc.storage_unit_id WHERE rc.id = ?",
                contractId, "Không tìm thấy hợp đồng");
        requireSameFacility(actor, toInt(contract.get("facility_id")));
        if (!"OVERDUE".equals(contract.get("status"))) {
            throw notApplicable("Chỉ giả lập được cho hợp đồng đang quá hạn");
        }
        LocalDateTime now = LocalDateTime.now();
        int attempts = ContractService.MIN_CONTACTS_BEFORE_LIQUIDATION;
        for (int i = 1; i <= attempts; i++) {
            jdbcTemplate.update(
                    "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) VALUES (?, ?, 'rental_contracts', ?, ?)",
                    actor.id(),
                    "[OVERDUE_CONTACT] HĐ " + contract.get("contract_code") + ": [SIMULATION] Gọi khách không nghe máy, đã nhắn SMS/email (lần " + i + ")",
                    String.valueOf(contractId),
                    Timestamp.valueOf(now.minusDays((long) (attempts - i) * 7)));
        }
        log(actor, "Ghi " + attempts + " lần liên hệ thất bại cho HĐ " + contract.get("contract_code"),
                "rental_contracts", contractId);
        return result("Đã ghi " + attempts + " lần liên hệ thất bại — đủ điều kiện liên hệ để thanh lý", "contacts", attempts);
    }

    // ---------- 2. Flow 1: đơn chưa cọc quá 15 phút giữ chỗ ----------
    // Lùi giờ tạo đơn 16 phút rồi chạy NGAY job huỷ giữ chỗ (không phải chờ lịch chạy mỗi phút).
    @Transactional
    public Map<String, Object> expireHold(Integer reservationId, CurrentUser actor) {
        requireEnabled();
        Map<String, Object> reservation = reservationRow(reservationId, actor);
        if (!"PENDING".equals(reservation.get("status"))) {
            throw notApplicable("Chỉ giả lập được cho đơn đang chờ thanh toán cọc (PENDING)");
        }
        jdbcTemplate.update("UPDATE reservations SET created_at = DATEADD(MINUTE, -16, SYSDATETIME()) WHERE id = ?", reservationId);
        reservationCleanupService.cancelExpiredReservations();
        String status = jdbcTemplate.queryForObject("SELECT status FROM reservations WHERE id = ?", String.class, reservationId);

        log(actor, "Đơn " + reservation.get("reservation_code") + " quá 15 phút giữ chỗ → " + status,
                "reservations", reservationId);
        return result("Đơn đã quá 15 phút giữ chỗ, hệ thống nhả suất", "status", status);
    }

    // ---------- 3. Flow 2: khách bùng hẹn, đủ điều kiện No-Show ----------
    // Giờ hẹn lùi 49h (ngày bắt đầu < hôm nay → hiện ở tab No-Show) + 2 lần gọi thất bại cách nhau 25h (PR-X3).
    @Transactional
    public Map<String, Object> triggerNoShow(Integer reservationId, CurrentUser actor) {
        requireEnabled();
        Map<String, Object> reservation = reservationRow(reservationId, actor);
        if (!"UNIT_ASSIGNED".equals(reservation.get("status"))) {
            throw notApplicable("Chỉ giả lập được cho đơn đã gán ô, khách chưa nhận kho");
        }
        Map<String, Object> contract = row("SELECT id, contract_code, status FROM rental_contracts WHERE reservation_id = ?",
                reservationId, "Đơn chưa có hợp đồng");
        if (!"PENDING_CHECK_IN".equals(contract.get("status"))) {
            throw notApplicable("Khách đã check-in, không còn là No-Show");
        }
        int months = toInt(reservation.get("duration_months"));
        LocalDateTime appointment = LocalDateTime.now().minusHours(49);
        LocalDate startDate = appointment.toLocalDate();

        jdbcTemplate.update("UPDATE reservations SET start_date = ?, expected_appointment_time = ? WHERE id = ?",
                startDate, Timestamp.valueOf(appointment), reservationId);
        jdbcTemplate.update("UPDATE rental_contracts SET start_date = ?, end_date = ? WHERE id = ?",
                startDate, startDate.plusMonths(months), contract.get("id"));
        // Task bàn giao đã quá hạn từ ngày hẹn (giống job đánh OVERDUE)
        jdbcTemplate.update(
                "UPDATE facility_tasks SET due_at = ?, status = 'OVERDUE' " +
                        "WHERE contract_id = ? AND task_type = 'CHECK_IN' AND status IN ('OPEN', 'IN_PROGRESS', 'OVERDUE')",
                Timestamp.valueOf(startDate.atTime(CLOSING_TIME)), contract.get("id"));
        // 2 lần liên hệ thất bại, cách nhau 25h, đều sau giờ hẹn — đúng mã [CONTACT][FAILED] mà evaluateNoShowEligibility đếm
        insertContactLog(actor, reservationId, LocalDateTime.now().minusHours(48), 1);
        insertContactLog(actor, reservationId, LocalDateTime.now().minusHours(23), 2);

        log(actor, "Khách bùng hẹn đơn " + reservation.get("reservation_code") + ": hẹn lùi 49h, 2 lần gọi thất bại cách 25h",
                "reservations", reservationId);
        return result("Đơn đã đủ điều kiện No-Show (xem tab No-Show)", "appointment", appointment);
    }

    // ---------- 4 + 5. Flow 6: hợp đồng quá hạn N ngày (3 = phí trễ, 31 = được thanh lý) ----------
    @Transactional
    public Map<String, Object> makeOverdue(Integer contractId, int days, CurrentUser actor) {
        requireEnabled();
        if (days < 1 || days > MAX_OVERDUE_DAYS) {
            throw new AccessException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Số ngày quá hạn phải từ 1 đến " + MAX_OVERDUE_DAYS);
        }
        Map<String, Object> contract = row(
                "SELECT rc.id, rc.contract_code, rc.status, rc.billing_cycle_months, rc.customer_id, su.facility_id " +
                        "FROM rental_contracts rc JOIN storage_units su ON su.id = rc.storage_unit_id WHERE rc.id = ?",
                contractId, "Không tìm thấy hợp đồng");
        requireSameFacility(actor, toInt(contract.get("facility_id")));
        String previousStatus = String.valueOf(contract.get("status"));
        if (!List.of("ACTIVE", "OVERDUE", "TERMINATION_PENDING").contains(previousStatus)) {
            throw notApplicable("Chỉ giả lập được cho hợp đồng đang thuê, chờ trả kho hoặc đang quá hạn");
        }
        boolean missedCheckout = "TERMINATION_PENDING".equals(previousStatus);
        // PR-Q1: hẹn trả kho rồi thì còn 5 ngày ân hạn — chỉ quá hạn khi đã qua end_date + 5
        if (missedCheckout && days <= CHECKOUT_GRACE_DAYS) {
            throw new AccessException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Hợp đồng đã hẹn trả kho còn " + CHECKOUT_GRACE_DAYS + " ngày ân hạn — nhập từ "
                            + (CHECKOUT_GRACE_DAYS + 1) + " ngày trở lên");
        }
        int months = Math.max(1, toInt(contract.get("billing_cycle_months")));
        LocalDate endDate = LocalDate.now().minusDays(days);
        // Giữ đúng độ dài kỳ thuê: start = end − số tháng (tránh end < start làm sai tiền hoàn)
        LocalDate startDate = endDate.minusMonths(months);

        jdbcTemplate.update(
                "UPDATE rental_contracts SET start_date = ?, end_date = ?, status = 'OVERDUE', " +
                        "late_fee_waived = 0, late_fee_waiver_note = NULL WHERE id = ?",
                startDate, endDate, contractId);
        // Link gia hạn đang chờ đã chốt số tiền cũ → huỷ để khách tạo link mới có phí trễ đúng
        jdbcTemplate.update(
                "UPDATE payment_transactions SET status = 'FAILED', paid_at = NULL WHERE contract_id = ? " +
                        "AND payment_method = 'VNPAY' AND payment_type IN ('MONTHLY_RENT', 'LATE_FEE') AND status = 'PENDING'",
                contractId);
        if (missedCheckout) {
            // Giống job PR-Q1 (OverdueContractProcessor): đơn về UNIT_ASSIGNED, huỷ task CHECK_OUT khách không tới
            jdbcTemplate.update("UPDATE reservations SET status = 'UNIT_ASSIGNED' " +
                    "WHERE id = (SELECT reservation_id FROM rental_contracts WHERE id = ?)", contractId);
            jdbcTemplate.update("UPDATE facility_tasks SET status = 'CANCELLED' WHERE contract_id = ? " +
                    "AND task_type = 'CHECK_OUT' AND status IN ('OPEN', 'IN_PROGRESS', 'OVERDUE')", contractId);
        }

        log(actor, "HĐ " + contract.get("contract_code") + (missedCheckout ? " khách không tới trả kho," : "")
                        + " quá hạn " + days + " ngày (hết hạn " + endDate + ")",
                "rental_contracts", contractId);
        return result(days > 30 ? "Hợp đồng quá hạn " + days + " ngày — đủ ngày thanh lý (cần thêm "
                        + ContractService.MIN_CONTACTS_BEFORE_LIQUIDATION + " lần liên hệ)"
                : "Hợp đồng quá hạn " + days + " ngày — đang tính phí trễ", "endDate", endDate);
    }

    // ---------- 5c. PR-Q10: hàng lưu giữ đã hết 60 ngày ----------
    // Lùi hạn lưu giữ về hôm qua → FM bán thanh lý / tiêu huỷ được ngay.
    @Transactional
    public Map<String, Object> expireHeldGoods(Integer heldGoodsId, CurrentUser actor) {
        requireEnabled();
        Map<String, Object> goods = row("SELECT h.id, h.status, h.facility_id, rc.contract_code FROM held_goods h " +
                        "JOIN rental_contracts rc ON rc.id = h.contract_id WHERE h.id = ?",
                heldGoodsId, "Không tìm thấy hồ sơ lưu giữ hàng");
        requireSameFacility(actor, toInt(goods.get("facility_id")));
        if (!"HOLDING".equals(goods.get("status"))) {
            throw notApplicable("Hồ sơ đã được xử lý, không cần giả lập");
        }
        LocalDate yesterday = LocalDate.now().minusDays(1);
        jdbcTemplate.update("UPDATE held_goods SET hold_until = ? WHERE id = ?", yesterday, heldGoodsId);

        log(actor, "Hàng lưu giữ HĐ " + goods.get("contract_code") + " hết hạn 60 ngày (hạn " + yesterday + ")",
                "held_goods", heldGoodsId);
        return result("Đã hết hạn lưu giữ — có thể bán thanh lý hoặc tiêu huỷ", "holdUntil", yesterday);
    }

    // ---------- 6. Flow 7: ticket đã xử lý quá 3 ngày → hệ thống tự đóng ----------
    @Transactional
    public Map<String, Object> autoCloseTicket(Integer ticketId, CurrentUser actor) {
        requireEnabled();
        Map<String, Object> ticket = row(
                "SELECT sr.id, sr.ticket_code, sr.status, sr.customer_id, su.facility_id FROM support_requests sr " +
                        "JOIN rental_contracts rc ON rc.id = sr.contract_id JOIN storage_units su ON su.id = rc.storage_unit_id " +
                        "WHERE sr.id = ?",
                ticketId, "Không tìm thấy yêu cầu hỗ trợ");
        requireOwnerOrFacility(actor, toInt(ticket.get("customer_id")), toInt(ticket.get("facility_id")));
        if (!"RESOLVED".equals(ticket.get("status"))) {
            throw notApplicable("Chỉ giả lập được cho yêu cầu đã xử lý (RESOLVED)");
        }
        jdbcTemplate.update("UPDATE support_requests SET resolved_at = DATEADD(DAY, -4, SYSDATETIME()) WHERE id = ?", ticketId);
        supportRequestService.autoCloseResolvedTickets();
        // Job đóng ticket qua JPA (chưa flush) → đẩy xuống DB trước khi đọc lại bằng JDBC
        entityManager.flush();
        String status = jdbcTemplate.queryForObject("SELECT status FROM support_requests WHERE id = ?", String.class, ticketId);

        log(actor, "Ticket " + ticket.get("ticket_code") + " đã xử lý quá 3 ngày → " + status, "support_requests", ticketId);
        return result("Yêu cầu hỗ trợ đã được hệ thống tự đóng", "status", status);
    }

    // ---------- Helpers ----------

    private void requireEnabled() {
        if (!enabled) {
            throw new AccessException(HttpStatus.NOT_FOUND, "SIMULATION_DISABLED", "Chức năng giả lập đang tắt");
        }
    }

    // Khách: đơn của mình · FM/Staff: đơn thuộc cơ sở mình
    private Map<String, Object> reservationRow(Integer reservationId, CurrentUser actor) {
        Map<String, Object> reservation = row(
                "SELECT id, reservation_code, status, customer_id, facility_id, duration_months FROM reservations WHERE id = ?",
                reservationId, "Không tìm thấy đơn đặt chỗ");
        requireOwnerOrFacility(actor, toInt(reservation.get("customer_id")), toInt(reservation.get("facility_id")));
        return reservation;
    }

    private void requireOwnerOrFacility(CurrentUser actor, Integer customerId, Integer facilityId) {
        if (actor.hasRole("CUSTOMER") && !Objects.equals(actor.id(), customerId)) {
            throw AccessException.forbidden("FORBIDDEN_OWNER", "Bản ghi không thuộc về bạn");
        }
        requireSameFacility(actor, facilityId);
    }

    private void requireSameFacility(CurrentUser actor, Integer facilityId) {
        if (actor.isFacilityScoped() && !Objects.equals(actor.facilityId(), facilityId)) {
            throw AccessException.forbidden("FORBIDDEN_FACILITY", "Bản ghi không thuộc cơ sở của bạn");
        }
    }

    private int durationMonths(Integer reservationId) {
        Integer months = jdbcTemplate.queryForObject("SELECT duration_months FROM reservations WHERE id = ?",
                Integer.class, reservationId);
        return months != null && months > 0 ? months : 1;
    }

    private void insertContactLog(CurrentUser actor, Integer reservationId, LocalDateTime at, int attempt) {
        jdbcTemplate.update(
                "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) VALUES (?, ?, 'reservations', ?, ?)",
                actor.id(), "[CONTACT][FAILED] [SIMULATION] Gọi khách không nghe máy (lần " + attempt + ")",
                String.valueOf(reservationId), Timestamp.valueOf(at));
    }

    private void log(CurrentUser actor, String detail, String targetEntity, Integer targetId) {
        activityLogService.log(actor.id(), "[SIMULATION] " + actor.fullName() + " giả lập: " + detail,
                targetEntity, String.valueOf(targetId));
    }

    private Map<String, Object> row(String sql, Object id, String notFoundMessage) {
        List<Map<String, Object>> rows = id == null ? List.of() : jdbcTemplate.queryForList(sql, id);
        if (rows.isEmpty()) {
            throw new AccessException(HttpStatus.NOT_FOUND, "NOT_FOUND", notFoundMessage);
        }
        return rows.get(0);
    }

    private static AccessException notApplicable(String message) {
        return new AccessException(HttpStatus.CONFLICT, "SIMULATION_NOT_APPLICABLE", message);
    }

    private static Map<String, Object> result(String message, String key, Object value) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", message);
        result.put(key, value);
        return result;
    }

    private static int toInt(Object value) {
        return value instanceof Number number ? number.intValue() : 0;
    }
}

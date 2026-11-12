package com.queenkho.api.service;

import com.queenkho.api.security.AccessException;
import com.queenkho.api.security.CurrentUser;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Autowired;
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

    private final JdbcTemplate jdbcTemplate;
    private final ReservationCleanupService reservationCleanupService;
    private final SupportRequestService supportRequestService;
    private final ActivityLogService activityLogService;
    private final boolean enabled;

    @PersistenceContext
    private EntityManager entityManager;

    public static final int MAX_APPOINTMENT_SHIFT_DAYS = 90; // PR-T1: giả lập lịch hẹn nhận kho còn N ngày
    public static final int MAX_EXPIRE_SOON_DAYS = 15; // 05/11/2026: mốc nhắc 15 / 10 / 7 / 3 / 1

    // Thêm sau (PR-R9, task quá hạn) — inject qua field để giữ nguyên constructor đang dùng trong test
    @Autowired(required = false)
    private RenewalReminderService renewalReminderService;

    @Autowired(required = false)
    private StaffTaskService staffTaskService;

    // D-15: giả lập quá hạn chạy luôn bước chuyển kho tổng
    @Autowired(required = false)
    private ContractOverdueJob contractOverdueJob;

    // BR-128 / BR-129 (04/11/2026): bảo hiểm chi trả, cảm biến vượt ngưỡng
    @Autowired(required = false)
    private UnitSensorService unitSensorService;

    @Autowired(required = false)
    private CompensationClaimService compensationClaimService;

    // D-18: dời ngày nhận kho → trạng thái ô tính lại theo lịch (về hôm nay = OCCUPIED, ra sau = AVAILABLE)
    @Autowired(required = false)
    private UnitScheduleService unitScheduleService;

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
        return shiftCheckInAppointment(taskId, 0, actor);
    }

    // ---------- 1a. PR-T1: lịch hẹn nhận kho còn N ngày → demo khung 30 ngày giao / nhận task CHECK_IN ----------
    // N > 30 → task chưa giao / nhận được (nút khoá); N ≤ 30 → mở giao việc.
    @Transactional
    public Map<String, Object> appointmentIn(Integer taskId, int days, CurrentUser actor) {
        if (days < 1 || days > MAX_APPOINTMENT_SHIFT_DAYS) {
            throw new AccessException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Số ngày tới lịch hẹn phải từ 1 đến " + MAX_APPOINTMENT_SHIFT_DAYS);
        }
        return shiftCheckInAppointment(taskId, days, actor);
    }

    // Dời lịch hẹn nhận kho của task CHECK_IN về hôm nay + days (đơn, hợp đồng, hạn task)
    private Map<String, Object> shiftCheckInAppointment(Integer taskId, int days, CurrentUser actor) {
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

        LocalDate today = LocalDate.now().plusDays(days);
        LocalDateTime now = LocalDateTime.now();
        // Giống StaffTaskService.computeDueAt: hẹn hôm nay mà đã sau 21:00 thì hạn sang 21:00 ngày mai
        LocalDateTime dueAt = days > 0 || now.toLocalTime().isBefore(CLOSING_TIME)
                ? today.atTime(CLOSING_TIME) : today.plusDays(1).atTime(CLOSING_TIME);

        jdbcTemplate.update("UPDATE reservations SET start_date = ?, expected_appointment_time = ? WHERE id = ?",
                today, today.atTime(APPOINTMENT_TIME), contract.get("reservation_id"));
        jdbcTemplate.update("UPDATE rental_contracts SET start_date = ?, end_date = ? WHERE id = ?",
                today, today.plusMonths(months), contract.get("id"));
        refreshUnitOf(contract.get("id"));
        // Task đã bị job đánh quá hạn → mở lại: chưa ai nhận = OPEN, đã có người = IN_PROGRESS
        jdbcTemplate.update(
                "UPDATE facility_tasks SET due_at = ?, status = CASE WHEN status = 'OVERDUE' " +
                        "THEN (CASE WHEN staff_id IS NULL THEN 'OPEN' ELSE 'IN_PROGRESS' END) ELSE status END WHERE id = ?",
                Timestamp.valueOf(dueAt), taskId);

        if (days == 0) {
            log(actor, "Khách tới nhận kho hôm nay — HĐ " + contract.get("contract_code") + ", task #" + taskId,
                    "facility_tasks", taskId);
            return result("Đã dời lịch hẹn về hôm nay, có thể check-in ngay", "dueAt", dueAt);
        }
        log(actor, "Lịch hẹn nhận kho còn " + days + " ngày — HĐ " + contract.get("contract_code") + ", task #" + taskId,
                "facility_tasks", taskId);
        boolean open = days <= StaffTaskService.ASSIGN_WINDOW_DAYS;
        return result("Lịch hẹn nhận kho còn " + days + " ngày — "
                + (open ? "task đã mở giao / nhận việc" : "task chưa giao / nhận được (ngoài khung "
                + StaffTaskService.ASSIGN_WINDOW_DAYS + " ngày)"), "dueAt", dueAt);
    }

    private void refreshUnitOf(Object contractId) {
        if (unitScheduleService == null) return;
        List<String> unitIds = jdbcTemplate.queryForList(
                "SELECT storage_unit_id FROM rental_contracts WHERE id = ?", String.class, contractId);
        if (unitIds != null && !unitIds.isEmpty()) unitScheduleService.refreshUnitStatus(unitIds.get(0));
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
        refreshUnitOf(contract.get("id"));
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
        // D-15 (05/11/2026): đã bỏ ân hạn 5 ngày — hẹn trả mà không tới thì quá hạn từ ngày sau hạn
        int months = Math.max(1, toInt(contract.get("billing_cycle_months")));
        LocalDate endDate = LocalDate.now().minusDays(days);
        // Giữ đúng độ dài kỳ thuê: start = end − số tháng (tránh end < start làm sai tiền hoàn)
        LocalDate startDate = endDate.minusMonths(months);

        jdbcTemplate.update(
                "UPDATE rental_contracts SET start_date = ?, end_date = ?, status = 'OVERDUE', " +
                        "late_fee_waived = 0, overstay_fee_waived = 0, late_fee_waiver_note = NULL WHERE id = ?",
                startDate, endDate, contractId);
        // Link gia hạn đang chờ đã chốt số tiền cũ → huỷ để khách tạo link mới có phí trễ đúng
        jdbcTemplate.update(
                "UPDATE payment_transactions SET status = 'FAILED', paid_at = NULL WHERE contract_id = ? " +
                        "AND payment_method = 'VNPAY' AND payment_type IN ('MONTHLY_RENT', 'LATE_FEE', 'OVERSTAY_FEE') AND status = 'PENDING' AND (payment_type <> 'OVERSTAY_FEE' OR renewal_months IS NOT NULL)",
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
        // BR-117: chạy ngay cảnh báo thanh lý (job thật chạy 8h sáng) để demo thấy chuông + email
        if (renewalReminderService != null) renewalReminderService.warnLiquidationContract(contractId);
        // D-15: điều khoản v4 → chạy ngay bước thanh lý + chuyển kho tổng như job 00:05
        if (contractOverdueJob != null && contractOverdueJob.relocateToCentralWarehouse(contractId) > 0) {
            return result("Hợp đồng quá hạn " + days + " ngày — điều khoản v4: đã thanh lý, sinh việc chuyển hàng vào kho tổng",
                    "endDate", endDate);
        }
        return result(days > 30 ? "Hợp đồng quá hạn " + days + " ngày — đủ ngày thanh lý (cần thêm "
                        + ContractService.MIN_CONTACTS_BEFORE_LIQUIDATION + " lần liên hệ)"
                : "Hợp đồng quá hạn " + days + " ngày — đang tính phí trễ", "endDate", endDate);
    }

    // ---------- 4b. PR-R9: hợp đồng ACTIVE sắp hết hạn (còn N ngày) → chạy ngay job nhắc gia hạn ----------
    @Transactional
    public Map<String, Object> expireSoon(Integer contractId, int days, CurrentUser actor) {
        requireEnabled();
        if (days < 1 || days > MAX_EXPIRE_SOON_DAYS) {
            throw new AccessException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Số ngày còn lại phải từ 1 đến " + MAX_EXPIRE_SOON_DAYS);
        }
        Map<String, Object> contract = row(
                "SELECT rc.id, rc.contract_code, rc.status, rc.billing_cycle_months, rc.customer_id, su.facility_id " +
                        "FROM rental_contracts rc JOIN storage_units su ON su.id = rc.storage_unit_id WHERE rc.id = ?",
                contractId, "Không tìm thấy hợp đồng");
        requireOwnerOrFacility(actor, toInt(contract.get("customer_id")), toInt(contract.get("facility_id")));
        if (!"ACTIVE".equals(contract.get("status"))) {
            throw notApplicable("Chỉ giả lập được cho hợp đồng đang thuê (ACTIVE)");
        }
        int months = Math.max(1, toInt(contract.get("billing_cycle_months")));
        LocalDate endDate = LocalDate.now().plusDays(days);
        jdbcTemplate.update("UPDATE rental_contracts SET start_date = ?, end_date = ? WHERE id = ?",
                endDate.minusMonths(months), endDate, contractId);
        boolean sent = renewalReminderService != null && renewalReminderService.remindContract(contractId);

        log(actor, "HĐ " + contract.get("contract_code") + " còn " + days + " ngày hết hạn (hết hạn " + endDate + ")",
                "rental_contracts", contractId);
        return result(sent
                ? "Hợp đồng còn " + days + " ngày — đã gửi nhắc gia hạn (chuông + email)"
                : "Hợp đồng còn " + days + " ngày — mốc nhắc này đã gửi trước đó", "endDate", endDate);
    }

    // ---------- 4c. Task quá hạn → FM thấy nút "Gia hạn xử lý" ----------
    // Lùi hạn task về 1 phút trước rồi chạy NGAY job đánh quá hạn (gửi thông báo cho FM / nhân viên giữ task).
    @Transactional
    public Map<String, Object> makeTaskOverdue(Integer taskId, CurrentUser actor) {
        requireEnabled();
        Map<String, Object> task = row("SELECT id, task_type, status, facility_id FROM facility_tasks WHERE id = ?",
                taskId, "Không tìm thấy task");
        requireSameFacility(actor, toInt(task.get("facility_id")));
        if (!List.of("OPEN", "IN_PROGRESS").contains(String.valueOf(task.get("status")))) {
            throw notApplicable("Chỉ giả lập được cho task đang chờ nhận / đang xử lý");
        }
        jdbcTemplate.update("UPDATE facility_tasks SET due_at = DATEADD(MINUTE, -1, SYSDATETIME()) WHERE id = ?", taskId);
        if (staffTaskService != null) {
            staffTaskService.markOverdueTasks();
        }
        String status = jdbcTemplate.queryForObject("SELECT status FROM facility_tasks WHERE id = ?", String.class, taskId);

        log(actor, "Task #" + taskId + " (" + task.get("task_type") + ") quá hạn xử lý → " + status, "facility_tasks", taskId);
        return result("Task đã quá hạn — Quản lý cơ sở có thể bấm \"Gia hạn xử lý\"", "status", status);
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

    // ---------- BR-129: cảm biến ô vượt ngưỡng (khách chủ HĐ / FM) ----------
    // Ghi 12 giờ số đo (6 giờ bình thường rồi nóng / ẩm dần tới 36°C, 88%) → chạy xử lý cảnh báo thật
    @Transactional
    public Map<String, Object> sensorAlert(Integer contractId, CurrentUser actor) {
        requireEnabled();
        Map<String, Object> contract = row(
                "SELECT rc.id, rc.contract_code, rc.status, rc.customer_id, rc.storage_unit_id, su.facility_id " +
                        "FROM rental_contracts rc JOIN storage_units su ON su.id = rc.storage_unit_id WHERE rc.id = ?",
                contractId, "Không tìm thấy hợp đồng");
        requireOwnerOrFacility(actor, toInt(contract.get("customer_id")), toInt(contract.get("facility_id")));
        if (!List.of("ACTIVE", "OVERDUE", "TERMINATION_PENDING").contains(String.valueOf(contract.get("status")))) {
            throw notApplicable("Chỉ giả lập được cho hợp đồng đang thuê");
        }
        Map<String, Object> reading = unitSensorService.simulateAlert(String.valueOf(contract.get("storage_unit_id")));
        log(actor, "Cảm biến ô " + contract.get("storage_unit_id") + " (HĐ " + contract.get("contract_code")
                + ") vượt ngưỡng " + reading.get("temperature") + "°C / " + reading.get("humidity") + "%", "rental_contracts", contractId);
        return result("Cảm biến ghi nhận " + reading.get("temperature") + "°C, độ ẩm " + reading.get("humidity")
                + "% — đã báo khách, FM và sinh việc kiểm tra", "storageUnitId", reading.get("storageUnitId"));
    }

    // ---------- BR-128: bên bảo hiểm duyệt & chi trả hồ sơ (FM) ----------
    @Transactional
    public Map<String, Object> insurancePayout(Integer claimId, CurrentUser actor) {
        requireEnabled();
        Map<String, Object> claim = row("SELECT id, facility_id FROM compensation_claims WHERE id = ?", claimId,
                "Không tìm thấy hồ sơ bồi thường");
        requireSameFacility(actor, toInt(claim.get("facility_id")));
        var response = compensationClaimService.simulateInsurancePayout(claimId, actor.id());
        return result("Bảo hiểm đã chi trả " + response.getInsuranceAmount() + "đ cho cơ sở", "insuranceStatus",
                response.getInsuranceStatus());
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

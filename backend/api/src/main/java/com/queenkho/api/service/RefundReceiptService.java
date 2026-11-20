package com.queenkho.api.service;

import com.queenkho.api.dto.RefundReceiptResponse;
import com.queenkho.api.entity.StaffTask;
import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.repository.StaffTaskRepository;
import com.queenkho.api.security.CurrentUser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * D-22 (20/11/2026) — PR-O25 → PR-O27: khách xác nhận đã nhận tiền hoàn.
 * <pre>
 * FM hoàn tất task REFUND (chuyển khoản)  → WAITING_CUSTOMER ── "Đã nhận được" ───────────▶ CONFIRMED
 *                                                            ├─ quá 3 ngày không phản hồi ─▶ AUTO_CONFIRMED
 *                                                            └─ "Chưa nhận được" + lý do ──▶ DISPUTED → task mở lại IN_PROGRESS (hạn 24h)
 *                                                                 → FM hoàn tất lại (giao dịch đúng / chuyển bổ sung) → WAITING_CUSTOMER
 * Tiền mặt có ảnh phiếu chi ký nhận → CONFIRMED ngay. Hoàn 0đ → AUTO_CONFIRMED.
 * </pre>
 */
@Service
public class RefundReceiptService {

    public static final int AUTO_CONFIRM_DAYS = 3;
    private static final Pattern RESERVATION_CODE = Pattern.compile("Đơn:\\s*([A-Za-z0-9_-]+)");

    private final StaffTaskRepository staffTaskRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ActivityLogService activityLogService;

    @Autowired(required = false)
    private NotificationService notificationService;

    @Autowired
    @Lazy
    private StaffTaskService staffTaskService;

    public RefundReceiptService(StaffTaskRepository staffTaskRepository, JdbcTemplate jdbcTemplate,
                                ActivityLogService activityLogService) {
        this.staffTaskRepository = staffTaskRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.activityLogService = activityLogService;
    }

    /** Các khoản hoàn của khách (mới nhất trước); contractId để lọc theo hợp đồng */
    @Transactional(readOnly = true)
    public List<RefundReceiptResponse> listMine(CurrentUser actor, Integer contractId) {
        requireCustomer(actor);
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT t.id, t.contract_id, t.status, t.note, t.evidence_image_url, t.completed_at, t.refund_amount, " +
                        "t.receipt_status, t.receipt_round, t.receipt_dispute_reason, t.receipt_confirmed_at, " +
                        "rc.contract_code, r.reservation_code, f.name AS facility_name, " +
                        "(SELECT TOP 1 p.payment_method FROM payment_transactions p WHERE p.payment_type = 'REFUND' AND p.status = 'SUCCESS' " +
                        "   AND ((t.contract_id IS NOT NULL AND p.contract_id = t.contract_id) OR (t.contract_id IS NULL AND p.user_id = t.customer_id)) " +
                        "   ORDER BY p.id DESC) AS payment_method, " +
                        "(SELECT TOP 1 p.bank_transaction_code FROM payment_transactions p WHERE p.payment_type = 'REFUND' AND p.status = 'SUCCESS' " +
                        "   AND ((t.contract_id IS NOT NULL AND p.contract_id = t.contract_id) OR (t.contract_id IS NULL AND p.user_id = t.customer_id)) " +
                        "   ORDER BY p.id DESC) AS bank_code " +
                        "FROM facility_tasks t " +
                        "LEFT JOIN rental_contracts rc ON rc.id = t.contract_id " +
                        "LEFT JOIN reservations r ON r.id = rc.reservation_id " +
                        "LEFT JOIN facilities f ON f.id = t.facility_id " +
                        "WHERE t.task_type = 'REFUND' AND t.customer_id = ? AND t.receipt_status IS NOT NULL " +
                        "AND (? IS NULL OR t.contract_id = ?) ORDER BY t.id DESC",
                actor.id(), contractId, contractId);
        List<RefundReceiptResponse> result = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            String receipt = (String) r.get("receipt_status");
            LocalDateTime completedAt = toTime(r.get("completed_at"));
            boolean waiting = StaffTask.RECEIPT_WAITING.equals(receipt);
            String note = (String) r.get("note");
            String reservationCode = (String) r.get("reservation_code");
            if (reservationCode == null && note != null) {
                Matcher m = RESERVATION_CODE.matcher(note);
                if (m.find()) reservationCode = m.group(1);
            }
            String method = (String) r.get("payment_method");
            if (method == null) method = StaffTaskService.detectRefundMethodFromNote(note);
            result.add(RefundReceiptResponse.builder()
                    .taskId(((Number) r.get("id")).intValue())
                    .contractId(r.get("contract_id") instanceof Number n ? n.intValue() : null)
                    .contractCode((String) r.get("contract_code"))
                    .reservationCode(reservationCode)
                    .facilityName((String) r.get("facility_name"))
                    .amount(r.get("refund_amount") instanceof BigDecimal b ? b : BigDecimal.ZERO)
                    .paymentMethod(method)
                    .bankTransactionCode((String) r.get("bank_code"))
                    .evidenceImageUrl((String) r.get("evidence_image_url"))
                    .completedAt(completedAt)
                    .taskStatus((String) r.get("status"))
                    .receiptStatus(receipt)
                    .receiptRound(r.get("receipt_round") instanceof Number n ? n.intValue() : 0)
                    .disputeReason((String) r.get("receipt_dispute_reason"))
                    .confirmedAt(toTime(r.get("receipt_confirmed_at")))
                    .autoConfirmAt(waiting && completedAt != null ? completedAt.plusDays(AUTO_CONFIRM_DAYS) : null)
                    .managerNote(lastManagerNote(note))
                    .canConfirm(waiting)
                    .canDispute(waiting)
                    .build());
        }
        return result;
    }

    @Transactional
    public RefundReceiptResponse confirm(Integer taskId, CurrentUser actor) {
        StaffTask task = requireOwnWaiting(taskId, actor);
        task.setReceiptStatus(StaffTask.RECEIPT_CONFIRMED);
        task.setReceiptConfirmedAt(LocalDateTime.now());
        task.setReceiptAutoConfirmed(false);
        staffTaskRepository.saveAndFlush(task); // flush trước khi đọc lại bằng JDBC
        activityLogService.log(actor.id(), "[REFUND_RECEIVED] Khách xác nhận đã nhận tiền hoàn task #" + taskId,
                "facility_tasks", String.valueOf(taskId));
        return find(actor, taskId);
    }

    @Transactional
    public RefundReceiptResponse dispute(Integer taskId, CurrentUser actor, String reason) {
        String r = reason != null ? reason.trim() : "";
        if (r.length() < 10 || r.length() > 500) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "DISPUTE_REASON_REQUIRED",
                    "Vui lòng mô tả vấn đề (10–500 ký tự), ví dụ chưa thấy tiền, sai số tiền, sai tài khoản");
        }
        StaffTask task = requireOwnWaiting(taskId, actor);
        LocalDateTime now = LocalDateTime.now();
        task.setReceiptStatus(StaffTask.RECEIPT_DISPUTED);
        task.setReceiptDisputeReason(r);
        task.setReceiptDisputedAt(now);
        // PR-O26: mở lại task cho FM xử lý, hạn 24h không tính Chủ Nhật (PR-93)
        task.setStatus("IN_PROGRESS");
        task.setDueAt(staffTaskService.refundDeadline(now));
        String note = (task.getNote() != null ? task.getNote() : "") + " | [KHÁCH BÁO CHƯA NHẬN lần " + task.getReceiptRound() + "] " + r;
        task.setNote(note.length() > 1000 ? note.substring(0, 997) + "..." : note);
        staffTaskRepository.saveAndFlush(task); // flush trước khi đọc lại bằng JDBC

        activityLogService.log(actor.id(), "[REFUND_DISPUTE] Khách báo chưa nhận tiền hoàn task #" + taskId + ": " + r,
                "facility_tasks", String.valueOf(taskId));
        if (notificationService != null) {
            notificationService.notifyFacilityManagers(task.getFacilityId(),
                    "Khách báo chưa nhận tiền hoàn — task #" + taskId,
                    (actor.fullName() != null ? actor.fullName() + ": " : "") + r,
                    "REFUND", "/manager/refunds?highlightTaskId=" + taskId);
        }
        return find(actor, taskId);
    }

    /** PR-O27: chuyển khoản chờ khách quá 3 ngày → tự xác nhận (job mỗi phút) */
    @Transactional
    public int autoConfirmDue() {
        return jdbcTemplate.update(
                "UPDATE facility_tasks SET receipt_status = 'AUTO_CONFIRMED', receipt_auto_confirmed = 1, " +
                        "receipt_confirmed_at = SYSDATETIME() WHERE task_type = 'REFUND' AND status = 'COMPLETED' " +
                        "AND receipt_status = 'WAITING_CUSTOMER' AND completed_at <= ?",
                Timestamp.valueOf(LocalDateTime.now().minusDays(AUTO_CONFIRM_DAYS)));
    }

    private RefundReceiptResponse find(CurrentUser actor, Integer taskId) {
        return listMine(actor, null).stream().filter(x -> Objects.equals(x.getTaskId(), taskId)).findFirst().orElse(null);
    }

    private StaffTask requireOwnWaiting(Integer taskId, CurrentUser actor) {
        requireCustomer(actor);
        StaffTask task = staffTaskRepository.findById(taskId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "TASK_NOT_FOUND", "Không tìm thấy khoản hoàn tiền"));
        if (!"REFUND".equals(task.getTaskType()) || !Objects.equals(task.getCustomerId(), actor.id())) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_REFUND", "Khoản hoàn tiền không thuộc tài khoản của bạn");
        }
        if (!StaffTask.RECEIPT_WAITING.equals(task.getReceiptStatus()) || !"COMPLETED".equals(task.getStatus())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "RECEIPT_STATUS_INVALID",
                    "Khoản hoàn tiền không ở bước chờ bạn xác nhận (hiện tại: " + task.getReceiptStatus() + ")");
        }
        return task;
    }

    private static void requireCustomer(CurrentUser actor) {
        if (actor == null || !"CUSTOMER".equals(actor.role())) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE", "Chỉ khách hàng xác nhận khoản hoàn tiền của mình");
        }
    }

    /** Ghi chú mới nhất FM thêm khi hoàn tất (sau dấu " - " của đoạn [ĐÃ HOÀN ...] / [XỬ LÝ ...] cuối cùng) */
    private static String lastManagerNote(String note) {
        if (note == null) return null;
        int i = Math.max(note.lastIndexOf("[XỬ LÝ KHÁCH BÁO CHƯA NHẬN"), note.lastIndexOf("[ĐÃ HOÀN"));
        if (i < 0) return null;
        int close = note.indexOf(']', i);
        if (close < 0) return null;
        String tail = note.substring(close + 1).trim();
        int nextTag = tail.indexOf(" | [");
        if (nextTag >= 0) tail = tail.substring(0, nextTag);
        if (tail.startsWith("-")) tail = tail.substring(1).trim();
        return tail.isBlank() ? null : tail;
    }

    private static LocalDateTime toTime(Object v) {
        if (v instanceof Timestamp ts) return ts.toLocalDateTime();
        if (v instanceof LocalDateTime t) return t;
        return null;
    }
}

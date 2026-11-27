package com.queenkho.api.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Đọc trạng thái xác nhận 2 chiều cho 3 điểm chạm bồi thường trực tiếp từ bảng activity_logs có sẵn
 * (target_entity = 'compensation_claims', target_id = claimId) — KHÔNG tạo bảng mới, giữ nguyên 27 bảng ERD.
 *  - Idea 3: Khách xác nhận biên bản kiểm tra hiện trường của Staff (PENDING_CUSTOMER / CONFIRMED / DISPUTED / BYPASSED)
 *  - Idea 2: Khách xác nhận phương án & mức bồi thường của FM trước khi chi (PENDING_CUSTOMER / CONFIRMED / DISPUTED / BYPASSED)
 *  - Idea 1: Khách xác nhận đã nhận tiền bồi thường sau khi FM chi (WAITING_CUSTOMER / CONFIRMED / AUTO_CONFIRMED / DISPUTED)
 */
@Service
public class ClaimConfirmationService {

    public static final int AUTO_CONFIRM_DAYS = 3;
    public static final int MAX_INSPECTION_ROUNDS = 2;
    public static final int MAX_DECISION_ROUNDS = 2;
    public static final int MAX_RECEIPT_ROUNDS = 2;

    public static final String STATUS_PENDING_CUSTOMER = "PENDING_CUSTOMER";
    public static final String STATUS_CONFIRMED = "CONFIRMED";
    public static final String STATUS_DISPUTED = "DISPUTED";
    public static final String STATUS_BYPASSED = "BYPASSED";

    public static final String RECEIPT_WAITING = "WAITING_CUSTOMER";
    public static final String RECEIPT_CONFIRMED = "CONFIRMED";
    public static final String RECEIPT_AUTO_CONFIRMED = "AUTO_CONFIRMED";
    public static final String RECEIPT_DISPUTED = "DISPUTED";

    public record State(
            String inspectionConfirmStatus,
            LocalDateTime inspectionConfirmedAt,
            String inspectionDisputeReason,
            int inspectionRound,
            String decisionConfirmStatus,
            LocalDateTime decisionConfirmedAt,
            String decisionDisputeReason,
            int decisionRound,
            String receiptStatus,
            LocalDateTime receiptConfirmedAt,
            boolean receiptAutoConfirmed,
            String receiptDisputeReason,
            LocalDateTime receiptDisputedAt,
            int receiptRound,
            java.math.BigDecimal staffAssessedValue
    ) {
        public State(
                String inspectionConfirmStatus,
                LocalDateTime inspectionConfirmedAt,
                String inspectionDisputeReason,
                int inspectionRound,
                String decisionConfirmStatus,
                LocalDateTime decisionConfirmedAt,
                String decisionDisputeReason,
                int decisionRound,
                String receiptStatus,
                LocalDateTime receiptConfirmedAt,
                boolean receiptAutoConfirmed,
                String receiptDisputeReason,
                LocalDateTime receiptDisputedAt,
                int receiptRound
        ) {
            this(inspectionConfirmStatus, inspectionConfirmedAt, inspectionDisputeReason, inspectionRound,
                    decisionConfirmStatus, decisionConfirmedAt, decisionDisputeReason, decisionRound,
                    receiptStatus, receiptConfirmedAt, receiptAutoConfirmed, receiptDisputeReason, receiptDisputedAt, receiptRound,
                    null);
        }

        public static State empty() {
            return new State(null, null, null, 0, null, null, null, 0, null, null, false, null, null, 0, null);
        }
    }

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired(required = false)
    private ActivityLogService activityLogService;

    @Autowired(required = false)
    private NotificationService notificationService;

    @Transactional(readOnly = true)
    public State getState(Integer claimId) {
        if (claimId == null) return State.empty();
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    "SELECT action, created_at FROM activity_logs " +
                    "WHERE target_entity = 'compensation_claims' AND target_id = ? ORDER BY id ASC",
                    String.valueOf(claimId));
            return deriveFromLogs(rows);
        } catch (Exception ignored) {
            return State.empty();
        }
    }

    static State deriveFromLogs(List<Map<String, Object>> rows) {
        if (rows == null || rows.isEmpty()) return State.empty();

        String inspStatus = null;
        LocalDateTime inspConfirmedAt = null;
        String inspDisputeReason = null;
        int inspRound = 0;

        String decStatus = null;
        LocalDateTime decConfirmedAt = null;
        String decDisputeReason = null;
        int decRound = 0;

        String recStatus = null;
        LocalDateTime recConfirmedAt = null;
        boolean recAuto = false;
        String recDisputeReason = null;
        LocalDateTime recDisputedAt = null;
        int recRound = 0;

        java.math.BigDecimal staffAssessedValue = null;

        for (Map<String, Object> r : rows) {
            String action = (String) r.get("action");
            if (action == null) continue;
            LocalDateTime at = toTime(r.get("created_at"));

            if (action.startsWith("[CLAIM_INSPECT]")) {
                inspRound = STATUS_DISPUTED.equals(inspStatus) ? inspRound + 1 : Math.max(1, inspRound);
                inspStatus = STATUS_PENDING_CUSTOMER;
                inspConfirmedAt = null;
                inspDisputeReason = null;
                staffAssessedValue = parseStaffAssessedValue(action);
            } else if (action.startsWith("[CLAIM_INSPECT_CONFIRMED]")) {
                inspStatus = STATUS_CONFIRMED;
                inspConfirmedAt = at;
            } else if (action.startsWith("[CLAIM_INSPECT_DISPUTED]")) {
                inspStatus = STATUS_DISPUTED;
                inspConfirmedAt = null;
                inspDisputeReason = extractReason(action);
            } else if (action.startsWith("[CLAIM_DECIDE]")) {
                if (STATUS_PENDING_CUSTOMER.equals(inspStatus)) {
                    inspStatus = STATUS_BYPASSED;
                }
                if (action.contains("(từ chối)")) {
                    decStatus = null;
                    decConfirmedAt = null;
                    decDisputeReason = null;
                } else {
                    decRound = STATUS_DISPUTED.equals(decStatus) ? decRound + 1 : Math.max(1, decRound);
                    decStatus = STATUS_PENDING_CUSTOMER;
                    decConfirmedAt = null;
                    decDisputeReason = null;
                }
            } else if (action.startsWith("[CLAIM_DECISION_CONFIRMED]")) {
                decStatus = STATUS_CONFIRMED;
                decConfirmedAt = at;
            } else if (action.startsWith("[CLAIM_DECISION_DISPUTED]")) {
                decStatus = STATUS_DISPUTED;
                decConfirmedAt = null;
                decDisputeReason = extractReason(action);
            } else if (action.startsWith("[CLAIM_PAY]")) {
                if (STATUS_PENDING_CUSTOMER.equals(decStatus)) {
                    decStatus = STATUS_BYPASSED;
                }
                recRound = RECEIPT_DISPUTED.equals(recStatus) ? recRound + 1 : Math.max(1, recRound);
                boolean immediate = action.contains("(SETTLEMENT_OFFSET)") || action.contains("(CASH_SIGNED)");
                recStatus = immediate ? RECEIPT_CONFIRMED : RECEIPT_WAITING;
                recConfirmedAt = immediate ? at : null;
                recAuto = false;
                recDisputeReason = null;
                recDisputedAt = null;
            } else if (action.startsWith("[CLAIM_DISPUTE_RESOLVED]")) {
                recRound = Math.max(1, recRound) + 1;
                recStatus = RECEIPT_WAITING;
                recConfirmedAt = null;
                recAuto = false;
                recDisputeReason = null;
                recDisputedAt = null;
            } else if (action.startsWith("[CLAIM_RECEIPT_CONFIRMED]")) {
                recStatus = RECEIPT_CONFIRMED;
                recConfirmedAt = at;
                recAuto = false;
            } else if (action.startsWith("[CLAIM_RECEIPT_DISPUTED]")) {
                recStatus = RECEIPT_DISPUTED;
                recDisputeReason = extractReason(action);
                recDisputedAt = at;
                recConfirmedAt = null;
            } else if (action.startsWith("[CLAIM_RECEIPT_AUTO_CONFIRMED]")) {
                recStatus = RECEIPT_AUTO_CONFIRMED;
                recAuto = true;
                recConfirmedAt = at;
            }
        }

        return new State(
                inspStatus, inspConfirmedAt, inspDisputeReason, inspRound,
                decStatus, decConfirmedAt, decDisputeReason, decRound,
                recStatus, recConfirmedAt, recAuto, recDisputeReason, recDisputedAt, recRound,
                staffAssessedValue
        );
    }

    @Transactional
    public int autoConfirmDueReceipts() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(AUTO_CONFIRM_DAYS);
        List<Map<String, Object>> candidates = jdbcTemplate.queryForList(
                "SELECT id, claim_code, customer_id, support_request_id, facility_id " +
                "FROM compensation_claims " +
                "WHERE status = 'PAID' AND paid_at IS NOT NULL AND paid_at <= ?",
                Timestamp.valueOf(cutoff));
        if (candidates.isEmpty()) return 0;

        LocalDateTime now = LocalDateTime.now();
        int count = 0;
        for (Map<String, Object> row : candidates) {
            Integer claimId = ((Number) row.get("id")).intValue();
            State s = getState(claimId);
            if (!RECEIPT_WAITING.equals(s.receiptStatus())) continue;

            String claimCode = (String) row.get("claim_code");
            Integer customerId = row.get("customer_id") instanceof Number n ? n.intValue() : null;
            Integer ticketId = row.get("support_request_id") instanceof Number n ? n.intValue() : null;
            Integer facilityId = row.get("facility_id") instanceof Number n ? n.intValue() : null;

            if (ticketId != null) {
                jdbcTemplate.update(
                        "UPDATE support_requests SET status = 'CLOSED', closed_at = COALESCE(closed_at, ?) " +
                        "WHERE id = ? AND status = 'RESOLVED'",
                        Timestamp.valueOf(now), ticketId);
            }
            if (activityLogService != null) {
                activityLogService.log(customerId != null ? customerId : 1,
                        "[CLAIM_RECEIPT_AUTO_CONFIRMED] Hệ thống tự xác nhận đã nhận tiền bồi thường hồ sơ " + claimCode
                                + " sau " + AUTO_CONFIRM_DAYS + " ngày khách không phản hồi",
                        "compensation_claims", String.valueOf(claimId));
            }
            if (notificationService != null) {
                String staffAndFmMsg = "Quá " + AUTO_CONFIRM_DAYS + " ngày không có khiếu nại, hệ thống đã tự động xác nhận khách nhận đủ tiền bồi thường hồ sơ " + claimCode + ".";
                if (customerId != null) {
                    notificationService.notifyCustomer(customerId,
                            "Đã tự xác nhận nhận tiền bồi thường " + claimCode,
                            "Quá " + AUTO_CONFIRM_DAYS + " ngày không có khiếu nại, hệ thống tự xác nhận bạn đã nhận đủ tiền bồi thường.",
                            "SUPPORT", "/ho-tro?highlightClaimCode=" + claimCode);
                }
                if (facilityId != null) {
                    notificationService.notifyFacilityManagers(facilityId,
                            "Hệ thống tự xác nhận nhận tiền — " + claimCode,
                            staffAndFmMsg,
                            "SUPPORT", "/manager/claims/" + claimId);
                }
                if (ticketId != null) {
                    List<Map<String, Object>> taskRows = jdbcTemplate.queryForList(
                            "SELECT TOP 1 id, staff_id FROM facility_tasks WHERE support_request_id = ? AND task_type = 'SUPPORT' ORDER BY id DESC",
                            ticketId);
                    if (!taskRows.isEmpty()) {
                        Integer taskId = ((Number) taskRows.get(0).get("id")).intValue();
                        Integer staffId = taskRows.get(0).get("staff_id") instanceof Number sn ? sn.intValue() : null;
                        if (staffId != null) {
                            notificationService.notifyStaff(staffId,
                                    "Hệ thống tự xác nhận nhận tiền — " + claimCode,
                                    staffAndFmMsg,
                                    "SUPPORT", "/staff/tasks/" + taskId);
                        } else if (facilityId != null) {
                            notificationService.notifyFacilityStaff(facilityId,
                                    "Hệ thống tự xác nhận nhận tiền — " + claimCode,
                                    staffAndFmMsg,
                                    "SUPPORT", "/staff/tasks/" + taskId);
                        }
                    }
                }
            }
            count++;
        }
        return count;
    }

    @Transactional
    public void forceAutoConfirmForDemo(Integer claimId) {
        LocalDateTime now = LocalDateTime.now();
        jdbcTemplate.update(
                "UPDATE compensation_claims SET paid_at = ? WHERE id = ?",
                Timestamp.valueOf(now.minusDays(AUTO_CONFIRM_DAYS + 1)), claimId);
        autoConfirmDueReceipts();
    }

    private static java.math.BigDecimal parseStaffAssessedValue(String action) {
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("\\[GIA_STAFF_UOC_TINH:([0-9]+(?:\\.[0-9]+)?)\\]")
                .matcher(action);
        if (!m.find()) return null;
        try {
            return new java.math.BigDecimal(m.group(1));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static String extractReason(String action) {
        int idx = action.indexOf(": ");
        return idx >= 0 && idx + 2 < action.length() ? action.substring(idx + 2).trim() : action;
    }

    private static LocalDateTime toTime(Object v) {
        return v instanceof Timestamp t ? t.toLocalDateTime() : null;
    }
}

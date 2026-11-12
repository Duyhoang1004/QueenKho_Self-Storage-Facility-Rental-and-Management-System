package com.queenkho.api.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Map;

/**
 * Xử lý transaction độc lập cho từng hợp đồng quá hạn (UC-28 / PR-Q1).
 * Tách riêng thành một Spring Bean để đảm bảo proxy transaction (REQUIRES_NEW)
 * hoạt động chính xác, tránh hoàn toàn vấn đề self-invocation.
 */
@Component
public class OverdueContractProcessor {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private StaffTaskService staffTaskService;

    @Autowired
    private NotificationService notificationService;

    /**
     * Xử lý chuyển trạng thái cho Hợp đồng ACTIVE hết hạn (end_date < today)
     * Mỗi hợp đồng được chạy trong một Transaction độc lập (REQUIRES_NEW).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean processActiveContract(Integer contractId, String contractCode, LocalDate endDate, Integer systemUserId, LocalDate today) {
        int rows = jdbcTemplate.update(
                // Đợt quá hạn mới → miễn phí trễ của đợt trước (nếu có) không còn hiệu lực
                "UPDATE rental_contracts SET status = 'OVERDUE', late_fee_waived = 0, overstay_fee_waived = 0, late_fee_waiver_note = NULL " +
                        "WHERE id = ? AND status = 'ACTIVE'",
                contractId
        );
        if (rows > 0) {
            String edStr = endDate != null ? endDate.toString() : "";
            logOverdueActivity(contractId, systemUserId, today,
                    "[OVERDUE] Hợp đồng " + contractCode + " chuyển sang QUÁ HẠN (hết hạn ngày " + edStr + ")");
            notifyOverdue(contractId, contractCode,
                    "Hợp đồng đã hết hạn mà chưa gia hạn hoặc hẹn trả kho. Vui lòng gia hạn hoặc hẹn trả kho (trong 3 ngày tới) "
                            + "để tránh phí trễ hạn, phí chiếm dụng và bị cưỡng chế dọn kho theo điều khoản.");
            return true;
        }
        return false;
    }

    /**
     * Hợp đồng TERMINATION_PENDING mà khách KHÔNG tới trả kho theo lịch hẹn (đã qua ngày hẹn và đã qua end_date)
     * → OVERDUE. ContractService chọn hợp đồng theo ngày hẹn (PR-O1 sửa 02/11/2026), không còn cố định end_date + 5.
     * Mỗi hợp đồng được chạy trong một Transaction độc lập (REQUIRES_NEW).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean processTerminationPendingContract(Integer contractId, String contractCode, Integer systemUserId, LocalDate today) {
        int rows = jdbcTemplate.update(
                "UPDATE rental_contracts SET status = 'OVERDUE', late_fee_waived = 0, overstay_fee_waived = 0, late_fee_waiver_note = NULL " +
                        "WHERE id = ? AND status = 'TERMINATION_PENDING'",
                contractId
        );
        if (rows > 0) {
            // Đồng bộ đơn đặt chỗ đưa về UNIT_ASSIGNED (CHỐT-4)
            jdbcTemplate.update(
                    "UPDATE reservations SET status = 'UNIT_ASSIGNED' WHERE id = (SELECT reservation_id FROM rental_contracts WHERE id = ?)",
                    contractId
            );

            // Hủy task CHECK_OUT đang mở của đúng hợp đồng này (PR-Q1)
            staffTaskService.cancelOpenTasks(contractId, "CHECK_OUT");

            logOverdueActivity(contractId, systemUserId, today,
                    "[OVERDUE] Hợp đồng " + contractCode + " không tới trả kho theo lịch hẹn, chuyển sang QUÁ HẠN và hủy task check-out");
            notifyOverdue(contractId, contractCode,
                    "Bạn đã không tới trả kho theo lịch hẹn nên hợp đồng chuyển sang quá hạn. Vui lòng hẹn lại ngày trả kho "
                            + "(trong 3 ngày tới) hoặc gia hạn để tránh phí trễ hạn, phí chiếm dụng và bị cưỡng chế dọn kho theo điều khoản.");
            return true;
        }
        return false;
    }

    // BR-111 / BR-117: khách (thông báo + email) và FM được báo khi hợp đồng chuyển OVERDUE — mỗi đợt quá hạn 1 lần
    private void notifyOverdue(Integer contractId, String contractCode, String customerMessage) {
        if (notificationService == null) return;
        try {
            Map<String, Object> row = jdbcTemplate.queryForMap(
                    "SELECT c.customer_id, c.reservation_id, c.end_date, su.id AS unit_id, su.facility_id, u.full_name " +
                            "FROM rental_contracts c JOIN storage_units su ON su.id = c.storage_unit_id " +
                            "JOIN users u ON u.id = c.customer_id WHERE c.id = ?", contractId);
            String refKey = "OVERDUE:" + contractId + ":" + row.get("end_date");
            Object reservationId = row.get("reservation_id");
            notificationService.notifyCustomer(((Number) row.get("customer_id")).intValue(), refKey,
                    "Hợp đồng " + contractCode + " đã quá hạn", customerMessage, "OVERDUE",
                    reservationId != null ? "/kho-cua-toi/hop-dong/" + reservationId : "/kho-cua-toi");
            notificationService.notifyFacilityManagersOnce(((Number) row.get("facility_id")).intValue(), refKey,
                    "Hợp đồng quá hạn — " + contractCode,
                    "Khách " + row.get("full_name") + " (ô " + row.get("unit_id") + ") chưa trả kho / gia hạn. Liên hệ khách và ghi nhật ký liên hệ.",
                    "OVERDUE", "/manager/overdue");
        } catch (Exception e) {
            System.err.println("[QueenKho Overdue Job] ⚠️ Lỗi gửi thông báo quá hạn HĐ " + contractCode + ": " + e.getMessage());
        }
    }

    /**
     * Ghi nhận nhật ký hoạt động (PR-A8 đến PR-A10, PR-92):
     * - user_id: ID tài khoản system (nếu thiếu thì bỏ qua, không ném lỗi)
     * - action: mã nghiệp vụ trong ngoặc [OVERDUE], có mã hợp đồng, tối đa 500 ký tự
     * - target_entity: 'rental_contracts', target_id: ID hợp đồng
     * - Chống trùng lặp log trong cùng ngày nếu job quét nhiều lần
     * - ⚠️ Lưu ý: T-SQL coi [ ] trong LIKE là tập ký tự, nên dùng LEFT(action, 9) = '[OVERDUE]'
     */
    private void logOverdueActivity(Integer contractId, Integer systemUserId, LocalDate today, String action) {
        if (systemUserId == null) {
            // Thiếu user system thì bỏ qua, không ném lỗi
            return;
        }

        try {
            Integer logCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(1) FROM activity_logs WHERE target_entity = 'rental_contracts' AND target_id = ? " +
                            "AND LEFT(action, 9) = '[OVERDUE]' AND CAST(created_at AS DATE) = ?",
                    Integer.class,
                    String.valueOf(contractId), today
            );
            if (logCount == null || logCount == 0) {
                // Đảm bảo action không vượt quá giới hạn NVARCHAR(500) của cột
                String truncatedAction = action.length() > 500 ? action.substring(0, 500) : action;
                jdbcTemplate.update(
                        "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                                "VALUES (?, ?, 'rental_contracts', ?, SYSDATETIME())",
                        systemUserId, truncatedAction, String.valueOf(contractId)
                );
            }
        } catch (Exception e) {
            System.err.println("[QueenKho Overdue Job] ⚠️ Lỗi khi ghi activity_logs cho HĐ ID " + contractId + ": " + e.getMessage());
        }
    }
}


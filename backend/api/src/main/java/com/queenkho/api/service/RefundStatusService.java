package com.queenkho.api.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * PR-O12: trạng thái hoàn tiền dùng CHUNG cho danh sách "Kho của tôi" và trang chi tiết hợp đồng
 * (trước đây danh sách đọc task REFUND, còn chi tiết coi TERMINATED = đã hoàn → hai màn nói hai kiểu).
 *
 *  - Còn task REFUND mở (OPEN / IN_PROGRESS / OVERDUE)  → PENDING
 *  - Có task REFUND đã COMPLETED                         → COMPLETED
 *  - Không có task: theo giao dịch REFUND mới nhất (SUCCESS → COMPLETED, PENDING → PENDING)
 *  - Còn lại                                             → NONE
 *
 * Task REFUND gắn hợp đồng qua contract_id (trả kho, thanh lý) hoặc ghi mã đơn trong note (huỷ đơn, No-Show, IPN muộn).
 */
@Service
public class RefundStatusService {

    public static final String NONE = "NONE";
    public static final String PENDING = "PENDING";
    public static final String COMPLETED = "COMPLETED";

    private final JdbcTemplate jdbcTemplate;

    public RefundStatusService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public String resolve(Integer reservationId, String reservationCode, Integer contractId) {
        int contractKey = contractId != null ? contractId : -1;
        int reservationKey = reservationId != null ? reservationId : -1;
        // Mã đơn rỗng thì dùng mẫu không bao giờ khớp
        String notePattern = reservationCode != null && !reservationCode.isBlank() ? "%" + reservationCode + "%" : "\u0000";

        Map<String, Object> counts = jdbcTemplate.queryForMap(
                "SELECT " +
                        " SUM(CASE WHEN status IN ('OPEN', 'IN_PROGRESS', 'OVERDUE') THEN 1 ELSE 0 END) AS open_count, " +
                        " SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS done_count " +
                        "FROM facility_tasks WHERE task_type = 'REFUND' AND (contract_id = ? OR note LIKE ?)",
                contractKey, notePattern);
        if (toInt(counts.get("open_count")) > 0) {
            return PENDING;
        }
        if (toInt(counts.get("done_count")) > 0) {
            return COMPLETED;
        }

        List<String> payment = jdbcTemplate.queryForList(
                "SELECT TOP 1 status FROM payment_transactions " +
                        "WHERE payment_type = 'REFUND' AND (reservation_id = ? OR contract_id = ?) ORDER BY id DESC",
                String.class, reservationKey, contractKey);
        if (!payment.isEmpty()) {
            if ("SUCCESS".equalsIgnoreCase(payment.get(0))) return COMPLETED;
            if ("PENDING".equalsIgnoreCase(payment.get(0))) return PENDING;
        }
        return NONE;
    }

    private static int toInt(Object value) {
        return value instanceof Number n ? n.intValue() : 0;
    }
}

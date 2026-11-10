package com.queenkho.api.service;

import com.queenkho.api.dto.RefundEvidenceResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Map;

@Service
public class RefundEvidenceService {
    private final JdbcTemplate jdbcTemplate;

    public RefundEvidenceService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public RefundEvidenceResponse findCompleted(Integer reservationId, String reservationCode, Integer contractId) {
        boolean hasContract = contractId != null && contractId > 0;
        boolean hasReservation = reservationId != null && reservationId > 0;
        boolean hasReservationCode = reservationCode != null && !reservationCode.isBlank();
        if (!hasContract && (!hasReservation || !hasReservationCode)) {
            return null;
        }

        String reservationPattern = hasReservationCode ? "%Đơn: " + reservationCode.trim() + "%" : "\u0000";
        try {
            Map<String, Object> task = jdbcTemplate.queryForMap(
                    "SELECT TOP 1 id, evidence_image_url, note, completed_at " +
                            "FROM facility_tasks WHERE task_type = 'REFUND' AND status = 'COMPLETED' " +
                            "AND (contract_id = ? OR (contract_id IS NULL AND note LIKE ?)) " +
                            "ORDER BY completed_at DESC, id DESC",
                    contractId, reservationPattern);

            Map<String, Object> payment = Map.of();
            try {
                payment = jdbcTemplate.queryForMap(
                        "SELECT TOP 1 transaction_code, bank_transaction_code, payment_method, amount, paid_at " +
                                "FROM payment_transactions WHERE (contract_id = ? OR reservation_id = ?) " +
                                "AND payment_type = 'REFUND' AND status = 'SUCCESS' " +
                                "ORDER BY paid_at DESC, id DESC",
                        contractId, reservationId);
            } catch (Exception ignored) {
                // Một số dữ liệu cũ chỉ lưu xác nhận tại task hoàn tiền.
            }

            LocalDateTime completedAt = toLocalDateTime(task.get("completed_at"));
            if (completedAt == null) {
                completedAt = toLocalDateTime(payment.get("paid_at"));
            }

            return new RefundEvidenceResponse(
                    ((Number) task.get("id")).intValue(),
                    (String) payment.get("payment_method"),
                    (String) payment.get("transaction_code"),
                    (String) payment.get("bank_transaction_code"),
                    (BigDecimal) payment.get("amount"),
                    completedAt,
                    (String) task.get("evidence_image_url"),
                    (String) task.get("note"));
        } catch (Exception ignored) {
            return null;
        }
    }

    private LocalDateTime toLocalDateTime(Object value) {
        if (value instanceof Timestamp timestamp) {
            return timestamp.toLocalDateTime();
        }
        if (value instanceof LocalDateTime localDateTime) {
            return localDateTime;
        }
        return null;
    }
}

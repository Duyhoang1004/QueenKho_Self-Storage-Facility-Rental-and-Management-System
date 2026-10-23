package com.queenkho.api.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReservationCleanupService {

    private final JdbcTemplate jdbcTemplate;

    public ReservationCleanupService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // Chạy mỗi phút 1 lần (60000ms)
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void cancelExpiredReservations() {
        // PR-B6/B7: link VNPAY sống 10 phút, đơn giữ suất thêm 5 phút đệm.
        // Hai cập nhật nằm trong cùng transaction để không còn giao dịch PENDING của đơn EXPIRED.
        jdbcTemplate.update(
                "UPDATE payment_transactions SET status = 'FAILED', paid_at = NULL " +
                "WHERE status = 'PENDING' AND payment_method = 'VNPAY' AND payment_type = 'DEPOSIT' " +
                "AND reservation_id IN (SELECT id FROM reservations " +
                "WHERE status = 'PENDING' AND created_at <= DATEADD(minute, -15, SYSDATETIME()))");

        int rowsUpdated = jdbcTemplate.update(
                "UPDATE reservations SET status = 'EXPIRED' " +
                "WHERE status = 'PENDING' AND created_at <= DATEADD(minute, -15, SYSDATETIME())");
        if (rowsUpdated > 0) {
            System.out.println("[QueenKho Cleanup] Đã hết hạn " + rowsUpdated + " đơn giữ chỗ quá 15 phút.");
        }
    }
}

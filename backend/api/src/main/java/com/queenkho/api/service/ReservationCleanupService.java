package com.queenkho.api.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class ReservationCleanupService {

    private final JdbcTemplate jdbcTemplate;

    public ReservationCleanupService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // Chạy mỗi phút 1 lần (60000ms)
    @Scheduled(fixedRate = 60000)
    public void expirePendingReservations() {
        // PR-B6 & PR-B7: Đơn PENDING giữ suất 15 phút (link VNPAY 10 phút + 5 phút đệm).
        // Hết hạn -> đơn chuyển sang 'EXPIRED', giao dịch PENDING chuyển sang 'FAILED'. (sửa L-08)
        String findExpiredSql = "SELECT id FROM reservations WHERE status = 'PENDING' AND created_at <= DATEADD(minute, -15, SYSDATETIME())";
        try {
            java.util.List<Integer> expiredIds = jdbcTemplate.queryForList(findExpiredSql, Integer.class);
            if (!expiredIds.isEmpty()) {
                for (Integer id : expiredIds) {
                    jdbcTemplate.update("UPDATE reservations SET status = 'EXPIRED' WHERE id = ?", id);
                    jdbcTemplate.update("UPDATE payment_transactions SET status = 'FAILED' WHERE reservation_id = ? AND status = 'PENDING'", id);
                }
                System.out.println("[QueenKho Cleanup] Da chuyen sang EXPIRED va huy giao dich PENDING cho " + expiredIds.size() + " don dat cho het han 15 phut.");
            }
        } catch (Exception e) {
            System.err.println("[QueenKho Cleanup] Loi khi quet don het han: " + e.getMessage());
        }
    }
}

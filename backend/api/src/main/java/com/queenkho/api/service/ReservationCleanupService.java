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
    public void cancelExpiredReservations() {
        // Tìm các đơn PENDING (chưa đóng cọc) mà thời gian tạo đã quá 10 phút và chuyển thành CANCELLED
        String sql = "UPDATE reservations SET status = 'CANCELLED' " +
                     "WHERE status = 'PENDING' AND created_at <= DATEADD(minute, -1, GETDATE())";
        
        int rowsUpdated = jdbcTemplate.update(sql);
        if (rowsUpdated > 0) {
            System.out.println("[QueenKho Cleanup] Da huy tu dong " + rowsUpdated + " don dat cho het han giu cho (qua 10 phut).");
        }
    }
}

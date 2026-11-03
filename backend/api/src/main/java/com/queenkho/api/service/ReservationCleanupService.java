package com.queenkho.api.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
public class ReservationCleanupService {

    private final JdbcTemplate jdbcTemplate;
    private final NotificationService notificationService;

    public ReservationCleanupService(JdbcTemplate jdbcTemplate, NotificationService notificationService) {
        this.jdbcTemplate = jdbcTemplate;
        this.notificationService = notificationService;
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

        // OUTPUT trả đúng các đơn vừa chuyển EXPIRED để báo cho khách
        List<Map<String, Object>> expired = jdbcTemplate.queryForList(
                "UPDATE reservations SET status = 'EXPIRED' " +
                "OUTPUT inserted.customer_id, inserted.reservation_code " +
                "WHERE status = 'PENDING' AND created_at <= DATEADD(minute, -15, SYSDATETIME())");
        if (!expired.isEmpty()) {
            System.out.println("[QueenKho Cleanup] Đã hết hạn " + expired.size() + " đơn giữ chỗ quá 15 phút.");
        }

        // BR-117: báo khách đơn hết hạn giữ chỗ (chuông + email)
        for (Map<String, Object> row : expired) {
            if (row.get("customer_id") == null) continue;
            String code = String.valueOf(row.get("reservation_code"));
            notificationService.notifyCustomer(
                    ((Number) row.get("customer_id")).intValue(),
                    "Đơn " + code + " đã hết hạn giữ chỗ",
                    "Đơn đặt chỗ " + code + " chưa được thanh toán cọc trong 15 phút nên đã tự huỷ, ô kho được trả lại cho khách khác. "
                            + "Nếu vẫn cần thuê, bạn có thể đặt lại đơn mới.",
                    "BOOKING",
                    "/tim-va-dat-kho");
        }
    }
}

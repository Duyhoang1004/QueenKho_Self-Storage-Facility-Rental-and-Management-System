package com.queenkho.api.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

/**
 * PR-R9 (BR-118): nhắc gia hạn hợp đồng ACTIVE sắp hết hạn — thông báo trong chuông + email.
 *  - Mốc nhắc: còn 7, 3, 1 ngày. Mỗi mốc gửi 1 lần (refKey RENEWAL:{hợp đồng}:{end_date}:{mốc}); gia hạn xong
 *    end_date đổi → kỳ mới nhắc lại từ đầu.
 *  - Lỡ ngày chạy job (server tắt) vẫn nhắc ở lần chạy sau: còn 5 ngày → gửi mốc 7, còn 2 ngày → gửi mốc 3.
 *  - Hợp đồng đã hẹn trả kho (TERMINATION_PENDING) không nhắc.
 */
@Service
public class RenewalReminderService {

    public static final List<Integer> REMIND_DAYS = List.of(1, 3, 7);
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final JdbcTemplate jdbcTemplate;
    private final NotificationService notificationService;

    public RenewalReminderService(JdbcTemplate jdbcTemplate, NotificationService notificationService) {
        this.jdbcTemplate = jdbcTemplate;
        this.notificationService = notificationService;
    }

    @Scheduled(cron = "0 0 8 * * *", zone = "Asia/Ho_Chi_Minh")
    public void scheduledRun() {
        int sent = remindAll();
        if (sent > 0) {
            System.out.println("[QueenKho Renewal] Đã gửi " + sent + " nhắc gia hạn.");
        }
    }

    /** Quét toàn bộ hợp đồng ACTIVE còn ≤ 7 ngày. Trả số nhắc mới gửi. */
    @Transactional
    public int remindAll() {
        LocalDate today = LocalDate.now(LateFeeService.VIETNAM_ZONE);
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                CONTRACT_SQL + "WHERE c.status = 'ACTIVE' AND c.end_date BETWEEN ? AND ?",
                today, today.plusDays(REMIND_DAYS.get(REMIND_DAYS.size() - 1)));
        int sent = 0;
        for (Map<String, Object> row : rows) {
            if (remind(row, today)) sent++;
        }
        return sent;
    }

    /** Nhắc 1 hợp đồng (dùng cho nút giả lập). Trả true nếu vừa gửi nhắc mới. */
    @Transactional
    public boolean remindContract(Integer contractId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                CONTRACT_SQL + "WHERE c.id = ? AND c.status = 'ACTIVE'", contractId);
        return !rows.isEmpty() && remind(rows.get(0), LocalDate.now(LateFeeService.VIETNAM_ZONE));
    }

    private static final String CONTRACT_SQL =
            "SELECT c.id, c.contract_code, c.end_date, c.customer_id, c.reservation_id, c.storage_unit_id " +
                    "FROM rental_contracts c ";

    private boolean remind(Map<String, Object> row, LocalDate today) {
        LocalDate endDate = ((java.sql.Date) row.get("end_date")).toLocalDate();
        long daysLeft = ChronoUnit.DAYS.between(today, endDate);
        Integer milestone = milestoneFor(daysLeft);
        if (milestone == null) return false;

        Integer contractId = ((Number) row.get("id")).intValue();
        String code = String.valueOf(row.get("contract_code"));
        LocalDate deadline = RenewalPolicyService.priorityDeadline(endDate);
        boolean pastDeadline = today.isAfter(deadline);
        String message = "Hợp đồng " + code + " (ô " + row.get("storage_unit_id") + ") hết hạn ngày " + endDate.format(DATE_FMT)
                + (daysLeft == 0 ? " (hôm nay)" : " (còn " + daysLeft + " ngày)") + ". "
                + (pastDeadline
                    ? "Đã qua hạn chót gia hạn ưu tiên " + deadline.format(DATE_FMT)
                        + " — ô có thể đã được khách khác đặt trước. Hãy gia hạn ngay (nếu ô còn) hoặc hẹn ngày trả kho."
                    : "Gia hạn trước ngày " + deadline.format(DATE_FMT)
                        + " để chắc chắn giữ ô; sau mốc này ô có thể được nhận đặt trước cho khách khác.");
        Object reservationId = row.get("reservation_id");
        String refKey = "RENEWAL:" + contractId + ":" + endDate + ":" + milestone;
        return notificationService.notifyCustomer(((Number) row.get("customer_id")).intValue(), refKey,
                "Nhắc gia hạn hợp đồng " + code, message, "RENEWAL",
                reservationId != null ? "/kho-cua-toi/hop-dong/" + reservationId : "/kho-cua-toi") != null;
    }

    /** Mốc nhắc nhỏ nhất ≥ số ngày còn lại (còn 5 ngày → mốc 7). Còn > 7 ngày hoặc đã hết hạn → null. */
    static Integer milestoneFor(long daysLeft) {
        if (daysLeft < 0) return null;
        for (Integer d : REMIND_DAYS) {
            if (daysLeft <= d) return d;
        }
        return null;
    }
}

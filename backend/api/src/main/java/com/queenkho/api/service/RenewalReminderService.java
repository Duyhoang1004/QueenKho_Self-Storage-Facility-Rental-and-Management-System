package com.queenkho.api.service;

import com.queenkho.api.dto.LateFeeCalculationResult;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.repository.RentalContractRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

/**
 * PR-R9 (BR-118): nhắc gia hạn hợp đồng ACTIVE sắp hết hạn — thông báo trong chuông + email.
 *  - Mốc nhắc: còn 15, 10, 7, 3, 1 ngày (sửa 05/11/2026). Mỗi mốc gửi 1 lần (refKey RENEWAL:{hợp đồng}:{end_date}:{mốc}); gia hạn xong
 *    end_date đổi → kỳ mới nhắc lại từ đầu.
 *  - Lỡ ngày chạy job (server tắt) vẫn nhắc ở lần chạy sau: còn 5 ngày → gửi mốc 7, còn 2 ngày → gửi mốc 3.
 *  - Hợp đồng đã hẹn trả kho (TERMINATION_PENDING) không nhắc.
 * BR-117: cùng job cảnh báo hợp đồng OVERDUE sắp tới mốc thanh lý — còn ≤ 3 ngày (LIQUIDATION_WARN) và khi đã
 *  đủ ngày để quản lý được phép thanh lý (LIQUIDATION_DUE). Mỗi loại gửi 1 lần cho mỗi kỳ end_date.
 */
@Service
public class RenewalReminderService {

    // Họp nhóm 05/11/2026: nhắc sớm hơn — còn 15 / 10 / 7 / 3 / 1 ngày
    public static final List<Integer> REMIND_DAYS = List.of(1, 3, 7, 10, 15);
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public static final int LIQUIDATION_WARN_DAYS = 3;

    private final JdbcTemplate jdbcTemplate;
    private final NotificationService notificationService;
    private final RentalContractRepository contractRepository;
    private final LateFeeService lateFeeService;

    public RenewalReminderService(JdbcTemplate jdbcTemplate, NotificationService notificationService,
                                  RentalContractRepository contractRepository, LateFeeService lateFeeService) {
        this.jdbcTemplate = jdbcTemplate;
        this.notificationService = notificationService;
        this.contractRepository = contractRepository;
        this.lateFeeService = lateFeeService;
    }

    @Scheduled(cron = "0 0 8 * * *", zone = "Asia/Ho_Chi_Minh")
    public void scheduledRun() {
        int sent = remindAll();
        if (sent > 0) {
            System.out.println("[QueenKho Renewal] Đã gửi " + sent + " nhắc gia hạn.");
        }
        int warned = warnLiquidationAll();
        if (warned > 0) {
            System.out.println("[QueenKho Renewal] Đã gửi " + warned + " cảnh báo cưỡng chế dọn kho.");
        }
    }

    /** Quét hợp đồng OVERDUE, cảnh báo khách trước / khi tới mốc cưỡng chế dọn kho. Trả số cảnh báo mới gửi. */
    @Transactional
    public int warnLiquidationAll() {
        LocalDate today = LocalDate.now(LateFeeService.VIETNAM_ZONE);
        List<Integer> ids = jdbcTemplate.queryForList(
                "SELECT id FROM rental_contracts WHERE status = 'OVERDUE'", Integer.class);
        int sent = 0;
        for (Integer id : ids) {
            RentalContract contract = contractRepository.findById(id).orElse(null);
            if (contract != null && warnLiquidation(contract, today)) sent++;
        }
        return sent;
    }

    /** Cảnh báo cưỡng chế dọn kho cho 1 hợp đồng OVERDUE (dùng cho nút giả lập quá hạn). Trả true nếu vừa gửi cảnh báo mới. */
    @Transactional
    public boolean warnLiquidationContract(Integer contractId) {
        return contractRepository.findById(contractId)
                .filter(c -> "OVERDUE".equals(c.getStatus()))
                .map(c -> warnLiquidation(c, LocalDate.now(LateFeeService.VIETNAM_ZONE)))
                .orElse(false);
    }

    private boolean warnLiquidation(RentalContract contract, LocalDate today) {
        if (contract.getEndDate() == null || contract.getCustomer() == null) return false;
        LateFeeCalculationResult late = lateFeeService.calculateLateFee(contract, today);
        // Quản lý được cưỡng chế dọn kho khi quá hạn > liquidationDays ngày (LateFeeService.canLiquidate)
        LocalDate liquidableFrom = contract.getEndDate().plusDays(late.getLiquidationDaysThreshold() + 1L);
        long daysLeft = ChronoUnit.DAYS.between(today, liquidableFrom);
        if (daysLeft > LIQUIDATION_WARN_DAYS) return false;

        boolean due = daysLeft <= 0;
        String code = contract.getContractCode();
        BigDecimal owed = (Boolean.TRUE.equals(contract.getLateFeeWaived()) ? BigDecimal.ZERO : nz(late.getLateFeeAmount()))
                .add(nz(late.getOverstayFeeAmount()));
        String message = "Hợp đồng " + code + " đã quá hạn " + late.getOverdueDays() + " ngày"
                + (owed.signum() > 0 ? ", phí trễ và phí chiếm dụng hiện tại " + vnd(owed) + "đ" : "") + ". "
                + (due
                    ? "Hợp đồng đã tới mốc cưỡng chế dọn kho theo điều khoản: quản lý cơ sở có thể cưỡng chế dọn kho bất cứ lúc nào, hàng còn trong ô "
                        + "sẽ được kiểm kê và lưu giữ tại kho tổng (có tính phí lưu giữ). "
                    : "Từ ngày " + liquidableFrom.format(DATE_FMT) + " hợp đồng có thể bị cưỡng chế dọn kho theo điều khoản bạn đã đồng ý. ")
                + "Vui lòng gia hạn hoặc hẹn trả kho ngay để tránh bị cưỡng chế dọn kho.";
        String refKey = (due ? "LIQUIDATION_DUE:" : "LIQUIDATION_WARN:") + contract.getId() + ":" + contract.getEndDate();
        Integer reservationId = contract.getReservation() != null ? contract.getReservation().getId() : null;
        return notificationService.notifyCustomer(contract.getCustomer().getId(), refKey,
                due ? "Hợp đồng " + code + " đã tới mốc cưỡng chế dọn kho" : "Cảnh báo sắp cưỡng chế dọn kho hợp đồng " + code,
                message, "OVERDUE",
                reservationId != null ? "/kho-cua-toi/hop-dong/" + reservationId : "/kho-cua-toi") != null;
    }

    private static BigDecimal nz(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private static String vnd(BigDecimal value) {
        return String.format("%,d", value.setScale(0, RoundingMode.HALF_UP).longValue()).replace(',', '.');
    }

    /** Quét toàn bộ hợp đồng ACTIVE còn ≤ 15 ngày. Trả số nhắc mới gửi. */
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
            "SELECT c.id, c.contract_code, c.end_date, c.customer_id, c.reservation_id, c.storage_unit_id, " +
                    "(SELECT r.terms_version FROM reservations r WHERE r.id = c.reservation_id) AS terms_version " +
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
                        + " để chắc chắn giữ ô; sau mốc này ô có thể được nhận đặt trước cho khách khác.")
                // D-15: điều khoản v4 — hết hạn là chuyển hàng vào kho tổng ngay, không còn ân hạn
                + (LateFeeService.acceptsCentralStorageTerms((String) row.get("terms_version"))
                    ? " Hết ngày " + endDate.format(DATE_FMT) + " mà chưa gia hạn hoặc trả kho, hôm sau QueenKho mở ô, kiểm kê và"
                        + " chuyển hàng vào kho tổng (có phí di dời + phí lưu giữ theo ngày)."
                    : "");
        Object reservationId = row.get("reservation_id");
        String refKey = "RENEWAL:" + contractId + ":" + endDate + ":" + milestone;
        return notificationService.notifyCustomer(((Number) row.get("customer_id")).intValue(), refKey,
                "Nhắc gia hạn hợp đồng " + code, message, "RENEWAL",
                reservationId != null ? "/kho-cua-toi/hop-dong/" + reservationId : "/kho-cua-toi") != null;
    }

    /** Mốc nhắc nhỏ nhất ≥ số ngày còn lại (còn 5 ngày → mốc 7). Còn > 15 ngày hoặc đã hết hạn → null. */
    static Integer milestoneFor(long daysLeft) {
        if (daysLeft < 0) return null;
        for (Integer d : REMIND_DAYS) {
            if (daysLeft <= d) return d;
        }
        return null;
    }
}

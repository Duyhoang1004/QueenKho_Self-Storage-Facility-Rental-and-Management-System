package com.queenkho.api.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Job tự động quét hợp đồng quá hạn (UC-28 / PR-Q1)
 * - Chạy định kỳ lúc 00:05 mỗi ngày (múi giờ Asia/Ho_Chi_Minh)
 * - Chạy bù tự động 1 lần khi hệ thống khởi động (ApplicationReadyEvent)
 */
@Component
public class ContractOverdueJob {

    @Autowired
    private ContractService contractService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * Chạy bù 1 lần ngay khi server khởi động xong (ApplicationReadyEvent)
     */
    @EventListener(ApplicationReadyEvent.class)
    public void runOnStartup() {
        try {
            System.out.println("[QueenKho Overdue Job] 🚀 Chạy bù quét hợp đồng quá hạn khi khởi động ứng dụng...");
            executeOverdueCheck();
        } catch (Exception e) {
            System.err.println("[QueenKho Overdue Job] ⚠️ Lỗi khi chạy bù quét hợp đồng quá hạn lúc khởi động: " + e.getMessage());
        }
    }

    /**
     * Chạy định kỳ 00:05 mỗi ngày theo múi giờ Việt Nam (PR-Q1)
     */
    @Scheduled(cron = "0 5 0 * * *", zone = "Asia/Ho_Chi_Minh")
    public void scheduleDailyOverdueCheck() {
        System.out.println("[QueenKho Overdue Job] ⏰ Bắt đầu quét hợp đồng quá hạn định kỳ (00:05)...");
        executeOverdueCheck();
    }

    /**
     * Thực thi logic quét và ghi log kết quả
     */
    public int executeOverdueCheck() {
        int updated = contractService.markOverdueContracts();
        if (updated > 0) {
            System.out.println("[QueenKho Overdue Job] ✅ Đã chuyển " + updated + " hợp đồng quá hạn sang OVERDUE.");
        } else {
            System.out.println("[QueenKho Overdue Job] ℹ️ Không có hợp đồng nào cần chuyển sang OVERDUE.");
        }
        int relocated = relocateToCentralWarehouse(null);
        if (relocated > 0) {
            System.out.println("[QueenKho Overdue Job] 📦 Đã thanh lý " + relocated + " hợp đồng điều khoản v4, chờ chuyển hàng vào kho tổng.");
        }
        return updated;
    }

    /**
     * D-15 (05/11/2026): hợp đồng OVERDUE của khách đồng ý điều khoản v4 → thanh lý ngay, sinh việc chuyển hàng vào kho tổng.
     * Mỗi hợp đồng 1 transaction riêng (gọi qua proxy của ContractService). contractId != null = chỉ xử lý 1 hợp đồng (giả lập).
     */
    public int relocateToCentralWarehouse(Integer contractId) {
        List<Integer> systemIds = jdbcTemplate.queryForList("SELECT id FROM users WHERE email = ?", Integer.class,
                ActivityLogService.SYSTEM_EMAIL);
        if (systemIds.isEmpty()) {
            System.err.println("[QueenKho Overdue Job] ⚠️ Thiếu tài khoản system, bỏ qua chuyển kho tổng");
            return 0;
        }
        List<Integer> ids = jdbcTemplate.queryForList(
                "SELECT c.id FROM rental_contracts c JOIN reservations r ON r.id = c.reservation_id " +
                        "WHERE c.status = 'OVERDUE' AND r.terms_version >= ? AND (? IS NULL OR c.id = ?)",
                Integer.class, LateFeeService.CENTRAL_STORAGE_TERMS_VERSION, contractId, contractId);
        int done = 0;
        for (Integer id : ids) {
            try {
                if (contractService.autoRelocateToCentralWarehouse(id, systemIds.get(0))) done++;
            } catch (Exception e) {
                System.err.println("[QueenKho Overdue Job] ❌ Lỗi chuyển kho tổng HĐ " + id + ": " + e.getMessage());
            }
        }
        return done;
    }
}

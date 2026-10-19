package com.queenkho.api.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Job tự động quét hợp đồng quá hạn (UC-28 / PR-Q1)
 * - Chạy định kỳ lúc 00:05 mỗi ngày (múi giờ Asia/Ho_Chi_Minh)
 * - Chạy bù tự động 1 lần khi hệ thống khởi động (ApplicationReadyEvent)
 */
@Component
public class ContractOverdueJob {

    @Autowired
    private ContractService contractService;

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
        return updated;
    }
}

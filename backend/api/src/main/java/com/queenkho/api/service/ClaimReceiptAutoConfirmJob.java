package com.queenkho.api.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Job chạy định kỳ mỗi phút tự động xác nhận hồ sơ bồi thường đã chi trả quá 3 ngày
 * mà khách không phản hồi chưa nhận tiền (Idea 1 — tương tự RefundReceiptService).
 */
@Component
public class ClaimReceiptAutoConfirmJob {

    @Autowired
    private ClaimConfirmationService claimConfirmationService;

    @Scheduled(fixedRate = 60000)
    public void autoConfirmDueClaimReceipts() {
        try {
            int count = claimConfirmationService.autoConfirmDueReceipts();
            if (count > 0) {
                System.out.println("[QueenKho Claim] Da tu xac nhan " + count + " ho so boi thuong qua 3 ngay.");
            }
        } catch (Exception e) {
            System.err.println("[QueenKho Claim] Warning auto-confirming claim receipts: " + e.getMessage());
        }
    }
}

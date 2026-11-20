package com.queenkho.api.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// UC-16: mỗi phút quét task OPEN / IN_PROGRESS đã quá hạn → OVERDUE
// UC-26 / PR-52: quét các ticket RESOLVED đã quá 3 ngày khách không phản hồi → tự động CLOSED
@Component
public class StaffTaskOverdueJob {

    @Autowired
    private StaffTaskService staffTaskService;

    @Autowired
    private SupportRequestService supportRequestService;

    @Autowired
    private CheckoutSettlementService settlementService;

    @Autowired
    private RefundReceiptService refundReceiptService;

    @Scheduled(fixedRate = 60000)
    public void markOverdue() {
        int updated = staffTaskService.markOverdueTasks();
        if (updated > 0) {
            System.out.println("[QueenKho Task] Da chuyen " + updated + " task sang OVERDUE.");
        }

        try {
            int autoClosed = supportRequestService.autoCloseResolvedTickets();
            if (autoClosed > 0) {
                System.out.println("[QueenKho Support] Da tu dong dong " + autoClosed + " ticket RESOLVED qua 3 ngay.");
            }
        } catch (Exception e) {
            System.err.println("[QueenKho Support] Warning auto-closing resolved tickets: " + e.getMessage());
        }

        // D-21 / PR-O23: quyết toán trả kho dương, khách không xác nhận quá 3 ngày → tự xác nhận
        try {
            int confirmed = settlementService.autoConfirmDue();
            if (confirmed > 0) {
                System.out.println("[QueenKho Settlement] Da tu xac nhan " + confirmed + " quyet toan tra kho qua 3 ngay.");
            }
        } catch (Exception e) {
            System.err.println("[QueenKho Settlement] Warning auto-confirming settlements: " + e.getMessage());
        }

        // D-22 / PR-O27: khoản hoàn chuyển khoản khách không phản hồi quá 3 ngày → tự xác nhận đã nhận
        try {
            int receipts = refundReceiptService.autoConfirmDue();
            if (receipts > 0) {
                System.out.println("[QueenKho Refund] Da tu xac nhan " + receipts + " khoan hoan tien qua 3 ngay.");
            }
        } catch (Exception e) {
            System.err.println("[QueenKho Refund] Warning auto-confirming refund receipts: " + e.getMessage());
        }
    }
}

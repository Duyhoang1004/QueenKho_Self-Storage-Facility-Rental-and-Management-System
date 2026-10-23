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
    }
}

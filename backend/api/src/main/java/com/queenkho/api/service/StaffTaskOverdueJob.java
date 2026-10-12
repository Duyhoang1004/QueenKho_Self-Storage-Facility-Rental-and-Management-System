package com.queenkho.api.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// UC-16: mỗi phút quét task OPEN / IN_PROGRESS đã quá hạn → OVERDUE
@Component
public class StaffTaskOverdueJob {

    @Autowired
    private StaffTaskService staffTaskService;

    @Scheduled(fixedRate = 60000)
    public void markOverdue() {
        int updated = staffTaskService.markOverdueTasks();
        if (updated > 0) {
            System.out.println("[QueenKho Task] Da chuyen " + updated + " task sang OVERDUE.");
        }
    }
}

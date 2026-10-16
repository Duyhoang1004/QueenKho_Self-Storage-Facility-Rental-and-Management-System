package com.queenkho.api.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// Tự động quét các hợp đồng ACTIVE đã quá ngày kết thúc -> chuyển sang OVERDUE
@Component
public class ContractOverdueJob {

    @Autowired
    private ContractService contractService;

    // Chạy mỗi phút để đồng bộ trạng thái quá hạn
    @Scheduled(fixedRate = 60000)
    public void markOverdueContracts() {
        int updated = contractService.markOverdueContracts();
        if (updated > 0) {
            System.out.println("[QueenKho Contract] Da chuyen " + updated + " hop dong het han sang OVERDUE.");
        }
    }
}


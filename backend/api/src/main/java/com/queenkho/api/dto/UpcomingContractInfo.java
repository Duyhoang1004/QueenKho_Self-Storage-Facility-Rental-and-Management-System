package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

// D-18: hợp đồng đã gán trước trên 1 ô (khách nhận kho ngày sau) — FM cần đổi ô cho họ khi ô vào bảo trì
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpcomingContractInfo {
    private Integer contractId;
    private String contractCode;
    private Integer reservationId;
    private String reservationCode;
    private String customerName;
    private String status;
    private LocalDate startDate;
    private LocalDate endDate;
}

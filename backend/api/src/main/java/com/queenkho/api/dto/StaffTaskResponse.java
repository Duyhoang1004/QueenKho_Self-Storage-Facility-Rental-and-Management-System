package com.queenkho.api.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

// UC-16: 1 thẻ công việc trên bảng công việc
@Getter
@Builder
public class StaffTaskResponse {
    private Integer id;
    private String taskType;        // CHECK_IN / CHECK_OUT
    private String status;          // OPEN / IN_PROGRESS / OVERDUE / COMPLETED / CANCELLED
    private LocalDateTime dueAt;
    private LocalDateTime createdAt;
    private LocalDateTime claimedAt;
    private LocalDateTime completedAt;
    private String note;

    // Người đã nhận (null nếu chưa ai nhận)
    private Integer staffId;
    private String staffName;

    // Hợp đồng + khách + ô kho
    private Integer contractId;
    private String contractCode;
    private String contractStatus;
    private String customerName;
    private String customerPhone;
    private String storageUnitId;
    private String unitTypeName;
}

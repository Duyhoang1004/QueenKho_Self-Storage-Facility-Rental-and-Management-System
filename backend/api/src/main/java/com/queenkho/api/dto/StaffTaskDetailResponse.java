package com.queenkho.api.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;
import java.time.LocalDateTime;

// UC-18: chi tiết 1 task (trang /staff/tasks/:id).
// Tách riêng với StaffTaskResponse để API bảng công việc không phải mang thêm PIN, biên bản...
@Getter
@Builder
public class StaffTaskDetailResponse {
    private Integer id;
    private String taskType;
    private String status;
    private LocalDateTime dueAt;
    private LocalDateTime createdAt;
    private LocalDateTime claimedAt;
    private LocalDateTime completedAt;
    private String note;

    private Integer staffId;
    private String staffName;

    // Hợp đồng
    private Integer contractId;
    private String contractCode;
    private String contractStatus;
    private LocalDate contractStartDate;
    private LocalDate contractEndDate;
    private String accessPinCode;
    private String rfidCardCode;

    // Khách
    private String customerName;
    private String customerPhone;
    private String customerEmail;

    // Ô kho
    private String storageUnitId;
    private String unitTypeName;
    private String facilityName;

    // null nếu chưa lập biên bản
    private HandoverRecordResponse handoverRecord;
}

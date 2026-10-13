package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StaffTaskResponse {
    // 1. Thông tin cơ bản của Task
    private Integer id;
    private Integer facilityId;
    private String taskType;             // CHECK_IN, CHECK_OUT, SUPPORT, REFUND
    private String status;               // OPEN, IN_PROGRESS, OVERDUE, COMPLETED, CANCELLED
    private LocalDateTime dueAt;         // Hạn chót hoàn thành (Deadline 24h)
    private LocalDateTime createdAt;
    private LocalDateTime claimedAt;     // Thời điểm nhân viên nhận việc
    private LocalDateTime completedAt;   // Thời điểm hoàn thành
    private String note;                 // Chi tiết STK, số tiền hoàn, lý do hủy...
    private String evidenceImageUrl;     // Link ảnh bill chuyển khoản bằng chứng

    // 2. Thông tin Nhân viên được giao / nhận việc (nếu có)
    private Integer staffId;
    private String staffName;

    // 3. Thông tin Hợp đồng liên quan (nếu là task CHECK_IN / CHECK_OUT)
    private Integer contractId;
    private String contractCode;
    private String contractStatus;

    // 4. Thông tin Khách hàng & Ô kho
    private String customerName;
    private String customerPhone;
    private String storageUnitId;
    private String unitTypeName;
}
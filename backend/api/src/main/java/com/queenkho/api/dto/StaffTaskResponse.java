package com.queenkho.api.dto;

import java.math.BigDecimal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
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
    private LocalDateTime dueAt;         // Hạn chót hoàn thành (Deadline 21:00 / 24h)
    private LocalDateTime assignableFrom; // PR-T1: CHECK_IN / CHECK_OUT chỉ giao / nhận từ mốc này (ngày hẹn − 30 ngày); null = không giới hạn
    private LocalDateTime createdAt;
    private LocalDateTime claimedAt;     // Thời điểm nhân viên nhận việc
    private LocalDateTime completedAt;   // Thời điểm hoàn thành
    private String note;                 // Chi tiết STK, số tiền hoàn, lý do hủy...
    private String evidenceImageUrl;     // Link ảnh bill chuyển khoản bằng chứng
    // D-22 / PR-O25: khách xác nhận đã nhận tiền hoàn (task REFUND)
    private String receiptStatus;
    private String receiptDisputeReason;
    private Integer receiptRound;
    private BigDecimal refundAmount;

    // 2. Thông tin Nhân viên được giao / nhận việc (nếu có)
    private Integer staffId;
    private String staffName;

    // 3. Thông tin Hợp đồng liên quan (nếu là task CHECK_IN / CHECK_OUT / SUPPORT)
    private Integer contractId;
    private String contractCode;
    private String contractStatus;
    private boolean checkInNeedsManager; // báo cáo bàn giao đang chờ FM ngay trên bảng công việc
    private String checkInEscalationStatus; // CI_BLOCKER / CI_FAULT

    // 4. Thông tin Khách hàng & Ô kho
    private String customerName;
    private String customerPhone;
    private String storageUnitId;
    private String unitTypeName;

    // 5. Thông tin Ticket Hỗ trợ (UC-26/27: khi taskType = SUPPORT)
    private Integer supportRequestId;
    private String ticketCode;
    private String issueType;
    private String subCategory;
    private boolean urgent;
    private String ticketStatus;
    private String ticketDescription;
    private String resolutionNote;
    private String cancelReason;     // PR-T2: lý do task bị huỷ (khách huỷ đơn / huỷ yêu cầu)
    private String maintenanceReason; // DAMAGE / LIQUIDATION / CHECKIN_REPAIR / CHECKIN_FAULT
    private LocalDate simulatedCheckoutDate; // PR-O31a: ngày hẹn gốc khi demo "khách tới đúng ngày hẹn"
}

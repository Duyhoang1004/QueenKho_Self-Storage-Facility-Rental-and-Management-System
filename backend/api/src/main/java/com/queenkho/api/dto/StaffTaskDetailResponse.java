package com.queenkho.api.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

// UC-18, UC-23, UC-24, UC-27: chi tiết 1 task (trang /staff/tasks/:id).
// Tách riêng với StaffTaskResponse để API bảng công việc không phải mang thêm PIN, biên bản, sự cố...
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
    private Integer facilityId;
    private String evidenceImageUrl;
    private String note;

    private Integer staffId;
    private String staffName;

    // Hợp đồng / Đơn đặt chỗ
    private Integer contractId;
    private String contractCode;
    private String reservationCode;
    private Integer reservationId;   // Demo: nút giả lập No-Show cần id đơn
    private String contractStatus;
    private LocalDate contractStartDate;
    private LocalDate contractEndDate;
    private BigDecimal depositHeldAmount;
    private String accessPinCode;
    private String rfidCardCode;

    // Khách
    private String customerName;
    private String customerPhone;
    private String customerEmail;
    private String customerCccd;

    // Ô kho
    private String storageUnitId;
    private String storageUnitStatus;
    private String unitTypeName;
    private String facilityName;

    // null nếu chưa lập biên bản
    private HandoverRecordResponse handoverRecord;

    // UC-24: Danh sách sự cố hư hỏng & quyết toán cọc khi trả kho
    private List<DamageCaseResponse> damageCases;
    private BigDecimal totalDamageCost;
    private BigDecimal refundAmount;
    private BigDecimal excessDebtAmount;

    // Chi tiết quyết toán hoàn tiền (PR-O2, PR-O11, PR-O14, PR-Q3)
    private BigDecimal depositRefund;
    private BigDecimal earlyRentRefund;
    private BigDecimal rentPaid;
    private BigDecimal breakFee;
    private BigDecimal graceFee;
    private BigDecimal lateFee;
    private Integer usedMonths;
    private Integer cycleMonths;
    private BigDecimal baseMonthlyPrice;
    private String refundBreakdownNote;

    // UC-26 & UC-27: Thông tin Ticket Hỗ trợ (khi taskType = SUPPORT)
    private Integer supportRequestId;
    private String ticketCode;
    private String issueType;
    private boolean urgent;
    private String ticketStatus;
    private String ticketDescription;
    private String resolutionNote;
    private LocalDateTime ticketCreatedAt;
    private LocalDateTime ticketResolvedAt;
    private LocalDateTime ticketClosedAt;
}

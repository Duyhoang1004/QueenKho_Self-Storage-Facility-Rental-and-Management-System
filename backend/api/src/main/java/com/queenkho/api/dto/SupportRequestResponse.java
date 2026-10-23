package com.queenkho.api.dto;

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
public class SupportRequestResponse {
    private Integer id;
    private String ticketCode;
    private String issueType;
    private boolean urgent;
    private String description;
    private String status; // OPEN / IN_PROGRESS / RESOLVED / CLOSED
    private String resolutionNote;
    private LocalDateTime createdAt;
    private LocalDateTime resolvedAt;
    private LocalDateTime closedAt;

    // Contract & Unit info
    private Integer contractId;
    private String contractCode;
    private String contractStatus;
    private LocalDate contractStartDate;
    private LocalDate contractEndDate;
    private String storageUnitId;
    private String unitTypeName;
    private Integer facilityId;
    private String facilityName;

    // Customer info
    private Integer customerId;
    private String customerName;
    private String customerPhone;

    // Linked task info (if any)
    private Integer latestTaskId;
    private String latestTaskStatus;
    private LocalDateTime latestTaskDueAt;
    private Integer assignedStaffId;
    private String assignedStaffName;
}

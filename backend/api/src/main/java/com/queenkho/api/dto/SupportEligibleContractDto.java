package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupportEligibleContractDto {
    private Integer contractId;
    private String contractCode;
    private String status; // ACTIVE, OVERDUE, TERMINATION_PENDING
    private LocalDate startDate;
    private LocalDate endDate;
    private String storageUnitId;
    private String unitTypeName;
    private Integer facilityId;
    private String facilityName;
    private int openTicketCount;
    private List<String> openIssueTypes;
}

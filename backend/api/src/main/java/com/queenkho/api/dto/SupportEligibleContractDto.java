package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
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

    // BR-125 / BR-127: thông tin bảo hiểm & trần bồi thường tối đa để cảnh báo khi khách tạo claim
    private String insurancePlan;
    private String insurancePlanLabel;
    private boolean insured;
    private BigDecimal declaredGoodsValue;
    private BigDecimal agreedGoodsValue;
    private BigDecimal planCoverageLimit;
    private BigDecimal coverageCap;
}

package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * DTO danh sách hợp đồng quá hạn cho Facility Manager (UC-28 / PR-Q11)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OverdueContractManagerResponse {
    private Integer contractId;
    private String contractCode;
    private String customerName;
    private String customerPhone;
    private String storageUnitId;
    private String unitTypeName;
    private LocalDate endDate;
    private Long overdueDays;
    private BigDecimal lateFeeAmount;
    private BigDecimal depositHeldAmount;
    private Boolean canLiquidate;
    private Integer liquidationDaysThreshold;
    private Integer contactCount;
    private String lastContactNote;
    private LocalDateTime lastContactAt;
    private String status;

    @com.fasterxml.jackson.annotation.JsonProperty("refundRequested")
    private Boolean refundRequested;

    // Flow 6: FM đã miễn phí trễ cho đợt quá hạn này (kèm lý do, người, thời điểm)
    private Boolean lateFeeWaived;
    private String lateFeeWaiverNote;

    // Điều khoản xử lý tài sản: số lần liên hệ tối thiểu trước khi thanh lý + phiên bản khách đã đồng ý (NULL = đơn cũ)
    private Integer minContactsRequired;
    private String termsVersion;
}


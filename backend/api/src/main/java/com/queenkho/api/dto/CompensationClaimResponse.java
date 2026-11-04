package com.queenkho.api.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

// BR-126 → BR-128: hồ sơ bồi thường hàng hư / mất (khách xem trong ticket hỗ trợ, FM / BOM xem ở màn Bồi thường)
@Getter
@Builder
public class CompensationClaimResponse {
    private Integer id;
    private String claimCode;
    private String claimType;            // GOODS_DAMAGE / GOODS_LOSS
    private String status;               // SUBMITTED / INSPECTED / APPROVED / PAID / REJECTED / WITHDRAWN
    private LocalDateTime createdAt;
    private LocalDate incidentDate;
    private String itemsDescription;
    private BigDecimal claimedAmount;
    private List<String> customerImages;

    // Ticket + hợp đồng
    private Integer ticketId;
    private String ticketCode;
    private String ticketStatus;
    private Integer contractId;
    private String contractCode;
    private String contractStatus;
    private Integer reservationId;
    private String storageUnitId;
    private String unitTypeName;
    private BigDecimal monthlyPrice;
    private Integer facilityId;
    private String facilityName;
    private Integer customerId;
    private String customerName;
    private String customerPhone;

    // Bảo hiểm của hợp đồng (BR-125)
    private String insurancePlan;
    private String insurancePlanLabel;
    private boolean insured;
    private BigDecimal declaredGoodsValue;
    private BigDecimal planCoverageLimit;

    // Kiểm tra hiện trường
    private String inspectedByName;
    private LocalDateTime inspectedAt;
    private String inspectionNote;
    private List<String> inspectionImages;
    private String preliminaryCause;

    // Quyết định
    private String liableParty;
    private BigDecimal assessedValue;
    private Integer damagePercent;
    private Integer unusableDays;
    private BigDecimal coverageCap;
    private BigDecimal goodsCompensation;
    private BigDecimal penaltyAmount;
    private BigDecimal rentRefundAmount;
    private BigDecimal totalCompensation;
    private String resolution;
    private String decisionNote;
    private String decidedByName;
    private LocalDateTime decidedAt;

    // Chi trả
    private String paymentMethod;
    private String paymentEvidence;
    private String bankTransactionCode;
    private String paidByName;
    private LocalDateTime paidAt;

    // Đòi bên bảo hiểm
    private String insuranceStatus;
    private String insuranceRef;
    private BigDecimal insuranceAmount;
    private LocalDateTime insuranceUpdatedAt;
}

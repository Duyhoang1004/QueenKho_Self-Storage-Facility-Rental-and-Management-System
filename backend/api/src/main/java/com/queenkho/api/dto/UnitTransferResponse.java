package com.queenkho.api.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

// BR-122: 1 lần chuyển ô của hợp đồng
@Getter
@Builder
public class UnitTransferResponse {
    private Integer id;
    private Integer contractId;
    private String contractCode;
    private String fromUnitId;
    private String toUnitId;
    private String reasonType;
    private String reason;
    private String oldUnitStatus;
    private String movedByName;
    private LocalDateTime createdAt;
}

package com.queenkho.api.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

// UC-18: biên bản bàn giao (xem lại ở trang chi tiết task)
@Getter
@Builder
public class HandoverRecordResponse {
    private Integer id;
    private String recordType;   // CHECK_IN / CHECK_OUT
    private Boolean identityVerified;
    private Boolean unitEmpty;
    private Boolean unitClean;
    private Boolean lockIntact;
    private Boolean customerSignatureConfirmed;
    private String notes;
    private Integer staffId;
    private String staffName;
    private LocalDateTime createdAt;
}

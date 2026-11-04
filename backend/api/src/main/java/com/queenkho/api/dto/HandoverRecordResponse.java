package com.queenkho.api.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;

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
    private Integer staffId;     // null khi khách tự check-in online
    private String staffName;
    private LocalDateTime createdAt;
    private List<String> evidenceImages;  // BR-121
    private String checkInMethod;         // BR-124: COUNTER / ONLINE
    private String contractCode;
}

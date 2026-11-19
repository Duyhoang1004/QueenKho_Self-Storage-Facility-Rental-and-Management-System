package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnitAccessSummaryResponse {
    private Integer contractId;
    private String contractCode;
    private String storageUnitId;
    private String roomNumber;
    private String deviceCode;
    private String deviceModel;          // "SMARTLOCK PRO-X5"
    private Integer batteryPercentage;   // 95
    private Boolean isDoorLocked;        // true
    private Boolean isAccessBlocked;     // true nếu hợp đồng bị khóa PIN / quá hạn
    private String blockReason;          // Lý do nếu bị khóa
    private String currentPinCode;       // PIN hiện tại
    private String currentRfidCode;      // RFID hiện tại
    private List<UnitAccessLogResponse> logs;
}

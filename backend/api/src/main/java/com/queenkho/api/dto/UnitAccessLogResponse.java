package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnitAccessLogResponse {
    private Long id;
    private Integer contractId;
    private String storageUnitId;
    private String accessMethod;       // "PIN", "RFID"
    private String credentialCode;     // Mã PIN hoặc RFID đã dùng
    private String deviceCode;         // "SMARTLOCK-B204"
    private String status;             // "SUCCESS", "DENIED"
    private String failureReason;      // Lý do từ chối nếu có
    private Integer batteryPercentage; // Pin của khóa (%)
    private LocalDateTime accessedAt;
    private String notes;              // Ghi chú trạng thái chốt cửa
}

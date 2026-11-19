package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SimulateAccessRequest {
    private String accessMethod; // "PIN" hoặc "RFID"
    private Boolean isInvalid;   // true nếu giả lập nhập sai mã / thẻ lạ không hợp lệ
}

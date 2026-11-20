package com.queenkho.api.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// D-21 / PR-O22: khách "Không đồng ý" (reason) · FM "Giữ nguyên" (note) · FM "Giao lại nhân viên" (note, staffId tuỳ chọn)
@Getter
@Setter
@NoArgsConstructor
public class SettlementActionRequest {
    private String reason;
    private String note;
    private Integer staffId;
}

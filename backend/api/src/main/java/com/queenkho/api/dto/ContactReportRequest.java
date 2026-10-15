package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ContactReportRequest {
    private String callOutcome;
    private String note;
    private Integer staffId;
}

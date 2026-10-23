package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateSupportRequestDto {
    private Integer contractId;
    private String issueType;   // LOCK_ISSUE, SECURITY, FACILITY_DAMAGE, CLEANING, OTHER
    private String description; // 10 - 1000 chars
}

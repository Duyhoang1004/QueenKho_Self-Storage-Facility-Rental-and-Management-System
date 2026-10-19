package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO cho thao tác Quản lý cơ sở thanh lý hợp đồng quá hạn (UC-28 / PR-Q8, PR-Q10)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LiquidateContractRequest {
    private Integer managerId;
    private String note;
}


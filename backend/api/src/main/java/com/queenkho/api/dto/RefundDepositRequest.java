package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO cho thao tác yêu cầu hoàn phần cọc còn lại sau thanh lý (UC-28 / PR-Q9)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RefundDepositRequest {
    private Integer managerId;
}


package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body cho việc ghi chú liên hệ khách hàng hợp đồng quá hạn (UC-28 / PR-Q11 / PR-A8)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateOverdueContactRequest {
    private Integer managerId;
    private String note;
}


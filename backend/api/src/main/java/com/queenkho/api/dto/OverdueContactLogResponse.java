package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO hiển thị danh sách các lần liên hệ với khách hàng quá hạn (UC-28 / PR-Q11 / PR-A8)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OverdueContactLogResponse {
    private Integer id;
    private Integer managerId;
    private String managerName;
    private LocalDateTime createdAt;
    private String note;
}


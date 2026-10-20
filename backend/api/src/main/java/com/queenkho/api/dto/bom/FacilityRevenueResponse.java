package com.queenkho.api.dto.bom;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

// UC-29: Doanh thu phân bổ theo từng cơ sở kho
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FacilityRevenueResponse {

    private Integer facilityId;
    private String facilityName;

    // Tổng doanh thu (thuê + phí - hoàn) của cơ sở trong kỳ
    private BigDecimal revenue;

    // % đóng góp so với toàn hệ thống
    private double percentage;

    // Số ô kho đang có hợp đồng ACTIVE / OVERDUE
    private int activeUnits;

    // Tỷ lệ lấp đầy của cơ sở (%)
    private double occupancyRate;
}

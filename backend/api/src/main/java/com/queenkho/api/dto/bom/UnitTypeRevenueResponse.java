package com.queenkho.api.dto.bom;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

// UC-29: Doanh thu phân bổ theo loại khoang lưu trữ
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnitTypeRevenueResponse {

    private Integer typeId;
    private String typeName;

    // Tổng doanh thu thuê của loại kho này
    private BigDecimal revenue;

    // % đóng góp so với toàn hệ thống
    private double percentage;

    // Tổng số hợp đồng đang thuê loại kho này
    private int totalRented;
}

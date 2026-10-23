package com.queenkho.api.dto;

import lombok.*;
import java.math.BigDecimal;

/**
 * DTO dành cho BOM Portal - Quản lý danh mục loại kho & giá niêm yết (UC-05, PR-M3, PR-M4, PR-12)
 */
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@Builder
public class BomUnitTypeResponse {
    private Integer id;
    private String name;
    private BigDecimal areaSqm;
    private BigDecimal volumeCbm;
    private BigDecimal basePriceMonthly;
    private String suggestedCapacity;
    private String dimensions;
    private String features;
    private String status;              // ACTIVE / INACTIVE (PR-M4)

    // Thống kê số lượng ô kho
    private long totalUnits;            // Tổng số ô kho thuộc loại này
    private long availableUnits;        // Số ô đang trống (AVAILABLE)
    private long occupiedUnits;         // Số ô đang có người thuê (OCCUPIED)
    private long maintenanceUnits;      // Số ô đang bảo trì (MAINTENANCE)
    private long reservedUnits;         // Số ô đang chờ/giữ chỗ (RESERVED)

    // Số lượng đơn đặt chỗ từng gắn loại này
    private long totalReservations;

    // PR-M4: Chỉ xoá được loại chưa từng có ô kho và chưa từng có đơn đặt chỗ
    private boolean canDelete;
}

package com.queenkho.api.dto.bom;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// UC-29 (PR-M7): Báo cáo tỷ lệ lấp đầy và vận hành kho toàn hệ thống
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OccupancyReportResponse {

    // Tổng số ô kho trong hệ thống
    private int totalUnits;

    // Số ô đang có hợp đồng (ACTIVE / OVERDUE)
    private int occupiedUnits;

    // Số ô trống sẵn sàng cho thuê
    private int availableUnits;

    // Số ô đang bảo trì / không cho thuê
    private int maintenanceUnits;

    // Tỷ lệ lấp đầy = occupiedUnits / (totalUnits - maintenanceUnits) * 100
    private double occupancyRate;

    // Số hợp đồng mới trong kỳ
    private int newContracts;

    // Số hợp đồng kết thúc trong kỳ
    private int terminatedContracts;

    // Tỷ lệ khách tái ký (gia hạn / tổng kết thúc)
    private double retentionRate;
}

package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StorageUnitDetailResponse {
    private String id;
    private Integer facilityId;
    private String facilityName;
    private String facilityCode;
    private Integer unitTypeId;
    private String unitTypeName;
    private BigDecimal areaSqm;
    private BigDecimal volumeCbm;
    private BigDecimal basePriceMonthly;
    private String floor;
    private String zone;
    private String roomNumber;
    private String status; // AVAILABLE, OCCUPIED, MAINTENANCE
    private boolean overdue; // true if current contract is OVERDUE
    private CurrentContractInfo currentContract;
    private boolean canDelete; // true only if never had any rental contract in history
    // PR-O10: ô MAINTENANCE có task bảo trì đang mở → FE hiện "Chờ sửa (task #id)" thay vì ô FM tự khoá
    private Integer maintenanceTaskId;
    private String maintenanceReason; // DAMAGE (sự cố sau trả kho) / LIQUIDATION (dọn kho sau thanh lý)

    // UC-06 mặt bằng: vị trí theo ô lưới 0.5m (null = chưa đặt) + kích thước mặc định theo loại kho
    private Integer mapX;
    private Integer mapY;
    private Integer mapW;
    private Integer mapH;
    private String mapDoor;
    private Integer defaultMapW;
    private Integer defaultMapH;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CurrentContractInfo {
        private Integer contractId;
        private String contractCode;
        private Integer customerId;
        private String customerName;
        private String customerPhone;
        private LocalDate startDate;
        private LocalDate endDate;
        private String contractStatus;
    }
}


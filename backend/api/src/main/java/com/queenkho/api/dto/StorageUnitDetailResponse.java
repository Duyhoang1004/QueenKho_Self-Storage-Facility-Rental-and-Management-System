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
    // (08/11/2026) Ô "sắp trống" (PR-R11): hợp đồng đã hẹn trả / quá hạn / qua hạn chót gia hạn → ngày ô giao được cho khách mới
    private boolean releasing;
    private LocalDate releaseDate;
    private CurrentContractInfo currentContract;
    // D-18: ngày ô giao lại được cho khách sau khi hợp đồng hiện tại kết thúc (đã cộng ngày dọn ô)
    private LocalDate freeFrom;
    // D-18: các hợp đồng đã gán trước, khách nhận kho sau hôm nay (ô vẫn AVAILABLE tới ngày đó)
    private java.util.List<UpcomingContractInfo> upcomingContracts;
    // D-18: ô đang gắn hợp đồng còn hiệu lực (kể cả hợp đồng tương lai) → khoá sửa thông tin / vị trí trên mặt bằng
    private boolean locked;
    // BR-140 (12/11/2026): ô kho khẩn cấp — không bán, chỉ dùng khi ô của khách gặp sự cố
    private boolean emergency;
    // D-18: cảnh báo lịch — ô bảo trì nhưng có khách sắp nhận, hoặc 2 hợp đồng trùng ngày
    private String scheduleWarning;
    private boolean canDelete; // true only if never had any rental contract in history
    // PR-O10: ô MAINTENANCE có task bảo trì đang mở → FE hiện "Chờ sửa (task #id)" thay vì ô FM tự khoá
    private Integer maintenanceTaskId;
    private String maintenanceReason; // DAMAGE (sự cố sau trả kho) / LIQUIDATION (dọn kho sau thanh lý)
    // PR-M9: ghi chú FM nhập khi tự chuyển ô sang Bảo trì
    private String maintenanceNote;
    private java.time.LocalDateTime maintenanceSince;

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


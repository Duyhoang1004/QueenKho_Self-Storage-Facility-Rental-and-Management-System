package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * UC-06: Vị trí ô kho của 1 hợp đồng trên mặt bằng — bản CHỈ XEM cho khách / nhân viên.
 * Ô khác trên tầng chỉ có hình khối (không mã ô, không trạng thái, không tên khách).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnitLocationResponse {
    private Integer contractId;
    private String unitId;
    private String unitTypeName;
    private BigDecimal areaSqm;
    private String facilityName;
    private String floor;
    private String zone;
    private String roomNumber;
    private String locationHint;   // "Tầng 1 · Khu A · Phòng 103 · cửa quay ra Lối đi A – B"
    private boolean placed;        // false = ô chưa đặt trên mặt bằng hoặc tầng chưa có mặt bằng
    private Rect unit;             // vị trí ô của hợp đồng (null khi chưa đặt)
    private String door;           // TOP / BOTTOM / LEFT / RIGHT
    private FloorPlan floorPlan;   // null khi chưa đặt

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Rect {
        private Integer x;
        private Integer y;
        private Integer w;
        private Integer h;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FloorPlan {
        private String name;
        private Integer gridWidth;
        private Integer gridHeight;
        private double cellMeters;
        private List<FloorFixtureDto> fixtures;
        private List<Rect> otherUnits;
    }
}

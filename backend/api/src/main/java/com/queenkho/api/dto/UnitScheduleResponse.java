package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * D-18 (08/11/2026): lịch chiếm dụng ô kho của 1 cơ sở trong khoảng [from, to) — FM xem khoảng nào đã có khách đặt,
 * khoảng nào còn trống (popup "Lịch ô kho"). Ngày dạng yyyy-MM-dd; "to" của mỗi khoảng là ngày đầu tiên ô rảnh lại (không tính).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnitScheduleResponse {
    private Integer facilityId;
    private String facilityName;
    private LocalDate from;
    private LocalDate to;
    private LocalDate today;
    private int cleanupDays;
    private List<UnitRow> units;
    // Đơn đã cọc, chưa gán ô — FM thấy nhu cầu sắp tới để chọn ô có khoảng trống vừa khít
    private List<PendingDemand> pendingReservations;
    private int conflictCount;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UnitRow {
        private String unitId;
        private Integer unitTypeId;
        private String unitTypeName;
        private String floor;
        private String zone;
        private String roomNumber;
        private String status;
        private String maintenanceNote;
        private LocalDateTime maintenanceSince;
        private List<BookingBar> bookings;
        private List<FreeRange> freeRanges;
        private boolean conflict;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BookingBar {
        private Integer contractId;
        private String contractCode;
        private Integer reservationId;
        private String reservationCode;
        private String customerName;
        private String status;          // PENDING_CHECK_IN / ACTIVE / TERMINATION_PENDING / OVERDUE
        private LocalDate startDate;
        private LocalDate endDate;
        private LocalDate freeFrom;     // ngày ô giao được cho khách sau (đã cộng ngày dọn ô)
        private boolean mayRenew;       // ACTIVE chưa qua hạn chót gia hạn ưu tiên → khách còn gia hạn được
        private boolean conflict;
        private String note;            // lý do trùng lịch / cảnh báo
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FreeRange {
        private LocalDate from;
        private LocalDate to;           // null = trống tới hết khoảng xem và chưa có ai đặt sau đó
        private Long days;              // null khi to = null
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PendingDemand {
        private Integer reservationId;
        private String reservationCode;
        private String customerName;
        private Integer unitTypeId;
        private String unitTypeName;
        private LocalDate startDate;
        private LocalDate endDate;
        private Integer durationMonths;
    }
}

package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

// D-18: trang đặt kho hỏi "khoảng ngày khách chọn còn bao nhiêu ô trống" (chỉ trả số lượng, không lộ từng ô — D-17)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RangeAvailabilityResponse {
    private Integer facilityId;
    private Integer unitTypeId;
    private LocalDate startDate;
    private LocalDate endDate;
    private int durationMonths;
    private int freeSlots;
    private boolean available;
    private LocalDate maxStartDate;   // ngày nhận kho xa nhất được đặt (hôm nay + 90 ngày)
    private String message;
}

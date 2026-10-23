package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

// UC-32: DTO thông tin nhân viên cơ sở (hiển thị trên trang /manager/staff)
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@Builder
public class FacilityStaffResponse {
    private Integer id;
    private String fullName;
    private String email;
    private String phone;
    private String status;                      // ACTIVE, LOCKED, DISABLED
    private int activeTasksCount;               // Số task đang thực hiện (IN_PROGRESS)
    private int completedTasksThisMonthCount;   // Số task đã hoàn thành trong tháng hiện tại
    private Integer facilityId;
    private String facilityName;
    private LocalDateTime createdAt;
}

